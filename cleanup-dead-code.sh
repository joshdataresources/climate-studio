#!/usr/bin/env bash
#
# cleanup-dead-code.sh — remove verified-dead files from climate-studio.
#
# Why a script: the assistant's sandbox could create/edit files but not DELETE
# them or run git, so the deletions are handed to you to run locally where you
# have full permissions. This script is self-verifying: it stages the deletions,
# checks that no surviving file imports anything it deleted, and ABORTS (undoing
# the staged deletions) if it finds a dangling import.
#
# Run from the repo root, on the cleanup branch:
#   git checkout cleanup/honest-data   # (already created)
#   bash cleanup-dead-code.sh
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
SRC="$ROOT/apps/climate-studio/src"
cd "$ROOT"

echo "▶ Removing stale git lock if present…"
rm -f .git/index.lock 2>/dev/null || true
rm -f "$SRC/__wtest__" 2>/dev/null || true   # stray file left by the sandbox

# --- Verified-dead files (zero inbound imports from the live entry graph) ---
APP_VARIANTS=(
  App.test.tsx AppBasic.tsx AppBioSync.tsx AppClean.tsx AppFixed.tsx
  AppGIS.tsx AppHello.tsx AppMap.tsx AppMinimal.tsx AppShadcn.tsx
  AppSimple.tsx AppTest.tsx
)
DEAD_COMPONENTS=(
  leaflet-map.tsx simple-leaflet-map.tsx EnhancedLeafletViewer.tsx
  MinimalLeafletViewer.tsx ProfessionalSliderViewer.tsx UltraMinimalViewer.tsx
  CleanMapViewer.tsx SimpleMapViewer.tsx ShadcnMapViewer.tsx
  HybridMapViewerFixed.tsx HybridMapViewerShadcn.tsx OpenLayersGlobe.tsx
  MinimalDemo.tsx gis-analysis-app.tsx MapViewer.tsx MapboxViewer.tsx
  MainContent.tsx AdvancedMapContainer.tsx
)

echo "▶ Staging deletions…"
for f in "${APP_VARIANTS[@]}"; do
  [ -f "$SRC/$f" ] && git rm -q "$SRC/$f" && echo "   - src/$f"
done
for f in "${DEAD_COMPONENTS[@]}"; do
  [ -f "$SRC/components/$f" ] && git rm -q "$SRC/components/$f" && echo "   - src/components/$f"
done

# --- Safety check: does any SURVIVING file still import a deleted module? ---
echo "▶ Verifying no dangling imports…"
BASENAMES=()
for f in "${APP_VARIANTS[@]}" "${DEAD_COMPONENTS[@]}"; do
  BASENAMES+=("${f%.tsx}")
done
PATTERN="from ['\"][^'\"]*(`IFS='|'; echo "${BASENAMES[*]}"`)['\"]"

if grep -rEn "$PATTERN" --include='*.ts' --include='*.tsx' "$SRC" ; then
  echo "✖ Dangling import(s) found above — a surviving file references a deleted module."
  echo "  Undoing staged deletions. Investigate the file(s) listed before retrying."
  git restore --staged --worktree -- "$SRC" || git checkout -- "$SRC"
  exit 1
fi
echo "   ✅ none"

echo "▶ Done. Review with:  git status   and   git diff --cached --stat"
echo
echo "OPTIONAL — drop the now-unused Leaflet/OpenLayers deps (only after the build passes):"
echo "  1) Remove the leaflet CSS import (line ~5) from apps/climate-studio/src/main.tsx"
echo "  2) Re-run a search to confirm nothing live still imports leaflet:"
echo "       grep -rEn \"from ['\\\"](leaflet|esri-leaflet|ol)\" apps/climate-studio/src || echo CLEAN"
echo "  3) If CLEAN:  (cd apps/climate-studio && npm uninstall leaflet leaflet.heat esri-leaflet @types/leaflet @types/leaflet.heat)"
echo
echo "Then build to confirm:  (cd apps/climate-studio && npm run build)"
echo "And commit:  git commit -m 'chore: remove dead App variants and legacy map components'"
