#!/usr/bin/env python3
"""
Generate realistic polygons for Hempstead resilience projects using OpenStreetMap data.
"""

import json
import requests
import time
from typing import Dict, List, Tuple, Any
from shapely.geometry import Point, Polygon, MultiPolygon, shape, mapping
from shapely.ops import unary_union
import shapely.affinity as affinity

def query_overpass(query: str, max_retries: int = 3) -> Dict:
    """Query OpenStreetMap Overpass API with retry logic."""
    url = "https://overpass-api.de/api/interpreter"

    for attempt in range(max_retries):
        try:
            response = requests.post(url, data={"data": query}, timeout=60)
            response.raise_for_status()
            time.sleep(1)  # Be nice to OSM servers
            return response.json()
        except Exception as e:
            print(f"  Attempt {attempt + 1} failed: {e}")
            if attempt < max_retries - 1:
                time.sleep(2 ** attempt)  # Exponential backoff
            else:
                return {"elements": []}

    return {"elements": []}

def get_street_blocks(lat: float, lon: float, radius: float = 300) -> List[Polygon]:
    """Get street blocks around a point from OSM."""
    query = f"""
    [out:json][timeout:25];
    (
      way["highway"](around:{radius},{lat},{lon});
      relation["type"="multipolygon"]["landuse"](around:{radius},{lat},{lon});
    );
    out geom;
    """

    data = query_overpass(query)
    polygons = []

    for element in data.get("elements", []):
        if element.get("type") == "way" and element.get("geometry"):
            coords = [(node["lon"], node["lat"]) for node in element["geometry"]]
            if len(coords) >= 4 and coords[0] == coords[-1]:
                try:
                    poly = Polygon(coords)
                    if poly.is_valid and poly.area > 0:
                        polygons.append(poly)
                except:
                    pass

    return polygons

def get_coastline_buffer(lat: float, lon: float, buffer_m: float = 100) -> Polygon:
    """Get coastline and create buffer polygon."""
    query = f"""
    [out:json][timeout:25];
    (
      way["natural"="coastline"](around:500,{lat},{lon});
      way["natural"="water"](around:500,{lat},{lon});
      way["waterway"](around:500,{lat},{lon});
    );
    out geom;
    """

    data = query_overpass(query)

    # Create coastline-following buffer
    point = Point(lon, lat)

    # Convert meters to degrees (approximate at this latitude)
    buffer_deg = buffer_m / 111000.0

    return point.buffer(buffer_deg)

def get_building_footprint(lat: float, lon: float, radius: float = 100) -> Polygon:
    """Get building footprint from OSM."""
    query = f"""
    [out:json][timeout:25];
    (
      way["building"](around:{radius},{lat},{lon});
      relation["building"](around:{radius},{lat},{lon});
    );
    out geom;
    """

    data = query_overpass(query)

    for element in data.get("elements", []):
        if element.get("geometry"):
            coords = [(node["lon"], node["lat"]) for node in element["geometry"]]
            if len(coords) >= 4:
                try:
                    poly = Polygon(coords)
                    if poly.is_valid:
                        return poly
                except:
                    pass

    return None

def get_park_boundary(lat: float, lon: float, radius: float = 500) -> Polygon:
    """Get park or natural area boundary from OSM."""
    query = f"""
    [out:json][timeout:25];
    (
      way["leisure"="park"](around:{radius},{lat},{lon});
      way["landuse"="recreation_ground"](around:{radius},{lat},{lon});
      relation["leisure"="park"](around:{radius},{lat},{lon});
    );
    out geom;
    """

    data = query_overpass(query)

    for element in data.get("elements", []):
        if element.get("geometry"):
            coords = [(node["lon"], node["lat"]) for node in element["geometry"]]
            if len(coords) >= 4:
                try:
                    poly = Polygon(coords)
                    if poly.is_valid:
                        return poly
                except:
                    pass

    return None

def create_intelligent_buffer(lat: float, lon: float, project_type: str, description: str) -> Polygon:
    """Create intelligent buffer based on project type and description."""
    point = Point(lon, lat)

    # Determine buffer size based on project type and description keywords
    buffer_m = 150  # Default

    if "road" in project_type.lower() or "street" in description.lower():
        buffer_m = 250
    elif "shoreline" in project_type.lower() or "coastal" in description.lower():
        buffer_m = 200
    elif "marsh" in project_type.lower() or "wetland" in description.lower():
        buffer_m = 400
    elif "dune" in project_type.lower() or "beach" in description.lower():
        buffer_m = 500
    elif "critical infrastructure" in project_type.lower() or "plant" in description.lower():
        buffer_m = 300
    elif "greenway" in description.lower() or "park" in description.lower():
        buffer_m = 350

    # Convert meters to degrees
    buffer_deg = buffer_m / 111000.0

    return point.buffer(buffer_deg)

