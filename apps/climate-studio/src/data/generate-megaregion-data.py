#!/usr/bin/env python3
"""
Generate megaregion population projection data for 2025-2095
Based on climate migration scenarios and megaregion convergence patterns
"""

import json

# Time frames
YEARS = [2025, 2035, 2045, 2055, 2065, 2075, 2085, 2095]

# Define 50 key US metros with coordinates and 2025 baseline populations
METROS = [
    # NORTHEAST CORRIDOR MEGAREGION (merges 2055-2065)
    {"name": "New York", "lat": 40.7128, "lon": -74.0060, "pop_2025": 19500000, "region": "northeast", "climate_risk": "moderate", "megaregion": "northeast_corridor"},
    {"name": "Philadelphia", "lat": 39.9526, "lon": -75.1652, "pop_2025": 6200000, "region": "northeast", "climate_risk": "moderate", "megaregion": "northeast_corridor"},
    {"name": "Boston", "lat": 42.3601, "lon": -71.0589, "pop_2025": 4900000, "region": "northeast", "climate_risk": "low", "megaregion": "northeast_corridor"},
    {"name": "Washington DC", "lat": 38.9072, "lon": -77.0369, "pop_2025": 6400000, "region": "northeast", "climate_risk": "moderate", "megaregion": "northeast_corridor"},
    {"name": "Baltimore", "lat": 39.2904, "lon": -76.6122, "pop_2025": 2800000, "region": "northeast", "climate_risk": "moderate", "megaregion": "northeast_corridor"},

    # GREAT LAKES MEGAREGION (emerges 2045-2065, climate haven)
    {"name": "Chicago", "lat": 41.8781, "lon": -87.6298, "pop_2025": 9500000, "region": "great_lakes", "climate_risk": "low", "megaregion": "great_lakes"},
    {"name": "Detroit", "lat": 42.3314, "lon": -83.0458, "pop_2025": 4300000, "region": "great_lakes", "climate_risk": "low", "megaregion": "great_lakes"},
    {"name": "Cleveland", "lat": 41.4993, "lon": -81.6944, "pop_2025": 2100000, "region": "great_lakes", "climate_risk": "low", "megaregion": "great_lakes"},
    {"name": "Pittsburgh", "lat": 40.4406, "lon": -79.9959, "pop_2025": 2400000, "region": "great_lakes", "climate_risk": "low", "megaregion": "great_lakes"},
    {"name": "Buffalo", "lat": 42.8864, "lon": -78.8784, "pop_2025": 1200000, "region": "great_lakes", "climate_risk": "low", "megaregion": "great_lakes"},
    {"name": "Milwaukee", "lat": 43.0389, "lon": -87.9065, "pop_2025": 1600000, "region": "great_lakes", "climate_risk": "low", "megaregion": "great_lakes"},
    {"name": "Minneapolis", "lat": 44.9778, "lon": -93.2650, "pop_2025": 3700000, "region": "great_lakes", "climate_risk": "low", "megaregion": "great_lakes"},

    # PIEDMONT ATLANTIC MEGAREGION (I-85 corridor, merges 2055-2075)
    {"name": "Atlanta", "lat": 33.7490, "lon": -84.3880, "pop_2025": 6200000, "region": "southeast", "climate_risk": "high", "megaregion": "piedmont_atlantic"},
    {"name": "Charlotte", "lat": 35.2271, "lon": -80.8431, "pop_2025": 2700000, "region": "southeast", "climate_risk": "moderate", "megaregion": "piedmont_atlantic"},
    {"name": "Raleigh", "lat": 35.7796, "lon": -78.6382, "pop_2025": 1500000, "region": "southeast", "climate_risk": "moderate", "megaregion": "piedmont_atlantic"},
    {"name": "Greensboro", "lat": 36.0726, "lon": -79.7920, "pop_2025": 800000, "region": "southeast", "climate_risk": "moderate", "megaregion": "piedmont_atlantic"},
    {"name": "Greenville SC", "lat": 34.8526, "lon": -82.3940, "pop_2025": 1000000, "region": "southeast", "climate_risk": "moderate", "megaregion": "piedmont_atlantic"},

    # TEXAS TRIANGLE (could merge 2035-2055, then decline)
    {"name": "Dallas", "lat": 32.7767, "lon": -96.7970, "pop_2025": 7600000, "region": "texas", "climate_risk": "high", "megaregion": "texas_triangle"},
    {"name": "Houston", "lat": 29.7604, "lon": -95.3698, "pop_2025": 7200000, "region": "texas", "climate_risk": "extreme", "megaregion": "texas_triangle"},
    {"name": "Austin", "lat": 30.2672, "lon": -97.7431, "pop_2025": 2400000, "region": "texas", "climate_risk": "high", "megaregion": "texas_triangle"},
    {"name": "San Antonio", "lat": 29.4241, "lon": -98.4936, "pop_2025": 2600000, "region": "texas", "climate_risk": "high", "megaregion": "texas_triangle"},

    # SOUTHERN CALIFORNIA (already merged, stable)
    {"name": "Los Angeles", "lat": 34.0522, "lon": -118.2437, "pop_2025": 13200000, "region": "socal", "climate_risk": "high", "megaregion": "southern_california"},
    {"name": "San Diego", "lat": 32.7157, "lon": -117.1611, "pop_2025": 3400000, "region": "socal", "climate_risk": "moderate", "megaregion": "southern_california"},

    # CASCADIA (merges 2065-2085)
    {"name": "Seattle", "lat": 47.6062, "lon": -122.3321, "pop_2025": 4000000, "region": "northwest", "climate_risk": "low", "megaregion": "cascadia"},
    {"name": "Portland", "lat": 45.5152, "lon": -122.6784, "pop_2025": 2500000, "region": "northwest", "climate_risk": "low", "megaregion": "cascadia"},

    # FRONT RANGE (growing, no merge)
    {"name": "Denver", "lat": 39.7392, "lon": -104.9903, "pop_2025": 3000000, "region": "mountain", "climate_risk": "moderate", "megaregion": "front_range"},
    {"name": "Colorado Springs", "lat": 38.8339, "lon": -104.8214, "pop_2025": 750000, "region": "mountain", "climate_risk": "moderate", "megaregion": "front_range"},

    # MAJOR DECLINING METROS (Gulf Coast & South Florida)
    {"name": "Miami", "lat": 25.7617, "lon": -80.1918, "pop_2025": 6200000, "region": "florida", "climate_risk": "extreme", "megaregion": "none"},
    {"name": "Tampa", "lat": 27.9506, "lon": -82.4572, "pop_2025": 3200000, "region": "florida", "climate_risk": "extreme", "megaregion": "none"},
    {"name": "Orlando", "lat": 28.5383, "lon": -81.3792, "pop_2025": 2700000, "region": "florida", "climate_risk": "high", "megaregion": "none"},
    {"name": "New Orleans", "lat": 29.9511, "lon": -90.0715, "pop_2025": 1300000, "region": "gulf", "climate_risk": "extreme", "megaregion": "none"},

    # ARIZONA CORRIDOR (extreme decline)
    {"name": "Phoenix", "lat": 33.4484, "lon": -112.0740, "pop_2025": 5000000, "region": "southwest", "climate_risk": "extreme", "megaregion": "none"},
    {"name": "Tucson", "lat": 32.2226, "lon": -110.9747, "pop_2025": 1100000, "region": "southwest", "climate_risk": "extreme", "megaregion": "none"},

    # OTHER MAJOR METROS
    {"name": "San Francisco", "lat": 37.7749, "lon": -122.4194, "pop_2025": 4700000, "region": "norcal", "climate_risk": "moderate", "megaregion": "none"},
    {"name": "Las Vegas", "lat": 36.1699, "lon": -115.1398, "pop_2025": 2300000, "region": "southwest", "climate_risk": "extreme", "megaregion": "none"},
    {"name": "Nashville", "lat": 36.1627, "lon": -86.7816, "pop_2025": 2000000, "region": "southeast", "climate_risk": "moderate", "megaregion": "none"},
    {"name": "Indianapolis", "lat": 39.7684, "lon": -86.1581, "pop_2025": 2100000, "region": "midwest", "climate_risk": "low", "megaregion": "none"},
    {"name": "Columbus", "lat": 39.9612, "lon": -82.9988, "pop_2025": 2200000, "region": "midwest", "climate_risk": "low", "megaregion": "none"},
    {"name": "Cincinnati", "lat": 39.1031, "lon": -84.5120, "pop_2025": 2200000, "region": "midwest", "climate_risk": "low", "megaregion": "none"},
    {"name": "Kansas City", "lat": 39.0997, "lon": -94.5786, "pop_2025": 2200000, "region": "plains", "climate_risk": "moderate", "megaregion": "none"},
    {"name": "St. Louis", "lat": 38.6270, "lon": -90.1994, "pop_2025": 2800000, "region": "midwest", "climate_risk": "moderate", "megaregion": "none"},
    {"name": "Salt Lake City", "lat": 40.7608, "lon": -111.8910, "pop_2025": 1300000, "region": "mountain", "climate_risk": "high", "megaregion": "none"},
    {"name": "San Jose", "lat": 37.3382, "lon": -121.8863, "pop_2025": 2000000, "region": "norcal", "climate_risk": "moderate", "megaregion": "none"},
    {"name": "Sacramento", "lat": 38.5816, "lon": -121.4944, "pop_2025": 2400000, "region": "norcal", "climate_risk": "high", "megaregion": "none"},
    {"name": "Richmond", "lat": 37.5407, "lon": -77.4360, "pop_2025": 1300000, "region": "southeast", "climate_risk": "moderate", "megaregion": "none"},
    {"name": "Jacksonville", "lat": 30.3322, "lon": -81.6557, "pop_2025": 1600000, "region": "florida", "climate_risk": "high", "megaregion": "none"},
    {"name": "Memphis", "lat": 35.1495, "lon": -90.0490, "pop_2025": 1350000, "region": "southeast", "climate_risk": "moderate", "megaregion": "none"},
    {"name": "Louisville", "lat": 38.2527, "lon": -85.7585, "pop_2025": 1300000, "region": "southeast", "climate_risk": "moderate", "megaregion": "none"},
    {"name": "Oklahoma City", "lat": 35.4676, "lon": -97.5164, "pop_2025": 1400000, "region": "plains", "climate_risk": "high", "megaregion": "none"},
    {"name": "Albuquerque", "lat": 35.0844, "lon": -106.6504, "pop_2025": 920000, "region": "southwest", "climate_risk": "high", "megaregion": "none"},
]


