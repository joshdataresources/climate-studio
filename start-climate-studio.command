#!/bin/bash
# Auto-generated launcher — boots Vite for climate-studio on http://localhost:8080
cd "/Users/joshuabutler/Documents/github-project/climate-suite" || exit 1

echo "▶ killing any leftover dev servers on 8080/8081…"
for port in 8080 8081; do
  pids=$(lsof -ti tcp:$port 2>/dev/null)
  if [ -n "$pids" ]; then
    echo "  port $port held by PID(s): $pids — killing"
    echo "$pids" | xargs kill -9 2>/dev/null
  fi
done
sleep 1

echo "▶ clearing Vite dep-bundle cache…"
rm -rf apps/climate-studio/node_modules/.vite apps/climate-studio/node_modules/.vite-temp 2>/dev/null
echo "  cache cleared"

echo "▶ starting climate-studio dev server (port 8080, force re-optimize)…"

# Background: wait for port 8080, then launch Chrome
(
  for i in $(seq 1 90); do
    if curl -fsS -o /dev/null --max-time 1 http://localhost:8080; then
      sleep 1
      open -a "Google Chrome" "http://localhost:8080"
      break
    fi
    sleep 1
  done
) &

# Foreground: dev server with --force so Vite re-runs dep optimization
cd apps/climate-studio && npx vite --host 0.0.0.0 --port 8080 --force
