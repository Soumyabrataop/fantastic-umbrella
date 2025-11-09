from __future__ import annotations

import asyncio
import io
import logging
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy import and_, func, inspect, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.settings import get_settings
from app.db.models import (
    AssetType,
    Profile,
    ReactionType,
    Video,
    VideoAsset,
    VideoReaction,
    VideoStatus,
    VideoView,
)
from app.db.session import get_session
from app.schemas.media import (
    FeedResponse,
    LeaderboardEntry,
    LeaderboardResponse,
    ProfileRead,
    ProfileUpdateRequest,
    ReactionResponse,
    TrackViewResponse,
    VideoAssetRead,
    VideoCreateRequest,
    VideoRead,
    VideoStatusSyncRequest,
)
from app.schemas.video import (
    CheckVideoStatusRequest,
    CheckVideoStatusResponse,
    GenerateVideoRequest,
    GenerateVideoResponse,
)
from app.services.auth import AuthenticatedUser, get_current_user
from app.services.flow_client import FlowClient
from app.services.security import require_signed_request
from app.services.storage import StorageService
from app.services.video_queue import VideoJob, VideoQueue, get_video_queue
from app.utils.flow_status import parse_flow_status
from app.utils.ranking import calculate_creator_score, calculate_ranking_score

router = APIRouter()
flow_client = FlowClient()
storage_service = StorageService()
logger = logging.getLogger(__name__)


@router.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


# -----------------------------
# Video Streaming
# -----------------------------

from fastapi.responses import StreamingResponse
import io

@router.get("/videos/{video_id}/stream")
async def stream_video(
    video_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
):
    """Proxy video streaming from Google Drive to avoid CORS/CSP issues"""
    try:
        # Get video from database
        video = await _get_video(session, video_id)
        
        # Check if video is published (for public access)
        if not video.is_published:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Video not found or not published"
            )
        
        # Get the Google Drive file ID
        drive_file_id = video.google_drive_file_id
        if not drive_file_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Video file not available"
            )
        
        # Stream from Google Drive using direct download URL
        drive_url = f"https://drive.google.com/uc?export=download&id={drive_file_id}"
        
        async with httpx.AsyncClient(follow_redirects=True, timeout=30.0) as client:
            response = await client.get(drive_url)
            
            if response.status_code != 200:
                logger.error(f"Failed to fetch video from Drive: {response.status_code}")
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail="Failed to fetch video from storage"
                )
            
            return StreamingResponse(
                io.BytesIO(response.content),
                media_type="video/mp4",
                headers={
                    "Accept-Ranges": "bytes",
                    "Content-Length": str(len(response.content)),
                    "Cache-Control": "public, max-age=3600",
                    "Access-Control-Allow-Origin": "*",
                }
            )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to stream video {video_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to stream video"
        )


# -----------------------------
# Flow passthrough (legacy)
# -----------------------------


@router.post("/generate-video", response_model=GenerateVideoResponse, status_code=status.HTTP_202_ACCEPTED)
async def generate_video(payload: GenerateVideoRequest) -> GenerateVideoResponse:
    try:
        response = await flow_client.generate_video(payload)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc
    except httpx.HTTPStatusError as exc:
        detail = _extract_error_detail(exc)
        raise HTTPException(status_code=exc.response.status_code, detail=detail) from exc
    except httpx.RequestError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc

    operation_name = _extract_operation_name(response)
    if not operation_name:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Missing operation name in Flow response")

    return GenerateVideoResponse(operation_name=operation_name, raw_response=response)


@router.post("/generation-status", response_model=CheckVideoStatusResponse)
async def generation_status(payload: CheckVideoStatusRequest) -> CheckVideoStatusResponse:
    try:
        response = await flow_client.check_video_status(payload)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc
    except httpx.HTTPStatusError as exc:
        detail = _extract_error_detail(exc)
        raise HTTPException(status_code=exc.response.status_code, detail=detail) from exc
    except httpx.RequestError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc

    return CheckVideoStatusResponse(raw_response=response)


# -----------------------------
# Application endpoints
# -----------------------------