def calculate_growth_rate(metro, year):
    """
    Calculate population growth rate based on climate risk and region
    """
    climate_risk = metro["climate_risk"]
    region = metro["region"]

    # Base growth rates by decade
    if year < 2035:
        # 2025-2035: Sunbelt boom continues
        if region in ["texas", "florida", "southwest"]:
            return 0.15  # +15%/decade
        elif region in ["southeast"]:
            return 0.12
        elif region == "northwest":
            return 0.10
        elif region in ["great_lakes", "midwest"]:
            return 0.03  # Still slight decline
        else:
            return 0.07

    elif year < 2055:
        # 2035-2055: Climate migration begins
        if climate_risk == "extreme":
            return -0.05 if region in ["gulf", "southwest"] else 0.05
        elif climate_risk == "high":
            return 0.03 if region == "texas" else 0.06
        elif climate_risk == "low":
            # Climate havens: Great Lakes boom
            return 0.20 if region == "great_lakes" else 0.12
        else:
            return 0.08

    elif year < 2075:
        # 2055-2075: Major convergence, climate impacts accelerate
        if climate_risk == "extreme":
            return -0.15 if region in ["gulf", "florida"] else -0.20  # Phoenix/Vegas
        elif climate_risk == "high":
            if region == "texas":
                return -0.05  # Texas reversal begins
            else:
                return 0.02
        elif climate_risk == "low":
            return 0.18 if region == "great_lakes" else 0.10
        else:
            return 0.06

    else:
        # 2075-2095: Climate reality fully realized
        if climate_risk == "extreme":
            return -0.25
        elif climate_risk == "high":
            return -0.10
        elif climate_risk == "low":
            return 0.12
        else:
            return 0.04


