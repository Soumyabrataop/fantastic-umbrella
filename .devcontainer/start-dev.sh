#!/usr/bin/env bash
set -euo pipefail

# This path MUST match your 'workspaceFolder' in devcontainer.json
ROOT="/workspaces/Zappai"
LOG_DIR="$ROOT/.devcontainer"
mkdir -p "$LOG_DIR"

# --- Activate Python ---
echo "Activating Python virtual environment..."
if [ -f "$ROOT/.venv/bin/activate" ]; then
    source "$ROOT/.venv/bin/activate"
else
    echo "Error: Python virtual environment not found at $ROOT/.venv/bin/activate"
    echo "Please run 'python -m venv .venv' in $ROOT and install dependencies before starting."
    exit 1
fi

# --- Start Backend ---
echo "Starting backend (uvicorn) on port 8000..."
# start uvicorn in background and redirect logs
(cd "$ROOT/backend" && nohup uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload > "$LOG_DIR/backend.log" 2>&1 &)

# --- Start Frontend ---
echo "Starting frontend (Next.js) on port 3000..."
# start frontend in background and redirect logs, capture PID
(cd "$ROOT/apps/web" && nohup pnpm dev > "$LOG_DIR/frontend.log" 2>&1 & echo $! > "$LOG_DIR/frontend.pid")

# Check if frontend started successfully
FRONTEND_PID=$(cat "$LOG_DIR/frontend.pid")
sleep 2  # Give it a moment to start

if ! kill -0 "$FRONTEND_PID" 2>/dev/null; then
    echo "ERROR: Frontend (Next.js) failed to start. Check logs below:"
    tail -n 20 "$LOG_DIR/frontend.log"
    exit 1
fi

echo "Both processes started."
echo "Backend logs:   $LOG_DIR/backend.log"
echo "Frontend logs:  $LOG_DIR/frontend.log"
echo "---"
echo "You can stream logs with: tail -f $LOG_DIR/backend.log"
