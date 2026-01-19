#!/usr/bin/env python3
"""
Extract major US rivers from Natural Earth shapefile and convert to GeoJSON
"""

import geopandas as gpd
import json
from pathlib import Path

# Paths
DATA_DIR = Path(__file__).parent.parent / 'data' / 'rivers_canals'
SHAPEFILE = DATA_DIR / 'ne_10m_rivers_lake_centerlines.shp'
OUTPUT_FILE = DATA_DIR / 'major_us_rivers_natural_earth.geojson'

# Major US rivers to extract
RIVERS_TO_EXTRACT = [
    'Colorado',
    'Mississippi',
    'Missouri',
    'Rio Grande',
    'Columbia',
    'Snake',
    'Arkansas',
    'Red',
    'Ohio',
    'Sacramento'
]

print("🌊 Extracting Major US Rivers from Natural Earth Data\n")

# Read shapefile
print(f"📖 Reading shapefile: {SHAPEFILE}")
gdf = gpd.read_file(SHAPEFILE)

print(f"   Total features: {len(gdf)}")
print(f"   Columns: {list(gdf.columns)}\n")

# Check what the name column is called
name_column = None
for col in ['name', 'Name', 'NAME', 'GNIS_NAME', 'river_name']:
    if col in gdf.columns:
        name_column = col
        break

if not name_column:
    print("Available columns:")
    for col in gdf.columns:
        print(f"  - {col}")
        if len(gdf) > 0:
            print(f"    Sample value: {gdf[col].iloc[0]}")
    print("\n⚠️  Could not find name column. Using all features.")
    filtered = gdf
else:
    print(f"✅ Using name column: {name_column}\n")

    # Filter for rivers that match our list
    mask = gdf[name_column].str.contains('|'.join(RIVERS_TO_EXTRACT), case=False, na=False)
    filtered = gdf[mask]

    print(f"🔍 Found {len(filtered)} matching river segments:\n")
    for river in RIVERS_TO_EXTRACT:
        count = gdf[name_column].str.contains(river, case=False, na=False).sum()
        if count > 0:
            print(f"   ✅ {river}: {count} segments")
        else:
            print(f"   ❌ {river}: not found")

# Convert to GeoJSON
print(f"\n💾 Converting to GeoJSON...")
filtered.to_file(OUTPUT_FILE, driver='GeoJSON')

print(f"✅ Saved to: {OUTPUT_FILE}")
print(f"📊 Total features in output: {len(filtered)}")

# Print sample of what was extracted
if len(filtered) > 0:
    print(f"\n📋 Sample of extracted features:")
    if name_column:
        unique_names = filtered[name_column].unique()
        for name in unique_names[:10]:
            print(f"   - {name}")
        if len(unique_names) > 10:
            print(f"   ... and {len(unique_names) - 10} more")

print("\n✅ Done! You now have real river shapes from Natural Earth.")
