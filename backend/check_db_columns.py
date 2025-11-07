"""Quick script to check if Google OAuth columns exist in database."""
import asyncio
from sqlalchemy import text
from app.db.session import get_session_factory

async def check_columns():
    async with get_session_factory()() as session:
        result = await session.execute(
            text(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_name='profiles' AND column_name IN "
                "('google_access_token', 'google_refresh_token', 'google_token_expiry')"
            )
        )
        columns = [r[0] for r in result.fetchall()]
        print("Google OAuth columns found:", columns)
        
        # Also check Video table
        result2 = await session.execute(
            text(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_name='videos' AND column_name IN "
                "('is_published', 'google_drive_file_id', 'google_drive_thumbnail_id')"
            )
        )
        video_columns = [r[0] for r in result2.fetchall()]
        print("Video Drive columns found:", video_columns)

if __name__ == "__main__":
    asyncio.run(check_columns())
