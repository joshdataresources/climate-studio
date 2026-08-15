#!/usr/bin/env bash
#
# Start the whole climate-studio dev stack with one command.
#
#   ./scripts/dev.sh              # both backends + frontend
#   ./scripts/dev.sh --frontend   # Vite only
#   ./scripts/dev.sh --backend    # Flask + Node, no Vite
#   ./scripts/dev.sh --check      # run the EE diagnostic and exit
#
# Handles the four things that keep going wrong by hand:
#   · the stale Vite dep cache (chart.js ENOENT → white screen)
#   · leftover processes holding 8080 / 5001 / 3001
#   · the Flask backend never being started, so every EE layer renders blank
#   · the Node backend never being started, so aquifers, sea level rise,
#     wildfire tiles, and live streamflow silently fail (the frontend's .env
#     points VITE_NODE_BACKEND_URL at :3001, but nothing used to listen there)
#
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

FRONTEND_PORT=8080
BACKEND_PORT=5001
NODE_BACKEND_PORT=3001
BACKEND_DIR="$REPO_ROOT/qgis-processing"
NODE_BACKEND_DIR="$REPO_ROOT/backend"
STUDIO_DIR="$REPO_ROOT/apps/climate-studio"

GREEN=$'\033[32m'; RED=$'\033[31m'; YELLOW=$'\033[33m'
BLUE=$'\033[34m'; DIM=$'\033[2m'; BOLD=$'\033[1m'; RESET=$'\033[0m'

say()  { printf '%s▶%s %s\n' "$BLUE" "$RESET" "$1"; }
ok()   { printf '  %s✓%s %s\n' "$GREEN" "$RESET" "$1"; }
warn() { printf '  %s!%s %s\n' "$YELLOW" "$RESET" "$1"; }
die()  { printf '  %s✗%s %s\n' "$RED" "$RESET" "$1"; exit 1; }

RUN_BACKEND=1
RUN_FRONTEND=1
case "${1:-}" in
  --frontend) RUN_BACKEND=0 ;;
  --backend)  RUN_FRONTEND=0 ;;
  --check)    RUN_BACKEND=0; RUN_FRONTEND=0 ;;
  "")         ;;
  *)          die "Unknown option: $1 (expected --frontend, --backend, or --check)" ;;
esac

# ── pick a python ────────────────────────────────────────────────────────────
PYTHON=""
for candidate in python3.12 python3 python; do
  if command -v "$candidate" >/dev/null 2>&1; then PYTHON="$candidate"; break; fi
done
[ -n "$PYTHON" ] || die "No python found on PATH"

# ── free the ports ───────────────────────────────────────────────────────────
free_port() {
  local port=$1 label=$2
  local pids
  pids=$(lsof -ti "tcp:$port" 2>/dev/null || true)
  if [ -n "$pids" ]; then
    warn "port $port ($label) held by PID(s) $(echo "$pids" | tr '\n' ' ')— killing"
    echo "$pids" | xargs kill -9 2>/dev/null || true
    sleep 1
  fi
}

say "Freeing ports"
[ "$RUN_FRONTEND" = 1 ] && free_port "$FRONTEND_PORT" "vite"
if [ "$RUN_BACKEND" = 1 ]; then
  free_port "$BACKEND_PORT" "flask"
  free_port "$NODE_BACKEND_PORT" "node"
fi
ok "ports clear"

# ── clear the stale Vite dep cache ───────────────────────────────────────────
# Vite records which deps it pre-bundled. After a branch switch or npm install
# removes a package, the cache still references it and the optimizer dies with
# ENOENT — which surfaces as a blank white page, not an obvious error.
if [ "$RUN_FRONTEND" = 1 ]; then
  say "Clearing Vite dep cache"
  rm -rf "$STUDIO_DIR/node_modules/.vite" "$STUDIO_DIR/node_modules/.vite-temp" 2>/dev/null || true
  ok "cache cleared"
fi

# ── sanity-check deps ────────────────────────────────────────────────────────
if [ "$RUN_FRONTEND" = 1 ] && [ ! -x "$REPO_ROOT/node_modules/.bin/vite" ] \
   && [ ! -x "$STUDIO_DIR/node_modules/.bin/vite" ]; then
  warn "vite not installed — running npm install"
  npm install || die "npm install failed"
fi

if [ "$RUN_BACKEND" = 1 ] && [ ! -d "$NODE_BACKEND_DIR/node_modules" ]; then
  warn "backend/node_modules missing — running npm install in backend/"
  ( cd "$NODE_BACKEND_DIR" && npm install ) || die "backend npm install failed"
fi

# ── shutdown ─────────────────────────────────────────────────────────────────
BACKEND_PID=""
NODE_BACKEND_PID=""
FRONTEND_PID=""
shutdown() {
  printf '\n'
  say "Shutting down"
  [ -n "$BACKEND_PID" ] && kill "$BACKEND_PID" 2>/dev/null || true
  [ -n "$NODE_BACKEND_PID" ] && kill "$NODE_BACKEND_PID" 2>/dev/null || true
  [ -n "$FRONTEND_PID" ] && kill "$FRONTEND_PID" 2>/dev/null || true
  wait 2>/dev/null || true
  ok "stopped"
}
trap shutdown INT TERM EXIT

# ── EE diagnostic ────────────────────────────────────────────────────────────
if [ "${1:-}" = "--check" ]; then
  exec "$PYTHON" "$BACKEND_DIR/diagnose_ee.py" --live
