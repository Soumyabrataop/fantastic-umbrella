from __future__ import annotations

import json
import logging
import secrets
from typing import Any, Dict, Tuple
from uuid import uuid4

import httpx

from app.core.settings import Settings, get_settings
from app.schemas.video import CheckVideoStatusRequest, GenerateVideoRequest
from app.services.multi_account_cookies import MultiAccountCookieManager
from app.utils.cookie_loader import CookieCredentials, load_cookie_credentials

logger = logging.getLogger("uvicorn.error").getChild("flow_client")

_DEFAULT_HEADERS = {
    "accept": "*/*",
    "accept-language": "en-GB,en;q=0.9,mr-IN;q=0.8,mr;q=0.7,en-US;q=0.6,hi;q=0.5",
    "content-type": "text/plain;charset=UTF-8",
    "priority": "u=1, i",
    "referer": "https://labs.google/",
    "sec-ch-ua": '"Google Chrome";v="141", "Not?A_Brand";v="8", "Chromium";v="141"',
    "sec-ch-ua-mobile": "?1",
    "sec-ch-ua-platform": '"Android"',
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "cross-site",
    "x-browser-channel": "stable",
    "x-browser-validation": "AGaxImjg97xQkd0h3geRTArJi8Y=",
    "x-browser-year": "2025",
    "x-client-data": "CJW2yQEIorbJAQipncoBCMCIywEIlKHLAQiwpMsBCIWgzQE=",
}


