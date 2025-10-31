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
from app.db.models import AssetType, Video, VideoAsset
from app.services.gcp_storage import GCPStorageClient
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
        self._gcp_client: GCPStorageClient | None = None
        
        # Initialize GCP client if backend is "gcp"
        settings = self._settings_override or get_settings()
        if settings.media_storage_backend == "gcp":
            if not settings.gcp_media_bucket:
                logger.warning("GCP storage backend selected but GCP_MEDIA_BUCKET not configured. Falling back to local storage.")
            else:
                try:
                    self._gcp_client = GCPStorageClient(
                        bucket_name=settings.gcp_media_bucket,
                        credentials_path=settings.gcp_credentials_path,
                    )
                    logger.info(f"GCP Storage client initialized for bucket: {settings.gcp_media_bucket}")
                except Exception as e:
                    logger.error(f"Failed to initialize GCP Storage client: {e}. Falling back to local storage.")
                    self._gcp_client = None

    async def handle_status_update(self, session: AsyncSession, video: Video, update: FlowStatusUpdate) -> None:
        if not update.video_url and not update.thumbnail_url:
            return

        settings = self._settings_override or get_settings()
        backend = settings.media_storage_backend
        
        # Fall back to local if GCP client failed to initialize
        if backend == "gcp" and self._gcp_client is None:
            logger.warning(f"GCP client not available for video {video.id}, falling back to local storage")
            backend = "local"

        if update.video_url:
            try:
                asset = await self._upsert_asset(
                    session=session,
                    video=video,
                    asset_type=AssetType.VIDEO,
                    source_url=update.video_url,
                    backend=backend,
                    settings=settings,
                    duration_seconds=update.duration_seconds,
                )
                # Generate signed URL for GCP assets
                if backend == "gcp" and asset.storage_key and self._gcp_client:
                    try:
                        signed_url = self._gcp_client.generate_signed_url(
                            asset.storage_key,
                            expiration_seconds=settings.gcp_signed_url_expiration,
                        )
                        asset.public_url = signed_url
                        video.video_url = signed_url
                    except Exception as e:
                        logger.error(f"Failed to generate signed URL for video asset {asset.id}: {e}")
                        video.video_url = asset.public_url or ""
                elif asset.public_url:
                    video.video_url = asset.public_url
                elif asset.file_path:
                    video.video_url = asset.file_path
            except Exception as e:
                logger.error(f"Failed to process video asset for video {video.id}: {e}", exc_info=True)
                # If GCP fails, try falling back to local storage
                if backend == "gcp":
                    logger.warning(f"Attempting fallback to local storage for video {video.id}")
                    try:
                        asset = await self._upsert_asset(
                            session=session,
                            video=video,
                            asset_type=AssetType.VIDEO,
                            source_url=update.video_url,
                            backend="local",
                            settings=settings,
                            duration_seconds=update.duration_seconds,
                        )
                        video.video_url = asset.public_url or asset.file_path or ""
                        logger.info(f"Successfully fell back to local storage for video {video.id}")
                    except Exception as fallback_error:
                        logger.error(f"Fallback to local storage also failed for video {video.id}: {fallback_error}", exc_info=True)
                        raise RuntimeError(f"Failed to store video asset: {e}") from e
                else:
                    raise RuntimeError(f"Failed to store video asset: {e}") from e

        if update.thumbnail_url:
            try:
                asset = await self._upsert_asset(
                    session=session,
                    video=video,
                    asset_type=AssetType.THUMBNAIL,
                    source_url=update.thumbnail_url,
                    backend=backend,
                    settings=settings,
                )
                # Generate signed URL for GCP assets
                if backend == "gcp" and asset.storage_key and self._gcp_client:
                    try:
                        signed_url = self._gcp_client.generate_signed_url(
                            asset.storage_key,
                            expiration_seconds=settings.gcp_signed_url_expiration,
                        )
                        asset.public_url = signed_url
                        video.thumbnail_url = signed_url
                    except Exception as e:
                        logger.error(f"Failed to generate signed URL for thumbnail asset {asset.id}: {e}")
                        video.thumbnail_url = asset.public_url
                elif asset.public_url:
                    video.thumbnail_url = asset.public_url
                elif asset.file_path:
                    video.thumbnail_url = asset.file_path
            except Exception as e:
                logger.error(f"Failed to process thumbnail asset for video {video.id}: {e}", exc_info=True)
                # If GCP fails, try falling back to local storage
                if backend == "gcp":
                    logger.warning(f"Attempting fallback to local storage for thumbnail of video {video.id}")
                    try:
                        asset = await self._upsert_asset(
                            session=session,
                            video=video,
                            asset_type=AssetType.THUMBNAIL,
                            source_url=update.thumbnail_url,
                            backend="local",
                            settings=settings,
                        )
                        video.thumbnail_url = asset.public_url or asset.file_path
                        logger.info(f"Successfully fell back to local storage for thumbnail of video {video.id}")
                    except Exception as fallback_error:
                        logger.error(f"Fallback to local storage also failed for thumbnail of video {video.id}: {fallback_error}", exc_info=True)
                        # Thumbnail is not critical, log but don't fail the entire operation
                        logger.warning(f"Continuing without thumbnail for video {video.id}")
                else:
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
    ) -> VideoAsset:
        stmt = select(VideoAsset).where(
            VideoAsset.video_id == video.id,
            VideoAsset.asset_type == asset_type,
        )
        result = await session.execute(stmt)
        asset = result.scalar_one_or_none()

        stored: StoredMedia
        if backend == "local":
            stored = await self._download_to_local(video.id, asset_type, source_url, settings)
        elif backend == "gcp":
            stored = await self._upload_to_gcp(video.id, asset_type, source_url, settings)
        else:
            # Unknown backend, store source URL as fallback
            logger.warning(f"Unknown storage backend '{backend}', using source URL as fallback")
            stored = StoredMedia(storage_key=source_url, file_path=None, public_url=source_url)

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

    async def _upload_to_gcp(
        self,
        video_id: uuid.UUID,
        asset_type: AssetType,
        source_url: str,
        settings: Settings,
    ) -> StoredMedia:
        """
        Download asset from Flow API and upload to GCP bucket.
        
        Args:
            video_id: UUID of the video
            asset_type: Type of asset (video or thumbnail)
            source_url: Flow API URL to download from
            settings: Application settings
            
        Returns:
            StoredMedia with GCP blob name and signed URL
            
        Raises:
            RuntimeError: If GCP client not initialized
            httpx.HTTPError: If download from Flow API fails
            Exception: If upload to GCP fails after retries
        """
        if not self._gcp_client:
            error_msg = f"GCP client not initialized for video {video_id}"
            logger.error(error_msg)
            raise RuntimeError(error_msg)
        
        video_id_str = str(video_id)
        filename = self._build_filename(video_id_str, asset_type, source_url)
        
        # Build GCP blob path: videos/{video_id}/{filename}
        blob_name = f"videos/{video_id_str}/{filename}"
        
        try:
            # Download from Flow API with error context
            logger.info(f"Downloading {asset_type.value} asset for video {video_id} from Flow API: {source_url}")
            async with httpx.AsyncClient(timeout=httpx.Timeout(120.0)) as client:
                response = await client.get(source_url)
            response.raise_for_status()
            data = response.content
            logger.info(f"Downloaded {len(data)} bytes for video {video_id} ({asset_type.value})")
            
            # Upload to GCP with retry logic (handled by GCPStorageClient)
            logger.info(f"Uploading {asset_type.value} for video {video_id} to GCP bucket: {blob_name}")
            await self._gcp_client.upload_file(
                source_data=data,
                destination_blob_name=blob_name,
            )
            
            # Generate signed URL
            logger.info(f"Generating signed URL for video {video_id} ({asset_type.value})")
            signed_url = self._gcp_client.generate_signed_url(
                blob_name,
                expiration_seconds=settings.gcp_signed_url_expiration,
            )
            
            logger.info(f"Successfully uploaded {asset_type.value} asset to GCP for video {video_id}: {blob_name}")
            return StoredMedia(
                storage_key=blob_name,
                file_path=None,
                public_url=signed_url,
            )
            
        except httpx.HTTPStatusError as e:
            error_msg = f"HTTP {e.response.status_code} error downloading {asset_type.value} from Flow API for video {video_id}: {e}"
            logger.error(error_msg, extra={"video_id": str(video_id), "asset_type": asset_type.value, "status_code": e.response.status_code})
            raise RuntimeError(error_msg) from e
        except httpx.RequestError as e:
            error_msg = f"Network error downloading {asset_type.value} from Flow API for video {video_id}: {e}"
            logger.error(error_msg, extra={"video_id": str(video_id), "asset_type": asset_type.value})
            raise RuntimeError(error_msg) from e
        except Exception as e:
            error_msg = f"Failed to upload {asset_type.value} to GCP for video {video_id}: {e}"
            logger.error(error_msg, extra={"video_id": str(video_id), "asset_type": asset_type.value}, exc_info=True)
            raise RuntimeError(error_msg) from e

    async def _download_to_local(
        self,
        video_id: uuid.UUID,
        asset_type: AssetType,
        source_url: str,
        settings: Settings,
    ) -> StoredMedia:
        """
        Download asset from Flow API and save to local filesystem.
        
        Args:
            video_id: UUID of the video
            asset_type: Type of asset (video or thumbnail)
            source_url: Flow API URL to download from
            settings: Application settings
            
        Returns:
            StoredMedia with local file path and public URL
            
        Raises:
            RuntimeError: If download or file write fails
        """
        video_id_str = str(video_id)
        filename = self._build_filename(video_id_str, asset_type, source_url)
        destination = settings.media_root / filename

        if not destination.exists():
            try:
                logger.info(f"Downloading {asset_type.value} asset for video {video_id} from Flow API: {source_url}")
                async with httpx.AsyncClient(timeout=httpx.Timeout(120.0)) as client:
                    response = await client.get(source_url)
                response.raise_for_status()
                data = response.content
                logger.info(f"Downloaded {len(data)} bytes for video {video_id} ({asset_type.value})")
                
                logger.info(f"Writing {asset_type.value} to local file: {destination}")
                await asyncio.to_thread(self._write_file, destination, data)
                logger.info(f"Successfully saved {asset_type.value} to local storage for video {video_id}")
            except httpx.HTTPStatusError as e:
                error_msg = f"HTTP {e.response.status_code} error downloading {asset_type.value} from Flow API for video {video_id}: {e}"
                logger.error(error_msg, extra={"video_id": str(video_id), "asset_type": asset_type.value, "status_code": e.response.status_code})
                raise RuntimeError(error_msg) from e
            except httpx.RequestError as e:
                error_msg = f"Network error downloading {asset_type.value} from Flow API for video {video_id}: {e}"
                logger.error(error_msg, extra={"video_id": str(video_id), "asset_type": asset_type.value})
                raise RuntimeError(error_msg) from e
            except OSError as e:
                error_msg = f"Failed to write {asset_type.value} to local file for video {video_id}: {e}"
                logger.error(error_msg, extra={"video_id": str(video_id), "asset_type": asset_type.value, "file_path": str(destination)})
                raise RuntimeError(error_msg) from e
            except Exception as e:
                error_msg = f"Unexpected error saving {asset_type.value} to local storage for video {video_id}: {e}"
                logger.error(error_msg, extra={"video_id": str(video_id), "asset_type": asset_type.value}, exc_info=True)
                raise RuntimeError(error_msg) from e

        public_url = self._build_public_url(settings.media_public_base, filename)
        return StoredMedia(storage_key=filename, file_path=str(destination), public_url=public_url)

    async def refresh_signed_urls(
        self,
        session: AsyncSession,
        video: Video,
    ) -> None:
        """
        Regenerate signed URLs for all GCP assets of a video if they are near expiration.
        
        This method checks the updated_at timestamp of each asset and regenerates
        signed URLs if they are older than 50 minutes (configurable threshold).
        
        Args:
            session: Database session
            video: Video object with assets to refresh
        """
        if not self._gcp_client:
            return
        
        settings = self._settings_override or get_settings()
        
        # Calculate expiration threshold (50 minutes by default, 10 minutes before expiration)
        expiration_threshold_seconds = settings.gcp_signed_url_expiration - 600
        threshold_time = datetime.now(timezone.utc) - timedelta(seconds=expiration_threshold_seconds)
        
        # Query all GCP assets for this video
        stmt = select(VideoAsset).where(
            VideoAsset.video_id == video.id,
            VideoAsset.storage_backend == "gcp",
        )
        result = await session.execute(stmt)
        assets = result.scalars().all()
        
        for asset in assets:
            # Check if asset needs URL refresh
            if asset.updated_at < threshold_time and asset.storage_key:
                try:
                    logger.info(f"Refreshing signed URL for asset {asset.id} (blob: {asset.storage_key})")
                    signed_url = self._gcp_client.generate_signed_url(
                        asset.storage_key,
                        expiration_seconds=settings.gcp_signed_url_expiration,
                    )
                    asset.public_url = signed_url
                    asset.updated_at = datetime.now(timezone.utc)
                    
                    # Update video URLs
                    if asset.asset_type == AssetType.VIDEO:
                        video.video_url = signed_url
                    elif asset.asset_type == AssetType.THUMBNAIL:
                        video.thumbnail_url = signed_url
                    
                    session.add(asset)
                    logger.info(f"Successfully refreshed signed URL for asset {asset.id}")
                    
                except Exception as e:
                    logger.error(f"Failed to refresh signed URL for asset {asset.id}: {e}")
        
        await session.flush()

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
