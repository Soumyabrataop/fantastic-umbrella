from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager, suppress

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.api.routes import flow_client, router, storage_service
from app.core.settings import get_settings
from app.db.session import get_session_factory, init_database
from app.services.cookie_refresher import CookieRefresher
from app.services.token_refresher import CookieExpiredError, SessionData, TokenRefresher, seconds_until_expiry
from app.services.video_queue import VideoQueue

logger = logging.getLogger("uvicorn.error").getChild("lifespan")


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    refresher = TokenRefresher(settings)
    cookie_refresher = CookieRefresher(settings)
    stop_event = asyncio.Event()
    session_factory = get_session_factory()
    video_queue = VideoQueue(session_factory, flow_client=flow_client, storage_service=storage_service, settings=settings)

    async def refresh_loop() -> None:
        session: SessionData | None = None
        consecutive_cookie_failures = 0
        
        while not stop_event.is_set():
            delay = 120.0
            try:
                session = await refresher.fetch_session()
                refresher.persist_token(session)
                delay = seconds_until_expiry(session, settings.token_refresh_margin_seconds)
                delay = max(delay, 60.0)
                consecutive_cookie_failures = 0  # Reset failure counter on success
                logger.info("Token refreshed; next refresh in %.0f seconds", delay)
                
            except CookieExpiredError as exc:
                # Cookies are expired - trigger immediate full refresh
                logger.error("❌ Cookies expired: %s", exc)
                logger.info("🔄 Triggering immediate full cookie refresh...")
                
                try:
                    await cookie_refresher.refresh_now()
                    logger.info("✅ Cookie refresh successful - will retry token refresh in 10 seconds")
                    delay = 10.0  # Retry token refresh shortly after cookie refresh
                    consecutive_cookie_failures = 0
                except Exception as refresh_exc:
                    consecutive_cookie_failures += 1
                    logger.error("❌ Cookie refresh failed (%s) - attempt %d", refresh_exc, consecutive_cookie_failures)
                    
                    # Exponential backoff for cookie refresh failures (max 1 hour)
                    delay = min(60.0 * (2 ** consecutive_cookie_failures), 3600.0)
                    logger.warning("⏳ Retrying in %.0f seconds", delay)
                    
            except Exception as exc:  # noqa: BLE001 - want to log any failure
                logger.warning("Token refresh failed (%s); retrying in %s seconds", exc, delay)
                
            try:
                await asyncio.wait_for(stop_event.wait(), timeout=delay)
            except asyncio.TimeoutError:
                continue

    refresh_task = asyncio.create_task(refresh_loop(), name="token-refresh")
    try:
        await init_database()
        await cookie_refresher.start()  # Start 21-hour cookie refresh loop
        await video_queue.start()
        logger.info("Video queue worker scheduled")
        app.state.video_queue = video_queue
        yield
    finally:
        stop_event.set()
        await cookie_refresher.stop()  # Stop cookie refresh loop
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