class FlowClient:
    def __init__(self, settings: Settings | None = None) -> None:
        self._settings_override = settings
        self._cookie_manager: MultiAccountCookieManager | None = None

    def _get_cookie_manager(self, settings: Settings) -> MultiAccountCookieManager:
        """Get or create the multi-account cookie manager"""
        if self._cookie_manager is None:
            self._cookie_manager = MultiAccountCookieManager(
                cookie_file=settings.flow_cookie_file,
                emails=settings.google_emails,
                passwords=settings.google_passwords
            )
        return self._cookie_manager

    async def generate_video(self, request: GenerateVideoRequest) -> Dict[str, Any]:
        settings = self._settings_override or get_settings()
        cookie_manager = self._get_cookie_manager(settings)
        
        # Try with current account, rotate on failure
        max_attempts = min(len(settings.google_emails), 3)  # Try up to 3 accounts
        last_error = None
        
        for attempt in range(max_attempts):
            try:
                credentials = await self._get_credentials(cookie_manager)
                payload = self._build_generate_payload(settings, request)
                response, headers, request_id = await self._post(settings.flow_generate_url, payload, credentials)
                
                # Success! Mark account as healthy
                account = cookie_manager.get_current_account()
                logger.info(f"Video generation successful with account: {account['email']}")
                
                if not response:
                    operation_name = _extract_operation_from_headers(headers)
                    if not operation_name:
                        logger.error(
                            "Flow generate_video returned empty response",
                            extra={"payload": payload, "headers": headers},
                        )
                        return {}

                    scene_id = None
                    try:
                        scene_id = payload["requests"][0]["metadata"]["sceneId"]
                    except (KeyError, IndexError, TypeError):
                        scene_id = None

                    operation_entry: Dict[str, Any] = {
                        "operation": {"name": operation_name},
                        "sceneId": scene_id,
                        "status": "MEDIA_GENERATION_STATUS_PENDING",
                    }
                    if request_id:
                        operation_entry["metadata"] = {"xRequestId": request_id}

                    response = {"operations": [operation_entry]}
                return response
                
            except httpx.HTTPStatusError as e:
                account = cookie_manager.get_current_account()
                logger.warning(f"Account {account['email']} failed on attempt {attempt + 1}: {e}")
                cookie_manager.mark_account_failure()
                last_error = e
                
                # Rotate to next account if more attempts available
                if attempt < max_attempts - 1:
                    if cookie_manager.rotate_to_next_account():
                        logger.info(f"Rotated to next account, retrying...")
                        continue
                    else:
                        logger.error("No healthy accounts available for rotation")
                        break
            except Exception as e:
                account = cookie_manager.get_current_account()
                logger.error(f"Unexpected error with account {account['email']}: {e}")
                last_error = e
                break
        
        # All attempts failed
        if last_error:
            raise last_error
        raise RuntimeError("Video generation failed after all account attempts")

    async def check_video_status(self, request: CheckVideoStatusRequest) -> Dict[str, Any]:
        settings = self._settings_override or get_settings()
        cookie_manager = self._get_cookie_manager(settings)
        
        # Status checks typically use the same account as generation
        credentials = await self._get_credentials(cookie_manager)
        payload = self._build_status_payload(request)
        response, headers, _ = await self._post(settings.flow_status_url, payload, credentials)
        if not response:
            logger.error(
                "Flow check_video_status returned empty response",
                extra={"payload": payload, "headers": headers},
            )
        return response

    async def _get_credentials(self, cookie_manager: MultiAccountCookieManager) -> CookieCredentials:
        """
        Get credentials for the current account
        
        Fetches access token from Google session API if not present in cookies
        """
        current_cookies = cookie_manager.get_current_cookies()
        account = cookie_manager.get_current_account()
        
        if not current_cookies:
            # Fallback: load from legacy cookie file
            logger.warning(f"No cookies for account {account['email']}, using legacy cookie file")
            settings = self._settings_override or get_settings()
            return load_cookie_credentials(settings.flow_cookie_file)
        
        # Check if we have a valid authorization token
        bearer_token = current_cookies.get("authorization", "")
        
        if not bearer_token or bearer_token.strip() == "":
            # Need to fetch access token from Google session API
            logger.info(f"Fetching access token for {account['email']}")
            
            try:
                from app.services.token_refresher import TokenRefresher
                settings = self._settings_override or get_settings()
                token_refresher = TokenRefresher(settings)
                
                # Fetch session data (includes access token)
                session_data = await token_refresher.fetch_session(current_cookies)
                
                # Add token to cookies
                current_cookies = token_refresher.persist_token_to_cookies(
                    account['email'],
                    session_data,
                    current_cookies
                )
                
                # Update cookie manager with new token
                cookie_manager.update_cookies(
                    account['email'],
                    current_cookies,
                    session_data.expires.isoformat()
                )
                
                bearer_token = session_data.access_token
                logger.info(f"✅ Access token fetched for {account['email']}")
                
            except Exception as e:
                logger.error(f"Failed to fetch access token for {account['email']}: {e}")
                raise RuntimeError(f"Failed to fetch access token: {e}") from e
        
        return CookieCredentials(
            cookies=current_cookies,
            bearer_token=bearer_token
        )

    async def _post(
        self, url: str, payload: Dict[str, Any], credentials: CookieCredentials
    ) -> Tuple[Dict[str, Any], Dict[str, str], str | None]:
        headers = {**_DEFAULT_HEADERS, "authorization": _format_bearer(credentials)}

        async with httpx.AsyncClient(timeout=httpx.Timeout(30.0)) as client:
            response = await client.post(
                url,
                headers=headers,
                cookies=credentials.cookies,
                content=json.dumps(payload),
            )

        snippet_success = response.text.strip()
        headers_out = {k.lower(): v for k, v in response.headers.items()}
        request_id = headers_out.get("x-request-id") or headers_out.get("x-flow-request-id")
        if response.status_code < 400 and (not snippet_success or snippet_success.lower() == "null"):
            logger.warning(
                "Flow returned empty body",
                extra={
                    "status_code": response.status_code,
                    "headers": headers_out,
                    "payload": payload,
                },
            )

        if response.status_code >= 400:
            snippet = response.text.strip()
            if len(snippet) > 500:
                snippet = snippet[:497] + "..."
            message = f"Flow API call failed ({response.status_code}): {snippet or 'no response body'}"
            logger.error(
                "Flow request rejected",
                extra={
                    "status_code": response.status_code,
                    "payload": payload,
                    "response": snippet,
                    "project_id": payload.get("clientContext", {}).get("projectId"),
                    "model_key": payload.get("requests", [{}])[0].get("videoModelKey"),
                    "aspect_ratio": payload.get("requests", [{}])[0].get("aspectRatio"),
                },
            )
            raise httpx.HTTPStatusError(message, request=response.request, response=response)

        if not snippet_success or snippet_success.lower() == "null":
            return {}, headers_out, request_id

        try:
            return response.json(), headers_out, request_id
        except ValueError as exc:
            raise RuntimeError("Flow API returned a non-JSON payload") from exc

    def _build_generate_payload(self, settings: Settings, request: GenerateVideoRequest) -> Dict[str, Any]:
        seed = request.seed if request.seed is not None else secrets.randbelow(1_000_000)
        scene_id = request.scene_id or str(uuid4())
        model_key = request.video_model_key or settings.flow_default_video_model
        aspect_ratio = request.aspect_ratio or settings.flow_default_aspect_ratio

        return {
            "clientContext": {
                "projectId": settings.flow_project_id,
                "tool": "PINHOLE",
                "userPaygateTier": settings.flow_user_paygate_tier,
            },
            "requests": [
                {
                    "aspectRatio": aspect_ratio,
                    "seed": seed,
                    "textInput": {"prompt": request.prompt},
                    "videoModelKey": model_key,
                    "metadata": {"sceneId": scene_id},
                }
            ],
        }

    def _build_status_payload(self, request: CheckVideoStatusRequest) -> Dict[str, Any]:
        operation = {
            "operation": {"name": request.operation_name},
            "sceneId": request.scene_id,
        }
        if request.status:
            operation["status"] = request.status

        return {"operations": [operation]}


def _format_bearer(credentials: CookieCredentials) -> str:
    token = credentials.bearer_token
    return token if token.lower().startswith("bearer ") else f"Bearer {token}"


def _extract_operation_from_headers(headers: Dict[str, str] | None) -> str | None:
    if not headers:
        return None
    for key in ("x-goog-operation-name", "x-operation-name", "x-flow-operation-name"):
        value = headers.get(key)
        if value:
            return value
    params = headers.get("x-goog-request-params")
    if params:
        for part in params.split("&"):
            if part.startswith("name="):
                candidate = part.split("=", 1)[1]
                if candidate:
                    return candidate.rsplit("/", 1)[-1]
    location = headers.get("location") if headers else None
    if location and "/" in location:
        return location.rsplit("/", 1)[-1]
    return None