@router.post("/videos/create", response_model=VideoRead, status_code=status.HTTP_201_CREATED)
async def create_video(
    payload: VideoCreateRequest,
    queue: VideoQueue = Depends(get_video_queue),
    _: None = Depends(require_signed_request),
    user: AuthenticatedUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> VideoRead:
    video, profile = await _create_and_enqueue_video(session, payload, user, queue)
    return _serialize_video(video, creator=profile)


@router.post("/videos/{video_id}/recreate", response_model=VideoRead, status_code=status.HTTP_201_CREATED)
async def recreate_video(
    video_id: uuid.UUID,
    queue: VideoQueue = Depends(get_video_queue),
    _: None = Depends(require_signed_request),
    user: AuthenticatedUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> VideoRead:
    original = await _get_video(session, video_id)
    payload = VideoCreateRequest(
        prompt=original.prompt,
        aspectRatio=original.aspect_ratio,
        videoModelKey=original.model_key,
        seed=None,
        sceneId=None,
        sourceVideoId=original.id,
    )
    video, profile = await _create_and_enqueue_video(session, payload, user, queue)
    return _serialize_video(video, creator=profile)


@router.post("/videos/{video_id}/sync-status", response_model=VideoRead)
async def sync_video_status(
    video_id: uuid.UUID,
    payload: VideoStatusSyncRequest | None = None,
    _: None = Depends(require_signed_request),
    user: AuthenticatedUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> VideoRead:
    video = await _get_video(session, video_id)

    if video.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the owner can sync this video")

    if payload:
        if payload.operation_name:
            video.operation_name = payload.operation_name
        if payload.scene_id:
            video.scene_id = payload.scene_id

    if not video.operation_name or not video.scene_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Video is missing Flow metadata for polling")

    try:
        response = await flow_client.check_video_status(
            CheckVideoStatusRequest(
                operationName=video.operation_name,
                sceneId=video.scene_id,
            )
        )
    except httpx.HTTPStatusError as exc:
        detail = _extract_error_detail(exc)
        raise HTTPException(status_code=exc.response.status_code, detail=detail) from exc
    except httpx.RequestError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001 - upstream resilience
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Failed to poll Flow status") from exc

    update = parse_flow_status(response)
    if update.status is not None:
        video.status = update.status
    if update.failure_reason:
        video.failure_reason = update.failure_reason
    if update.video_url:
        video.video_url = update.video_url
    if update.thumbnail_url:
        video.thumbnail_url = update.thumbnail_url
    if update.duration_seconds is not None:
        video.duration_seconds = update.duration_seconds

    await storage_service.handle_status_update(session, video, update)

    video.ranking_score = calculate_ranking_score(video)

    owner_profile = await _ensure_profile(session, video.user_id)
    owner_profile.last_active_at = datetime.now(timezone.utc)

    await session.flush()
    
    # No need to refresh URLs - we use public URLs that don't expire
    return _serialize_video(video, creator=owner_profile)


@router.get("/videos/feed", response_model=FeedResponse)
async def get_feed(
    cursor: str | None = Query(default=None),
    limit: int = Query(default=10, ge=1, le=50),
    session: AsyncSession = Depends(get_session),
) -> FeedResponse:
    ranking_expr = func.coalesce(Video.ranking_score, 0.0)
    query = (
        select(Video)
        .options(
            selectinload(Video.creator),
            selectinload(Video.assets),
        )
        .where(
            Video.status == VideoStatus.COMPLETED,
            Video.is_published == True,  # Only show published videos in feed
        )
        .order_by(ranking_expr.desc(), Video.created_at.desc(), Video.id.desc())
    )

    if cursor:
        (cursor_score, cursor_created_at), cursor_uuid = _decode_cursor(cursor)
        query = query.where(
            or_(
                ranking_expr < cursor_score,
                and_(
                    ranking_expr == cursor_score,
                    Video.created_at < cursor_created_at,
                ),
                and_(
                    ranking_expr == cursor_score,
                    Video.created_at == cursor_created_at,
                    Video.id < cursor_uuid,
                ),
            )
        )

    rows = await session.execute(query.limit(limit + 1))
    videos = rows.scalars().all()

    has_more = len(videos) > limit
    items = videos[:limit]

    # No need to refresh URLs - we use public URLs that don't expire
    serialized = [_serialize_video(video) for video in items]
    next_cursor = _encode_cursor(items[-1]) if has_more and items else None
    return FeedResponse(videos=serialized, next_cursor=next_cursor, has_more=has_more)


@router.get("/videos/{video_id}", response_model=VideoRead)
async def get_video_detail(
    video_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
) -> VideoRead:
    video = await _get_video(session, video_id)
    # No need to refresh URLs - we use public URLs that don't expire
    return _serialize_video(video)


@router.post("/videos/{video_id}/publish")
async def publish_video(
    video_id: uuid.UUID,
    user: AuthenticatedUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> VideoRead:
    """
    Publish a video - makes it visible in feed and sets Drive file permissions to public.
    """
    video = await _get_video(session, video_id)
    
    # Check ownership
    if video.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to publish this video")
    
    # Already published
    if video.is_published:
        return _serialize_video(video)
    
    # Get Drive service to update permissions
    drive_service = await storage_service.get_drive_service_for_user(session, user.id)
    
    if drive_service:
        try:
            # Make Drive files public
            if video.google_drive_file_id:
                await asyncio.to_thread(drive_service.make_public, video.google_drive_file_id)
                logger.info(f"Made video {video_id} public on Drive: {video.google_drive_file_id}")
            
            if video.google_drive_thumbnail_id:
                await asyncio.to_thread(drive_service.make_public, video.google_drive_thumbnail_id)
                logger.info(f"Made thumbnail for video {video_id} public on Drive: {video.google_drive_thumbnail_id}")
        except Exception as e:
            logger.error(f"Failed to update Drive permissions for video {video_id}: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update Drive permissions"
            )
    
    # Mark as published
    video.is_published = True
    session.add(video)
    await session.commit()
    
    logger.info(f"Published video {video_id}")
    return _serialize_video(video)


@router.post("/videos/{video_id}/unpublish")
async def unpublish_video(
    video_id: uuid.UUID,
    user: AuthenticatedUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> VideoRead:
    """
    Unpublish a video - removes it from feed and sets Drive file permissions to private.
    """
    video = await _get_video(session, video_id)
    
    # Check ownership
    if video.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to unpublish this video")
    
    # Already unpublished
    if not video.is_published:
        return _serialize_video(video)
    
    # Get Drive service to update permissions
    drive_service = await storage_service.get_drive_service_for_user(session, user.id)
    
    if drive_service:
        try:
            # Make Drive files private
            if video.google_drive_file_id:
                await asyncio.to_thread(drive_service.make_private, video.google_drive_file_id)
                logger.info(f"Made video {video_id} private on Drive: {video.google_drive_file_id}")
            
            if video.google_drive_thumbnail_id:
                await asyncio.to_thread(drive_service.make_private, video.google_drive_thumbnail_id)
                logger.info(f"Made thumbnail for video {video_id} private on Drive: {video.google_drive_thumbnail_id}")
        except Exception as e:
            logger.error(f"Failed to update Drive permissions for video {video_id}: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update Drive permissions"
            )
    
    # Mark as unpublished
    video.is_published = False
    session.add(video)
    await session.commit()
    
    logger.info(f"Unpublished video {video_id}")
    return _serialize_video(video)


@router.post("/videos/{video_id}/like", response_model=ReactionResponse)
async def like_video(
    video_id: uuid.UUID,
    _: None = Depends(require_signed_request),
    user: AuthenticatedUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> ReactionResponse:
    video = await _get_video(session, video_id)
    actor_profile = await _ensure_profile(session, user.id, user.email)
    owner_profile = await _ensure_profile(session, video.user_id)

    reaction = await _get_reaction(session, video.id, user.id)
    if reaction and reaction.reaction == ReactionType.LIKE:
        return ReactionResponse(
            video_id=video.id,
            reaction=reaction.reaction,
            likes=video.likes_count,
            dislikes=video.dislikes_count,
        )

    if reaction and reaction.reaction == ReactionType.DISLIKE:
        video.dislikes_count = max(video.dislikes_count - 1, 0)
        owner_profile.total_dislikes = max(owner_profile.total_dislikes - 1, 0)
        reaction.reaction = ReactionType.LIKE
    else:
        reaction = VideoReaction(video_id=video.id, user_id=user.id, reaction=ReactionType.LIKE)
        session.add(reaction)

    video.likes_count += 1
    owner_profile.total_likes += 1
    actor_profile.last_active_at = datetime.now(timezone.utc)
    owner_profile.last_active_at = datetime.now(timezone.utc)
    video.ranking_score = calculate_ranking_score(video)

    return ReactionResponse(video_id=video.id, reaction=ReactionType.LIKE, likes=video.likes_count, dislikes=video.dislikes_count)


@router.post("/videos/{video_id}/dislike", response_model=ReactionResponse)
async def dislike_video(
    video_id: uuid.UUID,
    _: None = Depends(require_signed_request),
    user: AuthenticatedUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> ReactionResponse:
    video = await _get_video(session, video_id)
    actor_profile = await _ensure_profile(session, user.id, user.email)
    owner_profile = await _ensure_profile(session, video.user_id)

    reaction = await _get_reaction(session, video.id, user.id)
    if reaction and reaction.reaction == ReactionType.DISLIKE:
        return ReactionResponse(
            video_id=video.id,
            reaction=reaction.reaction,
            likes=video.likes_count,
            dislikes=video.dislikes_count,
        )

    if reaction and reaction.reaction == ReactionType.LIKE:
        video.likes_count = max(video.likes_count - 1, 0)
        owner_profile.total_likes = max(owner_profile.total_likes - 1, 0)
        reaction.reaction = ReactionType.DISLIKE
    else:
        reaction = VideoReaction(video_id=video.id, user_id=user.id, reaction=ReactionType.DISLIKE)
        session.add(reaction)

    video.dislikes_count += 1
    owner_profile.total_dislikes += 1
    actor_profile.last_active_at = datetime.now(timezone.utc)
    owner_profile.last_active_at = datetime.now(timezone.utc)
    video.ranking_score = calculate_ranking_score(video)

    return ReactionResponse(video_id=video.id, reaction=ReactionType.DISLIKE, likes=video.likes_count, dislikes=video.dislikes_count)


@router.post("/videos/{video_id}/view", response_model=TrackViewResponse)
async def track_view(
    video_id: uuid.UUID,
    _: None = Depends(require_signed_request),
    user: AuthenticatedUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> TrackViewResponse:
    video = await _get_video(session, video_id)
    view = VideoView(video_id=video.id, user_id=user.id)
    session.add(view)
    video.views_count += 1
    video.ranking_score = calculate_ranking_score(video)

    owner_profile = await _ensure_profile(session, video.user_id)
    owner_profile.last_active_at = datetime.now(timezone.utc)

    return TrackViewResponse(video_id=video.id, views=video.views_count)


@router.get("/users/{user_id}", response_model=ProfileRead)
async def get_profile_route(
    user_id: uuid.UUID,
    user: AuthenticatedUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> ProfileRead:
    profile = await session.get(Profile, user_id)
    if profile is None:
        if user.id != user_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found")
        profile = Profile(
            id=user_id,
            email=user.email,
            last_active_at=datetime.now(timezone.utc),
        )
        session.add(profile)
        await session.flush()
    return _serialize_profile(profile)


@router.patch("/users/{user_id}", response_model=ProfileRead)
async def update_profile(
    user_id: uuid.UUID,
    payload: ProfileUpdateRequest,
    _: None = Depends(require_signed_request),
    user: AuthenticatedUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> ProfileRead:
    if user.id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot update another user's profile")

    profile = await session.get(Profile, user_id)
    if profile is None:
        profile = Profile(
            id=user_id,
            email=user.email,
            last_active_at=datetime.now(timezone.utc),
        )
        session.add(profile)
        await session.flush()

    if payload.username is not None:
        profile.username = payload.username
    if payload.avatar_url is not None:
        profile.avatar_url = payload.avatar_url
    if payload.bio is not None:
        profile.bio = payload.bio
    profile.last_active_at = datetime.now(timezone.utc)

    try:
        await session.flush()
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username already taken") from exc

    return _serialize_profile(profile)


@router.get("/users/{user_id}/videos", response_model=list[VideoRead])
async def list_user_videos(
    user_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
) -> list[VideoRead]:
    rows = await session.execute(
        select(Video)
        .options(
            selectinload(Video.creator),
            selectinload(Video.assets),
        )
        .where(Video.user_id == user_id)
        .order_by(Video.created_at.desc())
    )
    videos = rows.scalars().all()
    
    # No need to refresh URLs - we use public URLs that don't expire
    return [_serialize_video(video) for video in videos]


@router.get("/users/{user_id}/liked", response_model=list[VideoRead])
async def list_liked_videos(
    user_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
) -> list[VideoRead]:
    rows = await session.execute(
        select(Video)
        .join(VideoReaction, and_(VideoReaction.video_id == Video.id, VideoReaction.user_id == user_id))
        .options(
            selectinload(Video.creator),
            selectinload(Video.assets),
        )
        .where(VideoReaction.reaction == ReactionType.LIKE)
        .order_by(VideoReaction.created_at.desc())
    )
    videos = rows.scalars().all()
    
    # No need to refresh URLs - we use public URLs that don't expire
    return [_serialize_video(video) for video in videos]


@router.get("/users/top", response_model=LeaderboardResponse)
async def leaderboard(
    limit: int = Query(default=10, ge=1, le=50),
    session: AsyncSession = Depends(get_session),
) -> LeaderboardResponse:
    rows = await session.execute(
        select(Profile).order_by(Profile.total_likes.desc(), Profile.videos_created.desc()).limit(limit)
    )
    profiles = rows.scalars().all()

    creators = [
        LeaderboardEntry(
            profile=_serialize_profile(profile),
            score=calculate_creator_score(
                profile.last_active_at,
                profile.videos_created,
                profile.total_likes,
                profile.total_dislikes,
            ),
        )
        for profile in profiles
    ]
    return LeaderboardResponse(creators=creators)


# -----------------------------
# Helpers
# -----------------------------


def _extract_operation_name(response: dict[str, object] | None) -> str | None:
    if not isinstance(response, dict):
        return None
    operations = response.get("operations")
    if not isinstance(operations, list) or not operations:
        return None
    first = operations[0]
    if not isinstance(first, dict):
        return None
    op = first.get("operation")
    if not isinstance(op, dict):
        return None
    name = op.get("name")
    return str(name) if isinstance(name, str) else None


def _extract_error_detail(exc: httpx.HTTPStatusError) -> dict[str, object]:
    if exc.response.headers.get("content-type", "").startswith("application/json"):
        try:
            upstream = exc.response.json()
        except ValueError:
            upstream = exc.response.text
    else:
        upstream = exc.response.text
    return {"message": "Flow API call failed", "upstream": upstream}


def _serialize_video(video: Video, creator: Profile | None = None) -> VideoRead:
    creator_profile = creator or video.creator
    username = None
    if creator_profile:
        username = creator_profile.username or _safe_email_local(creator_profile.email)

    ranking_score: float | None
    if video.ranking_score is None:
        ranking_score = calculate_ranking_score(video)
    else:
        ranking_score = float(video.ranking_score) if isinstance(video.ranking_score, Decimal) else video.ranking_score

    assets: list[VideoAssetRead] = []
    video_url = video.video_url or ""
    thumbnail_url = video.thumbnail_url
    
    try:
        state = inspect(video)
    except Exception:  # noqa: BLE001 - fallback when instance inspection is unavailable
        state = None

    if state is None or "assets" not in getattr(state, "unloaded", set()):
        raw_assets = getattr(video, "assets", None) or []
        assets = [_serialize_asset(asset) for asset in raw_assets]
        
        # Extract signed URLs from assets - these take precedence over video table URLs
        for asset in raw_assets:
            if asset.asset_type == AssetType.VIDEO and asset.public_url:
                video_url = asset.public_url
            elif asset.asset_type == AssetType.THUMBNAIL and asset.public_url:
                thumbnail_url = asset.public_url

    return VideoRead(
        id=video.id,
        user_id=video.user_id,
        username=username,
        prompt=video.prompt,
        video_url=video_url,
        thumbnail_url=thumbnail_url,
        likes_count=video.likes_count,
        dislikes_count=video.dislikes_count,
        views_count=video.views_count,
        created_at=video.created_at,
        status=video.status,
        ranking_score=ranking_score,
        assets=assets,
        google_drive_file_id=video.google_drive_file_id,
    )


def _serialize_profile(profile: Profile) -> ProfileRead:
    return ProfileRead(
        id=profile.id,
        username=profile.username,
        email=profile.email,
        avatar_url=profile.avatar_url,
        bio=profile.bio,
        videos_created=profile.videos_created,
        total_likes=profile.total_likes,
        total_dislikes=profile.total_dislikes,
        last_active_at=profile.last_active_at,
        created_at=profile.created_at,
    )


def _serialize_asset(asset: VideoAsset) -> VideoAssetRead:
    return VideoAssetRead(
        id=asset.id,
        asset_type=asset.asset_type,
        storage_backend=asset.storage_backend,
        storage_key=asset.storage_key,
        file_path=asset.file_path,
        public_url=asset.public_url,
        source_url=asset.source_url,
        duration_seconds=asset.duration_seconds,
        created_at=asset.created_at,
        updated_at=asset.updated_at,
    )


async def _create_and_enqueue_video(
    session: AsyncSession,
    payload: VideoCreateRequest,
    user: AuthenticatedUser,
    queue: VideoQueue,
) -> tuple[Video, Profile]:
    settings = get_settings()
    await _enforce_creation_cooldown(session, user.id, settings.video_creation_cooldown_seconds)

    # Ensure profile exists BEFORE creating video to avoid foreign key violation
    profile = await _ensure_profile(session, user.id, user.email)
    profile.last_active_at = datetime.now(timezone.utc)

    scene_id = payload.scene_id or str(uuid.uuid4())
    video = Video(
        user_id=user.id,
        prompt=payload.prompt,
        status=VideoStatus.PENDING,
        aspect_ratio=payload.aspect_ratio,
        model_key=payload.video_model_key,
        seed=payload.seed,
        scene_id=scene_id,
        source_video_id=payload.source_video_id,
        failure_reason=None,
    )
    session.add(video)

    await session.flush()
    await queue.enqueue(VideoJob(video_id=video.id, scene_id=scene_id))
    return video, profile


async def _enforce_creation_cooldown(
    session: AsyncSession,
    user_id: uuid.UUID,
    cooldown_seconds: int,
) -> None:
    if cooldown_seconds <= 0:
        return

    result = await session.execute(
        select(Video.created_at)
        .where(Video.user_id == user_id)
        .order_by(Video.created_at.desc())
        .limit(1)
    )
    last_created_at = result.scalar_one_or_none()
    if last_created_at is None:
        return

    created_at = last_created_at
    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)

    now = datetime.now(timezone.utc)
    elapsed = (now - created_at).total_seconds()
    if elapsed < cooldown_seconds:
        remaining = int(cooldown_seconds - elapsed)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Please wait {remaining} seconds before creating another video",
        )


async def _get_video(session: AsyncSession, video_id: uuid.UUID) -> Video:
    rows = await session.execute(
        select(Video)
        .options(
            selectinload(Video.creator),
            selectinload(Video.assets),
        )
        .where(Video.id == video_id)
    )
    video = rows.scalar_one_or_none()
    if video is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Video not found")
    return video


async def _get_reaction(session: AsyncSession, video_id: uuid.UUID, user_id: uuid.UUID) -> VideoReaction | None:
    rows = await session.execute(
        select(VideoReaction).where(
            VideoReaction.video_id == video_id,
            VideoReaction.user_id == user_id,
        )
    )
    return rows.scalar_one_or_none()


async def _ensure_profile(
    session: AsyncSession,
    user_id: uuid.UUID,
    email: str | None = None,
) -> Profile:
    profile = await session.get(Profile, user_id)
    if profile is None:
        profile = Profile(
            id=user_id,
            email=email,
            last_active_at=datetime.now(timezone.utc),
        )
        session.add(profile)
        await session.flush()
    return profile


def _encode_cursor(video: Video) -> str:
    score = float(video.ranking_score or 0)
    return f"{score:.4f}|{video.created_at.isoformat()}|{video.id}"


def _decode_cursor(cursor: str) -> tuple[tuple[float, datetime], uuid.UUID]:
    try:
        score_str, created_at_str, uuid_str = cursor.split("|", 2)
        score = float(score_str)
        created_at = datetime.fromisoformat(created_at_str)
        if created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=timezone.utc)
        return (score, created_at), uuid.UUID(uuid_str)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid cursor format") from exc


def _safe_email_local(email: str | None) -> str | None:
    if not email or "@" not in email:
        return email
    return email.split("@", 1)[0]
