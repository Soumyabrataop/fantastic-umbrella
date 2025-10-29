from __future__ import annotations

import asyncio
import logging
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from sqlalchemy.orm import selectinload

from fastapi import Request

from app.core.settings import Settings, get_settings
from app.db.models import Profile, Video, VideoStatus
from app.schemas.video import CheckVideoStatusRequest, GenerateVideoRequest
from app.services.flow_client import FlowClient
from app.services.storage import StorageService
from app.utils.flow_status import FlowStatusUpdate, parse_flow_status
from app.utils.ranking import calculate_ranking_score

logger = logging.getLogger("uvicorn.error").getChild("video_queue")


@dataclass(frozen=True, slots=True)
class VideoJob:
    video_id: uuid.UUID
    scene_id: str


class VideoQueue:
    def __init__(
        self,
        session_factory: async_sessionmaker[AsyncSession],
        flow_client: FlowClient,
        storage_service: StorageService,
        settings: Settings | None = None,
    ) -> None:
        self._session_factory = session_factory
        self._flow_client = flow_client
        self._storage_service = storage_service
        self._settings = settings or get_settings()
        self._queue: asyncio.Queue[VideoJob] = asyncio.Queue(maxsize=self._settings.video_queue_maxsize)
        self._stop_event = asyncio.Event()
        self._worker_task: asyncio.Task[None] | None = None

    async def start(self) -> None:
        if self._worker_task is None:
            self._stop_event.clear()
            self._worker_task = asyncio.create_task(self._worker_loop(), name="video-queue-worker")

    async def stop(self) -> None:
        self._stop_event.set()
        if self._worker_task:
            self._worker_task.cancel()
            try:
                await self._worker_task
            except asyncio.CancelledError:
                pass
            self._worker_task = None

    async def enqueue(self, job: VideoJob) -> None:
        await self._queue.put(job)
        logger.info("Video job queued", extra={"video_id": str(job.video_id)})

    async def _worker_loop(self) -> None:
        logger.info("Video queue worker started")
        try:
            while not self._stop_event.is_set():
                try:
                    job = await asyncio.wait_for(self._queue.get(), timeout=1.0)
                except asyncio.TimeoutError:
                    continue
                try:
                    await self._process_job(job)
                except Exception as exc:  # noqa: BLE001
                    logger.exception("Video job failed: %s", exc, extra={"video_id": str(job.video_id)})
                finally:
                    self._queue.task_done()
        finally:
            logger.info("Video queue worker stopped")

    async def _process_job(self, job: VideoJob) -> None:
        async with self._session_factory() as session:
            video = await self._load_video(session, job.video_id)
            if video is None:
                logger.warning("Video job missing video record", extra={"video_id": str(job.video_id)})
                return

            profile = await self._ensure_profile(session, video.user_id)

            try:
                try:
                    await self._begin_generation(session, video, profile)
                    await self._run_generation(session, video, job.scene_id)
                except Exception:
                    await session.rollback()
                    raise
            except Exception as exc:  # noqa: BLE001
                await self._mark_failed(session, video, reason=str(exc))
                raise

    async def _begin_generation(self, session: AsyncSession, video: Video, profile: Profile) -> None:
        profile.last_active_at = datetime.now(timezone.utc)
        video.status = VideoStatus.PROCESSING
        video.failure_reason = None
        video.ranking_score = calculate_ranking_score(video)
        await session.commit()

    async def _run_generation(self, session: AsyncSession, video: Video, scene_id: str) -> None:
        generate_request = GenerateVideoRequest(
            prompt=video.prompt,
            aspectRatio=video.aspect_ratio,
            videoModelKey=video.model_key,
            seed=video.seed,
            sceneId=scene_id,
        )

        response = await self._flow_client.generate_video(generate_request)
        if response is None:
            logger.error(
                "Flow generate_video returned no payload",
                extra={"video_id": str(video.id)},
            )
            raise RuntimeError("Flow response missing operation name")

        operation_name = self._extract_operation_name(response)
        if not operation_name:
            logger.error(
                "Flow response missing operation name for video %s: %s",
                video.id,
                response,
                extra={"video_id": str(video.id), "response": response},
            )
            raise RuntimeError("Flow response missing operation name")
        video.operation_name = operation_name
        await session.commit()

        await self._poll_until_complete(session, video, scene_id)

    async def _poll_until_complete(self, session: AsyncSession, video: Video, scene_id: str) -> None:
        settings = self._settings
        for attempt in range(settings.video_status_max_polls):
            if attempt > 0:
                await asyncio.sleep(settings.video_status_poll_seconds)

            request = CheckVideoStatusRequest(operationName=video.operation_name, sceneId=scene_id)
            response = await self._flow_client.check_video_status(request)
            update = parse_flow_status(response)
            await self._apply_status_update(session, video, update)

            if update.status in {VideoStatus.COMPLETED, VideoStatus.FAILED}:
                return

        raise RuntimeError("Video generation timed out")

    async def _apply_status_update(self, session: AsyncSession, video: Video, update: FlowStatusUpdate) -> None:
        if update.status is not None:
            video.status = update.status
        if update.failure_reason:
            video.failure_reason = update.failure_reason

        await self._storage_service.handle_status_update(session, video, update)
        profile = await session.get(Profile, video.user_id)
        if profile:
            if update.status == VideoStatus.COMPLETED:
                profile.videos_created += 1
            profile.last_active_at = datetime.now(timezone.utc)

        video.ranking_score = calculate_ranking_score(video)
        await session.commit()

    async def _mark_failed(self, session: AsyncSession, video: Video, *, reason: str | None) -> None:
        video.status = VideoStatus.FAILED
        video.failure_reason = reason
        await session.commit()

    async def _load_video(self, session: AsyncSession, video_id: uuid.UUID) -> Video | None:
        # wait briefly for the record to become visible if the enqueue happened before commit
        for _ in range(5):
            video = await session.scalar(
                select(Video)
                .options(
                    selectinload(Video.creator),
                    selectinload(Video.assets),
                )
                .where(Video.id == video_id)
            )
            if video:
                return video
            await asyncio.sleep(0.2)
        return None

    async def _ensure_profile(self, session: AsyncSession, user_id: uuid.UUID) -> Profile:
        profile = await session.get(Profile, user_id)
        if profile is None:
            profile = Profile(id=user_id)
            session.add(profile)
            await session.commit()
            await session.refresh(profile)
        return profile

    @staticmethod
    def _extract_operation_name(response: dict[str, object] | None) -> str | None:
        if not isinstance(response, dict):
            return None
        operations = response.get("operations")
        if not isinstance(operations, list) or not operations:
            single = response.get("operation")
            if isinstance(single, dict):
                name = single.get("name")
                if isinstance(name, str):
                    return name
            if isinstance(single, str):
                return single
            name = response.get("name")
            return name if isinstance(name, str) else None
        first = operations[0]
        if not isinstance(first, dict):
            return str(first) if isinstance(first, str) else None
        operation = first.get("operation")
        if isinstance(operation, dict):
            name = operation.get("name")
            if isinstance(name, str):
                return name
        if isinstance(operation, str):
            return operation
        name = first.get("name")
        return name if isinstance(name, str) else None


def get_video_queue(request: Request) -> VideoQueue:
    queue: VideoQueue | None = getattr(request.app.state, "video_queue", None)
    if queue is None:
        raise RuntimeError("Video queue is not initialised")
    return queue
