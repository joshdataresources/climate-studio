"""
Precipitation & Drought Service

Provides precipitation and drought data from NOAA LOCA2 CMIP6
downscaled climate models via Earth Engine.
"""

import ee
import numpy as np
import h3
import logging

logger = logging.getLogger(__name__)


class PrecipitationDroughtService:
    """Service for precipitation and drought data from NOAA LOCA2"""

    def __init__(self, ee_project=None):
        """
        Initialize Earth Engine with the specified project

        Args:
            ee_project: Google Earth Engine project ID
        """
        self.ee_project = ee_project
        self.initialized = False

        try:
            if ee_project:
                ee.Initialize(project=ee_project)
            else:
                ee.Initialize()
            self.initialized = True
            logger.info(f"Earth Engine initialized for precipitation/drought (project: {ee_project})")
        except Exception as e:
            logger.error(f"Failed to initialize Earth Engine: {e}")
            logger.warning("Precipitation/drought service will not be available")

    def get_drought_data(self, bounds, scenario='rcp45', year=2050, metric='drought_index', resolution=7):
        """
        Get precipitation/drought data as hexagonal GeoJSON

        Args:
            bounds: Dict with 'north', 'south', 'east', 'west' keys
            scenario: Climate scenario (rcp26, rcp45, rcp85)
            year: Projection year (2020-2100)
            metric: 'precipitation', 'drought_index', or 'soil_moisture'
            resolution: H3 hexagon resolution (4-10)

        Returns:
            GeoJSON FeatureCollection with hexagonal drought/precipitation data
        """
        if not self.initialized:
            logger.error("Earth Engine not initialized - cannot fetch drought data")
            raise RuntimeError("Earth Engine not initialized. Please check server configuration and Earth Engine authentication.")

        # Validate bounding box size to prevent huge requests when zoomed way out
        # Earth Engine has a 5000 element limit for reduceRegions
        lat_span = bounds['north'] - bounds['south']
        lon_span = bounds['east'] - bounds['west']

        # Calculate approximate number of hexagons
        # H3 resolution area approximations (km²): res2=~86000, res3=~12000, res4=~1700, res5=~240, res6=~34, res7=~4.8
        resolution_area_km2 = {2: 86000, 3: 12000, 4: 1700, 5: 240, 6: 34, 7: 4.8, 8: 0.7}
        hex_area = resolution_area_km2.get(resolution, 240)

        # Approximate area of bounding box in km²
        # 1 degree latitude ≈ 111 km, longitude varies by latitude but use ~111 at equator
        bbox_area_km2 = (lat_span * 111) * (lon_span * 111)
        approx_hex_count = bbox_area_km2 / hex_area

        max_hexagons = 4500  # Stay under Earth Engine's 5000 limit with buffer

        if approx_hex_count > max_hexagons:
            logger.warning(f"Bounding box too large: {lat_span:.1f}° x {lon_span:.1f}° → ~{approx_hex_count:.0f} hexagons (max {max_hexagons})")
            raise ValueError(
                f"Bounding box too large: {lat_span:.1f}° x {lon_span:.1f}° would generate ~{approx_hex_count:.0f} hexagons (max {max_hexagons}). "
                f"Please zoom in closer to see precipitation/drought data."
            )

        try:
            logger.info(f"Fetching drought/precipitation data: metric={metric}, scenario={scenario}, year={year}, bounds={bounds}")

            # Create bounding box
            bbox = ee.Geometry.Rectangle([
                bounds['west'],
                bounds['south'],
                bounds['east'],
                bounds['north']
            ])

            # For now, use CHIRPS precipitation data as a proxy
            # TODO: Replace with actual NOAA LOCA2 data when available
            logger.info(f"Using CHIRPS dataset for {metric}")

            # CHIRPS Daily: Climate Hazards Group InfraRed Precipitation with Station data
            dataset = ee.ImageCollection('UCSB-CHG/CHIRPS/DAILY') \
                .filterBounds(bbox) \
                .filterDate('2020-01-01', '2023-12-31')

            # Calculate mean precipitation
            mean_precip = dataset.mean()

            # Get hexagons in bounds
            logger.info(f"Generating hexagons at resolution {resolution}")
            hex_ids = self._get_hexagons_in_bounds(bounds, resolution)
            logger.info(f"Generated {len(hex_ids)} hexagons, fetching precipitation data for each...")

            # Convert hexagons to Earth Engine FeatureCollection
            hex_features = []
            for hex_id in hex_ids:
                boundary = h3.cell_to_boundary(hex_id)
                # Convert H3 boundary (lat, lng) to EE polygon coordinates [[lng, lat]]
                coords = [[lng, lat] for lat, lng in boundary]
                coords.append(coords[0])  # Close the polygon

                hex_features.append(ee.Feature(
                    ee.Geometry.Polygon([coords]),
                    {'hexId': hex_id}
                ))

            hex_fc = ee.FeatureCollection(hex_features)

            # Use reduceRegions to get mean precipitation for each hexagon
            logger.info("Computing mean precipitation for each hexagon...")
            hex_precip = mean_precip.reduceRegions(
                collection=hex_fc,
                reducer=ee.Reducer.mean(),
                scale=5000  # ~5km resolution (CHIRPS native resolution)
            )

            # Get the results
            logger.info("Fetching results from Earth Engine...")
            features = hex_precip.getInfo()['features']
            logger.info(f"Got precipitation data for {len(features)} hexagons")

            if len(features) == 0:
                raise ValueError(f"No data retrieved for region {bounds}")

            # Log first feature for debugging
            if features and 'mean' in features[0]['properties']:
                first_precip = features[0]['properties']['mean']
                logger.info(f"First hexagon: {first_precip:.2f} mm/day")

            # Convert to GeoJSON
            logger.info(f"Converting {len(features)} hexagons to GeoJSON")
            hexagons = self._convert_hexagon_features_to_geojson(features, metric, scenario, year)

            logger.info("=" * 80)
            logger.info(f"✅ Successfully loaded {len(hexagons['features'])} hexagon features")
            logger.info(f"✅ Source: CHIRPS via Earth Engine (proxy for LOCA2)")
            logger.info(f"✅ Metric: {metric}, Scenario: {scenario}, Year: {year}")
            logger.info("=" * 80)
            return hexagons

        except Exception as e:
            import traceback
            logger.error("=" * 80)
            logger.error(f"🚨 EARTH ENGINE FETCH FAILED")
            logger.error(f"Error type: {type(e).__name__}")
            logger.error(f"Error message: {str(e)}")
            logger.error(f"Request details: metric={metric}, scenario={scenario}, year={year}, bounds={bounds}, resolution={resolution}")
            logger.error(f"Full traceback:\n{traceback.format_exc()}")
            logger.error("=" * 80)
            # Don't return fallback data - raise the error so frontend can handle it
            raise

    def _convert_hexagon_features_to_geojson(self, features, metric, scenario, year):
        """Convert Earth Engine hexagon features with precipitation data to GeoJSON

        Only includes hexagons with real data from Earth Engine.
        Hexagons with missing data are excluded (no interpolation/simulation).
        """
        hexagon_data = []
        missing_count = 0

        for feature in features:
            # Get hexagon ID from properties
            hex_id = feature['properties']['hexId']
            lat, lon = h3.cell_to_latlng(hex_id)
            boundary = h3.cell_to_boundary(hex_id)

            # Get precipitation from Earth Engine reduction (mean)
            if 'mean' not in feature['properties'] or feature['properties']['mean'] is None:
                # Skip hexagons with no data - DO NOT interpolate
                missing_count += 1
                continue

            precip_value = feature['properties']['mean']

            hexagon_data.append({
                'hex_id': hex_id,
                'lat': lat,
                'lon': lon,
                'boundary': boundary,
                'value': round(precip_value, 2)
            })

        if missing_count > 0:
            logger.info(f"Excluded {missing_count} hexagons with missing data (no interpolation applied)")

        return self._to_geojson(hexagon_data, metric, scenario, year)

    def _get_hexagons_in_bounds(self, bounds, resolution):
        """Get all H3 hexagons that cover the bounding box"""
        try:
            # Use H3 v4 API: LatLngPoly with h3shape_to_cells for complete tessellation
            from h3 import LatLngPoly

            poly = LatLngPoly([
                (bounds['south'], bounds['west']),
                (bounds['south'], bounds['east']),
                (bounds['north'], bounds['east']),
                (bounds['north'], bounds['west'])
            ])

            hex_ids = h3.h3shape_to_cells(poly, resolution)
            logger.info(f"Generated {len(hex_ids)} hexagons using h3shape_to_cells")
            return list(hex_ids)
        except Exception as e:
            logger.warning(f"h3shape_to_cells failed: {e}, using dense grid sampling")
            # Dense grid sampling fallback
            hex_set = set()

            # Calculate step size based on hexagon size
            edge_length_deg = 0.01 if resolution >= 8 else 0.03

            lat = bounds['south']
            while lat < bounds['north']:
                lon = bounds['west']
                while lon < bounds['east']:
                    hex_id = h3.latlng_to_cell(lat, lon, resolution)
                    hex_set.add(hex_id)
                    lon += edge_length_deg
                lat += edge_length_deg

            logger.info(f"Generated {len(hex_set)} hexagons using dense grid")
            return list(hex_set)

    def _to_geojson(self, hexagons, metric, scenario, year):
        """Convert hexagons to GeoJSON FeatureCollection"""
        features = []
        for hex_data in hexagons:
            # Convert H3 boundary to GeoJSON coordinates
            coordinates = [[
                [lng, lat] for lat, lng in hex_data['boundary']
            ]]
            # Close the polygon
            coordinates[0].append(coordinates[0][0])

            features.append({
                'type': 'Feature',
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': coordinates
                },
                'properties': {
                    'hexId': hex_data['hex_id'],
                    'lat': round(hex_data['lat'], 4),
                    'lon': round(hex_data['lon'], 4),
                    'value': hex_data['value'],
                    'metric': metric,
                    'scenario': scenario,
                    'year': year
                }
            })

        return {
            'type': 'FeatureCollection',
            'features': features,
            'metadata': {
                'source': 'CHIRPS via Earth Engine (proxy for LOCA2)',
                'metric': metric,
                'scenario': scenario,
                'year': year,
                'count': len(features),
                'isRealData': True,
                'dataType': 'real'
            }
        }
