#!/usr/bin/env python3
"""
add_city.py — add a metro and pull ALL its real climate data in one command.

It reuses the same Earth Engine extraction logic as the full regen scripts, but
for a single city, and writes into all three data files the app reads:

  • megaregion-data.json                 → registers the metro (name, lat, lon)
  • metro_temperature_projections.json   → real CMIP6 temps + heat-days (8 decades x 2 scenarios)
  • expanded_wet_bulb_projections.json   → real humidity, wet-bulb events, heat-day counts (6 decades)

Usage (venv active, from qgis-processing/):
  python add_city.py "Hartford, CT"                 # geocodes the name
  python add_city.py "Hartford" --lat 41.76 --lon -72.67
  python add_city.py "Boise, ID" --force            # overwrite if it already exists

Then refresh the app — the new metro shows up with real data everywhere.
"""

import os
import json
import argparse
import logging

import ee
import requests

# reuse the extraction logic from the regen scripts (same directory)
import regenerate_metro_temps as rmt
import regenerate_wet_bulb as rwb

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")
log = logging.getLogger("add_city")

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "..", "apps", "climate-studio", "src", "data")
MEGA = os.path.join(DATA, "megaregion-data.json")
TEMPS = os.path.join(DATA, "metro_temperature_projections.json")
WETBULB = os.path.join(DATA, "expanded_wet_bulb_projections.json")
EE_PROJECT = os.getenv("EARTHENGINE_PROJECT", "josh-geo-the-second")
WB_DECADES = [2025, 2035, 2045, 2055, 2065, 2075]   # matches the wet-bulb file


def geocode(name):
    """Look up lat/lon from a place name via OpenStreetMap Nominatim (free, no key)."""
    r = requests.get(
        "https://nominatim.openstreetmap.org/search",
        params={"q": name, "format": "json", "limit": 1},
        headers={"User-Agent": "climate-studio-add-city/1.0"},
        timeout=20,
    )
    res = r.json()
    if not res:
        raise SystemExit(f"✖ Could not geocode '{name}'. Re-run with --lat and --lon.")
    return float(res[0]["lat"]), float(res[0]["lon"])


def load(p):
    return json.load(open(p)) if os.path.exists(p) else {}


def save(p, d):
    with open(p, "w") as f:
        json.dump(d, f, indent=2)


def main():
    ap = argparse.ArgumentParser(description="Add a metro and pull all its real climate data.")
    ap.add_argument("name", help='City name, e.g. "Hartford, CT"')
    ap.add_argument("--lat", type=float, help="latitude (skips geocoding)")
    ap.add_argument("--lon", type=float, help="longitude (skips geocoding)")
    ap.add_argument("--key", help="key to store under (default: text before the first comma)")
    ap.add_argument("--force", action="store_true", help="overwrite if the city already exists")
    args = ap.parse_args()

    lat, lon = args.lat, args.lon
    if lat is None or lon is None:
        log.info(f"Geocoding '{args.name}'…")
        lat, lon = geocode(args.name)
    key = args.key or args.name.split(",")[0].strip()
    log.info(f"➕ Adding '{key}' at ({lat:.4f}, {lon:.4f})  [project: {EE_PROJECT}]")

    ee.Initialize(project=EE_PROJECT)

    mega = load(MEGA)
    temps = load(TEMPS)
    wet = load(WETBULB)

    if key in temps and not args.force:
        raise SystemExit(f"✖ '{key}' is already present. Use --force to overwrite.")

    # 1) register in the metro list (name/lat/lon — no fake population)
    mega.setdefault("metros", [])
    if not any(m.get("name") == key for m in mega["metros"]):
        mega["metros"].append({"name": key, "lat": lat, "lon": lon})
        save(MEGA, mega)
        log.info("  ✓ registered in megaregion-data.json")

    # 2) temperature projections — real CMIP6, full field set
    log.info("Pulling temperature projections (4-model ensemble)…")
    service = rmt.MetroTemperatureService(ee_project=EE_PROJECT)
    real = service.generate_metro_projections({"name": key, "lat": lat, "lon": lon})
    if real:
        for scenario, decades in real["projections"].items():
            for decade, vals in decades.items():
                try:
                    vals.update(rmt.compute_extra(lat, lon, scenario, int(decade)))
                except Exception as e:  # noqa: BLE001
                    log.warning(f"  temp extras {scenario} {decade}: {e}")
        temps[key] = real
        save(TEMPS, temps)
        log.info("  ✓ temperatures + heat-days saved")
    else:
        log.warning("  ⚠ no temperature data returned for this location")

    # 3) wet-bulb / humidity — real
    log.info("Pulling wet-bulb / humidity…")
    proj = {}
    for d in WB_DECADES:
        try:
            vals = rwb.compute_decade(lat, lon, d)
            vals["extent_radius_km"] = 30 + int(vals.get("wet_bulb_events", 0))  # display radius only
            proj[str(d)] = vals
            log.info(f"  {d}: {vals}")
        except Exception as e:  # noqa: BLE001
            log.error(f"  {d} FAILED: {e}")
    try:
        base = rwb.compute_decade(lat, lon, 1995, scenario="historical")
    except Exception:  # noqa: BLE001
        base = {}
    wet[key] = {
        "name": args.name,
        "lat": lat,
        "lon": lon,
        "baseline_1995_2014": {
            "avg_summer_humidity": base.get("avg_summer_humidity"),
            "wet_bulb_events": base.get("wet_bulb_events"),
            "days_over_95F": base.get("days_over_95F"),
        },
        "projections": proj,
    }
    save(WETBULB, wet)
    log.info("  ✓ wet-bulb / humidity saved")

    log.info(f"🎉 '{key}' added with real temperature + wet-bulb data. Refresh the app to see it.")


if __name__ == "__main__":
    main()
