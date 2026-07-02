# Climate Studio — App Handoff / Context Prompt

*Paste this into a new chat to continue working on the app. It's the full state of the project as of the last session.*

---

## What this is

**Climate Studio** — an interactive climate-risk map for US metro areas. A Mapbox basemap with **deck.gl** layers on top (temperature projections, urban heat, sea level, groundwater, precipitation, wet-bulb, live river flow), plus clickable **metro popovers** and a **Location dashboard**. I'm building it partly as the subject of a podcast, and the whole thrust of recent work has been **making the data honest** — replacing fabricated/estimated numbers with real NASA / NOAA / USGS data.

## Where it lives

- **Repo:** `~/Documents/GitHub/climate-studio` (a git clone — use this one).
- There's also an iCloud copy at `~/Library/Mobile Documents/com~apple~CloudDocs/climate-suite` — **ignore it**; its files are cloud-only and don't reliably materialize.
- **Working branch:** `cleanup/honest-data`. If git ever complains about a lock: `rm -f .git/index.lock`.

## Stack / architecture

npm-workspaces monorepo:
- `apps/climate-studio` — the main app (React 18 + Vite + TypeScript). Runs on **:8080**.
- `apps/navigation` — a separate shell app that imports from the studio package.
- `packages/climate-core` — shared config + contexts. **The climate layer registry is here:** `packages/climate-core/src/config/climateLayers.ts`.
- `backend/` — Node/Express gateway on **:3001** (handles USGS/NOAA + proxies climate tiles).
- `qgis-processing/` — Python/Flask climate service on **:5001**, backed by **Google Earth Engine**.

**Data flow:** Frontend (8080) → Node backend (3001) → Python/Flask (5001) → Earth Engine. Some layers hit public APIs directly (USGS streamflow, NOAA sea-level).

**The map:** `apps/climate-studio/src/components/DeckGLMap.tsx` — Mapbox GL + a deck.gl `MapboxOverlay`. Layers are declared in `climateLayers.ts`; `hooks/useClimateLayerData.ts` fetches each active layer's route into `layerStates`, and DeckGLMap renders them (raster tile layers via `TileLayer→BitmapLayer`, vectors via `GeoJsonLayer`/`ScatterplotLayer`).

**Quirks to know:**
- The default route renders `components/WaterAccessView.tsx` — a ~7,000-line file that is actually the **main map view** (misleadingly named; a rename was attempted and reverted).
- There are **two parallel layer systems** (`climate-core/config/climateLayers.ts` driving the map, and a separate `src/config/layerDefinitions.ts` UI registry). Messy.
- Four mapping libs are installed; only **Mapbox + deck.gl** are used. **Leaflet, esri-leaflet, and OpenLayers** are legacy/unused.

## How to run it

```
cd ~/Documents/GitHub/climate-studio
bash run-dev.sh --ee     # frontend + Node backend + Python EE service
```
- Frontend: **http://localhost:8080** (dashboard at `/dashboard`).
- Python EE service needs a venv + auth (see gotchas). `--ee` starts it; without `--ee` you get everything except the Earth Engine layers.
- `.env.local`: `VITE_NODE_BACKEND_URL` toggles local (commented) vs a hosted Render backend; `VITE_ENABLE_LOCATION_DASHBOARD=true` enables the dashboard route. Mapbox token is baked into DeckGLMap.

## Environment gotchas (important)

- **Python is 3.14 (Homebrew).** Use `qgis-processing/requirements-local.txt` (loosened pins so shapely/numpy install prebuilt wheels) — **not** the pinned `requirements.txt`, which fails to build on 3.14.
- **Earth Engine auth (once):** `cd qgis-processing && source .venv/bin/activate && earthengine authenticate`. EE project is `josh-geo-the-second` (env `EARTHENGINE_PROJECT`).
- Flask runs in debug mode and **auto-reloads** on file changes. Vite auto-reloads on `.env.local` changes.
- The regen scripts are **slow** (per-metro EE queries, ~1–4 min/city) but all **resumable** — they write progress files + `.bak` backups and skip finished cities on re-run. Wrap long runs in `caffeinate -i … &` and keep the lid open.

## What's been done (the honesty overhaul)

