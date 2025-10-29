from __future__ import annotations

import uuid
from dataclasses import dataclass

import httpx
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.settings import get_settings

_bearer_scheme = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class AuthenticatedUser:
    id: uuid.UUID
    email: str | None


class SupabaseAuthClient:
    def __init__(self) -> None:
        settings = get_settings()
        self._api_base = settings.supabase_url.rstrip("/")
        self._anon_key = settings.supabase_anon_key

    async def get_user(self, access_token: str) -> AuthenticatedUser:
        url = f"{self._api_base}/auth/v1/user"
        headers = {
            "Authorization": f"Bearer {access_token}",
            "apikey": self._anon_key,
        }

        async with httpx.AsyncClient(timeout=httpx.Timeout(10.0)) as client:
            response = await client.get(url, headers=headers)

        if response.status_code != status.HTTP_200_OK:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Supabase session")

        data = response.json()
        try:
            user_id = uuid.UUID(data["id"])
        except (KeyError, ValueError) as exc:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Malformed Supabase response") from exc

        return AuthenticatedUser(id=user_id, email=data.get("email"))


_client: SupabaseAuthClient | None = None


def get_auth_client() -> SupabaseAuthClient:
    global _client
    if _client is None:
        _client = SupabaseAuthClient()
    return _client


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
) -> AuthenticatedUser:
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")

    token = credentials.credentials.strip()
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")

    auth_client = get_auth_client()
    return await auth_client.get_user(token)
