# Cleanup + Live Data — branch `cleanup/honest-data`

What changed, what you need to run, and how to verify. Goal: a clean, honest, genuinely-live baseline so future work is about improving real things.

> **Heads-up on how this was done.** The assistant's sandbox could *create and edit* files in this repo but could **not delete files or run git**. So: the code edits below were made directly; the **deletions are packaged as a script for you to run** (`cleanup-dead-code.sh`). A stray empty file `apps/climate-studio/src/__wtest__` and a stale `.git/index.lock` were left behind — the script removes both (or delete them by hand: `rm -f .git/index.lock apps/climate-studio/src/__wtest__`).

---

## 1. Edits already made (review the diff)

**Backend — new live data source** (`backend/server.js`)
Added `GET /api/usgs/streamflow` — real-time river discharge from the USGS NWIS Instantaneous Values service. **No API key, no Earth Engine.** Accepts `?sites=`, `?bbox=W,S,E,N`, or `?state=XX` and returns GeoJSON gauges with the latest discharge (cfs). Test it immediately:

```bash
cd backend && npm start          # port 3001
# Hudson River at Hastings, NY:
curl "http://localhost:3001/api/usgs/streamflow?sites=01376520"
# Everything in a Denver-ish box:
curl "http://localhost:3001/api/usgs/streamflow?bbox=-105.1,39.6,-104.8,39.9"
```

**Frontend — honesty fix** (`apps/climate-studio/src/components/DeckGLMap.tsx`)
The deck.gl hover tooltip used a hard-coded mock ("4°F increase by 2095"). It now reads the real CMIP6 values from `metro_temperature_projections.json` (the same source the labels use), and returns nulls instead of inventing numbers when a metro has no projection on file.

**Frontend — new hook** (`apps/climate-studio/src/hooks/useStreamflow.ts`)
A self-contained `useStreamflow(bounds, enabled)` hook that calls the new endpoint and returns `{ data, loading, error }`. Ready to drop into a layer (see §3).

---

## 2. Run the deletion script (the cleanup)

The sandbox couldn't delete, so run this locally on the branch. It removes **30 verified-dead files** (12 dead `App*.tsx` variants + 18 orphaned legacy map components: the Leaflet/OpenLayers viewers, `MainContent`, `AdvancedMapContainer`, etc.) and **self-aborts if any surviving file still imports something it deletes**.

```bash
git checkout cleanup/honest-data      # already created for you
bash cleanup-dead-code.sh
git status && git diff --cached --stat
```

Kept deliberately: `App.tsx` (the live entry), `GISAnalysisApp.tsx` (the package's public embed entry, used by `index.tsx`), `DeckGLMap.tsx`, `MapView.tsx`, `WaterAccessView.tsx`.

After it passes, the optional block it prints lets you drop the now-unused `leaflet` / `leaflet.heat` / `esri-leaflet` deps — do that only after `npm run build` is green.

---

## 3. Surface streamflow on the map (the one wiring step left)

I didn't blind-wire this because the app has **two parallel layer systems** and I can't run it to verify: the UI registry in `config/layerDefinitions.ts` (which already has a stubbed `river_flow_status` layer marked *"not implemented yet"*) and the climate-core controls that `DeckGLMap` reads via `isLayerActive(...)`. Pick the climate-core path to render it. Minimal recipe inside `DeckGLMap.tsx`:

```ts
import { useStreamflow } from '../hooks/useStreamflow'
import { ScatterplotLayer } from '@deck.gl/layers'   // already imported nearby

// inside DeckGLMap(), after viewState is set:
const flowBounds = mapRef.current?.getMap?.()?.getBounds?.()
const streamflow = useStreamflow(
  flowBounds ? {
    west: flowBounds.getWest(), south: flowBounds.getSouth(),
    east: flowBounds.getEast(), north: flowBounds.getNorth(),
  } : null,
  isLayerActive('river_flow_status')   // register this id in climate-core controls
)

const streamflowLayer = useMemo(() => {
  if (!isLayerActive('river_flow_status') || !streamflow.data?.features?.length) return null
  return new ScatterplotLayer({
    id: 'usgs-streamflow',
    data: streamflow.data.features,
    getPosition: (f: any) => f.geometry.coordinates,
    getRadius: (f: any) => Math.min(6000, 800 + Math.sqrt(Math.max(0, f.properties.dischargeCfs || 0)) * 200),
    radiusMinPixels: 3, radiusMaxPixels: 40,
    getFillColor: (f: any) => f.properties.dischargeCfs == null
      ? [150,150,150,180]
      : [30, 130, 220, 200],
    pickable: true,
  })
}, [isLayerActive('river_flow_status'), streamflow.data])

// add `streamflowLayer` to the `layers` array (near the bottom of the file)
```

Then register a `river_flow_status` control in `@climate-studio/core` so `isLayerActive('river_flow_status')` can turn it on, and flip `hasMapVisualization: true` for it in `layerDefinitions.ts`. Run `npm run dev` and toggle it.

---

## 4. The fake-data paths (status)

Per the audits, these are **dead code** once the hexagon GeoJSON layers are unused — they no longer reach the screen, so removing them is cleanup, not behavior change:

- `qgis-processing/services/fallback_service.py` — synthetic `random.uniform` hexagons.
- `qgis-processing/services/noaa_sea_level.py` — the simulated three-coastal-boxes hexagon path (the **real** NOAA layer is the tile proxy in `server.js`, which stays).
- The hexagon endpoints in `precipitation_drought.py` / `nasa_ee_climate.py` (the app uses the **tile** endpoints).

These are Python; the sandbox left them in place. Remove or archive them when you do a backend pass. The still-static **frontend** layers (wet-bulb casualties, megaregion population) are a *product* decision, not dead code — wire them live or label them "estimate" as discussed in `DATA_INPUTS_MAP.md`.

---

## 5. Full-stack runbook (to confirm live data flows)

```bash
# 1. Python climate service (needs your Earth Engine auth)
cd qgis-processing && PORT=5001 python3 climate_server.py

# 2. Node gateway (USGS streamflow + NOAA tiles work here without EE)
cd backend && npm start                     # :3001

# 3. Frontend
cd apps/climate-studio && npm run dev        # :8080  (needs VITE_MAPBOX_ACCESS_TOKEN)
```

Verify: streamflow endpoint returns gauges (curl above) → toggle the river-flow layer → live USGS dots appear. The EE tile layers (temp, heat, relief, groundwater) need step 1 authenticated; streamflow and NOAA sea-level do not.
