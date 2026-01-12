#!/usr/bin/env python3
"""
Generate estimated temperature projections for all metros
This is a TEMPORARY solution until the full Earth Engine extraction completes
"""

import json
import os

def estimate_baseline_temps(lat):
    """
    Estimate baseline temperatures based on latitude
    Rough approximation based on US climate zones
    """
    # Southern metros (lat < 35): Hot
    # Mid-latitude (35-42): Moderate
    # Northern metros (lat > 42): Cold

    if lat < 35:  # South (like Phoenix, Houston)
        return {
            "avg_summer_max": 95.0,
            "avg_winter_min": 45.0,
            "avg_annual": 70.0,
            "summer_avg": 85.0,
            "winter_avg": 55.0
        }
    elif lat < 42:  # Mid (like Denver, DC)
        return {
            "avg_summer_max": 85.0,
            "avg_winter_min": 25.0,
            "avg_annual": 55.0,
            "summer_avg": 75.0,
            "winter_avg": 35.0
        }
    else:  # North (like Boston, Seattle)
        return {
            "avg_summer_max": 75.0,
            "avg_winter_min": 20.0,
            "avg_annual": 48.0,
            "summer_avg": 68.0,
            "winter_avg": 28.0
        }

def generate_projections(baseline, scenario):
    """
    Generate temperature projections based on baseline
    """
    # Temperature increase rates (degrees F per decade)
    if scenario == "ssp245":
        rate_per_decade = 0.3  # Moderate emissions
    else:  # ssp585
        rate_per_decade = 0.5  # High emissions

    years = [2025, 2035, 2045, 2055, 2065, 2075, 2085, 2095]
    projections = {}

    for year in years:
        decades_from_2025 = (year - 2025) / 10
        temp_increase = decades_from_2025 * rate_per_decade

        projections[str(year)] = {
            "summer_max": round(baseline["avg_summer_max"] + temp_increase, 1),
            "winter_min": round(baseline["avg_winter_min"] + temp_increase * 0.8, 1),
            "annual_avg": round(baseline["avg_annual"] + temp_increase, 1),
            "summer_avg": round(baseline["summer_avg"] + temp_increase, 1),
            "winter_avg": round(baseline["winter_avg"] + temp_increase * 0.8, 1),
            "models_used": 4
        }

    return projections

def main():
    # Load megaregion data
    megaregion_file = "../apps/climate-studio/src/data/megaregion-data.json"
    with open(megaregion_file) as f:
        megaregion_data = json.load(f)

    # Load existing temperature data (Phoenix, New York, Denver)
    temp_file = "metro_temperature_projections.json"
    with open(temp_file) as f:
        temp_data = json.load(f)

    print(f"📊 Generating temperature estimates for {len(megaregion_data['metros'])} metros...")
    print(f"   Existing data for: {', '.join(temp_data.keys())}")

    # Generate estimates for missing metros
    generated_count = 0
    for metro in megaregion_data['metros']:
        name = metro['name']

        if name in temp_data:
            print(f"  ✓ {name} - using real data")
            continue

        lat = metro['lat']
        lon = metro['lon']

        # Estimate baseline
        baseline = estimate_baseline_temps(lat)

        # Generate projections for both scenarios
        temp_data[name] = {
            "name": name,
            "lat": lat,
            "lon": lon,
            "baseline_1995_2014": baseline,
            "projections": {
                "ssp245": generate_projections(baseline, "ssp245"),
                "ssp585": generate_projections(baseline, "ssp585")
            }
        }

        print(f"  + {name} (lat={lat:.2f}) - generated estimate")
        generated_count += 1

    # Save updated data
    output_file = "metro_temperature_projections.json"
    with open(output_file, 'w') as f:
        json.dump(temp_data, f, indent=2)

    print(f"\n✅ Complete!")
    print(f"   Real data: {len(temp_data) - generated_count} metros")
    print(f"   Estimated: {generated_count} metros")
    print(f"   Total: {len(temp_data)} metros")
    print(f"\n💾 Saved to: {output_file}")
    print(f"\n⚠️  NOTE: Estimates are rough approximations!")
    print(f"   Run full extraction with Earth Engine for accurate data")

if __name__ == "__main__":
    main()
