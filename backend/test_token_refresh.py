from __future__ import annotations

import asyncio
import json
from pathlib import Path

from app.services.token_refresher import TokenRefresher


async def main() -> None:
    refresher = TokenRefresher()
    session = await refresher.fetch_session()

    print("Access token:")
    print(session.access_token)
    print()
    print("Expires:", session.expires.isoformat())

    output_path = Path("session_dump.json")
    output_path.write_text(
        json.dumps(
            {
                "access_token": session.access_token,
                "expires": session.expires.isoformat(),
                "user": session.user,
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    print(f"Session JSON written to {output_path.resolve()}")


if __name__ == "__main__":
    asyncio.run(main())