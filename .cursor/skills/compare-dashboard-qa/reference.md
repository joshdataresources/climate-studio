# Compare Dashboard — Reference

## Route and flags

- Route: `/dashboard` in `apps/climate-studio/src/App.tsx`
- Gated by `VITE_ENABLE_LOCATION_DASHBOARD`
- Max cities: `MAX_DASHBOARD_CITIES` (10) in `apps/climate-studio/src/config/dashboard.ts`

## Compare vs city tabs

- **Compare tab** (`__compare__`): `LocationCompareView` → `LocationMultiCityCharts` with `compareMode = locations.length > 1`
- **City tab**: `LocationCityView` → single-city charts with dashed baselines (Recharts)

Only the active tab should mount (see `Dashboard.tsx`) to avoid hidden Recharts instances.

## Multi-city chart rendering

All dashboard line charts use **React SVG** via `SvgLinePlot` (one `<path key={s.key}>` per series).

`DashboardChart` renders a custom legend below the plot.

Single-city charts include a dashed baseline dataset; compare mode uses one solid dataset per city.

## Series builders

All compare temperature/wet-bulb charts use `buildMultiCitySeries` in `metroChartData.ts`.  
Precip/drought use `buildPrecipitationChartsFromTrajectories` in `dashboardClimateApi.ts`.  
Aquifer uses `buildMultiCityAquiferStorageSeries` in `metroAquiferData.ts` — legend includes all locations; lines only where aquifer data exists.

## Default metros

`DEFAULT_DASHBOARD_METRO_KEYS`: New York, Seattle, Phoenix, Houston (`metroResolver.ts`).

## Not in scope

These project agents test **map layers**, not this dashboard:

- `climate-layer-tester`
- `hexagon-layer-debugger`
- `map-viz-expert`

Use this skill (`compare-dashboard-qa`) for Charts / Compare QA.
