#!/usr/bin/env python3
"""
regenerate_wet_bulb.py — replace the hand-made values in
expanded_wet_bulb_projections.json with REAL NASA NEX-GDDP-CMIP6 data.

Per city, per decade (single high-emissions scenario, ssp585), computes for real:
  • avg_summer_humidity   JJA mean of daily relative humidity (hurs, %)
  • peak_humidity         JJA 95th-percentile daily humidity (%)
  • days_over_95F         avg days/yr with tasmax > 95°F
  • days_over_100F        avg days/yr with tasmax > 100°F
  • wet_bulb_events       avg days/yr with wet-bulb temp > 31°C
                          (Stull 2011 formula from daily tas + hurs)

Leaves the fabricated fields (estimated_at_risk_population, casualty_rate_percent,
extent_radius_km) untouched — those are display-only and already removed from
the UI's death-stat readouts.

Same robustness as the temp run: server-side model averaging (one getInfo per
decade), per-field graceful fallback (kept-as-old on failure), incremental save,
and a resume file so it converges across interruptions.

Verify one city (~1-2 min):   python regenerate_wet_bulb.py --limit 1
Full run:   caffeinate -i python regenerate_wet_bulb.py >> wetbulb.log 2>&1 &
Resume after a stall: just run the same command again.
"""

import os
import json
import argparse
import logging

import ee

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")
log = logging.getLogger("wetbulb")

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_FILE = os.path.join(HERE, "..", "apps", "climate-studio", "src", "data", "expanded_wet_bulb_projections.json")
PROGRESS_FILE = os.path.join(HERE, "wet_bulb_progress.json")
EE_PROJECT = os.getenv("EARTHENGINE_PROJECT", "josh-geo-the-second")

MODELS = ["ACCESS-CM2", "CMCC-ESM2", "MIROC6", "MRI-ESM2-0"]
SCENARIO = "ssp585"  # high-emissions, matches the "danger zone" framing
WB_THRESH_C = 31.0   # dangerous heat-stress wet-bulb threshold (°C)
THRESH_95_K = (95 - 32) * 5 / 9 + 273.15
THRESH_100_K = (100 - 32) * 5 / 9 + 273.15

# Stull (2011) wet-bulb temperature from air temp (°C) and relative humidity (%)
STULL = ("Tc*atan(0.151977*sqrt(RH+8.313659)) + atan(Tc+RH) - atan(RH-1.676331)"
         " + 0.00391838*pow(RH,1.5)*atan(0.023101*RH) - 4.686035")

REAL_FIELDS = ("avg_summer_humidity", "peak_humidity", "days_over_95F",
               "days_over_100F", "wet_bulb_events")


def _wet_bulb(im):
    """Daily wet-bulb temperature image (°C) from a GDDP daily image."""
    return im.expression(STULL, {
        "Tc": im.select("tas").subtract(273.15),
        "RH": im.select("hurs"),
    })


