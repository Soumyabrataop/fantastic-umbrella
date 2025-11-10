"""
Multi-Account Cookie Refresher
Manages cookie refresh for multiple Google accounts with automatic rotation
"""

import asyncio
import logging
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import TYPE_CHECKING

from app.services.multi_account_cookies import MultiAccountCookieManager

if TYPE_CHECKING:
    from app.core.settings import Settings

logger = logging.getLogger("uvicorn.error").getChild("multi_account_refresher")

COOKIE_CHECK_INTERVAL = 5 * 60  # Check every 5 minutes


class MultiAccountRefresher:
    """Manages cookie refresh for multiple accounts"""

    def __init__(self, settings: "Settings"):
        self.settings = settings
        self.cookie_manager = MultiAccountCookieManager(
            cookie_file=settings.flow_cookie_file,
            emails=settings.google_emails,
            passwords=settings.google_passwords
        )
        self._task: asyncio.Task | None = None
        self._stop_event = asyncio.Event()

    async def start(self) -> None:
        """Start the background refresh task"""
        if self._task is not None:
            logger.warning("Multi-account refresher already running")
            return

        logger.info(f"Starting multi-account cookie refresher for {len(self.settings.google_emails)} accounts")
        self._stop_event.clear()
        self._task = asyncio.create_task(self._refresh_loop())

    async def stop(self) -> None:
        """Stop the background refresh task"""
        if self._task is None:
            return

        logger.info("Stopping multi-account cookie refresher")
        self._stop_event.set()

        try:
            await asyncio.wait_for(self._task, timeout=5.0)
        except asyncio.TimeoutError:
            logger.warning("Multi-account refresher didn't stop gracefully, cancelling")
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass

        self._task = None

    async def _refresh_loop(self) -> None:
        """Main refresh loop - checks all accounts periodically"""
        logger.info("Multi-account refresh loop started")

        while not self._stop_event.is_set():
            try:
                await self._check_and_refresh_accounts()
            except Exception as e:
                logger.error(f"Error in multi-account refresh loop: {e}", exc_info=True)

            # Wait for next check or stop signal
            try:
                await asyncio.wait_for(
                    self._stop_event.wait(),
                    timeout=COOKIE_CHECK_INTERVAL
                )
                break  # Stop event was set
            except asyncio.TimeoutError:
                continue  # Timeout reached, continue loop

        logger.info("Multi-account refresh loop stopped")

    async def _check_and_refresh_accounts(self) -> None:
        """Check all accounts and refresh cookies if needed"""
        status = self.cookie_manager.get_account_status()
        
        for account_status in status:
            email = account_status["email"]
            
            # Skip if account is in cooldown
            if account_status["cooldown_until"]:
                cooldown_until = datetime.fromisoformat(account_status["cooldown_until"])
                if datetime.now(timezone.utc) < cooldown_until:
                    logger.debug(f"Account {email} is in cooldown, skipping refresh check")
                    continue
            
            # Check if cookies need refresh
            if self.cookie_manager.needs_refresh(email):
                logger.info(f"Account {email} cookies need refresh")
                await self._refresh_account_cookies(email)
            else:
                logger.debug(f"Account {email} cookies are fresh")

    async def _refresh_account_cookies(self, email: str) -> None:
        """
        Refresh cookies for a specific account using headless browser automation
        
        Args:
            email: The account email to refresh cookies for
        """
        logger.info(f"Starting cookie refresh for account: {email}")
        
        # Get password for this account
        password = None
        for idx, settings_email in enumerate(self.settings.google_emails):
            if settings_email.strip() == email:
                password = self.settings.google_passwords[idx].strip()
                break
        
        if not password:
            logger.error(f"No password found for account: {email}")
            return
        
        try:
            from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeout
        except ImportError:
            logger.error("Playwright not installed. Run: pip install playwright && playwright install chromium")
            return
        
        try:
            async with async_playwright() as p:
                # Check if headless mode is disabled (show browser window)
                headless_mode = getattr(self.settings, 'playwright_headless', True)
                
                # Launch browser
                browser = await p.chromium.launch(
                    headless=headless_mode,
                    args=[
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-dev-shm-usage',
                        '--disable-blink-features=AutomationControlled'
                    ]
                )
                
                if not headless_mode:
                    logger.info(f"🔍 Browser window visible for {email}")
                
                context = await browser.new_context(
                    viewport={'width': 1280, 'height': 720},
                    user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
                )
                
                page = await context.new_page()
                
                try:
                    # Navigate to Google Labs Flow tool
                    logger.info(f"Navigating to Google Labs Flow")
                    await page.goto('https://labs.google/fx/tools/flow', wait_until='domcontentloaded', timeout=30000)
                    await asyncio.sleep(3)
                    
                    # Look for and click Sign In button
                    logger.info(f"Looking for Sign In button")
                    sign_in_clicked = False
                    sign_in_selectors = [
                        'button:has-text("Sign in")',
                        'a:has-text("Sign in")',
                        'text=/sign in/i',
                        '[aria-label*="Sign in"]',
                        '[data-action*="sign"]',
                        'a[href*="accounts.google.com"]'
                    ]
                    
                    for selector in sign_in_selectors:
                        try:
                            logger.debug(f"Trying sign in selector: {selector}")
                            element = page.locator(selector).first
                            if await element.count() > 0:
                                await element.click(timeout=5000)
                                sign_in_clicked = True
                                logger.info(f"✅ Clicked Sign In with selector: {selector}")
                                break
                        except Exception as e:
                            logger.debug(f"Sign in selector {selector} failed: {str(e)[:100]}")
                            continue
                    
                    if not sign_in_clicked:
                        logger.warning("No Sign In button found, may already be logged in")
                    else:
                        # Wait for Google login page to load
                        await asyncio.sleep(4)
                    
                    # Wait for email input with multiple possible selectors
                    logger.info(f"Waiting for email input field")
                    email_selectors = [
                        '#identifierId',
                        'input[type="email"]',
                        'input[name="identifier"]',
                        'input[aria-label*="email"]',
                        'input[aria-label*="Email"]',
                        '[name="identifier"]',
                        '[type="email"]'
                    ]
                    
                    email_input = None
                    for selector in email_selectors:
                        try:
                            logger.debug(f"Trying email selector: {selector}")
                            await page.wait_for_selector(selector, timeout=8000, state='visible')
                            email_input = selector
                            logger.info(f"✅ Found email input with selector: {selector}")
                            break
                        except Exception as e:
                            logger.debug(f"Selector {selector} not found: {str(e)[:100]}")
                            continue
                    
                    if not email_input:
                        current_url = page.url
                        logger.error(f"Could not find email input field. Current URL: {current_url}")
                        raise Exception(f"Email input field not found at {current_url}")
                    
                    # Fill in email
                    logger.info(f"Entering email: {email}")
                    await page.fill(email_input, email)
                    await asyncio.sleep(1)
                    
                    # Click Next button with multiple selectors
                    next_selectors = [
                        '#identifierNext',
                        'button:has-text("Next")',
                        'button[type="button"]:has-text("Next")',
                        '[id*="Next"] button'
                    ]
                    
                    for selector in next_selectors:
                        try:
                            await page.click(selector, timeout=3000)
                            logger.debug(f"Clicked Next with selector: {selector}")
                            break
                        except Exception:
                            continue
                    
                    # Wait for password field
                    logger.info(f"Waiting for password field")
                    await asyncio.sleep(3)
                    
                    password_selectors = [
                        'input[type="password"]',
                        'input[name="password"]',
                        'input[name="Passwd"]',
                        '#password',
                        'input[aria-label*="password"]',
                        'input[aria-label*="Password"]'
                    ]
                    
                    password_input = None
                    for selector in password_selectors:
                        try:
                            await page.wait_for_selector(selector, timeout=5000, state='visible')
                            password_input = selector
                            logger.debug(f"Found password input with selector: {selector}")
                            break
                        except Exception:
                            continue
                    
                    if not password_input:
                        logger.error("Could not find password input field")
                        raise Exception("Password input field not found")
                    
                    # Fill in password
                    logger.info(f"Entering password for {email}")
                    await page.fill(password_input, password)
                    await asyncio.sleep(1)
                    
                    # Click Next/Sign In button
                    password_next_selectors = [
                        '#passwordNext',
                        'button:has-text("Next")',
                        'button:has-text("Sign in")',
                        'button[type="button"]:has-text("Next")',
                        '[id*="passwordNext"] button'
                    ]
                    
                    for selector in password_next_selectors:
                        try:
                            await page.click(selector, timeout=3000)
                            logger.debug(f"Clicked password Next with selector: {selector}")
                            break
                        except Exception:
                            continue
                    
                    # Wait for login to complete
                    await asyncio.sleep(4)
                    logger.info(f"Login submitted, waiting for redirect")
                    
                    # Check for 2FA or other verification
                    try:
                        current_url = page.url
                        logger.debug(f"Current URL after login: {current_url}")
                        
                        # Check if still on accounts page (might be 2FA or error)
                        if 'accounts.google.com' in current_url:
                            # Look for 2FA prompts
                            verification_patterns = [
                                'text=/verify/i',
                                'text=/two-step/i',
                                'text=/2-step/i',
                                'text=/authentication/i',
                                'text=/confirm.*identity/i'
                            ]
                            
                            two_fa_present = False
                            for pattern in verification_patterns:
                                if await page.locator(pattern).count() > 0:
                                    two_fa_present = True
                                    break
                            
                            if two_fa_present:
                                logger.warning(f"⚠️  2FA detected for {email}")
                                logger.warning(f"Waiting up to 90 seconds for verification...")
                                try:
                                    await page.wait_for_url('https://labs.google/fx/tools/flow**', timeout=90000)
                                    logger.info("✅ Verification completed")
                                except PlaywrightTimeout:
                                    logger.error(f"Timeout waiting for 2FA completion")
                                    raise Exception("2FA timeout - please disable 2FA or use app-specific password")
                            else:
                                # Not 2FA, check for login errors
                                error_present = await page.locator('text=/wrong password|incorrect|couldn\'t find/i').count() > 0
                                if error_present:
                                    raise Exception("Login failed - check credentials")
                                
                                # Wait for redirect to Flow tool
                                await page.wait_for_url('https://labs.google/fx/tools/flow**', timeout=20000)
                        else:
                            # Already redirected, wait a bit more to ensure cookies are set
                            await asyncio.sleep(2)
                            
                    except PlaywrightTimeout:
                        logger.warning(f"Timeout waiting for redirect, checking current state")
                        current_url = page.url
                        if 'labs.google' in current_url:
                            logger.info("Already on Google Labs Flow, proceeding...")
                        else:
                            raise Exception(f"Login did not complete successfully, stuck at: {current_url}")
                    
                    logger.info(f"✅ Successfully logged in to Google Labs Flow for {email}")
                    
                    # Extract cookies
                    cookies = await context.cookies()
                    
                    # Convert to simple dictionary format (cookie_name: cookie_value)
                    # httpx expects simple string values, not nested dicts
                    cookie_dict = {}
                    earliest_expiry = None
                    
                    for cookie in cookies:
                        domain = cookie.get('domain', '')
                        if 'google' in domain:
                            # Store just the value as a string
                            cookie_dict[cookie['name']] = cookie['value']
                            
                            # Track expiry
                            if 'expires' in cookie and cookie['expires'] != -1:
                                expiry = datetime.fromtimestamp(cookie['expires'], tz=timezone.utc)
                                if earliest_expiry is None or expiry < earliest_expiry:
                                    earliest_expiry = expiry
                    
                    # Calculate expiration time (21 hours from now if no explicit expiry)
                    if earliest_expiry is None:
                        earliest_expiry = datetime.now(timezone.utc) + timedelta(hours=21)
                    
                    expires_at = earliest_expiry.isoformat()
                    
                    # Update cookie manager
                    self.cookie_manager.update_cookies(email, cookie_dict, expires_at)
                    
                    logger.info(f"✅ Successfully refreshed cookies for {email} (expires: {expires_at})")
                    
                except PlaywrightTimeout as e:
                    logger.error(f"Timeout during cookie refresh for {email}: {e}")
                    raise
                except Exception as e:
                    logger.error(f"Error during cookie refresh for {email}: {e}", exc_info=True)
                    raise
                finally:
                    await page.close()
                    await context.close()
                    await browser.close()
                    
        except Exception as e:
            logger.error(f"Failed to refresh cookies for {email}: {e}", exc_info=True)
            # Mark the account as failed
            self.cookie_manager.mark_account_failure(email)

    def get_account_health(self) -> list[dict]:
        """Get health status of all accounts"""
        return self.cookie_manager.get_account_status()


async def start_multi_account_refresher(settings: "Settings") -> MultiAccountRefresher:
    """Start the multi-account cookie refresher"""
    refresher = MultiAccountRefresher(settings)
    await refresher.start()
    return refresher
