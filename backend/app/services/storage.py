from __future__ import annotations

import asyncio
from dataclasses import dataclass
from pathlib import Path
from typing import Optional
from urllib.parse import urlparse
import uuid

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.settings import Settings, get_settings
from app.db.models import AssetType, Video, VideoAsset
from app.utils.flow_status import FlowStatusUpdate


@dataclass(slots=True)
class StoredMedia:
    storage_key: str | None
    file_path: str | None
    public_url: str | None


class StorageService:
    def __init__(self, settings: Settings | None = None) -> None:
        self._settings_override = settings

    async def handle_status_update(self, session: AsyncSession, video: Video, update: FlowStatusUpdate) -> None:
        if not update.video_url and not update.thumbnail_url:
            return

        settings = self._settings_override or get_settings()
        backend = settings.media_storage_backend

        if update.video_url:
            asset = await self._upsert_asset(
                session=session,
                video=video,
                asset_type=AssetType.VIDEO,
                source_url=update.video_url,
                backend=backend,
                settings=settings,
                duration_seconds=update.duration_seconds,
            )
            if asset.public_url:
                video.video_url = asset.public_url
            elif asset.file_path:
                video.video_url = asset.file_path

        if update.thumbnail_url:
            asset = await self._upsert_asset(
                session=session,
                video=video,
                asset_type=AssetType.THUMBNAIL,
                source_url=update.thumbnail_url,
                backend=backend,
                settings=settings,
            )
            if asset.public_url:
                video.thumbnail_url = asset.public_url
            elif asset.file_path:
                video.thumbnail_url = asset.file_path

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
        elif backend == "gcp":  # TODO: integrate with GCP bucket upload
            stored = StoredMedia(storage_key=source_url, file_path=None, public_url=source_url)
        else:
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

    async def _download_to_local(
        self,
        video_id: uuid.UUID,
        asset_type: AssetType,
        source_url: str,
        settings: Settings,
    ) -> StoredMedia:
        video_id_str = str(video_id)
        filename = self._build_filename(video_id_str, asset_type, source_url)
        destination = settings.media_root / filename

        if not destination.exists():
            async with httpx.AsyncClient(timeout=httpx.Timeout(120.0)) as client:
                response = await client.get(source_url)
            response.raise_for_status()
            data = response.content
            await asyncio.to_thread(self._write_file, destination, data)

        public_url = self._build_public_url(settings.media_public_base, filename)
        return StoredMedia(storage_key=filename, file_path=str(destination), public_url=public_url)

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
