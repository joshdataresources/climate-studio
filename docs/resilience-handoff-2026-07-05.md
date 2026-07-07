# Handoff prompt — Environmental Resilience Index (Climate Studio)

Paste everything below into a new session to continue the work.

---

You are continuing work on Climate Studio, a React + TypeScript + Deck.GL climate map app at `/Users/joshuabutler/Documents/GitHub/climate-studio` (main app in `apps/climate-studio`).

## The goal

An Environmental Resilience Index: ranks US metros by how well they hold up to a changing climate. Resilience = hazard exposure balanced by adaptive capacity, scored 0–100 (higher = more resilient), tracked by decade to 2100. The map stays the centerpiece; the index adds a leaderboard + dashboard viz (done) and eventually a map layer (not done — see next steps). Keep everything additive; never break the build.

## What exists (all live, typechecking clean)

- **Scoring engine** — `apps/climate-studio/src/utils/resilienceScore.ts`. Pure, side-effect-free. Five dimensions per metro per decade:
  - `heat` (forward-looking, per decade): from `expanded_wet_bulb_projections.json`, min–max normalized.
  - `water` (forward-looking): dependency-weighted river-flow retention with aquifer/canal penalties and fallback.
  - `fire` = 100 − NRI `WFIR_RISKS`; `flood` = 100 − max(`IFLD_RISKS`, `CFLD_RISKS`); `capacity` = ½·`RESL_SCORE` + ½·(100 − `SOVI_SCORE`) — all from `src/data/fema_nri_metros.json`, held FLAT across decades (NRI is present-day).
  - `composite` = (1 − capacityShare)·(weight-normalized hazard mean) + capacityShare·capacity. Weights are tunable via `ResilienceWeights` (heat/water/fire/flood relative + `capacityShare`; defaults equal hazards, 0.4 capacity). Weight normalization only covers dimensions a metro actually has — missing dims never zero a score.
  - Exports: `rankMetros(year, weights?)`, `metroResilience(key, year, weights?)`, `metroTrajectory(key, weights?)`, `fireScore/floodScore/capacityScore`, `resilienceColorRGBA(score)`, `DEFAULT_WEIGHTS`, `RESILIENCE_DECADES`.
- **FEMA data** — `apps/climate-studio/src/data/fema_nri_metros.json`: all 52 metros, keyed by wet-bulb metro name, principal county resolved by spatial point query (no name mismatches). `_meta` block documents fields. Regenerable via `scripts/merge-nri-parts.py` (raw part files were session-scratch; refetch if ever needed).
- **Dashboard card** — `components/dashboard/ResilienceLeaderboard.tsx`, top of `pages/Dashboard.tsx`. Leaderboard with per-row sub-scores (H/W/F/Fl/C), five live weight sliders (4 hazards + exposure:capacity blend, with reset), trajectory chart to 2095, wired to the projection-year slider.
- **One-pager** — `docs/resilience-index-framework.html`: five dimensions, formulas, provenance, caveats, roadmap.
- Typecheck: `cd apps/climate-studio && npx tsc --noEmit -p tsconfig.app.json` → **70 pre-existing errors in untouched files (baseline); 0 in the index files**. Don't add to the count.

## Data provenance & caveats (do not gloss over)

