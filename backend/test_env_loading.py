#!/usr/bin/env python3
"""Test if .env file loads correctly."""
from pathlib import Path
from dotenv import load_dotenv
import os

# Check if .env exists
env_file = Path(".env")
print(f"📁 .env file exists: {env_file.exists()}")

if env_file.exists():
    # Load it
    load_dotenv(env_file)
    print(f"✓ Loaded .env file")
else:
    print(f"❌ .env file not found at: {env_file.absolute()}")

# Check credentials
email = os.getenv("GOOGLE_EMAIL", "")
password = os.getenv("GOOGLE_PASSWORD", "")

print(f"\n📧 GOOGLE_EMAIL: {email if email else '❌ NOT SET'}")
print(f"🔑 GOOGLE_PASSWORD: {'✓ SET' if password else '❌ NOT SET'}")

if email and password:
    print(f"\n✅ Credentials loaded successfully!")
    print(f"   Email: {email}")
    print(f"   Password: {'*' * len(password)} ({len(password)} chars)")
else:
    print(f"\n❌ Credentials missing!")
    print(f"   Please set GOOGLE_EMAIL and GOOGLE_PASSWORD in backend/.env")
