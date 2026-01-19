#!/usr/bin/env python3
"""
Fetch professional-grade river data from USGS NHDPlus HR web service
Focuses on the Colorado River mainstem with accurate geometries
"""

import requests
import json
from pathlib import Path

# Output directory
DATA_DIR = Path(__file__).parent.parent / 'data' / 'rivers_canals'
OUTPUT_FILE = DATA_DIR / 'usgs_colorado_river.geojson'

print("🌊 Fetching USGS NHDPlus HR Colorado River Data\n")

# USGS NHDPlus HR MapServer endpoint
BASE_URL = "https://hydro.nationalmap.gov/arcgis/rest/services/NHDPlus_HR/MapServer/2/query"

# Query parameters for Colorado River mainstem
# Layer 2 is NHDFlowline (river centerlines)
params = {
    'where': "GNIS_NAME='Colorado River'",
    'outFields': '*',
    'f': 'geojson',
    'returnGeometry': 'true',
    'spatialRel': 'esriSpatialRelIntersects'
}

print("📡 Querying USGS NHDPlus HR web service...")
print(f"   Endpoint: {BASE_URL}")
print(f"   Filter: {params['where']}\n")

try:
    response = requests.get(BASE_URL, params=params, timeout=60)
    response.raise_for_status()

    data = response.json()

    if 'features' in data and len(data['features']) > 0:
        print(f"✅ Found {len(data['features'])} Colorado River segments")

        # Save to file
        with open(OUTPUT_FILE, 'w') as f:
            json.dump(data, f, indent=2)

        print(f"\n💾 Saved to: {OUTPUT_FILE}")

        # Show sample properties
        if data['features']:
            props = data['features'][0]['properties']
            print("\n📋 Sample properties:")
            for key in ['GNIS_NAME', 'LENGTHKM', 'FTYPE', 'STREAMORDE']:
                if key in props:
                    print(f"   {key}: {props[key]}")

        print(f"\n✅ Successfully fetched USGS professional river data!")

    else:
        print("⚠️  No features found with this query")
        print("Response:", json.dumps(data, indent=2)[:500])

except requests.exceptions.RequestException as e:
    print(f"❌ Error fetching data: {e}")
    print("\n💡 Trying alternative query...")

    # Try broader search
    params['where'] = "GNIS_NAME LIKE '%Colorado%'"
    try:
        response = requests.get(BASE_URL, params=params, timeout=60)
        response.raise_for_status()
        data = response.json()

        if 'features' in data:
            print(f"Found {len(data['features'])} features with 'Colorado' in name")

            # Filter to just "Colorado River" (not "Colorado River Aqueduct", etc.)
            colorado_river = [
                f for f in data['features']
                if f['properties'].get('GNIS_NAME') == 'Colorado River'
            ]

            if colorado_river:
                output_data = {
                    'type': 'FeatureCollection',
                    'features': colorado_river
                }

                with open(OUTPUT_FILE, 'w') as f:
                    json.dump(output_data, f, indent=2)

                print(f"\n✅ Saved {len(colorado_river)} Colorado River segments to: {OUTPUT_FILE}")

    except Exception as e2:
        print(f"❌ Alternative query also failed: {e2}")
