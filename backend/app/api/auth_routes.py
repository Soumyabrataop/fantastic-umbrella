"""Google OAuth authentication routes for Drive access."""

from __future__ import annotations

import logging
import os
import secrets
from datetime import datetime, timezone
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import RedirectResponse
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.settings import Settings, get_settings
from app.db.models import Profile
from app.db.session import get_session
from app.services.auth import AuthenticatedUser, get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth/google", tags=["Google OAuth"])

# In-memory state storage (in production, use Redis or database)
_oauth_states: dict[str, dict[str, str]] = {}


class GoogleOAuthStatusResponse(BaseModel):
    """Response for checking if user has connected Google Drive."""
    is_connected: bool
    email: str | None = None


class GoogleOAuthDisconnectResponse(BaseModel):
    """Response for disconnecting Google Drive."""
    success: bool
    message: str


@router.get("/status", response_model=GoogleOAuthStatusResponse)
async def google_oauth_status(
    user: AuthenticatedUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> GoogleOAuthStatusResponse:
    """Check if user has connected their Google Drive."""
    stmt = select(Profile).where(Profile.id == user.id)
    result = await session.execute(stmt)
    profile = result.scalar_one_or_none()
    
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found")
    
    is_connected = bool(profile.google_access_token and profile.google_refresh_token)
    
    return GoogleOAuthStatusResponse(
        is_connected=is_connected,
        email=profile.email if is_connected else None,
    )


@router.get("/login")
async def google_oauth_login(
    user: AuthenticatedUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
) -> RedirectResponse:
    """
    Initiate Google OAuth flow for Drive access.
    
    Redirects user to Google consent screen to authorize Drive access.
    """
    # Generate state token for CSRF protection
    state = secrets.token_urlsafe(32)
    _oauth_states[state] = {"user_id": str(user.id)}
    
    # Build Google OAuth URL
    auth_url = "https://accounts.google.com/o/oauth2/v2/auth"
    params = {
        "client_id": settings.google_client_id,
        "redirect_uri": settings.google_redirect_uri,
        "response_type": "code",
        # Include 'openid' to avoid scope mismatch (Google may append it)
        "scope": "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email openid",
        "access_type": "offline",  # Get refresh token
        "prompt": "consent",  # Force consent screen to ensure refresh token
        "state": state,
    }
    
    google_url = f"{auth_url}?{urlencode(params)}"
    logger.info(f"Redirecting user {user.id} to Google OAuth consent screen")
    
    return RedirectResponse(url=google_url)


@router.post("/initiate")
async def google_oauth_initiate(
    user: AuthenticatedUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
) -> dict:
    """
    Initiate Google OAuth flow and return the consent screen URL as JSON.

    This endpoint is intended for XHR requests where the Authorization bearer
    token is included (for example via the Next.js proxy). The frontend can
    POST here, receive the Google consent URL, and then redirect the browser
    to that URL. Returning JSON allows the frontend to ensure the backend
    received the authenticated user context.
    """
    # Generate state token for CSRF protection
    state = secrets.token_urlsafe(32)
    _oauth_states[state] = {"user_id": str(user.id)}

    # Build Google OAuth URL
    auth_url = "https://accounts.google.com/o/oauth2/v2/auth"
    params = {
        "client_id": settings.google_client_id,
        "redirect_uri": settings.google_redirect_uri,
        "response_type": "code",
        # Include 'openid' to avoid scope mismatch
        "scope": "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email openid",
        "access_type": "offline",
        "prompt": "consent",
        "state": state,
    }

    google_url = f"{auth_url}?{urlencode(params)}"
    logger.info(f"Created Google OAuth URL for user {user.id}")
    return {"url": google_url}


@router.get("/callback")
async def google_oauth_callback(
    code: str = Query(..., description="OAuth authorization code"),
    state: str = Query(..., description="State token for CSRF protection"),
    session: AsyncSession = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> RedirectResponse:
    """
    Handle Google OAuth callback and store tokens.
    
    Called by Google after user authorizes Drive access.
    """
    # Verify state token
    if state not in _oauth_states:
        logger.error(f"Invalid OAuth state token: {state}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid state token")
    
    state_data = _oauth_states.pop(state)
    user_id = state_data["user_id"]
    
    try:
        # Exchange authorization code for tokens
        logger.info(f"Exchanging OAuth code for tokens for user {user_id}")
        
        from google_auth_oauthlib.flow import Flow
        
        flow = Flow.from_client_config(
            {
                "web": {
                    "client_id": settings.google_client_id,
                    "client_secret": settings.google_client_secret,
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                    "redirect_uris": [settings.google_redirect_uri],
                }
            },
            scopes=[
                "https://www.googleapis.com/auth/drive.file",
                "https://www.googleapis.com/auth/userinfo.email",
                "openid",
            ],
        )
        flow.redirect_uri = settings.google_redirect_uri
        
        # Fetch tokens
        flow.fetch_token(code=code)
        credentials = flow.credentials
        
        # Get user email from Google
        user_info_service = build('oauth2', 'v2', credentials=credentials)
        user_info = user_info_service.userinfo().get().execute()
        user_email = user_info.get('email')
        
        # Store tokens in database
        stmt = select(Profile).where(Profile.id == user_id)
        result = await session.execute(stmt)
        profile = result.scalar_one_or_none()
        
        if not profile:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found")
        
        profile.google_access_token = credentials.token
        profile.google_refresh_token = credentials.refresh_token
        profile.google_token_expiry = credentials.expiry
        if user_email:
            profile.email = user_email
        
        session.add(profile)
        await session.commit()
        
        logger.info(f"Successfully stored Google OAuth tokens for user {user_id}")
        
        # Redirect to frontend create page with success parameter
        frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:3000")
        return RedirectResponse(url=f"{frontend_url}/create?google_drive_connected=true")
        
    except Exception as e:
        logger.error(f"Failed to complete OAuth flow for user {user_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to connect Google Drive: {str(e)}"
        )


@router.post("/disconnect", response_model=GoogleOAuthDisconnectResponse)
async def google_oauth_disconnect(
    user: AuthenticatedUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> GoogleOAuthDisconnectResponse:
    """
    Disconnect Google Drive and remove stored tokens.
    """
    stmt = select(Profile).where(Profile.id == user.id)
    result = await session.execute(stmt)
    profile = result.scalar_one_or_none()
    
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found")
    
    # Clear tokens
    profile.google_access_token = None
    profile.google_refresh_token = None
    profile.google_token_expiry = None
    
    session.add(profile)
    await session.commit()
    
    logger.info(f"Disconnected Google Drive for user {user.id}")
    
    return GoogleOAuthDisconnectResponse(
        success=True,
        message="Google Drive disconnected successfully"
    )
