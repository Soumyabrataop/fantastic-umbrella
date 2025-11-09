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
    flow_user_paygate_tier: str
    flow_cookie_file: Path
    token_refresh_margin_seconds: int
    supabase_url: str
    supabase_anon_key: str
    supabase_service_role_key: str | None
    database_url: str
    media_storage_backend: str
    media_root: Path
    media_public_base: str
    # Google OAuth & Drive
    google_client_id: str
    google_client_secret: str
    google_redirect_uri: str
    google_drive_folder_name: str
    # Security
    request_signature_secret: str | None
    request_signature_header: str
    request_timestamp_header: str
    request_signature_ttl_seconds: int
    video_queue_maxsize: int
    video_creation_cooldown_seconds: int
    video_status_poll_seconds: int
    video_status_max_polls: int


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

    database_url = (
        os.environ.get("DATABASE_URL")
        or os.environ.get("SUPABASE_DB_URL")
        or "postgresql+asyncpg://postgres:Mihir0209@localhost:5432/zappdb"
    )

    media_backend = os.environ.get("MEDIA_STORAGE_BACKEND", "drive").strip().lower() or "drive"
    media_root_raw = os.environ.get("MEDIA_ROOT") or str(BASE_DIR / "media")
    media_root = Path(media_root_raw).resolve()
    if media_backend == "local":
        media_root.mkdir(parents=True, exist_ok=True)

    media_public_base = os.environ.get("MEDIA_PUBLIC_BASE", "/media").strip() or "/media"
    if not media_public_base.startswith("/") and not media_public_base.startswith("http"):
        media_public_base = f"/{media_public_base}"

    request_signature_secret = os.environ.get("REQUEST_SIGNATURE_SECRET")
    request_signature_header = os.environ.get("REQUEST_SIGNATURE_HEADER", "x-instaveo-signature").lower()
    request_timestamp_header = os.environ.get("REQUEST_TIMESTAMP_HEADER", "x-instaveo-timestamp").lower()

    def _int_env(name: str, default: int, minimum: int = 0) -> int:
        raw = os.environ.get(name)
        if raw is None:
            return default
        try:
            value = int(raw)
        except ValueError as exc:
            raise RuntimeError(f"{name} must be an integer") from exc
        return max(value, minimum)

    return Settings(
        flow_generate_url=_get_env("FLOW_API_GENERATE_URL"),
        flow_status_url=_get_env("FLOW_API_STATUS_URL"),
        flow_project_id=_get_env("FLOW_PROJECT_ID"),
        flow_default_video_model=os.environ.get("FLOW_DEFAULT_VIDEO_MODEL", "veo_3_1_t2v_fast_portrait_ultra"),
        flow_default_aspect_ratio=os.environ.get("FLOW_DEFAULT_ASPECT_RATIO", "VIDEO_ASPECT_RATIO_PORTRAIT"),
        flow_user_paygate_tier=os.environ.get("FLOW_USER_PAYGATE_TIER", "PAYGATE_TIER_NOT_PAID"),
        flow_cookie_file=Path(cookie_path),
        token_refresh_margin_seconds=margin,
        supabase_url=supabase_url,
        supabase_anon_key=supabase_anon_key,
        supabase_service_role_key=os.environ.get("SUPABASE_SERVICE_ROLE_KEY"),
        database_url=database_url,
        media_storage_backend=media_backend,
        media_root=media_root,
        media_public_base=media_public_base.rstrip("/"),
        # Google OAuth & Drive
        google_client_id=_get_env("GOOGLE_CLIENT_ID"),
        google_client_secret=_get_env("GOOGLE_CLIENT_SECRET"),
        google_redirect_uri=os.environ.get("GOOGLE_REDIRECT_URI", "http://localhost:8000/api/auth/google/callback"),
        google_drive_folder_name=os.environ.get("GOOGLE_DRIVE_FOLDER_NAME", "InstaVEO Videos"),
        # Security
        request_signature_secret=request_signature_secret,
        request_signature_header=request_signature_header,
        request_timestamp_header=request_timestamp_header,
        request_signature_ttl_seconds=_int_env("REQUEST_SIGNATURE_TTL_SECONDS", default=120, minimum=1),
        video_queue_maxsize=_int_env("VIDEO_QUEUE_MAXSIZE", default=10, minimum=1),
        video_creation_cooldown_seconds=_int_env("VIDEO_CREATION_COOLDOWN_SECONDS", default=120, minimum=0),
        video_status_poll_seconds=_int_env("VIDEO_STATUS_POLL_SECONDS", default=15, minimum=1),
        video_status_max_polls=_int_env("VIDEO_STATUS_MAX_POLLS", default=40, minimum=1),
    )