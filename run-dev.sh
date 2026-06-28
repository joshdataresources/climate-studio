#!/usr/bin/env bash
#
# run-dev.sh — boot the climate-studio stack from THIS clone (with the cleanup-branch changes).
#
# Tiers:
#   • Frontend + Node backend  → you see the app, the basemap, and LIVE USGS streamflow / NOAA sea-level.
#   • + Python climate service → adds the Earth Engine layers (temp, urban heat, groundwater, relief).
#     The Python tier needs your Earth Engine auth; skip it and the app still runs (EE layers just won't load).
#
# Usage:   bash run-dev.sh          # frontend + backend
#          bash run-dev.sh --ee     # also start the Python Earth Engine service
#
set -uo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"
PIDS=()
cleanup() { echo; echo "▶ shutting down…"; for p in "${PIDS[@]:-}"; do kill "$p" 2>/dev/null || true; done; }
trap cleanup EXIT INT TERM

# --- deps check ---
if [ ! -d node_modules ] || [ ! -d apps/climate-studio/node_modules ]; then
  echo "▶ installing workspace deps (first run)…"
  npm install
fi

# --- 1) Node backend on :3001 (USGS streamflow, NOAA tiles, proxies EE tiles to :5001) ---
echo "▶ starting Node backend on :3001…"
( cd backend && [ -d node_modules ] || npm install >/dev/null 2>&1; \
  CLIMATE_SERVICE_URL="http://localhost:5001" PORT=3001 node server.js ) &
PIDS+=($!)

# --- 2) optional Python Earth Engine service on :5001 ---
if [ "${1:-}" = "--ee" ]; then
  echo "▶ preparing Python climate service on :5001 (Earth Engine)…"
  (
    cd qgis-processing
    if [ ! -x .venv/bin/python ]; then
      echo "   creating venv + installing deps (first run, ~1-2 min)…"
      python3 -m venv .venv
      ./.venv/bin/pip install --upgrade pip >/dev/null
      ./.venv/bin/pip install -r requirements-local.txt
    fi
    if [ ! -f "$HOME/.config/earthengine/credentials" ]; then
      echo "   ⚠ Earth Engine isn't authenticated yet. Run this once, then re-run with --ee:"
      echo "       source qgis-processing/.venv/bin/activate && earthengine authenticate"
    fi
    # use the venv's python so flask/earthengine/shapely resolve
    PORT=5001 ./.venv/bin/python climate_server.py
  ) &
  PIDS+=($!)
else
  echo "ℹ skipping Earth Engine service (run with --ee to enable temp/heat/groundwater layers)"
fi

# --- 3) open the browser once Vite is up ---
( for i in $(seq 1 90); do
    curl -fsS -o /dev/null --max-time 1 http://localhost:8080 && { sleep 1; open "http://localhost:8080" 2>/dev/null; break; }
    sleep 1
  done ) &

# --- 4) frontend (foreground; Ctrl-C stops everything) ---
echo "▶ starting frontend on :8080  (Ctrl-C to stop all)…"
cd apps/climate-studio && npx vite --host 0.0.0.0 --port 8080 --force
