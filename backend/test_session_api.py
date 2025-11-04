#!/usr/bin/env python3
"""
Test script to check if the access token is valid and what the session API returns.
"""
import asyncio
import json
import httpx
from pathlib import Path

COOKIE_FILE = Path("cookie.json")
SESSION_URL = "https://labs.google/fx/api/auth/session"

DEFAULT_HEADERS = {
    "accept": "application/json, text/plain, */*",
    "accept-language": "en-GB,en;q=0.9,en-US;q=0.8",
    "referer": "https://labs.google/",
    "sec-ch-ua": '"Google Chrome";v="141", "Not?A_Brand";v="8", "Chromium";v="141"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
}

async def test_token():
    # Load cookies
    with open(COOKIE_FILE) as f:
        cookies = json.load(f)
    
    # Build cookie header with ALL cookies
    cookie_parts = []
    access_token = None
    
    for entry in cookies:
        if isinstance(entry, dict) and entry.get("name"):
            name = entry.get("name")
            value = entry.get("value")
            if name and value:
                cookie_parts.append(f"{name}={value}")
                if name == "authorization":
                    access_token = value
    
    if not access_token:
        print("❌ No authorization token found in cookie.json")
        return
    
    print("=" * 70)
    print("Testing Google Labs Flow Session API")
    print("=" * 70)
    print(f"\n🔑 Access Token: {access_token[:60]}...")
    print(f"🍪 Total cookies: {len(cookie_parts)}")
    
    # Format cookie header with all cookies
    cookie_header = "; ".join(cookie_parts)
    headers = {**DEFAULT_HEADERS, "cookie": cookie_header}
    
    print(f"\n🌐 Making request to: {SESSION_URL}")
    print(f"📋 Cookie header: {cookie_header[:80]}...")
    
    async with httpx.AsyncClient(timeout=httpx.Timeout(15.0)) as client:
        try:
            response = await client.get(SESSION_URL, headers=headers)
            
            print(f"\n📊 Response Status: {response.status_code}")
            print(f"📋 Response Headers:")
            for key, value in response.headers.items():
                print(f"   {key}: {value}")
            
            print(f"\n📄 Response Body:")
            try:
                body = response.json()
                print(json.dumps(body, indent=2))
                
                # Check what fields we got
                print(f"\n🔍 Analysis:")
                print(f"   ✓ Has 'access_token': {'access_token' in body}")
                print(f"   ✓ Has 'expires': {'expires' in body}")
                print(f"   ✓ Has 'user': {'user' in body}")
                
                if 'access_token' in body:
                    print(f"\n✅ New access token: {body['access_token'][:60]}...")
                
                if 'expires' in body:
                    print(f"✅ Expires: {body['expires']}")
                else:
                    print(f"❌ No 'expires' field in response!")
                
                if response.status_code == 200:
                    if 'access_token' in body and 'expires' in body:
                        print(f"\n🎉 SUCCESS! Token is valid and session API works.")
                        return body
                    else:
                        print(f"\n⚠️  Session API responded but missing required fields")
                else:
                    print(f"\n❌ Session API returned non-200 status")
                    
            except Exception as e:
                print(f"   (Not JSON or parse error: {e})")
                print(f"   Raw text: {response.text}")
        
        except Exception as e:
            print(f"\n❌ Request failed: {e}")
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_token())
