from __future__ import annotations

import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    """Base class for all ORM models."""


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class VideoStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class ReactionType(str, enum.Enum):
    LIKE = "like"
    DISLIKE = "dislike"


class AssetType(str, enum.Enum):
    VIDEO = "video"
    THUMBNAIL = "thumbnail"


class Video(Base, TimestampMixin):
    __tablename__ = "videos"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("profiles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    prompt: Mapped[str] = mapped_column(Text, nullable=False)
    video_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    thumbnail_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[VideoStatus] = mapped_column(
        Enum(VideoStatus, name="video_status_enum", native_enum=False),
        default=VideoStatus.PENDING,
        nullable=False,
    )
    likes_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    dislikes_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    views_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    ranking_score: Mapped[float | None] = mapped_column(Numeric(12, 4), nullable=True)
    operation_name: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    scene_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    seed: Mapped[int | None] = mapped_column(Integer, nullable=True)
    model_key: Mapped[str | None] = mapped_column(String(255), nullable=True)
    aspect_ratio: Mapped[str | None] = mapped_column(String(255), nullable=True)
    duration_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    failure_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_video_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("videos.id", ondelete="SET NULL"),
        nullable=True,
    )

    reactions: Mapped[list["VideoReaction"]] = relationship(back_populates="video", cascade="all, delete-orphan")
    views: Mapped[list["VideoView"]] = relationship(back_populates="video", cascade="all, delete-orphan")
    creator: Mapped["Profile | None"] = relationship(
        "Profile",
        back_populates="videos",
        primaryjoin="Video.user_id==Profile.id",
        viewonly=True,
    )
    assets: Mapped[list["VideoAsset"]] = relationship(
        "VideoAsset",
        back_populates="video",
        cascade="all, delete-orphan",
    )


class VideoReaction(Base, TimestampMixin):
    __tablename__ = "video_reactions"
    __table_args__ = (
        UniqueConstraint("video_id", "user_id", name="uq_video_reactions_video_user"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    video_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("videos.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    reaction: Mapped[ReactionType] = mapped_column(
        Enum(ReactionType, name="video_reaction_enum", native_enum=False),
        nullable=False,
    )

    video: Mapped[Video] = relationship(back_populates="reactions")


class VideoView(Base, TimestampMixin):
    __tablename__ = "video_views"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    video_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("videos.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)
    session_id: Mapped[str | None] = mapped_column(String(255), nullable=True)

    video: Mapped[Video] = relationship(back_populates="views")


class Profile(Base, TimestampMixin):
    __tablename__ = "profiles"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    username: Mapped[str | None] = mapped_column(String(64), nullable=True, unique=True)
    email: Mapped[str | None] = mapped_column(String(320), nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    bio: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_active_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    videos_created: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_likes: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_dislikes: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    __table_args__ = (
        CheckConstraint("videos_created >= 0", name="ck_profiles_videos_created_non_negative"),
        CheckConstraint("total_likes >= 0", name="ck_profiles_total_likes_non_negative"),
        CheckConstraint("total_dislikes >= 0", name="ck_profiles_total_dislikes_non_negative"),
    )

    videos: Mapped[list[Video]] = relationship(
        "Video",
        back_populates="creator",
        cascade="all, delete-orphan",
        primaryjoin="Profile.id==Video.user_id",
    )


class VideoAsset(Base, TimestampMixin):
    __tablename__ = "video_assets"
    __table_args__ = (
        UniqueConstraint("video_id", "asset_type", name="uq_video_assets_video_type"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    video_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("videos.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    asset_type: Mapped[AssetType] = mapped_column(
        Enum(AssetType, name="video_asset_type_enum", native_enum=False),
        nullable=False,
    )
    storage_backend: Mapped[str] = mapped_column(String(32), nullable=False)
    storage_key: Mapped[str | None] = mapped_column(String(255), nullable=True)
    file_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    public_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    duration_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)

    video: Mapped[Video] = relationship(back_populates="assets")
