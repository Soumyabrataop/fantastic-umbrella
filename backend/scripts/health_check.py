#!/usr/bin/env python3
"""
Backend Health Check Script
Tests various backend API endpoints to ensure the service is running correctly.
"""

import requests
import sys
import time
from typing import Dict, List, Tuple

# Configuration
BACKEND_URL = "http://localhost:8001"
TIMEOUT = 10

def test_endpoint(url: str, method: str = "GET", expected_status: int = 200, name: str = "") -> Tuple[bool, str]:
    """Test a single endpoint and return (success, message)"""
    try:
        response = requests.request(method, url, timeout=TIMEOUT)
        if response.status_code == expected_status:
            return True, f"SUCCESS: {name or url} - OK ({response.status_code})"
        else:
            return False, f"ERROR: {name or url} - Expected {expected_status}, got {response.status_code}"
    except requests.exceptions.RequestException as e:
        return False, f"ERROR: {name or url} - Connection failed: {str(e)}"

def main():
    print("[CHECK] InstaVEO Backend Health Check")
    print("=" * 50)

    endpoints = [
        (f"{BACKEND_URL}/api/v1/videos/feed", "GET", 200, "Video Feed API"),
        (f"{BACKEND_URL}/docs", "GET", 200, "API Documentation"),
        (f"{BACKEND_URL}/api/v1/videos/status/test", "GET", 404, "Video Status Check (expected 404 for test)"),
    ]

    results = []
    for url, method, expected_status, name in endpoints:
        success, message = test_endpoint(url, method, expected_status, name)
        print(message)
        results.append(success)

    print("\n" + "=" * 50)
    total_tests = len(results)
    passed_tests = sum(results)

    if passed_tests == total_tests:
        print(f"SUCCESS: All {total_tests} tests passed! Backend is healthy.")
        return 0
    else:
        print(f"WARNING: {passed_tests}/{total_tests} tests passed. Some issues detected.")
        return 1

if __name__ == "__main__":
    sys.exit(main())