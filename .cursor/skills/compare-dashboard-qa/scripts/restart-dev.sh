#!/usr/bin/env bash
# Kill stale Vite dev servers and start a single instance.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../../../" && pwd)"
lsof -ti tcp:8080,tcp:8081,tcp:8082 2>/dev/null | xargs kill -9 2>/dev/null || true
sleep 1
cd "$ROOT/apps/climate-studio"
echo "Starting dev server (watch for the Local URL)..."
npm run dev
