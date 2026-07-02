#!/usr/bin/env python3
"""
backfill_wetbulb.py — give every metro that has temperature data a matching set
of real wet-bulb / humidity data.

The temperature file covers more metros than the wet-bulb file, so some cities
have temps but no humidity. This walks the temperature file, finds the ones
missing from the wet-bulb file, and pulls real wet-bulb/humidity for each using
the same Earth Engine logic as the rest (Stull wet-bulb from CMIP6 tas + hurs).

Expect a wide spread: dry/cold metros come back with ~0 wet-bulb events, humid-hot
metros with the extremes — that's the real signal.

Resumable like the others: re-run it and it skips finished cities.

  python backfill_wetbulb.py --limit 1      # test one
  caffeinate -i python backfill_wetbulb.py >> wetbulb_backfill.log 2>&1 &
"""

import os
import json
import argparse
import logging

import ee
import regenerate_wet_bulb as rwb   # reuse compute_decade

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")
log = logging.getLogger("backfill")

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "..", "apps", "climate-studio", "src", "data")
TEMPS = os.path.join(DATA, "metro_temperature_projections.json")
WETBULB = os.path.join(DATA, "expanded_wet_bulb_projections.json")
PROGRESS = os.path.join(HERE, "wetbulb_backfill_progress.json")
EE_PROJECT = os.getenv("EARTHENGINE_PROJECT", "josh-geo-the-second")
WB_DECADES = [2025, 2035, 2045, 2055, 2065, 2075]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=None, help="only process first N missing metros")
    ap.add_argument("--force", action="store_true", help="redo every metro, even those already present")
    args = ap.parse_args()

    ee.Initialize(project=EE_PROJECT)
    log.info(f"Earth Engine ready ({EE_PROJECT})")

    temps = json.load(open(TEMPS))
    wet = json.load(open(WETBULB)) if os.path.exists(WETBULB) else {}
    if not os.path.exists(WETBULB + ".bak"):
        json.dump(wet, open(WETBULB + ".bak", "w"), indent=2)

    done = set()
    if os.path.exists(PROGRESS) and not args.force:
        try:
            done = set(json.load(open(PROGRESS)))
        except Exception:  # noqa: BLE001
            done = set()

    # metros that have temps but no wet-bulb yet
    missing = [name for name in temps if (args.force or name not in wet) and name not in done]
    if args.limit:
        missing = missing[: args.limit]

    log.info(f"💧 Backfill — {len(missing)} metro(s) need wet-bulb data")
    for i, name in enumerate(missing, 1):
        entry = temps[name]
        lat, lon = entry.get("lat"), entry.get("lon")
        if lat is None or lon is None:
            log.warning(f"[{i}/{len(missing)}] {name}: no lat/lon in temp file, skipping")
            continue
        log.info(f"[{i}/{len(missing)}] {name} ({lat:.2f},{lon:.2f}) …")
        proj = {}
        for d in WB_DECADES:
            try:
                vals = rwb.compute_decade(lat, lon, d)
                vals["extent_radius_km"] = 30 + int(vals.get("wet_bulb_events", 0))
                proj[str(d)] = vals
            except Exception as e:  # noqa: BLE001
                log.error(f"    {d} FAILED: {e}")
        try:
            base = rwb.compute_decade(lat, lon, 1995, scenario="historical")
        except Exception:  # noqa: BLE001
            base = {}
        wet[name] = {
            "name": name,
            "lat": lat,
            "lon": lon,
            "baseline_1995_2014": {
                "avg_summer_humidity": base.get("avg_summer_humidity"),
                "wet_bulb_events": base.get("wet_bulb_events"),
                "days_over_95F": base.get("days_over_95F"),
            },
            "projections": proj,
        }
        with open(WETBULB, "w") as f:
            json.dump(wet, f, indent=2)
        done.add(name)
        with open(PROGRESS, "w") as f:
            json.dump(sorted(done), f)
        peak = proj.get("2075", {}).get("wet_bulb_events", "?")
        log.info(f"   ✅ {name} saved (2075 wet-bulb events: {peak})")

    log.info("🎉 Backfill complete — temps and wet-bulb now cover the same metros.")


if __name__ == "__main__":
    main()
