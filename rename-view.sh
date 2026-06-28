#!/usr/bin/env bash
#
# rename-view.sh — rename the misleadingly-named main view
#   WaterAccessView  →  ClimateStudioView
#
# It's actually the main climate map view, not a water-specific one. This keeps
# WaterAccessView as a back-compat alias in index.tsx so the navigation app and
# any external consumer keep working unchanged.
#
# Run AFTER you've committed (so it's a clean, revertable change), and ideally
# AFTER cleanup-dead-code.sh (that removes App.test.tsx, which also referenced it).
#
#   git checkout cleanup/honest-data
#   bash rename-view.sh
#   # restart the dev server, confirm the app still loads, then:
#   git add -A && git commit -m "Rename WaterAccessView -> ClimateStudioView"
#
# To revert if anything looks off:  git checkout .   (and git mv back, or just reset)
#
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"
SRC="apps/climate-studio/src"
OLD="WaterAccessView"
NEW="ClimateStudioView"   # change this if you prefer a different name

if [ ! -f "$SRC/components/$OLD.tsx" ]; then
  echo "✖ $SRC/components/$OLD.tsx not found — already renamed?"; exit 1
fi

echo "▶ moving the file (preserves git history)…"
git mv "$SRC/components/$OLD.tsx" "$SRC/components/$NEW.tsx"

echo "▶ renaming the component definition…"
sed -i '' "s/export default function $OLD/export default function $NEW/" "$SRC/components/$NEW.tsx"

echo "▶ updating App.tsx (import + usage)…"
sed -i '' "s#import $OLD from './components/$OLD'#import $NEW from './components/$NEW'#" "$SRC/App.tsx"
sed -i '' "s#<$OLD #<$NEW #g" "$SRC/App.tsx"

echo "▶ updating the dashboard map-background dynamic import…"
sed -i '' "s#'../$OLD'#'../$NEW'#g" "$SRC/components/dashboard/DashboardMapBackground.tsx"

echo "▶ updating index.tsx (new export + keep old name as alias)…"
sed -i '' "s#from './components/$OLD'#from './components/$NEW'#g" "$SRC/index.tsx"
echo "export { default as $NEW } from './components/$NEW'" >> "$SRC/index.tsx"

echo
echo "✅ Renamed $OLD → $NEW. '$OLD' still exported as an alias so external apps don't break."
echo "▶ Verify nothing references the OLD file path anymore:"
grep -rn "components/$OLD'" "$SRC" || echo "   ✅ no stale './components/$OLD' imports"
echo
echo "Now restart the dev server and confirm the app loads, then commit."
