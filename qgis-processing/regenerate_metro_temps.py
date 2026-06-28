#!/usr/bin/env python3
"""
regenerate_metro_temps.py — replace the latitude-bucket ESTIMATES in
metro_temperature_projections.json with REAL NASA NEX-GDDP-CMIP6 values from
Earth Engine. Now computes the FULL field set for real:

  • summer_max / winter_min / annual_avg   (decade-mean daily max / min / midpoint)
  • summer_avg / winter_avg                (JJA / DJF mean of daily-mean temp 'tas')
  • days_over_100 / days_over_110          (avg days/yr above 100°F / 110°F)

Safety for an overnight run:
  • Backs up the original once (.bak) before touching anything.
  • Saves after EVERY city — a crash/Ctrl-C keeps finished cities.
  • Per-city AND per-field error handling: if EE can't return a value, the old
    estimate is kept rather than blanked. Nothing breaks; worst case a field
    stays estimated.

Run (venv active):
    caffeinate -i python regenerate_metro_temps.py > metro_extract.log 2>&1 &
    tail -f metro_extract.log
"""

import os
import sys
import json
import shutil
import argparse
import logging

import ee

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "services"))
from metro_temperature_projections import MetroTemperatureService  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")
log = logging.getLogger("regen")

HERE = os.path.dirname(os.path.abspath(__file__))
METROS_FILE = os.path.join(HERE, "..", "apps", "climate-studio", "src", "data", "megaregion-data.json")
OUT_FILE = os.path.join(HERE, "..", "apps", "climate-studio", "src", "data", "metro_temperature_projections.json")
PROGRESS_FILE = os.path.join(HERE, "metro_regen_progress.json")
EE_PROJECT = os.getenv("EARTHENGINE_PROJECT", "josh-geo-the-second")

MODELS = ["ACCESS-CM2", "CMCC-ESM2", "MIROC6", "MRI-ESM2-0"]
REAL_FIELDS = ("summer_max", "winter_min", "annual_avg", "models_used")
BASELINE_FIELDS = ("avg_summer_max", "avg_winter_min", "avg_annual")

THRESH_100_K = (100 - 32) * 5 / 9 + 273.15
THRESH_110_K = (110 - 32) * 5 / 9 + 273.15


def _k_to_f(k):
    return (k - 273.15) * 9 / 5 + 32


def compute_extra(lat, lon, scenario, decade, radius_km=50):
    """Real heat-day counts + seasonal means for one decade. Models are averaged
    SERVER-SIDE and each metric renamed before combining (this avoids the band
    collision that silently zeroed these fields before) → one getInfo."""
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
    ap.add_argument("--force", action="store_true", help="ignore progress file and redo every metro")
    args = ap.parse_args()

    with open(METROS_FILE) as f:
        metros = json.load(f)["metros"]

    existing = json.load(open(OUT_FILE)) if os.path.exists(OUT_FILE) else {}
    if os.path.exists(OUT_FILE) and not os.path.exists(OUT_FILE + ".bak"):
        shutil.copy(OUT_FILE, OUT_FILE + ".bak")
        log.info(f"📦 backed up original → {os.path.basename(OUT_FILE)}.bak")

    # Resume support: a sidecar list of metros already fully pulled. Re-running
    # skips them, so an interrupted run just needs restarting until it converges.
    done_set = set()
    if os.path.exists(PROGRESS_FILE) and not args.force:
        try:
            done_set = set(json.load(open(PROGRESS_FILE)))
        except Exception:  # noqa: BLE001
            done_set = set()

    service = MetroTemperatureService(ee_project=EE_PROJECT)
    remaining = sum(1 for m in metros if m["name"] not in done_set)
    log.info(f"🌡️  Real CMIP6 regen — {len(done_set)} done, {remaining} to go (project: {EE_PROJECT})")

    done = 0
    for i, metro in enumerate(metros, 1):
        name = metro["name"]
        if name in done_set:
            continue
        log.info(f"[{i}/{len(metros)}] {name} …")
        try:
            real = service.generate_metro_projections(metro)
            if not real:
                log.warning(f"   ⚠️  no data for {name}, keeping existing values")
                continue

            entry = existing.get(name, {"name": name, "lat": metro["lat"], "lon": metro["lon"]})
            entry.setdefault("projections", {})

            base = entry.setdefault("baseline_1995_2014", {})
            for k in BASELINE_FIELDS:
                if k in real.get("baseline_1995_2014", {}):
                    base[k] = real["baseline_1995_2014"][k]

            for scenario, decades in real["projections"].items():
                sc = entry["projections"].setdefault(scenario, {})
                for decade, vals in decades.items():
                    dec = sc.setdefault(decade, {})
                    for k in REAL_FIELDS:
                        if k in vals:
                            dec[k] = vals[k]
                    # real heat-day counts + seasonal averages (kept-as-estimate on failure)
                    try:
                        dec.update(compute_extra(metro["lat"], metro["lon"], scenario, int(decade)))
                    except Exception as e:  # noqa: BLE001
                        log.warning(f"      heat-days {scenario} {decade} kept as estimate: {e}")

            existing[name] = entry
            with open(OUT_FILE, "w") as f:
                json.dump(existing, f, indent=2)
            done_set.add(name)
            with open(PROGRESS_FILE, "w") as f:
                json.dump(sorted(done_set), f)
            done += 1
            log.info(f"   ✅ {name} done & saved ({len(done_set)}/{len(metros)} total)")
        except Exception as e:  # noqa: BLE001
            log.error(f"   ❌ {name} failed: {e} — keeping existing values")
            continue

    log.info(f"🎉 Done. {done}/{len(metros)} metros now use real CMIP6 data (temps + heat days).")
    log.info(f"   Revert if needed:  cp {os.path.basename(OUT_FILE)}.bak {os.path.basename(OUT_FILE)}")


if __name__ == "__main__":
    main()