- Heat: NASA NEX-GDDP-CMIP6 via Earth Engine scripts in `qgis-processing/`. 52 metros, ssp585. Real.
- Water: ACCESS-WEIGHTED portfolio model. `metro-water-access.json` = utility-documented supply mixes for all 52 metros (researched + cited, ~2024–25; shares to 0.05). Score = Σ share × source-health: rivers/reservoirs inherit literature-parameterized flow declines (river-flow-projections.json), Colorado-basin imports (CAP/SNWA/QSA/San Juan-Chama) inherit the Colorado minus conveyance risk, Great Lakes = 90, groundwater inherits `metro-aquifers.json` stress (spatial join vs the app's USGS aquifer polygons; regenerate via `scripts/build-metro-aquifers.py`), desal 92 / reuse 90. Legacy river-mapping + aquifer/canal adjustments only serve as fallback. USGS county water-use API is decommissioned (files too large to fetch) — that's why portfolios are utility-sourced.
- FEMA NRI 2.0 (fetched July 2026): riverine flood is **`IFLD_RISKS`** ("Inland Flooding") — there is NO `RFLD` field in 2.0. `*_RISKS` = national percentiles of expected-annual-loss magnitude, which scale with exposed population — they pinned every big-metro county near 100 on inland flood. **Flood therefore uses the EAL-rate percentiles `IFLD_ALR_NPCTL` / `CFLD_ALR_NPCTL`** (stored as `inland_flood_alr_pctl` / `coastal_flood_alr_pctl`; the `_RISKS` values are kept for reference only). Fire still uses `WFIR_RISKS` (spread 0–91, adequate). Known quirk: NYC capacity = 36 because Manhattan's SOVI = 96 (county granularity; Nassau/Merrick = 86) — data, not a bug.
- Known app issue (not blocking): the wet-bulb MAP layer reverse-engineers a fake temp (`estimatedSummerTempF = 90 + days_over_95F/20`); the scatter chart and the index use the real stored fields.

## Fetch gotchas (if you touch the NRI endpoint again)

Endpoint: `https://services.arcgis.com/XG15cJAlne2vxtgt/arcgis/rest/services/National_Risk_Index_Counties/FeatureServer/0/query`

- Fetch ONLY with the provided web_fetch/WebSearch tools — never curl/wget/python.
- web_fetch rejects URLs over ~245 chars (pre-encoding) AND large responses (`outFields=*` is ~89 KB — too big; the layer-def `?f=json` also overflows).
- Working protocol (tested): (1) point query `geometry={lon},{lat}&geometryType=esriGeometryPoint&inSR=4326&returnGeometry=false&outFields=STCOFIPS` → FIPS; (2) `where=STCOFIPS='{fips}'` with `outFields=WFIR_RISKS,IFLD_RISKS,CFLD_RISKS,HWAV_RISKS,DRGT_RISKS`; (3) same with `outFields=RESL_SCORE,SOVI_SCORE,RISK_SCORE,COUNTY,STATE`. Batched IN(...) lists don't fit the URL cap.
- The fetch layer has a stale-cache bug: it can return a cached response for a DIFFERENT query on the same path. ALWAYS check the echoed URL in the result matches what you asked; if stale, re-issue with different path casing (`/0/Query`, `/0/quERy` — ArcGIS paths are case-insensitive, each casing is a fresh cache key). Rate limits (429) appear after bursts; pace ~2 fetches/15 s.

## NEXT TASK — in order

1. **Resilience map layer (headline; discuss approach before coding).** The layer registry (`packages/climate-core/src/config/climateLayers.ts`, type `ClimateLayerId`) assumes server-fetched layers (each needs a fetch route); a client-computed layer will spam failed fetches unless a small "client-computed" path is added. Engine already exposes `resilienceColorRGBA()` + `rankMetros()`, so the Deck.GL layer itself is short once the approach is chosen. Present options first (e.g., new `clientComputed: true` flag in the registry vs. a parallel lightweight registry vs. a synthetic in-memory fetch route), get agreement, then implement.
2. **Add new cities (e.g., Burlington VT).** Earth Engine credentials ARE available (project `josh-geo-the-second`, see `EARTH_ENGINE_SETUP.md`): run the EE wet-bulb pipeline (`qgis-processing/regenerate_wet_bulb.py` etc.) for the new coordinates, map water, fetch NRI county via the protocol above, extend the JSONs.
3. **FEMA refinements (optional, documented in one-pager):** ~~`*_ALR` rate percentiles to de-compress big-county flood~~ (DONE 2026-07-05 — flood uses `IFLD_ALR_NPCTL`/`CFLD_ALR_NPCTL`; fire kept on `WFIR_RISKS`, spread already adequate); metro-level aggregation instead of single principal county; forward-looking fire/flood trends instead of flat-to-2100.
4. **Water coverage gap** (~33 placeholder metros) — needs external supply data, biggest data debt in the index.

## Constraints

- Additive only; prefer new files + minimal edits; keep `tsc` at the 70-error baseline (0 in index files).
- Verify claims against the repo before acting; sanity-check any recomputed ranking (fire hurts the West, flood hurts Gulf/FL, capacity lifts low-SOVI metros).
