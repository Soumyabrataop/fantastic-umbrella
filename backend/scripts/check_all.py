#!/usr/bin/env python3
"""
Comprehensive Service Health Check Script
Runs all health checks for InstaVEO services.
"""

import subprocess
import sys
import os
from pathlib import Path

def run_script(script_name: str) -> int:
    """Run a health check script and return its exit code"""
    script_path = Path(__file__).parent / script_name
    if not script_path.exists():
        print(f"❌ Script {script_name} not found")
        return 1

    print(f"\n🔍 Running {script_name}...")
    try:
        result = subprocess.run([sys.executable, str(script_path)], capture_output=True, text=True)
        print(result.stdout)
        if result.stderr:
            print(f"Errors: {result.stderr}")
        return result.returncode
    except Exception as e:
        print(f"❌ Failed to run {script_name}: {str(e)}")
        return 1

def main():
    print("START: InstaVEO Comprehensive Health Check")
    print("=" * 60)

    scripts = [
        "check_db.py",
        "health_check.py",
        "check_frontend.py",
    ]

    results = []
    for script in scripts:
        exit_code = run_script(script)
        results.append(exit_code == 0)

    print("\n" + "=" * 60)
    print("📊 Summary:")

    total_checks = len(results)
    passed_checks = sum(results)

    for i, (script, passed) in enumerate(zip(scripts, results)):
        status = "SUCCESS" if passed else "FAILED"
        print(f"   {script}: {status}")

    print(f"\nOverall: {passed_checks}/{total_checks} checks passed")

    if passed_checks == total_checks:
        print("SUCCESS: All services are healthy!")
        return 0
    else:
        print("WARNING: Some services have issues.")
        return 1

if __name__ == "__main__":
    sys.exit(main())