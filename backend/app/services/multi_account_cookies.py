"""
Multi-Account Cookie Manager for Flow API
Manages multiple Google accounts with automatic rotation and failover
"""

import json
import logging
import random
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)


class MultiAccountCookieManager:
    """Manages cookies for multiple Google accounts with rotation and failover"""

    def __init__(self, cookie_file: Path, emails: List[str], passwords: List[str]):
        """
        Initialize multi-account cookie manager
        
        Args:
            cookie_file: Path to cookie.json file
            emails: List of Google account emails
            passwords: List of corresponding passwords
        """
        if len(emails) != len(passwords):
            raise ValueError("Number of emails must match number of passwords")
        
        self.cookie_file = cookie_file
        self.accounts = [
            {"email": email.strip(), "password": password.strip()}
            for email, password in zip(emails, passwords)
        ]
        self.current_account_index = 0
        self.account_health: Dict[str, Dict] = {}
        
        # Load existing cookies
        self.cookies_data = self._load_cookies()
        self._initialize_account_health()
        
        logger.info(f"Initialized multi-account manager with {len(self.accounts)} accounts")

    def _load_cookies(self) -> Dict:
        """Load cookies from file or create empty structure"""
        if self.cookie_file.exists():
            try:
                with open(self.cookie_file, "r") as f:
                    data = json.load(f)
                    # Convert old format to new multi-account format
                    if "accounts" not in data:
                        # Old single-account format
                        return {
                            "accounts": {},
                            "current_account": None,
                            "last_updated": data.get("timestamp")
                        }
                    return data
            except Exception as e:
                logger.error(f"Failed to load cookies: {e}")
        
        return {
            "accounts": {},
            "current_account": None,
            "last_updated": None
        }

    def _save_cookies(self):
        """Save cookies to file"""
        try:
            with open(self.cookie_file, "w") as f:
                json.dump(self.cookies_data, f, indent=2)
            logger.debug(f"Saved cookies for {len(self.cookies_data['accounts'])} accounts")
        except Exception as e:
            logger.error(f"Failed to save cookies: {e}")

    def _initialize_account_health(self):
        """Initialize health status for all accounts"""
        for account in self.accounts:
            email = account["email"]
            self.account_health[email] = {
                "failures": 0,
                "last_failure": None,
                "last_success": None,
                "is_healthy": True,
                "cooldown_until": None
            }

    def get_current_account(self) -> Dict[str, str]:
        """Get current account credentials"""
        return self.accounts[self.current_account_index]

    def get_current_cookies(self) -> Optional[Dict]:
        """Get cookies for the current account"""
        account = self.get_current_account()
        email = account["email"]
        
        account_cookies = self.cookies_data["accounts"].get(email)
        if not account_cookies:
            return None
        
        # Check if cookies are expired
        if self._are_cookies_expired(account_cookies):
            logger.info(f"Cookies expired for account: {email}")
            return None
        
        return account_cookies.get("cookies")

    def update_cookies(self, email: str, cookies: Dict, expires_at: str):
        """
        Update cookies for a specific account
        
        Args:
            email: Account email
            cookies: Cookie dictionary
            expires_at: Expiration timestamp
        """
        if "accounts" not in self.cookies_data:
            self.cookies_data["accounts"] = {}
        
        self.cookies_data["accounts"][email] = {
            "cookies": cookies,
            "expires_at": expires_at,
            "last_refreshed": datetime.now(timezone.utc).isoformat()
        }
        self.cookies_data["current_account"] = email
        self.cookies_data["last_updated"] = datetime.now(timezone.utc).isoformat()
        
        self._save_cookies()
        self._mark_success(email)
        logger.info(f"Updated cookies for account: {email}")

    def _are_cookies_expired(self, account_cookies: Dict) -> bool:
        """Check if cookies are expired"""
        expires_at = account_cookies.get("expires_at")
        if not expires_at:
            return True
        
        try:
            expiry = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
            # Refresh 5 minutes before expiry
            buffer = timedelta(minutes=5)
            return datetime.now(timezone.utc) >= (expiry - buffer)
        except Exception as e:
            logger.error(f"Failed to parse expiry date: {e}")
            return True

    def rotate_to_next_account(self) -> bool:
        """
        Rotate to the next healthy account
        
        Returns:
            True if successfully rotated, False if no healthy accounts available
        """
        original_index = self.current_account_index
        attempts = 0
        max_attempts = len(self.accounts)
        
        while attempts < max_attempts:
            # Move to next account
            self.current_account_index = (self.current_account_index + 1) % len(self.accounts)
            attempts += 1
            
            account = self.get_current_account()
            email = account["email"]
            health = self.account_health[email]
            
            # Check if account is in cooldown
            if health["cooldown_until"]:
                if datetime.now(timezone.utc) < health["cooldown_until"]:
                    logger.debug(f"Account {email} is in cooldown, skipping...")
                    continue
                else:
                    # Cooldown expired, reset
                    health["cooldown_until"] = None
                    health["failures"] = 0
                    health["is_healthy"] = True
            
            # Check if account is healthy
            if health["is_healthy"]:
                logger.info(f"Rotated to account: {email}")
                return True
        
        # No healthy accounts found, reset to original
        self.current_account_index = original_index
        logger.warning("No healthy accounts available!")
        return False

    def mark_account_failure(self, email: Optional[str] = None):
        """
        Mark an account as failed
        
        Args:
            email: Account email (uses current account if None)
        """
        if email is None:
            email = self.get_current_account()["email"]
        
        self._mark_failure(email)

    def _mark_failure(self, email: str):
        """Internal method to mark account failure"""
        health = self.account_health.get(email)
        if not health:
            return
        
        health["failures"] += 1
        health["last_failure"] = datetime.now(timezone.utc)
        
        # Apply cooldown after 3 failures
        if health["failures"] >= 3:
            health["is_healthy"] = False
            # Cooldown for 10 minutes
            health["cooldown_until"] = datetime.now(timezone.utc) + timedelta(minutes=10)
            logger.warning(f"Account {email} marked unhealthy (failures: {health['failures']}), cooldown until {health['cooldown_until']}")
        else:
            logger.info(f"Account {email} failure #{health['failures']}")

    def _mark_success(self, email: str):
        """Mark an account as successful"""
        health = self.account_health.get(email)
        if not health:
            return
        
        health["last_success"] = datetime.now(timezone.utc)
        health["failures"] = 0
        health["is_healthy"] = True
        health["cooldown_until"] = None

    def get_random_healthy_account(self) -> Optional[Dict[str, str]]:
        """
        Get a random healthy account (for load balancing)
        
        Returns:
            Account dict or None if no healthy accounts
        """
        healthy_accounts = [
            account for account in self.accounts
            if self.account_health[account["email"]]["is_healthy"]
        ]
        
        if not healthy_accounts:
            logger.warning("No healthy accounts for random selection")
            return None
        
        return random.choice(healthy_accounts)

    def get_account_status(self) -> List[Dict]:
        """Get status of all accounts"""
        status = []
        for account in self.accounts:
            email = account["email"]
            health = self.account_health[email]
            has_cookies = email in self.cookies_data.get("accounts", {})
            
            status.append({
                "email": email,
                "has_cookies": has_cookies,
                "is_healthy": health["is_healthy"],
                "failures": health["failures"],
                "last_success": health["last_success"].isoformat() if health["last_success"] else None,
                "last_failure": health["last_failure"].isoformat() if health["last_failure"] else None,
                "cooldown_until": health["cooldown_until"].isoformat() if health["cooldown_until"] else None
            })
        
        return status

    def needs_refresh(self, email: Optional[str] = None) -> bool:
        """
        Check if account cookies need refresh
        
        Args:
            email: Account email (uses current account if None)
        
        Returns:
            True if cookies need refresh
        """
        if email is None:
            email = self.get_current_account()["email"]
        
        account_cookies = self.cookies_data["accounts"].get(email)
        if not account_cookies:
            return True
        
        return self._are_cookies_expired(account_cookies)


def parse_multi_account_env(emails_str: str, passwords_str: str) -> tuple[List[str], List[str]]:
    """
    Parse comma-separated email and password strings
    
    Args:
        emails_str: Comma-separated emails
        passwords_str: Comma-separated passwords
    
    Returns:
        Tuple of (emails list, passwords list)
    """
    emails = [email.strip() for email in emails_str.split(",") if email.strip()]
    passwords = [pwd.strip() for pwd in passwords_str.split(",") if pwd.strip()]
    
    if len(emails) != len(passwords):
        raise ValueError(f"Mismatch: {len(emails)} emails but {len(passwords)} passwords")
    
    if not emails:
        raise ValueError("No accounts configured")
    
    return emails, passwords
