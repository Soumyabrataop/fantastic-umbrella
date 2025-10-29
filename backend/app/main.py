from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager, suppress

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.api.routes import flow_client, router, storage_service
from app.core.settings import get_settings
from app.db.session import get_session_factory, init_database
from app.services.token_refresher import SessionData, TokenRefresher, seconds_until_expiry
from app.services.video_queue import VideoQueue

logger = logging.getLogger("uvicorn.error").getChild("lifespan")


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    refresher = TokenRefresher(settings)
    stop_event = asyncio.Event()
    session_factory = get_session_factory()
    video_queue = VideoQueue(session_factory, flow_client=flow_client, storage_service=storage_service, settings=settings)

    async def refresh_loop() -> None:
        session: SessionData | None = None
        while not stop_event.is_set():
            delay = 120.0
            try:
                session = await refresher.fetch_session()
                refresher.persist_token(session)
                delay = seconds_until_expiry(session, settings.token_refresh_margin_seconds)
                delay = max(delay, 60.0)
                logger.info("Token refreshed; next refresh in %.0f seconds", delay)
            except Exception as exc:  # noqa: BLE001 - want to log any failure
                logger.warning("Token refresh failed (%s); retrying in %s seconds", exc, delay)
            try:
                await asyncio.wait_for(stop_event.wait(), timeout=delay)
            except asyncio.TimeoutError:
                continue

    refresh_task = asyncio.create_task(refresh_loop(), name="token-refresh")
    try:
        await init_database()
        await video_queue.start()
        logger.info("Video queue worker scheduled")
        app.state.video_queue = video_queue
        yield
    finally:
        stop_event.set()
        await video_queue.stop()
        refresh_task.cancel()
        with suppress(asyncio.CancelledError):
            await refresh_task


app = FastAPI(title="Flow Veo3 Proxy", version="0.2.0", lifespan=lifespan)
app.include_router(router)

settings = get_settings()
if settings.media_storage_backend == "local":
    mount_path = settings.media_public_base or "/media"
    if not mount_path.startswith("/"):
        mount_path = f"/{mount_path}"
    app.mount(mount_path, StaticFiles(directory=settings.media_root, check_dir=True), name="media")