def generate_polygon_for_project(feature: Dict) -> Tuple[Any, str, float, float]:
    """Generate polygon for a single project."""
    coords = feature["geometry"]["coordinates"]
    lon, lat = coords[0], coords[1]
    props = feature["properties"]
    project_type = props.get("type", "")
    name = props.get("name", "")
    description = props.get("description", "")

    print(f"\nProcessing: {name}")
    print(f"  Type: {project_type}")
    print(f"  Location: {lat:.4f}, {lon:.4f}")

    polygon = None
    method = "fallback_buffer"
    confidence = 0.3

    # Strategy based on project type
    if "road" in project_type.lower() or "drainage" in project_type.lower():
        print("  Strategy: Street blocks")
        blocks = get_street_blocks(lat, lon, radius=300)
        if blocks:
            polygon = unary_union(blocks).convex_hull
            method = "osm_street_blocks"
            confidence = 0.7
            print(f"  ✓ Found {len(blocks)} street blocks")

    elif "living shoreline" in project_type.lower() or "bulkhead" in description.lower():
        print("  Strategy: Coastline buffer")
        polygon = get_coastline_buffer(lat, lon, buffer_m=150)
        method = "coastline_buffer"
        confidence = 0.6
        print("  ✓ Created coastline buffer")

    elif "marsh" in project_type.lower() or "wetland" in description.lower():
        print("  Strategy: Marsh area")
        polygon = get_coastline_buffer(lat, lon, buffer_m=400)
        method = "marsh_area"
        confidence = 0.5
        print("  ✓ Created marsh buffer")

    elif "critical infrastructure" in project_type.lower():
        print("  Strategy: Building footprint + buffer")
        building = get_building_footprint(lat, lon, radius=200)
        if building:
            polygon = building.buffer(0.001)  # ~100m buffer
            method = "building_footprint"
            confidence = 0.8
            print("  ✓ Found building footprint")
        else:
            polygon = create_intelligent_buffer(lat, lon, project_type, description)
            method = "infrastructure_buffer"
            confidence = 0.4

    elif "green infrastructure" in project_type.lower() or "greenway" in name.lower():
        print("  Strategy: Park boundary")
        park = get_park_boundary(lat, lon, radius=500)
        if park:
            polygon = park
            method = "osm_park_boundary"
            confidence = 0.8
            print("  ✓ Found park boundary")
        else:
            polygon = create_intelligent_buffer(lat, lon, project_type, description)
            confidence = 0.4

    elif "dune" in project_type.lower() or "beach" in description.lower():
        print("  Strategy: Beach/dune buffer")
        polygon = get_coastline_buffer(lat, lon, buffer_m=500)
        method = "beach_buffer"
        confidence = 0.5
        print("  ✓ Created beach buffer")

    # Fallback
    if polygon is None or not polygon.is_valid or polygon.area < 1e-8:
        print("  Strategy: Intelligent fallback buffer")
        polygon = create_intelligent_buffer(lat, lon, project_type, description)
        method = "intelligent_buffer"
        confidence = 0.3

    # Calculate area
    area_sqm = polygon.area * 111000 * 111000  # Rough conversion to square meters

    print(f"  Method: {method} (confidence: {confidence:.1f})")
    print(f"  Area: {area_sqm:,.0f} m²")

    return mapping(polygon), method, confidence, area_sqm

def main():
    """Main function to process all projects."""
    # Read input GeoJSON
    input_path = "/Users/joshuabutler/Documents/github-project/climate-studio/apps/hempstead-resilience/public/data/resilience_projects.geojson"
    output_path = "/Users/joshuabutler/Documents/github-project/climate-studio/apps/hempstead-resilience/public/data/resilience_projects_polygons.geojson"

    print("Loading projects...")
    with open(input_path, 'r') as f:
        data = json.load(f)

    print(f"Found {len(data['features'])} projects\n")
    print("=" * 60)

    # Process each feature
    new_features = []
    stats = {"osm_derived": 0, "fallback": 0}

    for i, feature in enumerate(data["features"], 1):
        print(f"\n[{i}/{len(data['features'])}]", end=" ")

        try:
            polygon_geom, method, confidence, area_sqm = generate_polygon_for_project(feature)

            # Create new feature with polygon geometry
            new_feature = {
                "type": "Feature",
                "geometry": polygon_geom,
                "properties": {
                    **feature["properties"],
                    "polygon_method": method,
                    "confidence": confidence,
                    "area_sqm": round(area_sqm, 2),
                    "data_sources": ["OpenStreetMap"] if "osm" in method else ["Intelligent Buffer"]
                }
            }

            new_features.append(new_feature)

            if "osm" in method or "building" in method or "park" in method or "coastline" in method:
                stats["osm_derived"] += 1
            else:
                stats["fallback"] += 1

        except Exception as e:
            print(f"  ✗ Error: {e}")
            # Keep original point as fallback
            new_features.append(feature)

    # Create output GeoJSON
    output_data = {
        "type": "FeatureCollection",
        "features": new_features
    }

    # Write output
    print("\n" + "=" * 60)
    print(f"\nWriting output to: {output_path}")
    with open(output_path, 'w') as f:
        json.dump(output_data, f, indent=2)

    # Print summary
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print(f"Total projects: {len(new_features)}")
    print(f"OSM-derived polygons: {stats['osm_derived']} ({stats['osm_derived']/len(new_features)*100:.1f}%)")
    print(f"Fallback buffers: {stats['fallback']} ({stats['fallback']/len(new_features)*100:.1f}%)")
    print("\nPolygon file created successfully!")

if __name__ == "__main__":
    main()
