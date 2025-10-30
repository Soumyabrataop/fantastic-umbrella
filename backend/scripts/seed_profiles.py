from __future__ import annotations

import sys
from pathlib import Path
import asyncio
import uuid
from datetime import datetime, timezone

# Ensure the backend package is importable when running this script directly
# by adding the backend project root to sys.path.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

# When running the seeding script outside the full app/containers (e.g. on Windows),
# the configured database host (like "postgres") may not be resolvable (socket.gaierror).
# Provide a safe default to a local SQLite async DB unless DATABASE_URL is already set.
import os
os.environ.setdefault(
    "SUPABASE_DB_URL",
    "sqlite+aiosqlite:///./dev.db"
)

from app.db.models import Profile
from app.db.session import get_session_factory, init_database

DEMO_USERS = [
    {
        "id": uuid.uuid5(uuid.NAMESPACE_DNS, "demo-creator-1"),
        "username": "demo_creative",
        "email": "demo1@example.com",
        "avatar_url": None,
        "bio": "Exploring AI-powered storytelling.",
    },
    {
        "id": uuid.uuid5(uuid.NAMESPACE_DNS, "demo-creator-2"),
        "username": "motion_master",
        "email": "demo2@example.com",
        "avatar_url": None,
        "bio": "I turn prompts into cinematic clips.",
    },
    {
        "id": uuid.uuid5(uuid.NAMESPACE_DNS, "demo-creator-3"),
        "username": "visual_vibes",
        "email": "demo3@example.com",
        "avatar_url": None,
        "bio": "Sharing daily Flow experiments.",
    },
]


async def seed_profiles() -> None:
    await init_database()
    session_factory = get_session_factory()
    now = datetime.now(timezone.utc)

    async with session_factory() as session:
        for user in DEMO_USERS:
            profile = await session.get(Profile, user["id"])
            if profile:
                continue
            profile = Profile(
                id=user["id"],
                username=user["username"],
                email=user["email"],
                avatar_url=user["avatar_url"],
                bio=user["bio"],
                last_active_at=now,
            )
            session.add(profile)
        await session.commit()


def main() -> None:
    asyncio.run(seed_profiles())


if __name__ == "__main__":
    main()
