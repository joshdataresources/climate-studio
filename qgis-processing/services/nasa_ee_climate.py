"""
NASA NEX-GDDP-CMIP6 Climate Data Service using Google Earth Engine

Fetches and processes temperature projection data from NASA's NEX-GDDP-CMIP6 dataset
via Google Earth Engine for fast, reliable access.

Data source: NASA/GDDP-CMIP6 on Google Earth Engine
Documentation: https://developers.google.com/earth-engine/datasets/catalog/NASA_GDDP-CMIP6
"""

import ee
import h3
from shapely.geometry import Polygon
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class NASAEEClimateService:
    """Service for fetching NASA NEX-GDDP-CMIP6 climate projections via Earth Engine"""

    # Model selection - using ACCESS-CM2 as default
    DEFAULT_MODEL = "ACCESS-CM2"

    # Scenario mapping
    SCENARIOS = {
        'rcp26': 'ssp126',  # Low emissions
        'rcp45': 'ssp245',  # Moderate emissions
        'rcp85': 'ssp585'   # High emissions
    }

    # Baseline temperature for anomaly calculation (1986-2005 average, °C)
    BASELINE_TEMP_C = 14.5

    def __init__(self, ee_project=None):
        """Initialize NASA Climate Service with Earth Engine"""
        self.initialized = False
        self.ee_project = ee_project
        self._initialize_ee()

    def _initialize_ee(self):
        """Initialize Google Earth Engine"""
        try:
            if self.ee_project:
                ee.Initialize(project=self.ee_project)
            else:
                ee.Initialize()
            self.initialized = True
            logger.info("Earth Engine initialized for NASA climate data")
        except Exception as e:
            logger.error(f"Failed to initialize Earth Engine: {e}")
            self.initialized = False

    def get_temperature_projection(self, bounds, year=2050, scenario='rcp45', resolution=7):
        """
        Get temperature projection data for a bounding box

        Args:
            bounds: Dict with keys 'north', 'south', 'east', 'west' (degrees)
            year: Projection year (2015-2100)
            scenario: Climate scenario ('rcp26', 'rcp45', 'rcp85')
            resolution: H3 hexagon resolution (0-15, default 7 = ~5km diameter)

        Returns:
            GeoJSON FeatureCollection with hexagonal temperature data
        """
        if not self.initialized:
            logger.error("Earth Engine not initialized, attempting re-initialization")
            self._initialize_ee()

        if not self.initialized:
            raise RuntimeError(
                "Google Earth Engine is not initialized; cannot serve simulated temperature data."
            )

        try:
            logger.info(f"Fetching NASA EE data: year={year}, scenario={scenario}, bounds={bounds}")

            # Map RCP to SSP scenario
            ssp_scenario = self.SCENARIOS.get(scenario, 'ssp245')
            logger.info(f"Mapped {scenario} to {ssp_scenario}")

            # Get the dataset
            dataset = ee.ImageCollection('NASA/GDDP-CMIP6')
            logger.info("Got dataset")

            # Filter by model, scenario, and year
            filtered = dataset.filter(ee.Filter.eq('model', self.DEFAULT_MODEL)) \
                             .filter(ee.Filter.eq('scenario', ssp_scenario)) \
                             .filter(ee.Filter.calendarRange(year, year, 'year'))

            count = filtered.size().getInfo()
            logger.info(f"Filtered to {count} images for {self.DEFAULT_MODEL}, {ssp_scenario}, {year}")

            if count == 0:
                raise ValueError(f"No images found for {self.DEFAULT_MODEL}, {ssp_scenario}, {year}")

            # Get tasmax (maximum temperature)
            tasmax = filtered.select('tasmax')

            # Calculate mean temperature for the year
            mean_tasmax = tasmax.mean()
            logger.info("Calculated mean tasmax")

            # Create region of interest
            region = ee.Geometry.Rectangle([
                bounds['west'], bounds['south'],
                bounds['east'], bounds['north']
            ])
            logger.info(f"Created region: {region.bounds().getInfo()}")

            # Get hexagons first
            logger.info(f"Generating hexagons at resolution {resolution}")
            hex_ids = self._get_hexagons_in_bounds(bounds, resolution)
            logger.info(f"Generated {len(hex_ids)} hexagons, fetching NASA data for each...")

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

            # Use reduceRegions to get mean temperature for each hexagon
            logger.info("Computing mean temperature for each hexagon...")
            hex_temps = mean_tasmax.reduceRegions(
                collection=hex_fc,
                reducer=ee.Reducer.mean(),
                scale=27830  # ~25km resolution (native NEX-GDDP resolution)
            )

            # Get the results
            logger.info("Fetching results from Earth Engine...")
            features = hex_temps.getInfo()['features']
            logger.info(f"Got temperature data for {len(features)} hexagons")

            if len(features) == 0:
                raise ValueError(f"No data retrieved for region {bounds}")

            # Log first feature for debugging
            if features and 'mean' in features[0]['properties']:
                first_temp_k = features[0]['properties']['mean']
                first_temp_c = first_temp_k - 273.15
                logger.info(f"First hexagon: {first_temp_k:.2f}K = {first_temp_c:.2f}°C")

            # Convert to GeoJSON
            logger.info(f"Converting {len(features)} hexagons to GeoJSON")
            hexagons = self._convert_hexagon_features_to_geojson(features, year, scenario, ssp_scenario)

            logger.info(f"Successfully created {len(hexagons['features'])} hexagon features")
            return hexagons

        except Exception as e:
            import traceback
            logger.error(f"Error fetching NASA EE data: {type(e).__name__}: {str(e)}")
            logger.error(f"Traceback: {traceback.format_exc()}")
            # Return error to client instead of fallback data
            raise

    def _convert_hexagon_features_to_geojson(self, features, year, scenario, ssp_scenario):
        """Convert Earth Engine hexagon features with temperature data to GeoJSON"""
        hexagon_data = []

        for feature in features:
            # Get hexagon ID from properties
            hex_id = feature['properties']['hexId']

            # Get temperature from Earth Engine reduction (mean)
            if 'mean' not in feature['properties'] or feature['properties']['mean'] is None:
                # Skip hexagons with no data (e.g., over ocean)
                continue

            tasmax_k = feature['properties']['mean']

            # Convert from Kelvin to Celsius
            temp_c = tasmax_k - 273.15

            # Calculate anomaly relative to baseline
            anomaly = temp_c - self.BASELINE_TEMP_C

            # Get hexagon geometry
            lat, lon = h3.cell_to_latlng(hex_id)
            boundary = h3.cell_to_boundary(hex_id)

            hexagon_data.append({
                'hex_id': hex_id,
                'lat': lat,
                'lon': lon,
                'boundary': boundary,
                'temp_anomaly': round(anomaly, 2),
                'temp_anomaly_f': round(anomaly * 1.8, 2)
            })

        return self._to_geojson(hexagon_data, year, scenario, ssp_scenario)

    def _get_hexagons_in_bounds(self, bounds, resolution):
        """Get all H3 hexagons that cover the bounding box"""
        try:
            # Use H3 v4 API: LatLngPoly with h3shape_to_cells for complete tessellation
            # LatLngPoly expects (lat, lng) tuples
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
            # Dense grid sampling fallback to ensure complete coverage
            hex_set = set()

            # Calculate step size based on hexagon size at this resolution
            # H3 resolution approximate edge lengths (km): res7=~1.2km, res8=~0.4km
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

    def _to_geojson(self, hexagons, year, scenario, ssp_scenario):
        """Convert hexagons to GeoJSON FeatureCollection"""
        features = []
        for hex_data in hexagons:
            # Convert H3 boundary to GeoJSON coordinates
            # H3 returns (lat, lng), GeoJSON needs [lng, lat]
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
                    'tempAnomaly': hex_data['temp_anomaly'],
                    'tempAnomalyF': hex_data['temp_anomaly_f'],
                    'projected': round(self.BASELINE_TEMP_C + hex_data['temp_anomaly'], 2),
                    'scenario': scenario,
                    'sspScenario': ssp_scenario,
                    'year': year,
                    'model': self.DEFAULT_MODEL
                }
            })

        return {
            'type': 'FeatureCollection',
            'features': features,
            'metadata': {
                'source': 'NASA NEX-GDDP-CMIP6 via Earth Engine',
                'model': self.DEFAULT_MODEL,
                'scenario': ssp_scenario,
                'year': year,
                'baselineTemp': self.BASELINE_TEMP_C,
                'count': len(features)
            }
        }
