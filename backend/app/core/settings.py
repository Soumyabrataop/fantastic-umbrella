from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parents[2]
ENV_PATH = BASE_DIR / ".env"


def _get_env(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


@dataclass(frozen=True)
class Settings:
    flow_generate_url: str
    flow_status_url: str
    flow_project_id: str
    flow_default_video_model: str
    flow_default_aspect_ratio: str
    flow_cookie_file: Path
    token_refresh_margin_seconds: int
    supabase_url: str
    supabase_anon_key: str
    supabase_service_role_key: str | None
    database_url: str


def get_settings() -> Settings:
    load_dotenv(ENV_PATH, override=True)
    cookie_path = os.environ.get("FLOW_COOKIE_FILE", str(BASE_DIR / "cookie.json"))
    margin_raw = os.environ.get("FLOW_TOKEN_REFRESH_MARGIN", "60")
    try:
        margin = int(margin_raw)
    except ValueError as exc:
        raise RuntimeError("FLOW_TOKEN_REFRESH_MARGIN must be an integer") from exc

    supabase_url = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    if not supabase_url:
        raise RuntimeError("Missing SUPABASE_URL environment variable")

    supabase_anon_key = os.environ.get("SUPABASE_ANON_KEY") or os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    if not supabase_anon_key:
        raise RuntimeError("Missing SUPABASE_ANON_KEY environment variable")

    return Settings(
        flow_generate_url=_get_env("FLOW_API_GENERATE_URL"),
        flow_status_url=_get_env("FLOW_API_STATUS_URL"),
        flow_project_id=_get_env("FLOW_PROJECT_ID"),
        flow_default_video_model=os.environ.get("FLOW_DEFAULT_VIDEO_MODEL", "veo_3_1_t2v_fast_portrait"),
        flow_default_aspect_ratio=os.environ.get("FLOW_DEFAULT_ASPECT_RATIO", "VIDEO_ASPECT_RATIO_PORTRAIT"),
        flow_cookie_file=Path(cookie_path),
        token_refresh_margin_seconds=margin,
        supabase_url=supabase_url,
        supabase_anon_key=supabase_anon_key,
        supabase_service_role_key=os.environ.get("SUPABASE_SERVICE_ROLE_KEY"),
        database_url=_get_env("SUPABASE_DB_URL"),
    )