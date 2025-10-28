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


def get_settings() -> Settings:
    load_dotenv(ENV_PATH, override=True)
    cookie_path = os.environ.get("FLOW_COOKIE_FILE", str(BASE_DIR / "cookie.json"))
    margin_raw = os.environ.get("FLOW_TOKEN_REFRESH_MARGIN", "60")
    try:
        margin = int(margin_raw)
    except ValueError as exc:
        raise RuntimeError("FLOW_TOKEN_REFRESH_MARGIN must be an integer") from exc
    return Settings(
        flow_generate_url=_get_env("FLOW_API_GENERATE_URL"),
        flow_status_url=_get_env("FLOW_API_STATUS_URL"),
        flow_project_id=_get_env("FLOW_PROJECT_ID"),
        flow_default_video_model=os.environ.get("FLOW_DEFAULT_VIDEO_MODEL", "veo_3_1_t2v_fast_portrait"),
        flow_default_aspect_ratio=os.environ.get("FLOW_DEFAULT_ASPECT_RATIO", "VIDEO_ASPECT_RATIO_PORTRAIT"),
        flow_cookie_file=Path(cookie_path),
        token_refresh_margin_seconds=margin,
    )