def compute_decade(lat, lon, decade, scenario=SCENARIO, radius_km=50):
    """Real humidity + heat-day + wet-bulb-event metrics for one decade.
    Models averaged server-side → one getInfo. Returns only fields EE returned."""
    region = ee.Geometry.Point([lon, lat]).buffer(radius_km * 1000)
    start, end = f"{decade}-01-01", f"{decade + 9}-12-31"
    base = (ee.ImageCollection("NASA/GDDP-CMIP6")
            .filter(ee.Filter.date(start, end))
            .filter(ee.Filter.eq("scenario", scenario)))
    summer_f = ee.Filter.calendarRange(6, 8, "month")

    def avg_h(m):
        return base.filter(ee.Filter.eq("model", m)).filter(summer_f).select("hurs").mean()

    def peak_h(m):
        s = base.filter(ee.Filter.eq("model", m)).filter(summer_f).select("hurs")
        return s.reduce(ee.Reducer.percentile([95])).rename("hurs")

    def d_over(m, thr):
        c = base.filter(ee.Filter.eq("model", m)).select("tasmax")
        return c.map(lambda im: im.gt(thr)).sum()

    def wbe(m):
        c = base.filter(ee.Filter.eq("model", m))
        return c.map(lambda im: _wet_bulb(im).gt(WB_THRESH_C)).sum()

    ah = ee.ImageCollection([avg_h(m) for m in MODELS]).mean().rename("ah")
    ph = ee.ImageCollection([peak_h(m) for m in MODELS]).mean().rename("ph")
    d95 = ee.ImageCollection([d_over(m, THRESH_95_K) for m in MODELS]).mean().rename("d95")
    d100 = ee.ImageCollection([d_over(m, THRESH_100_K) for m in MODELS]).mean().rename("d100")
    wb = ee.ImageCollection([wbe(m) for m in MODELS]).mean().rename("wb")

    stats = (ee.Image.cat([ah, ph, d95, d100, wb])
             .reduceRegion(reducer=ee.Reducer.mean(), geometry=region,
                           scale=25000, maxPixels=int(1e9)).getInfo())

    out = {}
    if stats.get("ah") is not None:
        out["avg_summer_humidity"] = round(stats["ah"])
    if stats.get("ph") is not None:
        out["peak_humidity"] = round(stats["ph"])
    if stats.get("d95") is not None:
        out["days_over_95F"] = round(stats["d95"] / 10)
    if stats.get("d100") is not None:
        out["days_over_100F"] = round(stats["d100"] / 10)
    if stats.get("wb") is not None:
        out["wet_bulb_events"] = round(stats["wb"] / 10)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=None, help="only process first N cities (test)")
    ap.add_argument("--force", action="store_true", help="ignore progress file and redo every city")
    args = ap.parse_args()

    ee.Initialize(project=EE_PROJECT)
    log.info(f"Earth Engine ready (project: {EE_PROJECT})")

    data = json.load(open(OUT_FILE))
    if not os.path.exists(OUT_FILE + ".bak"):
        json.dump(data, open(OUT_FILE + ".bak", "w"), indent=2)
        log.info("📦 backed up original → expanded_wet_bulb_projections.json.bak")

    done_set = set()
    if os.path.exists(PROGRESS_FILE) and not args.force:
        try:
            done_set = set(json.load(open(PROGRESS_FILE)))
        except Exception:  # noqa: BLE001
            done_set = set()

    names = list(data.keys())
    if args.limit:
        names = names[: args.limit]
        log.info(f"TEST MODE: first {len(names)} city(ies)")

    todo = [n for n in names if n not in done_set]
    log.info(f"💧 Wet-bulb regen ({SCENARIO}) — {len(done_set)} done, {len(todo)} to go")

    for i, name in enumerate(names, 1):
        if name in done_set:
            continue
        city = data[name]
        lat, lon = city.get("lat"), city.get("lon")
        if lat is None or lon is None:
            log.warning(f"[{i}/{len(names)}] {name}: no lat/lon, skipping")
            continue
        log.info(f"[{i}/{len(names)}] {name} …")
        for decade in city.get("projections", {}):
            try:
                real = compute_decade(lat, lon, int(decade))
                city["projections"][decade].update(real)
                if args.limit:
                    log.info(f"    {decade}: {real}")
            except Exception as e:  # noqa: BLE001
                log.error(f"    {decade} FAILED: {type(e).__name__}: {e}")
        with open(OUT_FILE, "w") as f:
            json.dump(data, f, indent=2)
        if not args.limit:
            done_set.add(name)
            with open(PROGRESS_FILE, "w") as f:
                json.dump(sorted(done_set), f)
        log.info(f"   ✅ {name} saved ({len(done_set)}/{len(data)} total)")

    log.info("🎉 Done — wet-bulb/humidity now real.")


if __name__ == "__main__":
    main()
