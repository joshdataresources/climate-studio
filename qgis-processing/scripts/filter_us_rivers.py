#!/usr/bin/env python3
"""
Filter Natural Earth rivers to get only US rivers with proper geometries
"""

import json
from pathlib import Path

# Paths
DATA_DIR = Path(__file__).parent.parent / 'data' / 'rivers_canals'
INPUT_FILE = DATA_DIR / 'major_us_rivers_natural_earth.geojson'
OUTPUT_FILE = DATA_DIR / 'us_rivers_filtered.geojson'

print("🌊 Filtering US Rivers from Natural Earth Data\n")

with open(INPUT_FILE) as f:
    data = json.load(f)

us_rivers = []

for i, feature in enumerate(data['features']):
    name = feature['properties'].get('name', '')
    coords = feature['geometry']['coordinates']

    # Check if this is a US river based on latitude
    if isinstance(coords[0][0], list):
        # MultiLineString - check first part
        if len(coords) > 0 and len(coords[0]) > 0:
            sample_lat = coords[0][0][1]
        else:
            continue
    else:
        # LineString
        sample_lat = coords[0][1]

    # US rivers are roughly between 25°N and 50°N
    if 25 <= sample_lat <= 50:
        # Special handling for Colorado River - merge all parts
        if name == 'Colorado':
            # Feature #10 is the complete US Colorado River
            if i == 10:
                # Merge all parts into a single LineString
                merged_coords = []
                for part in coords:
                    merged_coords.extend(part)

                us_rivers.append({
                    'type': 'Feature',
                    'properties': {
                        'name': name,
                        'scalerank': feature['properties'].get('scalerank'),
                        'note': 'US Colorado River - merged from 8 segments'
                    },
                    'geometry': {
                        'type': 'LineString',
                        'coordinates': merged_coords
                    }
                })
                print(f"✅ {name}: Merged {len(coords)} parts into {len(merged_coords)} points")
        else:
            # Keep other US rivers as-is
            us_rivers.append(feature)
            if isinstance(coords[0][0], list):
                total_points = sum(len(part) for part in coords)
                print(f"✅ {name}: {len(coords)} parts, {total_points} total points")
            else:
                print(f"✅ {name}: {len(coords)} points")

# Create output GeoJSON
output = {
    'type': 'FeatureCollection',
    'name': 'Major US Rivers (Filtered)',
    'features': us_rivers
}

with open(OUTPUT_FILE, 'w') as f:
    json.dump(output, f, indent=2)

print(f"\n✅ Saved {len(us_rivers)} US rivers to: {OUTPUT_FILE}")
print("\n📋 Rivers included:")
for feature in us_rivers:
    print(f"   - {feature['properties']['name']}")
