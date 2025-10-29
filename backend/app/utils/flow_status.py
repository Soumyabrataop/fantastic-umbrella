from __future__ import annotations

from dataclasses import dataclass
from typing import Any
from urllib.parse import urlparse

from app.db.models import VideoStatus


@dataclass(frozen=True)
class FlowStatusUpdate:
    status: VideoStatus | None = None
    video_url: str | None = None
    thumbnail_url: str | None = None
    duration_seconds: int | None = None
    failure_reason: str | None = None


_STATUS_MAP: dict[str, VideoStatus] = {
    "MEDIA_GENERATION_STATUS_PENDING": VideoStatus.PENDING,
    "MEDIA_GENERATION_STATUS_CREATED": VideoStatus.PENDING,
    "MEDIA_GENERATION_STATUS_SCHEDULED": VideoStatus.PENDING,
    "MEDIA_GENERATION_STATUS_RUNNING": VideoStatus.PROCESSING,
    "MEDIA_GENERATION_STATUS_PROCESSING": VideoStatus.PROCESSING,
    "MEDIA_GENERATION_STATUS_COMPLETED": VideoStatus.COMPLETED,
    "MEDIA_GENERATION_STATUS_FAILED": VideoStatus.FAILED,
    "STATE_PENDING": VideoStatus.PENDING,
    "STATE_RUNNING": VideoStatus.PROCESSING,
    "STATE_PROCESSING": VideoStatus.PROCESSING,
    "STATE_SUCCEEDED": VideoStatus.COMPLETED,
    "STATE_COMPLETED": VideoStatus.COMPLETED,
    "STATE_FAILED": VideoStatus.FAILED,
    "STATUS_PENDING": VideoStatus.PENDING,
    "STATUS_RUNNING": VideoStatus.PROCESSING,
    "STATUS_COMPLETE": VideoStatus.COMPLETED,
    "STATUS_COMPLETED": VideoStatus.COMPLETED,
    "STATUS_FAILED": VideoStatus.FAILED,
}


def parse_flow_status(payload: dict[str, Any] | None) -> FlowStatusUpdate:
    """Extract high-level video status details from a Flow status response."""
    if not isinstance(payload, dict):
        return FlowStatusUpdate()

    operations = payload.get("operations")
    if not isinstance(operations, list) or not operations:
        return FlowStatusUpdate()

    entry = operations[0]
    if not isinstance(entry, dict):  # pragma: no cover - defensive
        return FlowStatusUpdate()

    operation = entry.get("operation")
    if not isinstance(operation, dict):
        operation = {}

    metadata = operation.get("metadata")
    if not isinstance(metadata, dict):
        metadata = {}

    response_body = operation.get("response")
    if not isinstance(response_body, dict):
        response_body = {}

    scene_outputs = response_body.get("sceneOutputs")
    if isinstance(scene_outputs, dict):
        # sceneOutputs is a map keyed by sceneId with nested mediaOutputs
        response_body = {
            **response_body,
            "sceneOutputs": list(scene_outputs.values()),
        }

    status_token = _extract_status(entry, operation, metadata, response_body)
    failure_reason = _extract_failure(entry, operation, metadata, response_body)

    video_url, thumbnail_url, duration_seconds = _extract_assets(metadata)
    if video_url is None or thumbnail_url is None or duration_seconds is None:
        video_url, thumbnail_url, duration_seconds = _extract_assets(response_body, video_url, thumbnail_url, duration_seconds)

    return FlowStatusUpdate(
        status=status_token,
        video_url=video_url,
        thumbnail_url=thumbnail_url,
        duration_seconds=duration_seconds,
        failure_reason=failure_reason,
    )


def _extract_status(entry: dict[str, Any], operation: dict[str, Any], metadata: dict[str, Any], response_body: dict[str, Any]) -> VideoStatus | None:
    candidates: list[str | None] = [
        entry.get("status"),
        operation.get("status"),
        metadata.get("status"),
        metadata.get("state"),
        metadata.get("generationStatus"),
        metadata.get("sceneStatus"),
    ]

    media_outputs = response_body.get("sceneOutputs")
    if isinstance(media_outputs, list):
        for item in media_outputs:
            if isinstance(item, dict):
                candidates.append(item.get("status"))
                outputs = item.get("mediaOutputs")
                if isinstance(outputs, list):
                    for output in outputs:
                        if isinstance(output, dict):
                            candidates.append(output.get("status"))

    for candidate in candidates:
        if isinstance(candidate, str):
            mapped = _STATUS_MAP.get(candidate.upper())
            if mapped:
                return mapped

    if operation.get("done") is True:
        return VideoStatus.COMPLETED

    return None


def _extract_failure(entry: dict[str, Any], operation: dict[str, Any], metadata: dict[str, Any], response_body: dict[str, Any]) -> str | None:
    error_sources: list[Any] = [
        entry.get("error"),
        operation.get("error"),
        metadata.get("error"),
        response_body.get("error"),
    ]

    for source in error_sources:
        if isinstance(source, dict):
            message = source.get("message")
            if isinstance(message, str) and message:
                return message

    for key in ("failureReason", "failureMessage", "errorMessage", "reason"):
        value = metadata.get(key)
        if isinstance(value, str) and value:
            return value

    return None


def _extract_assets(
    payload: dict[str, Any],
    initial_video_url: str | None = None,
    initial_thumbnail_url: str | None = None,
    initial_duration: int | None = None,
) -> tuple[str | None, str | None, int | None]:
    video_url = initial_video_url
    thumbnail_url = initial_thumbnail_url
    duration_seconds = initial_duration

    def walk(node: Any) -> None:
        nonlocal video_url, thumbnail_url, duration_seconds
        if isinstance(node, dict):
            for key, value in node.items():
                lowered = key.lower()
                if isinstance(value, str):
                    if video_url is None and _looks_like_video_url(lowered, value):
                        video_url = value
                    elif thumbnail_url is None and _looks_like_thumbnail_url(lowered, value):
                        thumbnail_url = value
                    elif duration_seconds is None and lowered in {"duration", "durationseconds", "durationsecs"}:
                        duration_seconds = _coerce_duration(value)
                elif isinstance(value, (int, float)) and duration_seconds is None:
                    if lowered in {"duration", "durationseconds", "durationsecs"}:
                        duration_seconds = int(value)
                else:
                    walk(value)
        elif isinstance(node, list):
            for item in node:
                walk(item)

    walk(payload)
    return video_url, thumbnail_url, duration_seconds


def _coerce_duration(value: str) -> int | None:
    try:
        numeric = float(value)
    except ValueError:
        return None
    return int(numeric)


def _looks_like_video_url(key: str, value: str) -> bool:
    if not value.startswith("http"):
        return False

    parsed = urlparse(value)
    suffix = parsed.path.lower()
    if any(suffix.endswith(ext) for ext in (".mp4", ".webm", ".mov", ".mkv", ".gif")):
        return True

    if key in {"downloadurl", "videourl", "signedurl", "url"}:
        return True

    return False


def _looks_like_thumbnail_url(key: str, value: str) -> bool:
    if not value.startswith("http"):
        return False

    parsed = urlparse(value)
    suffix = parsed.path.lower()
    if any(suffix.endswith(ext) for ext in (".jpg", ".jpeg", ".png", ".webp")):
        return True

    if key in {"thumbnailurl", "posterurl", "previewurl"}:
        return True

    return False