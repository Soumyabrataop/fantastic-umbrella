from __future__ import annotations

from datetime import datetime, timezone

from app.db.models import Video


def calculate_ranking_score(video: Video) -> float:
    """Calculate ranking score that mirrors the frontend logic."""
    created_at = video.created_at
    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)

    age_hours = (datetime.now(timezone.utc) - created_at).total_seconds() / 3600.0
    net_likes = max(video.likes_count - video.dislikes_count, 0)
    engagement_multiplier = _log10(video.views_count + 1) + 1.0
    engagement_score = net_likes * engagement_multiplier
    recency_bonus = 100.0 * pow(2.718281828459045, -age_hours / 24.0)
    return engagement_score + recency_bonus


def calculate_creator_score(
    last_active_at: datetime | None,
    videos_created: int,
    total_likes: int,
    total_dislikes: int,
) -> float:
    now = datetime.now(timezone.utc)
    if last_active_at is None:
        hours_since_active = 24.0 * 30.0
    else:
        value = last_active_at
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        hours_since_active = (now - value).total_seconds() / 3600.0

    recently_active_score = max(0.0, 100.0 - (hours_since_active / (24.0 * 30.0)) * 100.0)
    video_count_score = min(100.0, (videos_created / 50.0) * 100.0)
    likes_score = min(100.0, (_log10(total_likes + 1) / _log10(1001.0)) * 100.0)
    dislikes_score = min(100.0, total_dislikes)

    return round(
        recently_active_score * 0.4
        + video_count_score * 0.3
        + likes_score * 0.2
        + dislikes_score * 0.1,
        1,
    )


def _log10(value: float) -> float:
    if value <= 0:
        return 0.0
    from math import log10

    return log10(value)
