from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.db.models import AssetType, ReactionType, VideoStatus


class VideoCreateRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    prompt: str = Field(..., min_length=1, max_length=2000)
    aspect_ratio: str | None = Field(None, alias="aspectRatio")
    video_model_key: str | None = Field(None, alias="videoModelKey")
    seed: int | None = None
    scene_id: str | None = Field(None, alias="sceneId")
    source_video_id: uuid.UUID | None = Field(None, alias="sourceVideoId")


class VideoStatusSyncRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    operation_name: str | None = Field(None, alias="operationName")
    scene_id: str | None = Field(None, alias="sceneId")


class VideoAssetRead(BaseModel):
    model_config = ConfigDict(populate_by_name=True, from_attributes=True)

    id: uuid.UUID
    asset_type: AssetType = Field(..., alias="assetType")
    storage_backend: str = Field(..., alias="storageBackend")
    storage_key: str | None = Field(None, alias="storageKey")
    file_path: str | None = Field(None, alias="filePath")
    public_url: str | None = Field(None, alias="publicUrl")
    source_url: str | None = Field(None, alias="sourceUrl")
    duration_seconds: int | None = Field(None, alias="durationSeconds")
    created_at: datetime = Field(..., alias="createdAt")
    updated_at: datetime = Field(..., alias="updatedAt")


class VideoRead(BaseModel):
    model_config = ConfigDict(populate_by_name=True, from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID = Field(..., alias="userId")
    username: str | None = None
    prompt: str
    video_url: str = Field("", alias="videoUrl")
    thumbnail_url: str | None = Field(None, alias="thumbnailUrl")
    likes_count: int = Field(0, alias="likes")
    dislikes_count: int = Field(0, alias="dislikes")
    views_count: int = Field(0, alias="views")
    created_at: datetime = Field(..., alias="createdAt")
    status: VideoStatus
    ranking_score: float | None = Field(None, alias="rankingScore")
    assets: list[VideoAssetRead] = Field(default_factory=list)


class FeedResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    videos: list[VideoRead]
    next_cursor: str | None = Field(None, alias="nextCursor")
    has_more: bool = Field(..., alias="hasMore")


class ReactionResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    video_id: uuid.UUID = Field(..., alias="videoId")
    reaction: ReactionType
    likes: int
    dislikes: int


class TrackViewResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    video_id: uuid.UUID = Field(..., alias="videoId")
    views: int


class ProfileRead(BaseModel):
    model_config = ConfigDict(populate_by_name=True, from_attributes=True)

    id: uuid.UUID
    username: str | None = None
    email: str | None = None
    avatar_url: str | None = Field(None, alias="avatarUrl")
    bio: str | None = None
    videos_created: int = Field(0, alias="videosCreated")
    total_likes: int = Field(0, alias="totalLikes")
    total_dislikes: int = Field(0, alias="totalDislikes")
    last_active_at: datetime | None = Field(None, alias="lastActiveAt")
    created_at: datetime = Field(..., alias="createdAt")


class ProfileUpdateRequest(BaseModel):
    username: str | None = Field(None, min_length=3, max_length=32)
    avatar_url: str | None = Field(None, alias="avatarUrl")
    bio: str | None = Field(None, max_length=512)


class LeaderboardEntry(BaseModel):
    profile: ProfileRead
    score: float


class LeaderboardResponse(BaseModel):
    creators: list[LeaderboardEntry]
