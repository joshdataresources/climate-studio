# Task for Fable — wildfire: ALR fix + real map layer

Two related wildfire tasks. Part A is a small data fetch; Part B is a new client-side
map layer. Background: `docs/resilience-handoff-2026-07-05.md`.

Constraints for both: additive only; keep `tsc` at baseline
(`cd apps/climate-studio && npx tsc --noEmit -p tsconfig.app.json` → 67 pre-existing
errors, 0 in index files). Fetch only via the provided web_fetch/WebSearch tools.

---

## Part A — Fire dimension: switch to the ALR-rate percentile (consistency with flood)

**Why.** Fire currently uses `WFIR_RISKS` (loss-*magnitude* percentile), which has the
same population/exposure bias we already removed from flood — big-population counties pin
high. Example: Sacramento County `wildfire_risk` = 96 → fire sub-score = 4, which
over-penalizes it. The fix mirrors the flood fix: use the annualized-loss-**rate**
percentile, which normalizes out exposure.

**Engine is already done.** `resilienceScore.ts` `fireScore()` now prefers
`rec.wildfire_alr_pctl` and falls back to `rec.wildfire_risk`. You only need to add the
data field; the engine picks it up automatically.

**Steps**
1. Field: **`WFIR_ALR_NPCTL`** (annualized-loss-rate national percentile). It follows the
   same pattern as the flood fields (`IFLD_ALR_NPCTL`, `CFLD_ALR_NPCTL`) that are already
   in `fema_nri_metros.json`. If unsure it exists, read the layer field list at
   `.../National_Risk_Index_Counties/FeatureServer/0?f=json`.
2. Re-fetch it for all 52 metros. Each metro's `stcofips` is already in
   `apps/climate-studio/src/data/fema_nri_metros.json`, so query directly:
   `where=STCOFIPS='{fips}'&outFields=WFIR_ALR_NPCTL`.
   Reuse the tested NRI fetch protocol (endpoint
   `https://services.arcgis.com/XG15cJAlne2vxtgt/arcgis/rest/services/National_Risk_Index_Counties/FeatureServer/0/query`;
   watch the stale-cache — verify the echoed URL, retry with path-casing variants; pace
   ~2 fetches/15 s; back off on 429).
3. Store it in each metro record as **`wildfire_alr_pctl`** (keep `wildfire_risk` for
   reference). Update the `_meta.fields` block.
4. **Success test (report the numbers).** Recompute the fire sub-score across 52 metros.
   It should de-compress from today's distribution (many metros near 0–5) to a real
   spread. Print new fire min/median/max and the top-5/bottom-5 composite at 2055.
   Sacramento should rise off 4.

---

## Part B — Wildfire map layer (client-side raster, no backend)

**Source (public USFS ArcGIS ImageServer, national 30 m):**
- Wildfire Hazard Potential (use this — matches the "wildfire risk" framing):
  `https://apps.fs.usda.gov/fsgisx01/rest/services/RDW_Wildfire/RMRS_WRC_WildfireHazardPotential/ImageServer`
- Alternatives if preferred: `.../RMRS_WRC_RiskToPotentialStructures/ImageServer` (risk to
  homes), `.../RMRS_WRC_BurnProbability/ImageServer`.

**Approach — a Mapbox raster layer, added directly to the map instance. No backend, no
`/api`, no Earth Engine, and do NOT route it through the fetch-oriented `climateLayers`
registry** (that's for server-fetched EE layers). This is a plain client-side raster.

**Steps**
1. First `GET .../ImageServer?f=json` and confirm: `capabilities` includes `Image`,
   the `spatialReference` (likely Albers 5070/102039 — fine, we reproject on the fly),
   `fullExtent` (CONUS only), and that it has a default colormap/rendering. Sanity-check
   by opening one `exportImage` URL for a US bbox in a browser.
2. Add a raster source + layer to the existing Mapbox map (where `mapRef`/`map` is set up
   in `ClimateStudioView`). Use ArcGIS `exportImage` with Mapbox's bbox template:
   ```js
   map.addSource('wildfire-whp', {
     type: 'raster',
     tiles: ['https://apps.fs.usda.gov/fsgisx01/rest/services/RDW_Wildfire/RMRS_WRC_WildfireHazardPotential/ImageServer/exportImage' +
             '?bbox={bbox-epsg-3857}&bboxSR=3857&imageSR=3857&size=256,256&format=png32&transparent=true&f=image'],
     tileSize: 256,
     attribution: 'USFS Wildfire Risk to Communities (RMRS / Pyrologix, LANDFIRE 2020)'
   })
   map.addLayer({ id: 'wildfire-whp', type: 'raster', source: 'wildfire-whp',
                  paint: { 'raster-opacity': 0.6 } })
   ```
   Mapbox substitutes `{bbox-epsg-3857}` per tile. If the default rendering comes back
   blank/greyscale, add a `renderingRule` param (the service usually ships a colormap —
   verify with the sanity-check in step 1).
3. Wire a toggle: a new `showWildfireLayer` state + a layer-panel/`LayerPalette` entry.
   On → `addSource`/`addLayer` (guard for `map.isStyleLoaded()`); off →
   `removeLayer`/`removeSource`. Mirror any existing direct-Mapbox layer if one exists;
   otherwise add the on/off effect in `ClimateStudioView`.
4. Add a small legend (WHP: Very Low → Very High) and the USFS attribution.

**Caveats to surface in the UI/attribution:** CONUS-only (no AK/HI/PR), **present-day**
(not projected to a decade like heat/water), 30 m resolution. This is the spatial
complement to the FEMA county wildfire number in the resilience index — different data,
different granularity.

**Success test:** toggling the layer draws the WHP raster over the US, pans/zooms
smoothly, shows the legend + attribution, and doesn't touch the backend.

---

## Sources
- USFS Wildfire Hazard Potential ImageServer: https://apps.fs.usda.gov/fsgisx01/rest/services/RDW_Wildfire/RMRS_WRC_WildfireHazardPotential/ImageServer
- USFS Risk to Potential Structures ImageServer: https://apps.fs.usda.gov/fsgisx01/rest/services/RDW_Wildfire/RMRS_WRC_ConditionalRiskToPotentialStructures/ImageServer
- Wildfire Risk to Communities (data + methodology): https://wildfirerisk.org/download/
