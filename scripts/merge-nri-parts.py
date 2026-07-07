#!/usr/bin/env python3
"""
Merge FEMA NRI part-files fetched from the National Risk Index Counties
FeatureServer into apps/climate-studio/src/data/fema_nri_metros.json.

Usage: python3 scripts/merge-nri-parts.py <part1.json> [part2.json ...]

Each part file is a flat map: metro name -> record. Records with a null/absent
composite_risk are treated as incomplete and skipped (a warning is printed).
Keys starting with "_" are ignored.

Provenance: FEMA National Risk Index (NRI) 2.0, per-county, fetched from the
ArcGIS FeatureServer. Hazard *_RISKS fields are 0-100 national percentiles
(higher = worse). RESL_SCORE is Community Resilience (higher = better).
SOVI_SCORE is Social Vulnerability (higher = worse). Riverine flood is
IFLD_RISKS ("Inland Flooding") in NRI 2.0 — there is no RFLD field.
"""
import json
import sys
from datetime import date
from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / "apps/climate-studio/src/data/fema_nri_metros.json"

REQUIRED = [
    "county", "state", "stcofips", "wildfire_risk", "inland_flood_risk",
    "heat_wave_risk", "drought_risk", "community_resilience",
    "social_vulnerability", "composite_risk",
]  # coastal_flood_risk may legitimately be null (inland counties)


def main(paths):
    metros = {}
    for p in paths:
        part = json.loads(Path(p).read_text())
        for name, rec in part.items():
            if name.startswith("_"):
                continue
            if not isinstance(rec, dict) or rec.get("composite_risk") is None:
                print(f"  SKIP incomplete: {name} ({p})")
                continue
            missing = [k for k in REQUIRED if k not in rec]
            if missing:
                print(f"  SKIP {name}: missing {missing} ({p})")
                continue
            if name in metros:
                print(f"  WARN duplicate {name}: keeping first")
                continue
            metros[name] = {k: rec.get(k) for k in [
                "county", "state", "stcofips", "wildfire_risk",
                "inland_flood_risk", "coastal_flood_risk", "heat_wave_risk",
                "drought_risk", "community_resilience", "social_vulnerability",
                "composite_risk",
            ]}
    out = {
        "_meta": {
            "source": "FEMA National Risk Index (NRI) 2.0, county level",
            "endpoint": "https://services.arcgis.com/XG15cJAlne2vxtgt/arcgis/rest/services/National_Risk_Index_Counties/FeatureServer/0",
            "fetched": str(date.today()),
            "fields": {
                "wildfire_risk": "WFIR_RISKS (0-100 percentile, higher = worse)",
                "inland_flood_risk": "IFLD_RISKS (riverine/inland flooding; NRI 2.0 has no RFLD)",
                "coastal_flood_risk": "CFLD_RISKS (null = no coastal exposure)",
                "heat_wave_risk": "HWAV_RISKS",
                "drought_risk": "DRGT_RISKS",
                "community_resilience": "RESL_SCORE (higher = MORE resilient)",
                "social_vulnerability": "SOVI_SCORE (higher = MORE vulnerable)",
                "composite_risk": "RISK_SCORE (FEMA composite, all 18 hazards)",
            },
            "note": "Present-day snapshot; held flat across projection decades.",
        },
        "metros": dict(sorted(metros.items())),
    }
    OUT.write_text(json.dumps(out, indent=2) + "\n")
    print(f"Wrote {len(metros)} metros -> {OUT}")


if __name__ == "__main__":
    main(sys.argv[1:])
