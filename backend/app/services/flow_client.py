from __future__ import annotations

import json
import logging
import secrets
from typing import Any, Dict, Tuple
from uuid import uuid4

import httpx

from app.core.settings import Settings, get_settings
from app.schemas.video import CheckVideoStatusRequest, GenerateVideoRequest
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

    async def generate_video(self, request: GenerateVideoRequest) -> Dict[str, Any]:
        settings = self._settings_override or get_settings()
        credentials = load_cookie_credentials(settings.flow_cookie_file)
        payload = self._build_generate_payload(settings, request)
        response, headers, request_id = await self._post(settings.flow_generate_url, payload, credentials)
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

    async def check_video_status(self, request: CheckVideoStatusRequest) -> Dict[str, Any]:
        settings = self._settings_override or get_settings()
        credentials = load_cookie_credentials(settings.flow_cookie_file)
        payload = self._build_status_payload(request)
        response, headers, _ = await self._post(settings.flow_status_url, payload, credentials)
        if not response:
            logger.error(
                "Flow check_video_status returned empty response",
                extra={"payload": payload, "headers": headers},
            )
        return response

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
