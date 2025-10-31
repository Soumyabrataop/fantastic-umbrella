#!/usr/bin/env bash
set -euo pipefail

ROOT="/workspaces/goldpool"
LOG_DIR="$ROOT/.devcontainer"
mkdir -p "$LOG_DIR"

echo "Installing backend Python dependencies..."
if [ -f "$ROOT/backend/requirements.txt" ]; then
  pip install --no-cache-dir -r "$ROOT/backend/requirements.txt" || true
fi

echo "Starting backend (uvicorn) on port 8000..."
# start uvicorn in background and redirect logs
(cd "$ROOT/backend" && nohup uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload > "$LOG_DIR/backend.log" 2>&1 &)

echo "Starting frontend (Next.js) on port 3000..."
# start frontend in background and redirect logs
(cd "$ROOT/apps/web" && nohup pnpm dev > "$LOG_DIR/frontend.log" 2>&1 &)

echo "Both processes started. Backend logs: $LOG_DIR/backend.log  Frontend logs: $LOG_DIR/frontend.log"
