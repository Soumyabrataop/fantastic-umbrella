#!/bin/bash
# Quick API Test Script using curl
# Usage: ./test_api.sh [endpoint]

BACKEND_URL="http://localhost:8001"
FRONTEND_URL="http://localhost:3000"

echo "🔍 InstaVEO API Quick Test"
echo "=========================="

# Default endpoint
ENDPOINT=${1:-api/v1/videos/feed}

echo "Testing backend endpoint: $ENDPOINT"
echo "URL: $BACKEND_URL/$ENDPOINT"
echo ""

# Test backend
curl -s -w "\n📊 Status: %{http_code}\n⏱️  Time: %{time_total}s\n" \
     -H "Accept: application/json" \
     "$BACKEND_URL/$ENDPOINT" | head -20

echo ""
echo "=========================="

# Test frontend if no specific endpoint requested
if [ "$1" = "" ]; then
    echo "Testing frontend..."
    curl -s -w "📊 Status: %{http_code}\n⏱️  Time: %{time_total}s\n" \
         -H "Accept: text/html" \
         "$FRONTEND_URL" | grep -E "(title|InstaVEO|Next.js)" | head -3
fi