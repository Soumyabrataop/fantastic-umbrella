from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Tuple


_BEARER_TOKEN_NAMES: Tuple[str, ...] = (
    "authorization",
    "bearer",
    "bearer_token",
    "bearertoken",
)


@dataclass(frozen=True)
class CookieCredentials:
    cookies: Dict[str, str]
    bearer_token: str


def load_cookie_credentials(cookie_file: Path) -> CookieCredentials:
    data = load_cookie_entries(cookie_file)
    cookies: Dict[str, str] = {}
    bearer_token: str | None = None

    for entry in data:
        if not isinstance(entry, dict):
            continue
        name = entry.get("name")
        value = entry.get("value")
        if not name or value is None:
            continue

        name_str = str(name)
        cookies[name_str] = str(value)

        if bearer_token is None and _matches_bearer_name(name_str):
            bearer_token = str(value)

    if not cookies:
        raise ValueError("Cookie file did not yield any valid cookies")

    if not bearer_token:
        raise ValueError(
            "No bearer token found in cookie file. Ensure the refresh job writes an entry with name 'authorization' "
            "(or one of: " + ", ".join(_BEARER_TOKEN_NAMES) + ") containing the OAuth access token."
        )

    normalized_token = bearer_token.split(" ", 1)[1] if bearer_token.lower().startswith("bearer ") else bearer_token

    return CookieCredentials(cookies=cookies, bearer_token=normalized_token)


def load_cookie_map(cookie_file: Path) -> Dict[str, str]:
    data = load_cookie_entries(cookie_file)
    cookies: Dict[str, str] = {}
    for entry in data:
        if not isinstance(entry, dict):
            continue
        name = entry.get("name")
        value = entry.get("value")
        if not name or value is None:
            continue
        cookies[str(name)] = str(value)

    if not cookies:
        raise ValueError("Cookie file did not yield any valid cookies")

    return cookies


def load_cookie_entries(cookie_file: Path) -> List[Dict[str, Any]]:
    if not cookie_file.exists():
        raise FileNotFoundError(f"Cookie file not found: {cookie_file}")

    with cookie_file.open("r", encoding="utf-8") as fh:
        data = json.load(fh)

    if not isinstance(data, list):
        raise ValueError("Cookie file must contain a JSON array")

    normalized: List[Dict[str, Any]] = []
    for entry in data:
        if not isinstance(entry, dict):
            continue
        normalized.append(entry)

    if not normalized:
        raise ValueError("Cookie file did not yield any valid cookies")

    return normalized


def _matches_bearer_name(name: str) -> bool:
    return name.lower() in _BEARER_TOKEN_NAMES
