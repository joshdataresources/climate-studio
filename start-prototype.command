#!/bin/bash
# Launcher — boots climate-studio and opens the map prototype at
# http://localhost:8080/prototype. Double-clickable; no typing needed.
cd "/Users/joshuabutler/Documents/GitHub/climate-studio" || exit 1

echo "- freeing port 8080 if held..."
pids=$(lsof -ti tcp:8080 2>/dev/null)
if [ -n "$pids" ]; then echo "$pids" | xargs kill -9 2>/dev/null; sleep 1; fi

echo "- clearing Vite dep cache..."
rm -rf apps/climate-studio/node_modules/.vite apps/climate-studio/node_modules/.vite-temp 2>/dev/null

if [ ! -d node_modules ]; then
  echo "- installing dependencies (first run)..."
  npm install
fi

# Open the prototype once the server responds
(
  for i in $(seq 1 120); do
    if curl -fsS -o /dev/null --max-time 1 http://localhost:8080; then
      sleep 1
      open "http://localhost:8080/prototype"
      break
    fi
    sleep 1
  done
) &

echo "- starting dev server on http://localhost:8080 (close this window or Ctrl-C to stop)"
cd apps/climate-studio && npx vite --host 0.0.0.0 --port 8080
