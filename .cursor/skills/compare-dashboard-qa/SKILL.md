---
name: compare-dashboard-qa
description: >-
  QA the Location Analysis Compare dashboard — verify every chart shows one line
  and legend entry per selected city (up to 10). Use when the user reports
  compare charts missing cities, stale lines, legend mismatch, asks for a QA
  agent on the dashboard, or mentions /dashboard multi-city charts.
---

# Compare Dashboard QA

Validate that **Charts → Compare** shows **N lines and N legend items** on every panel when **N cities** are selected.

## Before testing

1. **Use one dev server only.** Multiple Vite instances cause stale code (common ports: 8080, 8081, 8082).
2. From repo root:

```bash
lsof -ti tcp:8080,tcp:8081,tcp:8082 | xargs kill -9 2>/dev/null
cd apps/climate-studio && npm run dev
```

3. Open **only** the URL Vite prints (e.g. `http://localhost:8080/dashboard`).
4. Hard refresh: `Cmd+Shift+R`.

## Chart panels to check (8 total)

| # | Title |
|---|--------|
| 1 | Annual Temperature |
| 2 | Summer Average |
| 3 | Winter Average |
| 4 | Days Over 100°F |
| 5 | Wet Bulb Events |
| 6 | Precipitation & Drought |
| 7 | Drought Index |
| 8 | Aquifer Storage |

**Pass:** subtitle says `N cities — one line per city` and legend has **N** items.  
**Pass (visual):** each chart has an `<svg>` with **N** `<path>` stroke elements (one per city with data).

## Browser QA workflow (cursor-ide-browser MCP)

1. `browser_navigate` → `{baseUrl}/dashboard`
2. Confirm **Compare** tab is selected (default when ≥2 cities).
3. Note default city count (usually 4: New York, Seattle, Phoenix, Houston).
4. For each chart, count legend `<li>` items in `browser_snapshot`.
5. Add cities via search combobox → type metro name → **Add**:
   - Chicago, Los Angeles, Miami, Denver (stop at 8 or user limit).
6. After **each** add, re-count legend items on **all 8** panels.
7. Compare charts render via **React SVG** (`SvgLinePlot.tsx`), not Recharts or Chart.js.

`DashboardChart` uses `SvgLinePlot` for all dashboard line charts (compare + single-city baselines).

Optional CDP check (Annual Temperature widget):

```javascript
(() => {
  const h = [...document.querySelectorAll('h4.widget-title')]
    .find(el => el.textContent.includes('Annual Temperature'));
  const w = h?.closest('.widget-container');
  return {
    legendCount: w?.querySelectorAll('ul[aria-label="Chart legend"] li').length
      ?? w?.querySelectorAll('ul li').length,
    pathCount: w?.querySelectorAll('svg path[stroke]').length,
  };
})()
```

Use `browser_cdp` with `Runtime.evaluate`, `returnByValue: true`.

## Data-layer script (no browser)

Verifies builders return correct series length:

```bash
.cursor/skills/compare-dashboard-qa/scripts/verify-compare-series.sh
```

Expect `series: 6` for all chart types when given 6 default+extra metros.

## Key source files

| File | Role |
|------|------|
| `apps/climate-studio/src/pages/Dashboard.tsx` | City list; only mounts active tab |
| `apps/climate-studio/src/components/dashboard/LocationCompareView.tsx` | Compare table + charts |
| `apps/climate-studio/src/components/dashboard/LocationMultiCityCharts.tsx` | Builds compare chart grid |
| `apps/climate-studio/src/components/dashboard/DashboardChart.tsx` | Chart shell + custom legend |
| `apps/climate-studio/src/components/dashboard/SvgLinePlot.tsx` | React SVG multi-line renderer |
| `apps/climate-studio/src/utils/metroChartData.ts` | `buildMultiCity*` series |
| `apps/climate-studio/src/hooks/useDashboardPrecipitationCharts.ts` | Async precip/drought |

## Known failure modes

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Stuck at 4 lines, subtitle updates | Old dev server tab | Kill 8080/8081/8082, restart, hard refresh |
| Precip/drought lag 1 city | EE fetch async | Wait 2–3s; legend should still list N immediately |
| Aquifer legend > lines | City has no aquifer at coords | Legend shows all cities; line only if data exists |
| Recharts curves, not SVG paths | Old code path | Hard refresh; dashboard uses SvgLinePlot |

## If QA fails — fix order

1. Confirm `SvgLinePlot` renders (`svg path[stroke]` inside compare chart widgets).
2. Confirm `LocationMultiCityCharts` has `key={locations.map(...).join('-')}`.
3. Confirm `Dashboard.tsx` only mounts `activeTab === COMPARE_TAB` content.
4. Confirm `buildMultiCitySeries` returns **all** metros (no `activeKeys` filter).
5. Re-run browser QA after each fix.

## Report template

```markdown
## Compare Dashboard QA

**URL:** http://localhost:PORT/dashboard  
**Cities tested:** 4 → N  

| Chart | N cities | Legend | SVG paths | Pass |
|-------|----------|--------|-----------|------|
| Annual Temperature | | | | |
| ... | | | | |

**Root cause:**  
**Fix applied:**  
**Verification:**  
```

## Additional resources

- File map and architecture notes: [reference.md](reference.md)