def generate_populations():
    """Generate population projections for all metros across all years"""
    result = {"metros": []}

    for metro in METROS:
        metro_data = {
            "name": metro["name"],
            "lat": metro["lat"],
            "lon": metro["lon"],
            "climate_risk": metro["climate_risk"],
            "region": metro["region"],
            "megaregion": metro["megaregion"],
            "populations": {}
        }

        current_pop = metro["pop_2025"]

        for i, year in enumerate(YEARS):
            if i == 0:
                metro_data["populations"][str(year)] = current_pop
            else:
                prev_year = YEARS[i-1]
                growth_rate = calculate_growth_rate(metro, year)
                years_elapsed = year - prev_year
                decades = years_elapsed / 10.0

                # Compound growth
                new_pop = current_pop * ((1 + growth_rate) ** decades)
                metro_data["populations"][str(year)] = int(new_pop)
                current_pop = new_pop

        result["metros"].append(metro_data)

    return result


if __name__ == "__main__":
    data = generate_populations()

    output_path = "/Users/joshuabutler/Documents/github-project/climate-studio/apps/climate-studio/src/data/megaregion-data.json"

    with open(output_path, 'w') as f:
        json.dump(data, f, indent=2)

    print(f"✅ Generated megaregion data for {len(data['metros'])} metros")
    print(f"📁 Saved to: {output_path}")
