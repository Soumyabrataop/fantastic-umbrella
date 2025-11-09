#!/usr/bin/env python3
"""
Database Connectivity Check Script
Tests database connection and basic operations.
"""

import asyncio
import sys
import os
from pathlib import Path

# Add backend to path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

try:
    from app.db.session import get_session_factory
    from app.core.settings import get_settings
    from sqlalchemy import text
    from sqlalchemy.ext.asyncio import AsyncSession
except ImportError as e:
    print(f"❌ Failed to import required modules: {e}")
    print("Make sure you're running this from the backend/scripts directory")
    sys.exit(1)

async def test_database_connection():
    """Test database connection and basic query"""
    try:
        settings = get_settings()
        print(f"[CHECK] Testing database connection to: {settings.database_url.split('@')[1] if '@' in settings.database_url else 'configured URL'}")

        session_factory = get_session_factory()
        async with session_factory() as session:
            # Test basic connection
            result = await session.execute(text("SELECT 1 as test"))
            row = result.first()
            if row and row.test == 1:
                print("SUCCESS: Database connection successful")
            else:
                print("ERROR: Database query failed - unexpected result")
                return False

            # Test if tables exist (check for videos table)
            result = await session.execute(text("""
                SELECT EXISTS (
                    SELECT 1
                    FROM information_schema.tables
                    WHERE table_name = 'videos'
                ) as table_exists
            """))
            row = result.first()
            if row and row.table_exists:
                print("SUCCESS: Videos table exists")
            else:
                print("WARNING: Videos table not found - database may need migration")
                return False

            # Test video count
            result = await session.execute(text("SELECT COUNT(*) as video_count FROM videos"))
            row = result.first()
            video_count = row.video_count if row else 0
            print(f"INFO: Current video count: {video_count}")

        return True

    except Exception as e:
        print(f"ERROR: Database connection failed: {str(e)}")
        return False

def main():
    print("[CHECK] InstaVEO Database Health Check")
    print("=" * 50)

    # Run async test
    success = asyncio.run(test_database_connection())

    print("\n" + "=" * 50)
    if success:
        print("SUCCESS: Database connection is healthy!")
        return 0
    else:
        print("WARNING: Database issues detected.")
        return 1

if __name__ == "__main__":
    sys.exit(main())