"""
ZappAI Backend - FastAPI Application

Storage Architecture:
- Temporary: Google Drive (videos after generation, before publish)
- Permanent: Cloudflare R2 (videos after user clicks publish)
- No local filesystem fallback - Google OAuth required

Multi-Account System:
- Supports multiple Google accounts for Flow API load balancing
- Automatic rotation and failover on account failures
- Cookie management per account with health tracking
"""
from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager, suppress

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import flow_client, router, storage_service
from app.api.auth_routes import router as auth_router
from app.core.settings import get_settings
from app.db.session import get_session_factory, init_database
from app.services.multi_account_refresher import MultiAccountRefresher
from app.services.video_queue import VideoQueue

logger = logging.getLogger("uvicorn.error").getChild("lifespan")


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    session_factory = get_session_factory()
    video_queue = VideoQueue(session_factory, flow_client=flow_client, storage_service=storage_service, settings=settings)
    
    # Initialize multi-account cookie refresher
    account_refresher = MultiAccountRefresher(settings)

    try:
        await init_database()
        
        # Start multi-account cookie refresher
        await account_refresher.start()
        logger.info(f"✅ Multi-account refresher started for {len(settings.google_emails)} accounts")
        
        # Start the video queue worker
        await video_queue.start()
        logger.info("Video queue worker started")
        app.state.video_queue = video_queue
        app.state.account_refresher = account_refresher
        
        yield
    finally:
        # Cleanup
        await account_refresher.stop()
        await video_queue.stop()
        logger.info("Application shutdown complete")


app = FastAPI(title="Flow Veo3 Proxy", version="0.2.0", lifespan=lifespan)

# Add CORS middleware to allow frontend to make requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)
app.include_router(auth_router)  # Add Google OAuth routes

# No local media mounting - using Google Drive + Cloudflare R2 only
