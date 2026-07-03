#!/usr/bin/env python3
"""
backfill_wetbulb_temps.py — add REAL wet-bulb TEMPERATURES to
expanded_wet_bulb_projections.json (the dataset already has humidity and
event counts; this adds the intuitive number the dashboard can plot).

Per city, per decade (ssp585, 4-model NASA NEX-GDDP-CMIP6 ensemble):
  • summer_wet_bulb_F   JJA mean of daily Stull wet-bulb temperature (°F)
  • peak_wet_bulb_F     JJA 95th-percentile daily wet-bulb temperature (°F)

Context for reading the numbers: ~88°F (31°C) wet-bulb is the dangerous
heat-stress threshold the wet_bulb_events field counts against; ~95°F
(35°C) is the theoretical human survivability limit.

Same robustness as the other regen scripts: server-side model averaging
(one getInfo per decade), incremental save, resume file.

Verify one city (~1-2 min):   python backfill_wetbulb_temps.py --limit 1
Full run:   caffeinate -i python backfill_wetbulb_temps.py >> wetbulb_temps.log 2>&1 &
Resume after a stall: just run the same command again.
"""

import os
import json
import argparse
import logging

import ee

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")
log = logging.getLogger("wetbulb-temps")

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_FILE = os.path.join(HERE, "..", "apps", "climate-studio", "src", "data", "expanded_wet_bulb_projections.json")
PROGRESS_FILE = os.path.join(HERE, "wetbulb_temps_progress.json")
EE_PROJECT = os.getenv("EARTHENGINE_PROJECT", "josh-geo-the-second")

MODELS = ["ACCESS-CM2", "CMCC-ESM2", "MIROC6", "MRI-ESM2-0"]
SCENARIO = "ssp585"  # matches the rest of this dataset

# Stull (2011) wet-bulb temperature from air temp (°C) and relative humidity (%)
STULL = ("Tc*atan(0.151977*sqrt(RH+8.313659)) + atan(Tc+RH) - atan(RH-1.676331)"
         " + 0.00391838*pow(RH,1.5)*atan(0.023101*RH) - 4.686035")


def _wet_bulb(im):
    """Daily wet-bulb temperature image (°C) from a GDDP daily image."""
    return im.expression(STULL, {
        "Tc": im.select("tas").subtract(273.15),
        "RH": im.select("hurs"),
    })


def compute_decade(lat, lon, decade, scenario=SCENARIO, radius_km=50):
    """JJA mean + p95 wet-bulb temperature (°F) for one decade.
    Models averaged server-side → one getInfo. Returns only fields EE returned."""
    region = ee.Geometry.Point([lon, lat]).buffer(radius_km * 1000)
    start, end = f"{decade}-01-01", f"{decade + 9}-12-31"
    base = (ee.ImageCollection("NASA/GDDP-CMIP6")
            .filter(ee.Filter.date(start, end))
            .filter(ee.Filter.eq("scenario", scenario))
            .filter(ee.Filter.calendarRange(6, 8, "month")))

    def wb_daily(m):
        return base.filter(ee.Filter.eq("model", m)).map(_wet_bulb)

    avg = ee.ImageCollection([wb_daily(m).mean() for m in MODELS]).mean().rename("wba")
    peak = ee.ImageCollection([
        wb_daily(m).reduce(ee.Reducer.percentile([95])) for m in MODELS
    ]).mean().rename("wbp")

    stats = (ee.Image.cat([avg, peak])
             .reduceRegion(reducer=ee.Reducer.mean(), geometry=region,
                           scale=25000, maxPixels=int(1e9)).getInfo())

    out = {}
    if stats.get("wba") is not None:
        out["summer_wet_bulb_F"] = round(stats["wba"] * 9 / 5 + 32, 1)
    if stats.get("wbp") is not None:
        out["peak_wet_bulb_F"] = round(stats["wbp"] * 9 / 5 + 32, 1)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=None, help="only process first N cities (test)")
    ap.add_argument("--force", action="store_true", help="ignore progress file and redo every city")
    args = ap.parse_args()

    ee.Initialize(project=EE_PROJECT)
    log.info(f"Earth Engine ready (project: {EE_PROJECT})")

    data = json.load(open(OUT_FILE))

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
    log.info(f"🌡️ Wet-bulb temperature backfill ({SCENARIO}) — {len(done_set)} done, {len(todo)} to go")

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

    log.info("🎉 Done — wet-bulb temperatures now on file.")


if __name__ == "__main__":
    main()
