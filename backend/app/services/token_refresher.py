"""
Token Refresher Service
Fetches OAuth access tokens from Google Labs session API using cookies
"""
from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import TYPE_CHECKING, Any, Dict

import httpx

if TYPE_CHECKING:
    from app.core.settings import Settings

logger = logging.getLogger("uvicorn.error").getChild("token_refresher")

SESSION_URL = "https://labs.google/fx/api/auth/session"

DEFAULT_HEADERS: Dict[str, str] = {
    "accept": "application/json, text/plain, */*",
    "accept-language": "en-GB,en;q=0.9,en-US;q=0.8",
    "referer": "https://labs.google/",
    "sec-ch-ua": '"Google Chrome";v="141", "Not?A_Brand";v="8", "Chromium";v="141"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
}


@dataclass
class SessionData:
    access_token: str
    expires: datetime
    user: Dict[str, Any]


class CookieExpiredError(Exception):
    """Raised when session cookies are expired or invalid."""
    pass


class TokenRefresher:
    """Fetches and manages OAuth access tokens from Google Labs"""
    
    def __init__(self, settings: "Settings") -> None:
        self.settings = settings

    async def fetch_session(self, cookies: Dict[str, str]) -> SessionData:
        """
        Fetch session data from Google Labs API
        
        Args:
            cookies: Dictionary of cookie name-value pairs
            
        Returns:
            SessionData with access token and expiry
            
        Raises:
            CookieExpiredError: If cookies are expired or invalid
            RuntimeError: If API request fails
        """
        headers = {**DEFAULT_HEADERS, "cookie": self._format_cookie_header(cookies)}

        async with httpx.AsyncClient(timeout=httpx.Timeout(15.0)) as client:
            response = await client.get(SESSION_URL, headers=headers)

        if response.status_code >= 400:
            raise RuntimeError(f"Session fetch failed ({response.status_code}): {response.text}")

        payload = response.json()
        
        # Check if session API returned empty object or missing fields (indicates expired cookies)
        if not payload or "access_token" not in payload:
            raise CookieExpiredError("Session API returned empty/invalid response - cookies likely expired")
        
        try:
            expires = datetime.fromisoformat(payload["expires"].replace("Z", "+00:00"))
            return SessionData(
                access_token=payload["access_token"],
                expires=expires,
                user=payload.get("user", {}),
            )
        except KeyError as exc:
            raise CookieExpiredError(f"Session payload missing field: {exc}") from exc

    def persist_token_to_cookies(self, email: str, session: SessionData, cookies: Dict[str, str]) -> Dict[str, str]:
        """
        Add the access token to cookies dictionary
        
        Args:
            email: Account email
            session: Session data with access token
            cookies: Existing cookies dictionary
            
        Returns:
            Updated cookies dictionary with authorization token
        """
        # Add or update authorization cookie
        cookies["authorization"] = session.access_token
        logger.info(f"Added authorization token for {email} (expires: {session.expires.isoformat()})")
        return cookies

    def _format_cookie_header(self, cookies: Dict[str, str]) -> str:
        """Format cookies as HTTP Cookie header"""
        return "; ".join(f"{name}={value}" for name, value in cookies.items())

    def seconds_until_expiry(self, session: SessionData, margin_seconds: int = 60) -> float:
        """Calculate seconds until token expires (with margin)"""
        now = datetime.now(timezone.utc)
        target = session.expires - timedelta(seconds=margin_seconds)
        return max((target - now).total_seconds(), 0.0)
