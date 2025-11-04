from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Dict

import httpx

from app.core.settings import Settings, get_settings
from app.utils.cookie_loader import load_cookie_entries, load_cookie_map

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
    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()

    async def fetch_session(self) -> SessionData:
        cookies = load_cookie_map(self.settings.flow_cookie_file)
        headers = {**DEFAULT_HEADERS, "cookie": _format_cookie_header(cookies)}

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
                user=payload["user"],
            )
        except KeyError as exc:
            raise CookieExpiredError(f"Session payload missing field: {exc}") from exc

    def persist_token(self, session: SessionData) -> None:
        entries = load_cookie_entries(self.settings.flow_cookie_file)
        updated = False
        for entry in entries:
            if isinstance(entry, dict) and entry.get("name", "").lower() in ("authorization", "bearer", "bearer_token", "bearertoken"):
                entry["name"] = "authorization"
                entry["value"] = session.access_token
                entry["httpOnly"] = False
                entry["secure"] = True
                entry.setdefault("path", "/")
                updated = True
        if not updated:
            entries.append(
                {
                    "domain": "labs.google",
                    "name": "authorization",
                    "value": session.access_token,
                    "path": "/",
                    "secure": True,
                    "httpOnly": False,
                    "sameSite": "lax",
                }
            )

        self.settings.flow_cookie_file.write_text(json.dumps(entries, indent=4), encoding="utf-8")


def _format_cookie_header(cookies: Dict[str, str]) -> str:
    return "; ".join(f"{name}={value}" for name, value in cookies.items())


def seconds_until_expiry(session: SessionData, margin_seconds: int = 60) -> float:
    now = datetime.now(timezone.utc)
    target = session.expires - timedelta(seconds=margin_seconds)
    return max((target - now).total_seconds(), 0.0)
