@echo off
REM AI Video Generator - Quick Start Script (Windows)
REM Run this script to set up and start the frontend

echo 🚀 AI Video Generator - Frontend Setup
echo ======================================
echo.

REM Step 1: Navigate to web directory
echo 📁 Step 1: In apps/web directory...
cd /d "%~dp0"

REM Step 2: Install dependencies
echo.
echo 📦 Step 2: Installing dependencies...
call pnpm install @tanstack/react-query axios react-intersection-observer

REM Step 3: Check for .env.local
if not exist .env.local (
    echo.
    echo ⚠️  Step 3: Creating .env.local from example...
    copy .env.local.example .env.local
    echo.
    echo ⚠️  IMPORTANT: Please edit .env.local with your credentials:
    echo    - NEXT_PUBLIC_SUPABASE_URL
    echo    - NEXT_PUBLIC_SUPABASE_ANON_KEY
    echo    - NEXT_PUBLIC_API_URL
    echo.
    echo Press any key after you've updated .env.local...
    pause
) else (
    echo.
    echo ✅ Step 3: .env.local already exists
)

REM Step 4: Start dev server
echo.
echo 🚀 Step 4: Starting development server...
echo.
echo Frontend will be available at: http://localhost:3000
echo.
call pnpm dev
