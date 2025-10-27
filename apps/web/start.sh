#!/bin/bash

# AI Video Generator - Quick Start Script
# Run this script to set up and start the frontend

echo "🚀 AI Video Generator - Frontend Setup"
echo "======================================"
echo ""

# Step 1: Navigate to web directory
echo "📁 Step 1: Navigating to apps/web..."
cd "$(dirname "$0")"

# Step 2: Install dependencies
echo ""
echo "📦 Step 2: Installing dependencies..."
pnpm install @tanstack/react-query axios react-intersection-observer

# Step 3: Check for .env.local
if [ ! -f .env.local ]; then
    echo ""
    echo "⚠️  Step 3: Creating .env.local from example..."
    cp .env.local.example .env.local
    echo ""
    echo "⚠️  IMPORTANT: Please edit .env.local with your credentials:"
    echo "   - NEXT_PUBLIC_SUPABASE_URL"
    echo "   - NEXT_PUBLIC_SUPABASE_ANON_KEY"
    echo "   - NEXT_PUBLIC_API_URL"
    echo ""
    echo "Press Enter after you've updated .env.local..."
    read
else
    echo ""
    echo "✅ Step 3: .env.local already exists"
fi

# Step 4: Start dev server
echo ""
echo "🚀 Step 4: Starting development server..."
echo ""
echo "Frontend will be available at: http://localhost:3000"
echo ""
pnpm dev
