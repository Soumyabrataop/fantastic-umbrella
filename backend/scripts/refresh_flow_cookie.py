#!/usr/bin/env python3
"""
Google Labs Flow - Headless Cookie Extraction

This script uses Playwright to:
1. Log into Google with your credentials (headless mode)
2. Navigate to labs.google.com/fx/tools/flow
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

import json
import os
import time
import sys
from pathlib import Path
from datetime import datetime
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

# Configuration
GOOGLE_EMAIL = os.getenv('GOOGLE_EMAIL', '').strip('"').strip("'")
GOOGLE_PASSWORD = os.getenv('GOOGLE_PASSWORD', '').strip('"').strip("'")

# URLs
GOOGLE_LABS_FLOW_URL = "https://labs.google/fx/tools/flow"
SESSION_API_URL = "https://labs.google/fx/api/auth/session"

# Paths
SCRIPT_DIR = Path(__file__).parent
BACKEND_DIR = SCRIPT_DIR.parent
COOKIE_FILE = BACKEND_DIR / "cookie.json"
BACKUP_FILE = BACKEND_DIR / "flow_session_backup.json"
BROWSER_DATA_DIR = SCRIPT_DIR / "browser_data"


def print_banner():
    """Print script banner."""
    print("\n" + "=" * 70)
    print("  Google Labs Flow - Headless Cookie Extraction")
    print("=" * 70)


def validate_credentials():
    """Validate that credentials are set."""
    if not GOOGLE_EMAIL or not GOOGLE_PASSWORD:
        print("\n❌ ERROR: Credentials not set!")
        print("\n📝 Set environment variables:")
        print("\nPowerShell:")
        print('  $env:GOOGLE_EMAIL = "your-email@gmail.com"')
        print('  $env:GOOGLE_PASSWORD = "your-app-password"')
        print("\nBash/Linux:")
        print('  export GOOGLE_EMAIL="your-email@gmail.com"')
        print('  export GOOGLE_PASSWORD="your-app-password"')
        print("\n💡 Security Tips:")
        print("  • Use an App Password (not your main password)")
        print("  • Create at: https://myaccount.google.com/apppasswords")
        print("  • Disable 2FA temporarily if not using App Password")
        return False
    return True


def backup_existing_cookie():
    """Backup existing cookie.json if it exists."""
    if COOKIE_FILE.exists():
        try:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            backup_name = BACKEND_DIR / f"cookie_backup_{timestamp}.json"
            
            # Copy to timestamped backup
            with open(COOKIE_FILE, 'r') as src:
                content = src.read()
            with open(backup_name, 'w') as dst:
                dst.write(content)
            
            # Also copy to standard backup location
            with open(BACKUP_FILE, 'w') as dst:
                dst.write(content)
            
            print(f"\n📦 Backed up existing cookie.json to:")
            print(f"   - {backup_name.name}")
            print(f"   - {BACKUP_FILE.name}")
            return True
        except Exception as e:
            print(f"\n⚠️  Warning: Could not backup cookie.json: {e}")
            return False
    else:
        print("\n📝 No existing cookie.json found (first run)")
        return True


def extract_flow_cookie_headless(email: str, password: str):
    """
    Extract Google Labs Flow cookies in headless mode.
    
    Args:
        email: Google account email
        password: Google account password (or App Password)
    
    Returns:
        dict: Cookie data with access_token, or None on failure
    """
    print(f"\n📧 Email: {email}")
    print(f"🔒 Password: {'*' * len(password)}")
    print(f"🎯 Target: {GOOGLE_LABS_FLOW_URL}")
    print(f"🤖 Mode: Headless (invisible browser)")
    
    # Create browser data directory
    os.makedirs(BROWSER_DATA_DIR, exist_ok=True)
    
    with sync_playwright() as p:
        print("\n🚀 Launching headless browser...")
        
        try:
            # Launch persistent context (headless)
            context = p.chromium.launch_persistent_context(
                user_data_dir=str(BROWSER_DATA_DIR),
                headless=True,  # Headless mode
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
            
            # Step 1: Check if already logged in
            print("\n📋 Step 1: Checking existing session...")
            try:
                response = page.goto(SESSION_API_URL, wait_until='networkidle', timeout=15000)
                
                if response and response.status == 200:
                    session_data = response.json()
                    
                    if 'access_token' in session_data and session_data['access_token']:
                        access_token = session_data['access_token']
                        print("   ✅ Existing valid session found!")
                        print(f"   Token: {access_token[:60]}...")
                        
                        cookie_data = {
                            'access_token': access_token,
                            'expires': session_data.get('expires', ''),
                            'extracted_at': datetime.now().isoformat(),
                            'method': 'existing_session'
                        }
                        
                        context.close()
                        return cookie_data
            except:
                print("   ➜ No existing session, proceeding with login...")
            
            # Step 2: Navigate to Flow page
            print("\n📋 Step 2: Navigating to Google Labs Flow...")
            page.goto(GOOGLE_LABS_FLOW_URL, wait_until='networkidle', timeout=30000)
            time.sleep(2)
            
            # Step 3: Click "Sign in with Google"
            print("\n📋 Step 3: Clicking 'Sign in with Google'...")
            try:
                sign_in_button = page.wait_for_selector('text="Sign in with Google"', timeout=10000)
                sign_in_button.click()
                time.sleep(3)
            except PlaywrightTimeout:
                # Try alternative selector
                sign_in_button = page.wait_for_selector('button:has-text("Sign in")', timeout=5000)
                sign_in_button.click()
                time.sleep(3)
            
            # Step 4: Enter email
            print("\n📋 Step 4: Entering email...")
            email_input = page.wait_for_selector('input[type="email"]', timeout=15000)
            email_input.fill(email)
            
            next_button = page.wait_for_selector('button:has-text("Next")', timeout=5000)
            next_button.click()
            time.sleep(3)
            
            # Step 5: Enter password
            print("\n📋 Step 5: Entering password...")
            password_input = page.wait_for_selector('input[type="password"]', timeout=15000)
            password_input.fill(password)
            
            next_button = page.wait_for_selector('button:has-text("Next")', timeout=5000)
            next_button.click()
            time.sleep(5)
            
            # Step 6: Check for 2FA
            print("\n📋 Step 6: Checking for 2FA...")
            try:
                twofa_input = page.wait_for_selector(
                    'input[type="tel"], input[aria-label*="code"]',
                    timeout=3000
                )
                if twofa_input:
                    print("\n❌ 2FA DETECTED!")
                    print("   This script requires an App Password (no 2FA prompt)")
                    print("   Or temporarily disable 2FA on your Google account")
                    print("\n   To create App Password:")
                    print("   https://myaccount.google.com/apppasswords")
                    context.close()
                    return None
            except PlaywrightTimeout:
                print("   ✓ No 2FA required")
            
            # Step 7: Wait for redirect
            print("\n📋 Step 7: Waiting for successful login...")
            time.sleep(5)
            
            # Check URL
            current_url = page.url
            if 'labs.google' in current_url:
                print(f"   ✓ Redirected to: {current_url}")
            else:
                print(f"   ⚠️  Unexpected URL: {current_url}")
                time.sleep(3)
            
            # Step 8: Extract access token from session API
            print("\n📋 Step 8: Extracting access token...")
            response = page.goto(SESSION_API_URL, wait_until='networkidle', timeout=15000)
            
            if response.status == 200:
                session_data = response.json()
                
                if 'access_token' in session_data:
                    access_token = session_data['access_token']
                    print("   ✅ Access token extracted!")
                    print(f"   Token: {access_token[:60]}...")
                    
                    # Also extract ALL browser cookies
                    print("\n📋 Step 9: Extracting all browser cookies...")
                    all_cookies = context.cookies()
                    print(f"   ✓ Found {len(all_cookies)} cookies")
                    
                    cookie_data = {
                        'access_token': access_token,
                        'expires': session_data.get('expires', ''),
                        'extracted_at': datetime.now().isoformat(),
                        'method': 'fresh_login',
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
                print(f"   ❌ Session API returned status: {response.status}")
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
            except:
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
    
    cookie_data = extract_flow_cookie_headless(GOOGLE_EMAIL, GOOGLE_PASSWORD)
    
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
