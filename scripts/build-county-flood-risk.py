#!/usr/bin/env python3
"""
Build apps/climate-studio/src/data/county_flood_risk.json — FEMA National Risk
Index flood percentiles per county, with simplified geometry.

Why a bundled file rather than a live query: FEMA's NRI county FeatureServer takes
19-20 seconds to return the national extent, whatever combination of
maxAllowableOffset, geometryPrecision and quantizationParameters you ask for. That
is fine for an annual build step and unusable as a map layer fetch. NRI is
published annually, so this is static data in practice.

The flood zones themselves (FEMA NFHL) cannot be drawn above about zoom 14 and have
no national tile service, which is why this coarser layer exists at all — see
apps/climate-studio/src/utils/femaFloodTiles.ts.

Usage: python3 scripts/build-county-flood-risk.py
"""
import json
import urllib.parse
import urllib.request
from pathlib import Path

SERVICE = (
    "https://services.arcgis.com/XG15cJAlne2vxtgt/arcgis/rest/services/"
    "National_Risk_Index_Counties/FeatureServer/0/query"
)
OUT = Path("apps/climate-studio/src/data/county_flood_risk.json")
PRECISION = 2  # ~1.1 km at the equator; the layer is only shown below zoom 14
MIN_RING_POINTS = 4
MIN_PART_SPAN = 0.08  # drop islands smaller than roughly one simplification step


def fetch(offset):
    params = {
        "where": "1=1",
        "outFields": "COUNTY,STATE,STCOFIPS,IFLD_ALR_NPCTL,CFLD_ALR_NPCTL",
        "returnGeometry": "true",
        "maxAllowableOffset": "0.08",
        "outSR": "4326",
        "resultOffset": str(offset),
        "resultRecordCount": "2000",
        "f": "geojson",
    }
    url = f"{SERVICE}?{urllib.parse.urlencode(params)}"
    print(f"  fetching counties from offset {offset} …")
    with urllib.request.urlopen(url, timeout=180) as r:
        return json.load(r)


def round_coords(node):
    """Round in place, and drop points that collapse onto their predecessor."""
    if isinstance(node[0], (int, float)):
        return [round(node[0], PRECISION), round(node[1], PRECISION)]
    out = [round_coords(c) for c in node]
    if out and isinstance(out[0], list) and out[0] and isinstance(out[0][0], (int, float)):
        deduped = [p for i, p in enumerate(out) if i == 0 or p != out[i - 1]]
        # A ring needs four points to survive as a polygon.
        return deduped if len(deduped) >= 4 else out
    return out


def span(ring):
    xs = [p[0] for p in ring]
    ys = [p[1] for p in ring]
    return max(max(xs) - min(xs), max(ys) - min(ys))


def drop_slivers(geom):
    """Discard rings too small to see at the zooms this layer is drawn at.

    Coastal counties carry long tails of small islands that survive simplification
    as 4-point specks. They cost more bytes than the county outlines do."""
    def keep_polygon(poly):
        rings = [r for r in poly if len(r) >= MIN_RING_POINTS and span(r) >= MIN_PART_SPAN]
        return rings or None

    if geom["type"] == "Polygon":
        rings = keep_polygon(geom["coordinates"])
        return {"type": "Polygon", "coordinates": rings} if rings else None

    parts = [p for p in (keep_polygon(poly) for poly in geom["coordinates"]) if p]
    if not parts:
        return None
    # A multipolygon reduced to one part is a polygon.
    if len(parts) == 1:
        return {"type": "Polygon", "coordinates": parts[0]}
    return {"type": "MultiPolygon", "coordinates": parts}


def main():
    features = []
    offset = 0
    while True:
        page = fetch(offset)
        page_features = page.get("features") or []
        features.extend(page_features)
        if len(page_features) < 2000:
            break
        offset += 2000

    kept = []
    for f in features:
        props = f.get("properties") or {}
        inland = props.get("IFLD_ALR_NPCTL")
        coastal = props.get("CFLD_ALR_NPCTL")
        if inland is None and coastal is None:
            continue  # nothing to colour by
        pct = max(inland or 0, coastal or 0)
        geom = f.get("geometry")
        if not geom:
            continue
        geom["coordinates"] = round_coords(geom["coordinates"])
        geom = drop_slivers(geom)
        if geom is None:
            continue
        kept.append({
            "type": "Feature",
            "geometry": geom,
            "properties": {
                "county": props.get("COUNTY"),
                "state": props.get("STATE"),
                "pct": round(pct, 1),
            },
        })

    out = {
        "type": "FeatureCollection",
        "metadata": {
            "source": "FEMA National Risk Index, county level",
            "fields": "max of IFLD_ALR_NPCTL and CFLD_ALR_NPCTL — expected annual loss "
                      "rate percentiles, not the _RISKS fields, which scale with "
                      "exposed population and pin every large metro near 100",
            "service": SERVICE,
            "geometryPrecision": PRECISION,
            "regenerate": "python3 scripts/build-county-flood-risk.py",
        },
        "features": kept,
    }
    OUT.write_text(json.dumps(out, separators=(",", ":")))
    print(f"  wrote {len(kept)} counties -> {OUT} ({OUT.stat().st_size / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
