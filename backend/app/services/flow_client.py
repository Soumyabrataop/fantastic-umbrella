from __future__ import annotations

import json
import secrets
from typing import Any, Dict
from uuid import uuid4

import httpx

from app.core.settings import Settings, get_settings
from app.schemas.video import CheckVideoStatusRequest, GenerateVideoRequest
from app.utils.cookie_loader import CookieCredentials, load_cookie_credentials

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

    async def generate_video(self, request: GenerateVideoRequest) -> Dict[str, Any]:
        settings = self._settings_override or get_settings()
        credentials = load_cookie_credentials(settings.flow_cookie_file)
        payload = self._build_generate_payload(settings, request)
        return await self._post(settings.flow_generate_url, payload, credentials)

    async def check_video_status(self, request: CheckVideoStatusRequest) -> Dict[str, Any]:
        settings = self._settings_override or get_settings()
        credentials = load_cookie_credentials(settings.flow_cookie_file)
        payload = self._build_status_payload(request)
        return await self._post(settings.flow_status_url, payload, credentials)

    async def _post(self, url: str, payload: Dict[str, Any], credentials: CookieCredentials) -> Dict[str, Any]:
        headers = {**_DEFAULT_HEADERS, "authorization": _format_bearer(credentials)}

        async with httpx.AsyncClient(timeout=httpx.Timeout(30.0)) as client:
            response = await client.post(
                url,
                headers=headers,
                cookies=credentials.cookies,
                content=json.dumps(payload),
            )

        if response.status_code >= 400:
            raise httpx.HTTPStatusError("Flow API call failed", request=response.request, response=response)

        try:
            return response.json()
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
                "userPaygateTier": "PAYGATE_TIER_NOT_PAID",
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
