#!/usr/bin/env python3
"""
Update megaregion population data with dramatic climate-based migration patterns.

Growth/Decline Patterns:
- Great Lakes climate havens: +50% to +80% (2025-2095)
- Gulf Coast: -30% to -50%
- South Florida: -20% to -40%
- Phoenix/Tucson: Boom to 2055 (+60%), then crash to 2095 (-40% from peak)
- Texas Triangle: +70% to 2055, then plateau/slight decline
- Denver/Front Range: +80% sustained growth
- Appalachian corridor: +40% to +60%
"""

import json
import math

# Load existing data
with open('apps/climate-studio/src/data/megaregion-data.json', 'r') as f:
    data = json.load(f)

# Climate risk growth patterns (multipliers for each decade from 2025)
# Format: [2025, 2035, 2045, 2055, 2065, 2075, 2085, 2095]
GROWTH_PATTERNS = {
    # GREAT LAKES CLIMATE HAVENS - Strong sustained growth
    'Buffalo': [1.0, 1.15, 1.32, 1.50, 1.68, 1.85, 2.00, 2.10],
    'Detroit': [1.0, 1.12, 1.26, 1.42, 1.58, 1.72, 1.85, 1.95],
    'Cleveland': [1.0, 1.10, 1.22, 1.35, 1.48, 1.60, 1.70, 1.78],
    'Milwaukee': [1.0, 1.13, 1.28, 1.44, 1.60, 1.75, 1.88, 1.98],
    'Minneapolis': [1.0, 1.14, 1.30, 1.48, 1.65, 1.80, 1.93, 2.02],
    'Pittsburgh': [1.0, 1.11, 1.24, 1.38, 1.52, 1.64, 1.75, 1.83],
    'Rochester': [1.0, 1.16, 1.34, 1.52, 1.70, 1.86, 2.00, 2.08],

    # GULF COAST - Severe decline
    'New Orleans': [1.0, 0.92, 0.82, 0.70, 0.58, 0.48, 0.42, 0.38],
    'Mobile': [1.0, 0.90, 0.78, 0.65, 0.52, 0.42, 0.35, 0.30],
    'Houston': [1.0, 1.25, 1.45, 1.60, 1.50, 1.35, 1.18, 1.05],  # Boom then decline

    # SOUTH FLORIDA - Major coastal retreat
    'Miami': [1.0, 1.05, 1.08, 1.05, 0.95, 0.82, 0.68, 0.58],
    'Fort Lauderdale': [1.0, 1.03, 1.04, 1.00, 0.90, 0.78, 0.65, 0.55],
    'Orlando': [1.0, 1.30, 1.65, 2.05, 2.20, 1.95, 1.68, 1.45],  # Boom then reality

    # ARIZONA - Extreme boom-bust
    'Phoenix': [1.0, 1.22, 1.48, 1.65, 1.50, 1.25, 0.95, 0.75],
    'Tucson': [1.0, 1.18, 1.38, 1.52, 1.35, 1.10, 0.85, 0.68],

    # TEXAS TRIANGLE - Strong growth then plateau
    'Dallas': [1.0, 1.28, 1.58, 1.82, 1.85, 1.82, 1.78, 1.72],
    'Austin': [1.0, 1.32, 1.68, 2.05, 2.15, 2.10, 2.02, 1.95],
    'San Antonio': [1.0, 1.25, 1.52, 1.75, 1.78, 1.75, 1.70, 1.65],

    # FRONT RANGE - Sustained boom
    'Denver': [1.0, 1.20, 1.45, 1.72, 1.98, 2.22, 2.42, 2.58],
    'Colorado Springs': [1.0, 1.22, 1.48, 1.76, 2.05, 2.30, 2.52, 2.68],

    # APPALACHIAN CORRIDOR - Strong rebound
    'Cincinnati': [1.0, 1.12, 1.26, 1.42, 1.56, 1.68, 1.78, 1.85],
    'Louisville': [1.0, 1.10, 1.22, 1.36, 1.48, 1.58, 1.66, 1.72],
    'Nashville': [1.0, 1.15, 1.32, 1.50, 1.65, 1.78, 1.88, 1.95],
    'Raleigh': [1.0, 1.18, 1.38, 1.60, 1.78, 1.92, 2.02, 2.08],
    'Charlotte': [1.0, 1.16, 1.34, 1.54, 1.70, 1.82, 1.92, 1.98],

    # NORTHEAST CORRIDOR - Moderate steady growth
    'New York': [1.0, 1.08, 1.17, 1.26, 1.34, 1.40, 1.45, 1.48],
    'Boston': [1.0, 1.12, 1.25, 1.38, 1.50, 1.60, 1.68, 1.73],
    'Philadelphia': [1.0, 1.08, 1.17, 1.26, 1.34, 1.40, 1.45, 1.48],
    'Baltimore': [1.0, 1.06, 1.13, 1.20, 1.26, 1.30, 1.33, 1.35],
    'Washington': [1.0, 1.10, 1.21, 1.32, 1.42, 1.50, 1.56, 1.60],

    # ATLANTA - Hot then heat stress
    'Atlanta': [1.0, 1.22, 1.48, 1.72, 1.82, 1.75, 1.65, 1.55],

    # CASCADIA - Steady growth
    'Seattle': [1.0, 1.15, 1.32, 1.50, 1.66, 1.80, 1.92, 2.00],
    'Portland': [1.0, 1.13, 1.28, 1.44, 1.58, 1.70, 1.80, 1.88],

    # CALIFORNIA - Stable to slight decline (water issues)
    'Los Angeles': [1.0, 1.05, 1.08, 1.08, 1.05, 1.00, 0.95, 0.92],
    'San Diego': [1.0, 1.06, 1.10, 1.10, 1.06, 1.00, 0.95, 0.90],
    'San Francisco': [1.0, 1.08, 1.15, 1.18, 1.15, 1.10, 1.05, 1.02],
    'San Jose': [1.0, 1.10, 1.18, 1.22, 1.20, 1.15, 1.10, 1.08],
    'Sacramento': [1.0, 1.08, 1.15, 1.18, 1.15, 1.10, 1.05, 1.02],

    # MIDWEST - Mixed
    'Chicago': [1.0, 1.08, 1.17, 1.26, 1.34, 1.40, 1.45, 1.48],
    'St. Louis': [1.0, 1.05, 1.10, 1.15, 1.18, 1.20, 1.22, 1.23],
    'Kansas City': [1.0, 1.06, 1.12, 1.18, 1.22, 1.25, 1.28, 1.30],
    'Indianapolis': [1.0, 1.07, 1.14, 1.21, 1.27, 1.32, 1.36, 1.38],
    'Columbus': [1.0, 1.09, 1.19, 1.29, 1.38, 1.45, 1.50, 1.54],
}

