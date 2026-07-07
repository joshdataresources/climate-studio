# Task for Fable — fix the flood dimension (swap `_RISKS` → `_ALR_NPCTL`)

Paste everything below into Fable.

---

Continue on Climate Studio's Environmental Resilience Index (see
`docs/resilience-handoff-2026-07-05.md` for full context). One scoped fix.

## Problem
The `flood` dimension is dead weight. It uses FEMA NRI `IFLD_RISKS` / `CFLD_RISKS`,
which are national percentiles of expected-annual-**loss magnitude** — that scales
with a county's population/property, so every big-metro county pins near 100.
Result: every metro's flood sub-score lands between 0 and 17 (median 2), so flood
adds ~no signal and just drags all composites down by the same amount.

## Fix
Use the **annualized-loss-RATE national percentile** instead (rate normalizes out
exposure, so it discriminates). Confirmed fields exist on the NRI county layer:

- Inland/riverine: `IFLD_ALR_NPCTL`
- Coastal: `CFLD_ALR_NPCTL`

Confirmed contrast for Harris County (Houston), so you know it's working:
`IFLD_RISKS` 99.97 → `IFLD_ALR_NPCTL` **85.5**; `CFLD_RISKS` 83.2 → `CFLD_ALR_NPCTL` **48.3**.

## Steps
1. **Re-fetch** `IFLD_ALR_NPCTL,CFLD_ALR_NPCTL` for all 52 metros. You already have
   each metro's `stcofips` in `apps/climate-studio/src/data/fema_nri_metros.json`,
   so use the step-2 query directly: `where=STCOFIPS='{fips}'&outFields=IFLD_ALR_NPCTL,CFLD_ALR_NPCTL`.
   Reuse your tested fetch protocol (web_fetch only; watch the stale-cache — verify
   the echoed URL matches, re-issue with different path casing if stale; pace ~2 fetches/15 s;
   back off on 429).
2. **Store** them in `fema_nri_metros.json` as new keys `inland_flood_alr_pctl` and
   `coastal_flood_alr_pctl` (keep the existing `inland_flood_risk`/`coastal_flood_risk`
   for reference). Update the `_meta.fields` block.
3. **Engine** — in `apps/climate-studio/src/utils/resilienceScore.ts`, change `floodScore`
   to `flood = 100 − max(inland_flood_alr_pctl ?? 0, coastal_flood_alr_pctl ?? 0)`.
   Update the module docstring (the `flood — …` line) to say it uses the ALR-rate
   percentile, not `_RISKS`.
4. Leave **fire, heat, water, capacity untouched.** (Fire spread is already 0–91, fine —
   don't change `WFIR_RISKS` unless you check and find it's also compressed.)

## Success test (must report the numbers)
Recompute the flood sub-score across all 52 metros. Today it's min 0 / median 2 / max 17.
After the fix it must **discriminate** — expect a spread on the order of ~15–85.
Print the new min/median/max and the new top-5 / bottom-5 composite at 2055 (default
weights) as a sanity check (flood should now hurt genuinely flood-prone metros more than
merely-populous ones).

If `_ALR_NPCTL` somehow still clusters (it shouldn't — Houston coastal already drops
83→48), fall back to min–max normalizing the two ALR percentiles across the 52 metros so
flood discriminates within the set. Say so if you do.

## Constraints
- Keep `tsc` at the baseline: `cd apps/climate-studio && npx tsc --noEmit -p tsconfig.app.json`
  → 70 pre-existing errors in untouched files, **0 in the index files**. Don't add any.
- Update `docs/resilience-index-framework.html` flood description, and tick the
  "flood `*_ALR`" item off the FEMA-refinements list in the handoff doc.
- Additive only; don't touch heat/water/capacity logic or the map registry.
