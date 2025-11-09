#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Google Labs Flow - Headful Cookie Extraction

This script uses Playwright to:
1. Log into Google with your credentials (headful mode)
2. Navigate to labs.google/fx/tools/flow
3. Extract the session cookies/access token
4. Save to cookie.json for use with Flow API

Usage:
    python refresh_flow_cookie.py

Environment Variables (required):
    GOOGLE_EMAIL - Your Google account email
    GOOGLE_PASSWORD - Your Google account password (or App Password)

Output:
    - cookie.json (replaces existing file in backend/)
    - flow_session_backup.json (backup of previous cookie.json)

Security Notes:
- Use an App Password if you have 2FA enabled
- Or temporarily disable 2FA for automation
- Recommended: Use a dedicated Google account
"""

import os
import sys
import time
import json
from datetime import datetime
from pathlib import Path
from playwright.sync_api import sync_playwright

# Constants
GOOGLE_EMAIL = os.getenv('GOOGLE_EMAIL')
GOOGLE_PASSWORD = os.getenv('GOOGLE_PASSWORD')
GOOGLE_LABS_FLOW_URL = "https://labs.google/fx/tools/flow"
SESSION_API_URL = "https://labs.google/fx/api/auth/session"

# Directory paths
SCRIPT_DIR = Path(__file__).parent
BACKEND_DIR = SCRIPT_DIR.parent
COOKIE_FILE = BACKEND_DIR / "cookie.json"
BACKUP_FILE = BACKEND_DIR / "flow_session_backup.json"
BROWSER_DATA_DIR = BACKEND_DIR / "browser_data"


def print_banner():
    """Print the script banner."""
    print("\n" + "=" * 70)
    print("  🎬 Google Labs Flow - Cookie Extractor")
    print("  🔐 Headful Mode (Visible Browser)")
    print("=" * 70)
    print("  📧 Gmail-first login for longer token expiry")
    print("  💾 Persistent browser profile for session reuse")
    print("=" * 70)


def validate_credentials():
    """Validate that required environment variables are set."""
    if not GOOGLE_EMAIL:
        print("\n❌ GOOGLE_EMAIL environment variable not set!")
        print("   Set it with: $env:GOOGLE_EMAIL='your.email@gmail.com'")
        return False

    if not GOOGLE_PASSWORD:
        print("\n❌ GOOGLE_PASSWORD environment variable not set!")
        print("   Set it with: $env:GOOGLE_PASSWORD='your-password'")
        print("   💡 Use App Password if you have 2FA enabled")
        return False

    return True


def backup_existing_cookie():
    """Create a backup of existing cookie.json if it exists."""
    if COOKIE_FILE.exists():
        backup_name = f"cookie_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        backup_path = BACKEND_DIR / backup_name
        try:
            import shutil
            shutil.copy2(COOKIE_FILE, backup_path)
            print(f"\n📋 Backed up existing cookie.json to: {backup_name}")
        except Exception as e:
            print(f"\n⚠️  Could not backup existing cookie.json: {e}")


def extract_flow_cookie_headful(email: str, password: str):
    print(f"\n📧 Email: {email}")
    print(f"🔒 Password: {'*' * len(password)}")
    print(f"🎯 Target: {GOOGLE_LABS_FLOW_URL}")
    print(f"🤖 Mode: Headful (visible browser)")

    # Create browser data directory
    os.makedirs(BROWSER_DATA_DIR, exist_ok=True)

    with sync_playwright() as p:
        print("\n🚀 Launching headful browser (persistent profile)...")

        try:
            # Launch persistent context (headful)
            context = p.chromium.launch_persistent_context(
                user_data_dir=str(BROWSER_DATA_DIR),
                headless=False,  # Visible browser
                args=[
                    '--no-sandbox',
                    '--disable-blink-features=AutomationControlled',
                    '--disable-dev-shm-usage',
                ],
                user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                viewport={'width': 1920, 'height': 1080},
                ignore_https_errors=True,
            )

            page = context.pages[0] if context.pages else context.new_page()

            # Step 1: Ensure Gmail session exists by navigating to mail.google.com
            print("\n� Step 1: Ensuring Gmail session (visit mail.google.com)...")
            try:
                mail_response = page.goto("https://mail.google.com/", wait_until='networkidle', timeout=30000)

                current = page.url
                if 'mail.google.com' in current and 'signin' not in current.lower():
                    print(f"   ✓ Already at Gmail: {current}")
                else:
                    print(f"   ✳️  Gmail not authenticated (url: {current}) - attempting interactive sign-in")

                    # Attempt interactive sign-in on mail.google.com
                    try:
                        email_input = page.wait_for_selector('input[type="email"]', timeout=8000)
                        email_input.fill(email)
                        next_btn = page.wait_for_selector('button:has-text("Next")', timeout=5000)
                        next_btn.click()
                        time.sleep(2)

                        password_input = page.wait_for_selector('input[type="password"]', timeout=15000)
                        password_input.fill(password)
                        next_btn = page.wait_for_selector('button:has-text("Next")', timeout=5000)
                        next_btn.click()
                        time.sleep(5)

                        # Wait a bit for mailbox to load
                        page.wait_for_load_state('networkidle', timeout=20000)
                        print("   ✓ Attempted Gmail sign-in (check browser window for interactive prompts)")
                    except Exception:
                        print("   ⚠️  Gmail sign-in input not found; continuing")

            except Exception as e:
                print(f"   ⚠️  Error accessing mail.google.com: {e}")

            # Step 2: Navigate to Flow page
            print("\n� Step 2: Navigating to Google Labs Flow...")
            page.goto(GOOGLE_LABS_FLOW_URL, wait_until='networkidle', timeout=30000)
            time.sleep(2)

            # Step 3: Click "Sign in with Google" if present
            print("\n📋 Step 3: Initiating sign-in on Labs page (if needed)...")
            try:
                sign_in_button = page.wait_for_selector('text="Sign in with Google"', timeout=10000)
                sign_in_button.click()
                time.sleep(3)
            except Exception:
                # Try alternative selector
                try:
                    sign_in_button = page.wait_for_selector('button:has-text("Sign in")', timeout=5000)
                    sign_in_button.click()
                    time.sleep(3)
                except Exception:
                    print("   ⚠️  No explicit sign-in button found on Labs page; proceeding")

            # Step 4/5: If redirected to Google sign-in flows, handle email/password as needed
            try:
                email_input = page.wait_for_selector('input[type="email"]', timeout=10000)
                email_input.fill(email)
                next_button = page.wait_for_selector('button:has-text("Next")', timeout=5000)
                next_button.click()
                time.sleep(2)

                password_input = page.wait_for_selector('input[type="password"]', timeout=15000)
                password_input.fill(password)
                next_button = page.wait_for_selector('button:has-text("Next")', timeout=5000)
                next_button.click()
                time.sleep(5)
            except Exception:
                # Not necessarily an error; may already be signed in
                pass

            # Step 6: Check for 2FA
            print("\n📋 Step 6: Checking for 2FA prompts...")
            try:
                twofa_input = page.wait_for_selector('input[type="tel"], input[aria-label*="code"]', timeout=3000)
                if twofa_input:
                    print("\n❌ 2FA DETECTED!")
                    print("   This script requires an App Password (no 2FA prompt) or interactive input")
                    print("   To create App Password: https://myaccount.google.com/apppasswords")
                    context.close()
                    return None
            except Exception:
                print("   ✓ No 2FA required (or not detected)")

            # Step 7: Wait for successful login / redirect to labs
            print("\n📋 Step 7: Waiting for successful login / redirect to labs...")
            time.sleep(5)
            current_url = page.url
            if 'labs.google' in current_url:
                print(f"   ✓ At labs.google: {current_url}")
            else:
                print(f"   ⚠️  Unexpected URL after login: {current_url}")
                time.sleep(3)

            # Step 8: Extract access token from session API
            print("\n📋 Step 8: Extracting access token from Labs session API...")
            response = page.goto(SESSION_API_URL, wait_until='networkidle', timeout=15000)

            if response and response.status == 200:
                session_data = response.json()

                # Check if session API returned empty object or missing fields
                if not session_data or "access_token" not in session_data:
                    print("   ❌ Session API returned empty/invalid response - authentication failed")
                    print(f"   Response: {session_data}")
                    context.close()
                    return None

                if 'access_token' in session_data:
                    access_token = session_data['access_token']
                    expires = session_data.get('expires', '')
                    print("   ✅ Access token extracted!")
                    print(f"   Token: {access_token[:60]}...")
                    print(f"   Expires: {expires}")

                    # Also extract ALL browser cookies
                    print("\n📋 Step 9: Extracting all browser cookies...")
                    all_cookies = context.cookies()
                    print(f"   ✓ Found {len(all_cookies)} cookies")

                    cookie_data = {
                        'access_token': access_token,
                        'expires': expires,
                        'extracted_at': datetime.now().isoformat(),
                        'method': 'headful_login',
                        'all_cookies': all_cookies  # Include all cookies for session persistence
                    }

                    context.close()
                    return cookie_data
                else:
                    print("   ❌ No access_token in session response")
                    print(f"   Response: {session_data}")
                    context.close()
                    return None
            else:
                status = response.status if response else 'no response'
                print(f"   ❌ Session API returned status: {status}")
                context.close()
                return None

        except Exception as e:
            print(f"\n❌ Error during extraction: {e}")
            import traceback
            traceback.print_exc()

            # Take screenshot for debugging
            try:
                screenshot_path = SCRIPT_DIR / f"error_screenshot_{datetime.now().strftime('%Y%m%d_%H%M%S')}.png"
                page.screenshot(path=str(screenshot_path))
                print(f"📸 Screenshot saved: {screenshot_path}")
            except Exception:
                pass

            context.close()
            return None


def cleanup_old_backups():
    """Remove old cookie backup files to keep the directory clean."""
    try:
        # Find all cookie_backup_*.json files
        backup_pattern = "cookie_backup_*.json"
        backup_files = list(BACKEND_DIR.glob(backup_pattern))
        
        if backup_files:
            print(f"\n🧹 Cleaning up {len(backup_files)} old backup file(s)...")
            for backup_file in backup_files:
                try:
                    backup_file.unlink()
                    print(f"   ✓ Deleted: {backup_file.name}")
                except Exception as e:
                    print(f"   ⚠️  Could not delete {backup_file.name}: {e}")
    except Exception as e:
        print(f"   ⚠️  Cleanup warning: {e}")


def save_cookie_json(cookie_data: dict):
    """Save cookie data to cookie.json in backend directory."""
    try:
        print(f"\n📋 Saving to: {COOKIE_FILE}")
        
        # Clean up old backup files
        cleanup_old_backups()
        
        # Get all browser cookies if available
        all_cookies = cookie_data.get('all_cookies', [])
        
        if all_cookies:
            print(f"   ✓ Saving {len(all_cookies)} browser cookies")
            
            # Convert Playwright cookie format to the format expected by backend
            cookies_array = []
            for cookie in all_cookies:
                # Convert Playwright cookie to backend format
                cookie_entry = {
                    "domain": cookie.get('domain', ''),
                    "name": cookie.get('name', ''),
                    "value": cookie.get('value', ''),
                    "path": cookie.get('path', '/'),
                    "secure": cookie.get('secure', True),
                    "httpOnly": cookie.get('httpOnly', False),
                    "sameSite": cookie.get('sameSite', 'Lax'),
                }
                
                # Add expiry if present
                if 'expires' in cookie and cookie['expires'] != -1:
                    # Playwright returns expires as Unix timestamp
                    from datetime import datetime, timezone
                    expires_dt = datetime.fromtimestamp(cookie['expires'], tz=timezone.utc)
                    cookie_entry['expires'] = expires_dt.isoformat()
                
                cookies_array.append(cookie_entry)
            
            # Also add the authorization token explicitly if not already present
            has_auth = any(c.get('name', '').lower() == 'authorization' for c in cookies_array)
            if not has_auth and 'access_token' in cookie_data:
                cookies_array.insert(0, {
                    "domain": "labs.google",
                    "name": "authorization",
                    "value": cookie_data['access_token'],
                    "path": "/",
                    "secure": True,
                    "httpOnly": False,
                    "sameSite": "Lax",
                    "expires": cookie_data.get('expires', ''),
                })
        
        else:
            # Fallback: just save the authorization token
            print(f"   ⚠️  No browser cookies found, saving authorization token only")
            cookies_array = [
                {
                    "domain": "labs.google",
                    "name": "authorization",
                    "value": cookie_data['access_token'],
                    "path": "/",
                    "secure": True,
                    "httpOnly": False,
                    "sameSite": "Lax",
                    "expires": cookie_data.get('expires', ''),
                }
            ]
        
        # Add metadata entry
        cookies_array.append({
            "_metadata": {
                "extracted_at": cookie_data.get('extracted_at', ''),
                "method": cookie_data.get('method', ''),
                "expires": cookie_data.get('expires', ''),
                "total_cookies": len(cookies_array) - 1,  # -1 for metadata entry
            }
        })
        
        with open(COOKIE_FILE, 'w') as f:
            json.dump(cookies_array, f, indent=2)
        
        print("   ✅ Cookie saved successfully!")
        print(f"   Token: {cookie_data['access_token'][:60]}...")
        print(f"   Expires: {cookie_data.get('expires', 'Unknown')}")
        print(f"   Total cookies: {len(cookies_array) - 1}")
        
        print(f"\n🎯 Next steps:")
        print("   1. Test with: python test_session_api.py")
        print("   2. If successful, restart backend: uvicorn main:app")
        print("   3. Test video generation from the frontend")
        
        return True
    except Exception as e:
        print(f"\n❌ Error saving cookie.json: {e}")
        import traceback
        traceback.print_exc()
        return False


def main():
    """Main entry point."""
    print_banner()
    
    # Validate credentials
    if not validate_credentials():
        sys.exit(1)
    
    # Backup existing cookie
    backup_existing_cookie()
    
    # Extract cookie
    print("\n" + "=" * 70)
    print("  Starting Cookie Extraction")
    print("=" * 70)
    
    cookie_data = extract_flow_cookie_headful(GOOGLE_EMAIL, GOOGLE_PASSWORD)
    
    if cookie_data:
        print("\n" + "=" * 70)
        print("  ✅ SUCCESS!")
        print("=" * 70)
        
        # Save to cookie.json
        if save_cookie_json(cookie_data):
            print("\n✨ Cookie refresh complete!")
            print(f"📁 Cookie saved to: {COOKIE_FILE}")
            print(f"📁 Backup saved to: {BACKUP_FILE}")
            print(f"\n🔄 Session will persist in: {BROWSER_DATA_DIR}")
            print("   (Delete this folder to force fresh login next time)")
            sys.exit(0)
        else:
            sys.exit(1)
    else:
        print("\n" + "=" * 70)
        print("  ❌ FAILED!")
        print("=" * 70)
        print("\n💡 Troubleshooting:")
        print("   1. Check that your Google credentials are correct")
        print("   2. Use an App Password instead of your main password")
        print("   3. Disable 2FA temporarily if not using App Password")
        print("   4. Check the error screenshot if generated")
        print("   5. Try running with visible browser first to debug:")
        print("      (Change headless=True to headless=False in the script)")
        sys.exit(1)


if __name__ == "__main__":
    # Check if playwright is installed
    try:
        import playwright
    except ImportError:
        print("\n❌ Playwright not installed!")
        print("\n📦 Install with:")
        print("   pip install playwright")
        print("   playwright install chromium")
        sys.exit(1)
    
    main()
