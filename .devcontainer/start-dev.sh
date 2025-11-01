#!/usr/bin/env bash
set -euo pipefail

# This path MUST match your 'workspaceFolder' in devcontainer.json
ROOT="/workspaces/fantastic-umbrella"
LOG_DIR="$ROOT/.devcontainer"
mkdir -p "$LOG_DIR"

# --- Activate Python ---
echo "Activating Python virtual environment..."
source "$ROOT/.venv/bin/activate"

# --- Start Backend ---
echo "Starting backend (uvicorn) on port 8000..."
# start uvicorn in background and redirect logs
(cd "$ROOT/backend" && nohup uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload > "$LOG_DIR/backend.log" 2>&1 &)

# --- Start Frontend ---
echo "Starting frontend (Next.js) on port 3000..."
# start frontend in background and redirect logs
(cd "$ROOT/apps/web" && nohup pnpm dev > "$LOG_DIR/frontend.log" 2>&1 &)

echo "Both processes started."
echo "Backend logs:   $LOG_DIR/backend.log"
echo "Frontend logs:  $LOG_DIR/frontend.log"
echo "---"
echo "You can stream logs with: tail -f $LOG_DIR/backend.log"
