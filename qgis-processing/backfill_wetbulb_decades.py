#!/usr/bin/env python3
"""
backfill_wetbulb_decades.py — extend expanded_wet_bulb_projections.json with
the 2085 and 2095 decades so the wet-bulb charts run as far as the temperature
charts (which already reach 2095).

Computes ALL fields for the new decades in one EE round-trip per decade
(4-model NASA NEX-GDDP-CMIP6 ensemble, ssp585, real data):
  avg_summer_humidity, peak_humidity, days_over_95F, days_over_100F,
  wet_bulb_events, summer_wet_bulb_F, peak_wet_bulb_F

Note: CMIP6 daily data ends at 2100, so the "2095 decade" is 2095–2100
(6 years). Per-year rates divide by the actual year count, not 10 — the
older regen scripts' /10 would undercount here.

Verify one city (~1-2 min):   python backfill_wetbulb_decades.py --limit 1
Full run:   caffeinate -i python backfill_wetbulb_decades.py >> wetbulb_decades.log 2>&1 &
Resume after a stall: just run the same command again.
"""

import os
import json
import argparse
import logging

import ee

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")
log = logging.getLogger("wetbulb-decades")

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_FILE = os.path.join(HERE, "..", "apps", "climate-studio", "src", "data", "expanded_wet_bulb_projections.json")
PROGRESS_FILE = os.path.join(HERE, "wetbulb_decades_progress.json")
EE_PROJECT = os.getenv("EARTHENGINE_PROJECT", "josh-geo-the-second")

MODELS = ["ACCESS-CM2", "CMCC-ESM2", "MIROC6", "MRI-ESM2-0"]
SCENARIO = "ssp585"
NEW_DECADES = [2085, 2095]
DATA_END_YEAR = 2100  # NEX-GDDP-CMIP6 daily data stops here

WB_THRESH_C = 31.0
THRESH_95_K = (95 - 32) * 5 / 9 + 273.15
THRESH_100_K = (100 - 32) * 5 / 9 + 273.15

# Stull (2011) wet-bulb temperature from air temp (°C) and relative humidity (%)
STULL = ("Tc*atan(0.151977*sqrt(RH+8.313659)) + atan(Tc+RH) - atan(RH-1.676331)"
         " + 0.00391838*pow(RH,1.5)*atan(0.023101*RH) - 4.686035")


def _wet_bulb(im):
    return im.expression(STULL, {
        "Tc": im.select("tas").subtract(273.15),
        "RH": im.select("hurs"),
    })


def compute_decade_all(lat, lon, decade, scenario=SCENARIO, radius_km=50):
    """Every wet-bulb dataset field for one decade, one getInfo.
    Day counts are normalized by the decade's ACTUAL year span."""
    end_year = min(decade + 9, DATA_END_YEAR)
    nyears = end_year - decade + 1
    region = ee.Geometry.Point([lon, lat]).buffer(radius_km * 1000)
    base = (ee.ImageCollection("NASA/GDDP-CMIP6")
            .filter(ee.Filter.date(f"{decade}-01-01", f"{end_year}-12-31"))
            .filter(ee.Filter.eq("scenario", scenario)))
    summer_f = ee.Filter.calendarRange(6, 8, "month")

    def m(model):
        return base.filter(ee.Filter.eq("model", model))

    def summer(model):
        return m(model).filter(summer_f)

    ah = ee.ImageCollection([summer(x).select("hurs").mean() for x in MODELS]).mean().rename("ah")
    ph = ee.ImageCollection([
        summer(x).select("hurs").reduce(ee.Reducer.percentile([95])) for x in MODELS
    ]).mean().rename("ph")
    d95 = ee.ImageCollection([
        m(x).select("tasmax").map(lambda im: im.gt(THRESH_95_K)).sum() for x in MODELS
    ]).mean().rename("d95")
    d100 = ee.ImageCollection([
        m(x).select("tasmax").map(lambda im: im.gt(THRESH_100_K)).sum() for x in MODELS
    ]).mean().rename("d100")
    wbe = ee.ImageCollection([
        m(x).map(lambda im: _wet_bulb(im).gt(WB_THRESH_C)).sum() for x in MODELS
    ]).mean().rename("wbe")
    wba = ee.ImageCollection([summer(x).map(_wet_bulb).mean() for x in MODELS]).mean().rename("wba")
    wbp = ee.ImageCollection([
        summer(x).map(_wet_bulb).reduce(ee.Reducer.percentile([95])) for x in MODELS
    ]).mean().rename("wbp")

    stats = (ee.Image.cat([ah, ph, d95, d100, wbe, wba, wbp])
             .reduceRegion(reducer=ee.Reducer.mean(), geometry=region,
                           scale=25000, maxPixels=int(1e9)).getInfo())

    out = {}
    if stats.get("ah") is not None:
        out["avg_summer_humidity"] = round(stats["ah"])
    if stats.get("ph") is not None:
        out["peak_humidity"] = round(stats["ph"])
    if stats.get("d95") is not None:
        out["days_over_95F"] = round(stats["d95"] / nyears)
    if stats.get("d100") is not None:
        out["days_over_100F"] = round(stats["d100"] / nyears)
    if stats.get("wbe") is not None:
        out["wet_bulb_events"] = round(stats["wbe"] / nyears)
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
    log.info(f"📅 Wet-bulb decade extension ({SCENARIO}, {NEW_DECADES}) — {len(done_set)} done, {len(todo)} to go")

    for i, name in enumerate(names, 1):
        if name in done_set:
            continue
        city = data[name]
        lat, lon = city.get("lat"), city.get("lon")
        if lat is None or lon is None:
            log.warning(f"[{i}/{len(names)}] {name}: no lat/lon, skipping")
            continue
        log.info(f"[{i}/{len(names)}] {name} …")
        proj = city.setdefault("projections", {})
        for decade in NEW_DECADES:
            try:
                real = compute_decade_all(lat, lon, decade)
                proj[str(decade)] = {**proj.get(str(decade), {}), **real}
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

    log.info("🎉 Done — wet-bulb dataset now runs through 2095.")


if __name__ == "__main__":
    main()
