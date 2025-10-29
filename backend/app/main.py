from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager, suppress

from fastapi import FastAPI

from app.api.routes import router
from app.core.settings import get_settings
from app.db.session import init_database
from app.services.token_refresher import SessionData, TokenRefresher, seconds_until_expiry

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    refresher = TokenRefresher(settings)
    stop_event = asyncio.Event()

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

    task = asyncio.create_task(refresh_loop())
    try:
        await init_database()
        yield
    finally:
        stop_event.set()
        task.cancel()
        with suppress(asyncio.CancelledError):
            await task


app = FastAPI(title="Flow Veo3 Proxy", version="0.2.0", lifespan=lifespan)
app.include_router(router)
