from __future__ import annotations

import hashlib
import hmac
import time
from typing import Any

from fastapi import HTTPException, Request, status

from app.core.settings import get_settings


async def require_signed_request(request: Request) -> None:
    """Validate an HMAC signature on incoming requests when a secret is configured."""
    settings = get_settings()
    secret = settings.request_signature_secret
    if not secret:
        return

    signature_header = settings.request_signature_header
    timestamp_header = settings.request_timestamp_header

    provided_signature = request.headers.get(signature_header)
    timestamp_raw = request.headers.get(timestamp_header)

    if not provided_signature or not timestamp_raw:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing request signature headers")

    try:
        timestamp = int(timestamp_raw)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid signature timestamp") from exc

    now = int(time.time())
    if abs(now - timestamp) > settings.request_signature_ttl_seconds:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Signature timestamp expired")

    body = await request.body()
    request._body = body  # allow downstream handlers to read the body again

    message = _build_signature_payload(
        timestamp=timestamp_raw,
        method=request.method.upper(),
        path=request.url.path,
        body=body,
    )
    expected_signature = _compute_signature(secret, message)

    if not hmac.compare_digest(expected_signature, provided_signature):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid request signature")


def _build_signature_payload(*, timestamp: str, method: str, path: str, body: bytes) -> bytes:
    components: list[str] = [timestamp, method, path]
    if body:
        components.append(body.decode("utf-8", errors="replace"))
    payload = "\n".join(components)
    return payload.encode("utf-8")


def _compute_signature(secret: str, payload: bytes) -> str:
    digest = hmac.new(secret.encode("utf-8"), payload, hashlib.sha256).hexdigest()
    return digest
