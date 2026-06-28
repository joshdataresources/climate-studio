#!/usr/bin/env python3
"""
fill_heat_days.py — fill the REAL heat-day counts + seasonal averages into
metro_temperature_projections.json, WITHOUT re-running the (already-done) temp
extraction.

Adds, per scenario/decade:
  • days_over_100 / days_over_110   (avg days/yr above 100°F / 110°F)
  • summer_avg / winter_avg         (JJA / DJF mean of daily-mean temp 'tas')

Faster than before: averages the 4 climate models SERVER-SIDE, so it's one
Earth Engine call per decade (not four). Errors are LOGGED, not hidden.

Verify on one city first (~2 min):
    python fill_heat_days.py --limit 1
Then the full run:
    caffeinate -i python fill_heat_days.py > heatdays.log 2>&1 &
    tail -f heatdays.log
"""

import os
import json
import argparse
import logging

import ee

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")
log = logging.getLogger("heatdays")

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_FILE = os.path.join(HERE, "..", "apps", "climate-studio", "src", "data", "metro_temperature_projections.json")
EE_PROJECT = os.getenv("EARTHENGINE_PROJECT", "josh-geo-the-second")
MODELS = ["ACCESS-CM2", "CMCC-ESM2", "MIROC6", "MRI-ESM2-0"]

THRESH_100_K = (100 - 32) * 5 / 9 + 273.15
THRESH_110_K = (110 - 32) * 5 / 9 + 273.15


def _k_to_f(k):
    return (k - 273.15) * 9 / 5 + 32


def compute_extra(lat, lon, scenario, decade, radius_km=50):
    """Real heat-day counts + seasonal means for one decade, model-averaged
    server-side → ONE getInfo. Returns only the fields EE could compute."""
    region = ee.Geometry.Point([lon, lat]).buffer(radius_km * 1000)
    start, end = f"{decade}-01-01", f"{decade + 9}-12-31"
    base = (ee.ImageCollection("NASA/GDDP-CMIP6")
            .filter(ee.Filter.date(start, end))
            .filter(ee.Filter.eq("scenario", scenario)))

    summer_f = ee.Filter.calendarRange(6, 8, "month")
    winter_f = ee.Filter.Or(ee.Filter.calendarRange(12, 12, "month"),
                            ee.Filter.calendarRange(1, 2, "month"))

    def days_over(model, thr):
        c = base.filter(ee.Filter.eq("model", model)).select("tasmax")
        return c.map(lambda im: im.gt(thr)).sum()

    def season_mean(model, months):
        c = base.filter(ee.Filter.eq("model", model)).filter(months).select("tas")
        return c.mean()

    d100 = ee.ImageCollection([days_over(m, THRESH_100_K) for m in MODELS]).mean().rename("d100")
    d110 = ee.ImageCollection([days_over(m, THRESH_110_K) for m in MODELS]).mean().rename("d110")
    su = ee.ImageCollection([season_mean(m, summer_f) for m in MODELS]).mean().rename("su")
    wi = ee.ImageCollection([season_mean(m, winter_f) for m in MODELS]).mean().rename("wi")

    stats = (ee.Image.cat([d100, d110, su, wi])
             .reduceRegion(reducer=ee.Reducer.mean(), geometry=region,
                           scale=25000, maxPixels=int(1e9)).getInfo())

    out = {}
    if stats.get("d100") is not None:
        out["days_over_100"] = round(stats["d100"] / 10)
    if stats.get("d110") is not None:
        out["days_over_110"] = round(stats["d110"] / 10)
    if stats.get("su") is not None:
        out["summer_avg"] = round(_k_to_f(stats["su"]), 1)
    if stats.get("wi") is not None:
        out["winter_avg"] = round(_k_to_f(stats["wi"]), 1)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=None, help="only process first N metros (test)")
    args = ap.parse_args()

    ee.Initialize(project=EE_PROJECT)
    log.info(f"Earth Engine ready (project: {EE_PROJECT})")

    data = json.load(open(OUT_FILE))
    names = list(data.keys())
    if args.limit:
        names = names[: args.limit]
        log.info(f"TEST MODE: first {len(names)} metro(s)")

    for i, name in enumerate(names, 1):
        m = data[name]
        lat, lon = m.get("lat"), m.get("lon")
        if lat is None or lon is None:
            log.warning(f"[{i}/{len(names)}] {name}: no lat/lon, skipping")
            continue
        log.info(f"[{i}/{len(names)}] {name} …")
        for scenario, decades in m.get("projections", {}).items():
            for decade in decades:
                try:
                    extra = compute_extra(lat, lon, scenario, int(decade))
                    decades[decade].update(extra)
                    if args.limit:  # show the real numbers in test mode
                        log.info(f"    {scenario} {decade}: {extra}")
                except Exception as e:  # noqa: BLE001
                    log.error(f"    {scenario} {decade} FAILED: {type(e).__name__}: {e}")
        # save after each metro
        with open(OUT_FILE, "w") as f:
            json.dump(data, f, indent=2)
        log.info(f"   ✅ {name} saved")

    log.info("🎉 Done filling heat-day + seasonal fields.")


if __name__ == "__main__":
    main()