- **Metro temperature projections → real.** All ~52 metros now use real NASA NEX-GDDP-CMIP6 (4-model ensemble), 8 decades × 2 scenarios (ssp245/ssp585), with real `days_over_100/110` and `summer_avg/winter_avg`. Fixed the old "identical 70°F" bug (was latitude-bucket estimates). File: `apps/climate-studio/src/data/metro_temperature_projections.json`. Script: `qgis-processing/regenerate_metro_temps.py`.
- **Wet-bulb / humidity → real.** Stull wet-bulb from CMIP6 `tas`+`hurs`: `avg_summer_humidity`, `peak_humidity`, `wet_bulb_events`, `days_over_95F/100F`. File: `expanded_wet_bulb_projections.json`. Scripts: `regenerate_wet_bulb.py` + `backfill_wetbulb.py` (backfilled the ~16 metros that had temps but no wet-bulb — now the two datasets match).
- **Removed fabricated numbers.** Killed `casualty_rate_percent` / `estimated_at_risk_population` from popovers; fixed a mislabeled "Humid Temp 144°" (it was a day-count shown with a ° sign) → "95°+ Days"; replaced a hardcoded mock temperature tooltip in DeckGLMap with real data.
- **Precipitation/drought → real projection.** `services/precipitation_drought.py get_tile_url` now pulls real CMIP6 `pr` by year+scenario (was frozen CHIRPS 2020–23 with a decorative slider). **Caveat:** single model (ACCESS-CM2), not the 4-model ensemble; and `drought_index`/`soil_moisture` are simple derived proxies off precipitation, not independent variables.
- **Removed fake metro population.** The fabricated population bubbles + "population change %" are gone from the map/popovers; the real temperature/humidity stays. (`megaregion-data.json` still has a dead `populations` field, no longer displayed.)
- **Added a live USGS streamflow layer.** Backend `/api/usgs/streamflow` (real-time NWIS, no EE) in `server.js`; registered as climate layer `river_flow_status` in `climateLayers.ts`; rendered as a `ScatterplotLayer` sized by discharge in DeckGLMap. Toggle "Live River Flow (USGS)" and zoom into a metro.
- **New tooling:** `add_city.py "City, ST"` — one command to add a metro and pull all its real data (geocodes the name). `backfill_wetbulb.py` — fills wet-bulb for any temp-only metros. Both resumable.

## Current per-layer data status

- **Real & solid:** Temperature Anomaly (CMIP6), Urban Heat Island (Yale YCEO), Topographic Relief (SRTM), Sea Level Rise (real NOAA tiles), Wet-Bulb map layer (live EE), Live River Flow (USGS), and metro popovers (temp + humidity real).
- **Real, with a caveat:** Precipitation & Drought (real CMIP6 `pr`, but single-model; drought/soil-moisture derived).
- **Gone (were fake):** metro population; casualty/at-risk numbers.
- **Other:** `groundwater_depletion` layer is commented out in `climateLayers.ts` (awaiting GRACE access) though the backend GRACE service works. Urban expansion (if surfaced) uses real GHSL-2020 base + a simple 500 m/yr growth model.

## Remaining work / to-dos

1. **Run the dead-code cleanup:** `bash cleanup-dead-code.sh` removes ~30 dead files (11 `App*.tsx` variants + legacy map viewers). Self-verifying (aborts if anything still imports a deleted file). Then commit.
2. **Rename `WaterAccessView`** → something clearer (it's the main map view). `rename-view.sh` exists; a `MapView` target collides with a dead `components/MapView.tsx` (git rm that first). Keep `WaterAccessView` as an alias for the navigation app.
3. **Consolidate mapping libs** — remove Leaflet / esri-leaflet / OpenLayers deps + the dead components that use them.
4. **Precipitation:** optionally upgrade to the 4-model ensemble for consistency with temperature; consider real drought/soil-moisture instead of derived proxies.
5. **Hide the dead "Population" toggle** in the layer control panel (it renders but does nothing now).
6. **Streamflow hover tooltip** — dots render + size by flow, but there's no hover tooltip yet (the `getTooltip` handler only covers the megaregion layer).
7. **TypeScript noise:** ~130 pre-existing type errors (module-resolution + a commented-out `groundwater_depletion` id + a `LayerStateMap` export quirk). **Vite/esbuild builds fine regardless** (the build doesn't typecheck) — clean up if desired, not blocking.
8. **Commit state:** work is on `cleanup/honest-data`; confirm `git status` and commit. `.gitignore` already excludes `.venv`, logs, `.bak`, and the regen `*_progress.json` files.
9. Benign: backend logs "Database initialization failed" — Postgres isn't set up; only needed for GIS-download features, ignore.

## Key files

- Map: `apps/climate-studio/src/components/DeckGLMap.tsx`
- Layer registry: `packages/climate-core/src/config/climateLayers.ts`
- Data hook: `apps/climate-studio/src/hooks/useClimateLayerData.ts`
- Main view: `apps/climate-studio/src/components/WaterAccessView.tsx`
- Popovers: `components/MetroHumidityBubble.tsx`, `components/MetroUnifiedPopup.tsx`
- Node backend: `backend/server.js`
- Python EE services: `qgis-processing/services/*.py` (e.g. `nasa_ee_climate.py`, `precipitation_drought.py`, `wet_bulb_service.py`)
- Data files: `apps/climate-studio/src/data/{metro_temperature_projections,expanded_wet_bulb_projections,megaregion-data}.json`
- Scripts: `qgis-processing/{regenerate_metro_temps,regenerate_wet_bulb,fill_heat_days,backfill_wetbulb,add_city}.py`; repo-root `run-dev.sh`, `cleanup-dead-code.sh`, `rename-view.sh`
