"""
Full cookie refresh service using headless browser automation.
This refreshes the entire browser session (all cookies) every 21 hours.
"""
from __future__ import annotations

import asyncio
import json
import logging
import subprocess
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.core.settings import Settings

logger = logging.getLogger("uvicorn.error").getChild("cookie_refresher")

COOKIE_REFRESH_INTERVAL = 21 * 60 * 60  # 21 hours in seconds


def get_cookie_expiry_time(cookie_file: Path) -> datetime | None:
    """Get the earliest cookie expiration time from cookie.json."""
    try:
        if not cookie_file.exists():
            return None
            
        with cookie_file.open("r", encoding="utf-8") as f:
            cookies = json.load(f)
        
        earliest_expiry = None
        
        for entry in cookies:
            if not isinstance(entry, dict):
                continue
                
            # Skip metadata entries
            if "_metadata" in entry:
                continue
            
            # Check for expires field
            expires_str = entry.get("expires") or entry.get("expirationDate")
            if not expires_str:
                continue
            
            try:
                # Handle different expiry formats
                if isinstance(expires_str, (int, float)):
                    # Unix timestamp
                    expiry = datetime.fromtimestamp(expires_str, tz=timezone.utc)
                else:
                    # ISO format
                    expiry = datetime.fromisoformat(str(expires_str).replace("Z", "+00:00"))
                
                if earliest_expiry is None or expiry < earliest_expiry:
                    earliest_expiry = expiry
                    
            except (ValueError, TypeError):
                continue
        
        return earliest_expiry
        
    except Exception as exc:
        logger.warning("Could not read cookie expiry: %s", exc)
        return None


def should_refresh_cookies_early(cookie_file: Path, margin_hours: float = 3.0) -> bool:
    """Check if cookies should be refreshed early (within margin_hours of expiration)."""
    expiry = get_cookie_expiry_time(cookie_file)
    if not expiry:
        return False  # Can't determine, let scheduled refresh handle it
    
    now = datetime.now(timezone.utc)
    time_until_expiry = (expiry - now).total_seconds() / 3600  # in hours
    
    if time_until_expiry <= margin_hours:
        logger.info("Cookies expire in %.1f hours - triggering early refresh", time_until_expiry)
        return True
    
    return False


class CookieRefresher:
    """Service to refresh full browser session cookies periodically."""

    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self._stop_event = asyncio.Event()
        self._task: asyncio.Task | None = None

    async def start(self) -> None:
        """Start the cookie refresh loop."""
        self._stop_event.clear()
        self._task = asyncio.create_task(self._refresh_loop(), name="cookie-refresh")
        logger.info("Cookie refresh service started (interval: %.1f hours)", COOKIE_REFRESH_INTERVAL / 3600)

    async def stop(self) -> None:
        """Stop the cookie refresh loop."""
        if self._task and not self._task.done():
            self._stop_event.set()
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("Cookie refresh service stopped")

    async def _refresh_loop(self) -> None:
        """Periodically refresh cookies using headless browser."""
        while not self._stop_event.is_set():
            try:
                # Check if cookies are about to expire (within 3 hours)
                if should_refresh_cookies_early(self.settings.flow_cookie_file, margin_hours=3.0):
                    logger.warning("⚠️  Cookies expiring soon - refreshing early")
                    try:
                        await self._run_cookie_refresh()
                    except Exception as exc:
                        logger.error("Early cookie refresh failed: %s", exc, exc_info=True)
                        # Continue to scheduled refresh
                
                # Wait for the refresh interval (21 hours)
                logger.info("Next cookie refresh in %.1f hours", COOKIE_REFRESH_INTERVAL / 3600)
                await asyncio.wait_for(self._stop_event.wait(), timeout=COOKIE_REFRESH_INTERVAL)
            except asyncio.TimeoutError:
                # Time to refresh
                try:
                    await self._run_cookie_refresh()
                except Exception as exc:
                    logger.error("Cookie refresh failed: %s", exc, exc_info=True)
                    # On failure, retry in 1 hour instead of 21 hours
                    try:
                        logger.info("Retrying cookie refresh in 1 hour due to failure")
                        await asyncio.wait_for(self._stop_event.wait(), timeout=3600)
                    except asyncio.TimeoutError:
                        continue

    async def _run_cookie_refresh(self) -> None:
        """Execute the headless cookie refresh script."""
        script_path = Path(__file__).parent.parent.parent / "scripts" / "refresh_flow_cookie.py"
        
        if not script_path.exists():
            logger.error("Cookie refresh script not found: %s", script_path)
            return

        logger.info("Running cookie refresh script: %s", script_path)
        
        # Run the script in a subprocess
        process = await asyncio.create_subprocess_exec(
            sys.executable,
            str(script_path),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

        stdout, stderr = await process.communicate()

        if process.returncode == 0:
            logger.info("Cookie refresh successful")
            if stdout:
                logger.debug("Script output: %s", stdout.decode().strip())
        else:
            logger.error(
                "Cookie refresh script failed (exit code %d): %s",
                process.returncode,
                stderr.decode().strip() if stderr else "No error output",
            )
            raise RuntimeError(f"Cookie refresh script failed with exit code {process.returncode}")

    async def refresh_now(self) -> None:
        """Manually trigger a cookie refresh (for testing/admin endpoints)."""
        logger.info("Manual cookie refresh triggered")
        await self._run_cookie_refresh()
