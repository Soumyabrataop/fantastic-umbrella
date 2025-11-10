from __future__ import annotations

import asyncio
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
import logging
from pathlib import Path
from typing import Optional
from urllib.parse import urlparse
import uuid

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.settings import Settings, get_settings
from app.db.models import AssetType, Video, VideoAsset, Profile
from app.services.google_drive import GoogleDriveService
from app.utils.flow_status import FlowStatusUpdate

logger = logging.getLogger(__name__)


@dataclass(slots=True)
class StoredMedia:
    storage_key: str | None
    file_path: str | None
    public_url: str | None


class StorageService:
    def __init__(self, settings: Settings | None = None) -> None:
        self._settings_override = settings

    async def get_drive_service_for_user(self, session: AsyncSession, user_id: uuid.UUID) -> GoogleDriveService | None:
        """Get Google Drive service for a user if they have valid OAuth tokens."""
        stmt = select(Profile).where(Profile.id == user_id)
        result = await session.execute(stmt)
        profile = result.scalar_one_or_none()
        
        if not profile:
            logger.warning(f"User {user_id} profile not found in database")
            return None
            
        if not profile.google_access_token or not profile.google_refresh_token:
            logger.warning(
                f"User {user_id} does not have Google OAuth tokens. "
                f"User must sign in with Google through Supabase to enable Drive uploads. "
                f"Has access_token: {bool(profile.google_access_token)}, "
                f"Has refresh_token: {bool(profile.google_refresh_token)}"
            )
            return None
        
        settings = self._settings_override or get_settings()
        try:
            drive_service = GoogleDriveService(
                access_token=profile.google_access_token,
                refresh_token=profile.google_refresh_token,
                token_expiry=profile.google_token_expiry,
                settings=settings,
            )
            
            # Update tokens if they were refreshed
            new_token, new_expiry = drive_service.get_updated_tokens()
            if new_token != profile.google_access_token:
                profile.google_access_token = new_token
                profile.google_token_expiry = new_expiry
                session.add(profile)
                await session.flush()
                logger.info(f"Updated refreshed OAuth tokens for user {user_id}")
            
            return drive_service
        except Exception as e:
            logger.error(f"Failed to create Drive service for user {user_id}: {e}")
            return None

    async def handle_status_update(self, session: AsyncSession, video: Video, update: FlowStatusUpdate) -> None:
        if not update.video_url and not update.thumbnail_url:
            return

        settings = self._settings_override or get_settings()
        
        # ONLY use Google Drive - no fallback to local storage
        drive_service = await self.get_drive_service_for_user(session, video.user_id)
        if not drive_service:
            raise RuntimeError(
                f"User {video.user_id} must sign in with Google to upload videos. "
                f"Google Drive OAuth tokens are required - no local storage fallback."
            )

        if update.video_url:
            asset = await self._upsert_asset(
                session=session,
                video=video,
                asset_type=AssetType.VIDEO,
                source_url=update.video_url,
                backend="drive",
                settings=settings,
                duration_seconds=update.duration_seconds,
                drive_service=drive_service,
            )
            # Store Drive file ID and URL (temporary storage)
            video.google_drive_file_id = asset.storage_key
            video.video_url = asset.public_url or ""
            logger.info(f"Uploaded video to Google Drive (temporary) for video {video.id}, file_id={asset.storage_key}")

        if update.thumbnail_url:
            try:
                asset = await self._upsert_asset(
                    session=session,
                    video=video,
                    asset_type=AssetType.THUMBNAIL,
                    source_url=update.thumbnail_url,
                    backend="drive",
                    settings=settings,
                    drive_service=drive_service,
                )
                # Store Drive thumbnail ID and URL (temporary storage)
                video.google_drive_thumbnail_id = asset.storage_key
                video.thumbnail_url = asset.public_url or ""
                logger.info(f"Uploaded thumbnail to Google Drive (temporary) for video {video.id}, file_id={asset.storage_key}")
            except Exception as e:
                logger.error(f"Failed to process thumbnail asset for video {video.id}: {e}", exc_info=True)
                # Thumbnail is not critical, log but don't fail the entire operation
                logger.warning(f"Continuing without thumbnail for video {video.id}")

    async def _upsert_asset(
        self,
        session: AsyncSession,
        video: Video,
        asset_type: AssetType,
        source_url: str,
        backend: str,
        settings: Settings,
        duration_seconds: Optional[int] = None,
        drive_service: GoogleDriveService | None = None,
    ) -> VideoAsset:
        stmt = select(VideoAsset).where(
            VideoAsset.video_id == video.id,
            VideoAsset.asset_type == asset_type,
        )
        result = await session.execute(stmt)
        asset = result.scalar_one_or_none()

        # ONLY Google Drive - no local storage fallback
        if not drive_service:
            raise RuntimeError("Google Drive service is required - no fallback storage available")
        
        stored = await self._upload_to_drive(
            video.id, 
            asset_type, 
            source_url, 
            settings, 
            drive_service, 
            is_published=video.is_published
        )

        if asset is None:
            asset = VideoAsset(video_id=video.id, asset_type=asset_type)

        asset.storage_backend = backend
        asset.storage_key = stored.storage_key
        asset.file_path = stored.file_path
        asset.public_url = stored.public_url
        asset.source_url = source_url
        if asset_type == AssetType.VIDEO and duration_seconds is not None:
            asset.duration_seconds = duration_seconds

        session.add(asset)
        await session.flush()
        return asset

    async def _upload_to_drive(
        self,
        video_id: uuid.UUID,
        asset_type: AssetType,
        source_url: str,
        settings: Settings,
        drive_service: GoogleDriveService,
        is_published: bool = False,
    ) -> StoredMedia:
        """
        Download asset from Flow API and upload to user's Google Drive.
        
        Args:
            video_id: UUID of the video
            asset_type: Type of asset (video or thumbnail)
            source_url: Flow API URL to download from
            settings: Application settings
            drive_service: Google Drive service for the user
            is_published: Whether video is published (controls Drive file visibility)
            
        Returns:
            StoredMedia with Drive file ID and URL
        """
        video_id_str = str(video_id)
        filename = self._build_filename(video_id_str, asset_type, source_url)
        
        # Download from temp location first
        temp_path = settings.media_root / "temp" / filename
        
        try:
            # Download from Flow API
            logger.info(f"Downloading {asset_type.value} asset for video {video_id} from Flow API: {source_url}")
            async with httpx.AsyncClient(timeout=httpx.Timeout(120.0)) as client:
                response = await client.get(source_url)
            response.raise_for_status()
            data = response.content
            logger.info(f"Downloaded {len(data)} bytes for video {video_id} ({asset_type.value})")
            
            # Save to temp file
            await asyncio.to_thread(self._write_file, temp_path, data)
            
            # Determine MIME type
            mime_type = "video/mp4" if asset_type == AssetType.VIDEO else "image/jpeg"
            
            # Upload to Drive (private by default, public if published)
            logger.info(f"Uploading {asset_type.value} for video {video_id} to Google Drive: {filename}")
            file_id = await asyncio.to_thread(
                drive_service.upload_file,
                temp_path,
                filename,
                mime_type,
                is_published,  # Make public only if video is published
            )
            
            # Get Drive URL
            drive_url = drive_service.get_file_url(file_id)
            
            # Clean up temp file
            try:
                temp_path.unlink()
            except Exception as e:
                logger.warning(f"Failed to delete temp file {temp_path}: {e}")
            
            logger.info(f"Successfully uploaded {asset_type.value} to Drive for video {video_id}: {file_id}")
            return StoredMedia(
                storage_key=file_id,  # Store Drive file ID
                file_path=None,
                public_url=drive_url,
            )
            
        except Exception as e:
            # Clean up temp file on error
            if temp_path.exists():
                try:
                    temp_path.unlink()
                except Exception as cleanup_error:
                    logger.warning(f"Failed to delete temp file after error: {cleanup_error}")
            
            error_msg = f"Failed to upload {asset_type.value} to Drive for video {video_id}: {e}"
            logger.error(error_msg, exc_info=True)
            raise RuntimeError(error_msg) from e

    async def upload_video_to_r2(self, session: AsyncSession, video: Video) -> None:
        """Upload video from Google Drive to R2 for publishing"""
        from app.services.r2_storage import R2StorageService
        
        if not video.google_drive_file_id:
            raise ValueError("Video has no Google Drive file ID")
        
        # Get Drive service to download the video
        drive_service = await self.get_drive_service_for_user(session, video.user_id)
        if not drive_service:
            raise RuntimeError(f"Cannot access Google Drive for user {video.user_id}")
        
        try:
            # Download video from Google Drive
            logger.info(f"Downloading video {video.id} from Drive: {video.google_drive_file_id}")
            video_bytes = await asyncio.to_thread(
                drive_service.download_file,
                video.google_drive_file_id
            )
            
            # Upload to R2
            r2_service = R2StorageService()
            object_key = f"videos/{video.id}.mp4"
            
            logger.info(f"Uploading video {video.id} to R2...")
            public_url = await r2_service.upload_from_bytes(
                video_bytes,
                object_key,
                content_type="video/mp4"
            )
            
            if not public_url:
                raise RuntimeError("Failed to upload video to R2")
            
            # Update video with R2 URL
            video.r2_video_url = public_url
            video.r2_object_key = object_key
            video.video_url = public_url
            
            logger.info(f"Video {video.id} published to R2: {public_url}")
            
        except Exception as e:
            logger.error(f"Failed to upload video {video.id} to R2: {e}")
            raise

    @staticmethod
    def _build_filename(video_id: str, asset_type: AssetType, source_url: str) -> str:
        parsed = urlparse(source_url)
        suffix = Path(parsed.path).suffix.lower()
        if not suffix:
            suffix = ".mp4" if asset_type == AssetType.VIDEO else ".jpg"

        if asset_type == AssetType.THUMBNAIL:
            return f"{video_id}_thumbnail{suffix}"
        return f"{video_id}{suffix}"

    @staticmethod
    def _build_public_url(base: str, filename: str) -> str:
        base = base.rstrip("/")
        if base.startswith("http://") or base.startswith("https://"):
            return f"{base}/{filename}"
        if not base:
            return filename
        return f"{base}/{filename}"

    @staticmethod
    def _write_file(destination: Path, data: bytes) -> None:
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(data)