# Default moderate growth for cities not specified
DEFAULT_GROWTH = [1.0, 1.05, 1.10, 1.15, 1.18, 1.20, 1.22, 1.23]

def get_growth_pattern(city_name):
    """Get growth pattern for a city, with fallback to default."""
    for key in GROWTH_PATTERNS:
        if key.lower() in city_name.lower():
            return GROWTH_PATTERNS[key]
    return DEFAULT_GROWTH

# Update populations
for metro in data['metros']:
    # Get base 2025 population
    base_pop = metro['populations']['2025']

    # Get growth pattern
    pattern = get_growth_pattern(metro['name'])

    # Apply pattern to all years
    years = [2025, 2035, 2045, 2055, 2065, 2075, 2085, 2095]
    for i, year in enumerate(years):
        metro['populations'][str(year)] = int(base_pop * pattern[i])

    print(f"{metro['name']:20s} 2025: {metro['populations']['2025']:>10,} → 2095: {metro['populations']['2095']:>10,} ({((pattern[-1] - 1) * 100):+.0f}%)")

# Save updated data
with open('apps/climate-studio/src/data/megaregion-data.json', 'w') as f:
    json.dump(data, f, indent=2)

print(f"\n✅ Updated {len(data['metros'])} metros with climate-based population projections")