fi

# ── backend ──────────────────────────────────────────────────────────────────
if [ "$RUN_BACKEND" = 1 ]; then
  say "Starting climate server (Flask, port $BACKEND_PORT)"

  if [ ! -f "$BACKEND_DIR/.env" ]; then
    warn "qgis-processing/.env missing — Earth Engine layers will be blank"
    warn "run: $PYTHON qgis-processing/diagnose_ee.py"
  fi

  mkdir -p "$REPO_ROOT/.dev-logs"
  BACKEND_LOG="$REPO_ROOT/.dev-logs/climate-server.log"
  ( cd "$BACKEND_DIR" && "$PYTHON" climate_server.py ) > "$BACKEND_LOG" 2>&1 &
  BACKEND_PID=$!

  printf '  waiting for backend'
  BACKEND_UP=0
  # climate_server.py authenticates ~9 Earth Engine services at import time, over the
  # network, before it can serve /health. 90s gives that real headroom on a slow
  # connection without leaving a truly-stuck process spinning forever.
  for _ in $(seq 1 90); do
    if curl -fsS -o /dev/null --max-time 1 "http://localhost:$BACKEND_PORT/health" 2>/dev/null; then
      BACKEND_UP=1; break
    fi
    if ! kill -0 "$BACKEND_PID" 2>/dev/null; then break; fi
    printf '.'; sleep 1
  done
  printf '\n'

  if [ "$BACKEND_UP" = 1 ]; then
    ok "backend ready — http://localhost:$BACKEND_PORT"
    STATUS=$(curl -fsS --max-time 20 "http://localhost:$BACKEND_PORT/api/climate/status" 2>/dev/null || echo "")
    if [ -n "$STATUS" ]; then
      echo "$STATUS" | "$PYTHON" -c '
import json, sys
try:
    d = json.load(sys.stdin)
except Exception:
    sys.exit()
services = d.get("services") or d.get("ee_services") or {}
for name, ready in services.items():
    mark = "\033[32m✓\033[0m" if ready else "\033[31m✗\033[0m"
    print(f"    {mark} {name}")
if services and not all(services.values()):
    print("    \033[2m→ some Earth Engine services failed; run: python qgis-processing/diagnose_ee.py\033[0m")
'
    fi
  else
    warn "backend did not come up — Earth Engine layers will be blank"
    warn "log: $BACKEND_LOG"
    tail -n 15 "$BACKEND_LOG" 2>/dev/null | sed 's/^/      /'
    BACKEND_PID=""
  fi
fi

# ── node backend ─────────────────────────────────────────────────────────────
# Aquifers, sea level rise tiles, wildfire tiles, and live streamflow all go
# through BACKEND_BASE_URL, which the frontend's .env points at :3001. Without
# this running, those calls hit a closed port and the layers stay empty.
if [ "$RUN_BACKEND" = 1 ]; then
  say "Starting Node server (Express, port $NODE_BACKEND_PORT)"

  if [ ! -f "$NODE_BACKEND_DIR/.env" ]; then
    warn "backend/.env missing — some Node-backed layers may be blank"
  fi

  mkdir -p "$REPO_ROOT/.dev-logs"
  NODE_BACKEND_LOG="$REPO_ROOT/.dev-logs/node-server.log"
  ( cd "$NODE_BACKEND_DIR" && PORT="$NODE_BACKEND_PORT" node server.js ) > "$NODE_BACKEND_LOG" 2>&1 &
  NODE_BACKEND_PID=$!

  printf '  waiting for node backend'
  NODE_BACKEND_UP=0
  for _ in $(seq 1 30); do
    if curl -fsS -o /dev/null --max-time 1 "http://localhost:$NODE_BACKEND_PORT/health" 2>/dev/null; then
      NODE_BACKEND_UP=1; break
    fi
    if ! kill -0 "$NODE_BACKEND_PID" 2>/dev/null; then break; fi
    printf '.'; sleep 1
  done
  printf '\n'

  if [ "$NODE_BACKEND_UP" = 1 ]; then
    ok "node backend ready — http://localhost:$NODE_BACKEND_PORT"
  else
    warn "node backend did not come up — aquifers, sea level rise, wildfire tiles, and streamflow will be blank"
    warn "log: $NODE_BACKEND_LOG"
    tail -n 15 "$NODE_BACKEND_LOG" 2>/dev/null | sed 's/^/      /'
    NODE_BACKEND_PID=""
  fi
fi

# ── frontend ─────────────────────────────────────────────────────────────────
if [ "$RUN_FRONTEND" = 1 ]; then
  say "Starting Vite (port $FRONTEND_PORT)"
  ( cd "$STUDIO_DIR" && npx vite --host 0.0.0.0 --port "$FRONTEND_PORT" --force ) &
  FRONTEND_PID=$!

  printf '  waiting for frontend'
  for _ in $(seq 1 60); do
    if curl -fsS -o /dev/null --max-time 1 "http://localhost:$FRONTEND_PORT" 2>/dev/null; then
      break
    fi
    if ! kill -0 "$FRONTEND_PID" 2>/dev/null; then break; fi
    printf '.'; sleep 1
  done
  printf '\n'

  printf '\n%sReady%s  →  %shttp://localhost:%s%s\n' \
    "$BOLD" "$RESET" "$BOLD" "$FRONTEND_PORT" "$RESET"
  printf '%s        Ctrl-C to stop everything%s\n\n' "$DIM" "$RESET"
fi

wait
