#!/usr/bin/env python3
"""
Frontend Health Check Script
Tests if the Next.js frontend is running and accessible.
"""

import requests
import sys
import time

# Configuration
FRONTEND_URL = "http://localhost:3000"
TIMEOUT = 10

def test_frontend():
    """Test frontend accessibility"""
    print("[CHECK] InstaVEO Frontend Health Check")
    print("=" * 50)

    try:
        print(f"Testing connection to {FRONTEND_URL}...")
        response = requests.get(FRONTEND_URL, timeout=TIMEOUT)

        if response.status_code == 200:
            print("SUCCESS: Frontend is accessible")
            print(f"   Status: {response.status_code}")
            print(f"   Response time: {response.elapsed.total_seconds():.2f}s")

            # Check if it's actually the Next.js app (look for common indicators)
            content = response.text.lower()
            if "next.js" in content or "react" in content or "instaveo" in content:
                print("SUCCESS: Frontend appears to be the correct application")
            else:
                print("WARNING: Frontend response doesn't contain expected content")

            return True
        else:
            print(f"ERROR: Frontend returned status code: {response.status_code}")
            return False

    except requests.exceptions.ConnectionError:
        print(f"ERROR: Cannot connect to frontend at {FRONTEND_URL}")
        print("   Make sure the frontend is running with: npm run dev")
        return False
    except requests.exceptions.Timeout:
        print(f"ERROR: Connection to frontend timed out after {TIMEOUT} seconds")
        return False
    except Exception as e:
        print(f"ERROR: Unexpected error: {str(e)}")
        return False

def main():
    success = test_frontend()

    print("\n" + "=" * 50)
    if success:
        print("SUCCESS: Frontend is healthy!")
        return 0
    else:
        print("WARNING: Frontend issues detected.")
        return 1

if __name__ == "__main__":
    sys.exit(main())