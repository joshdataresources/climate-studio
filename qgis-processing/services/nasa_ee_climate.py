"""
NASA NEX-GDDP-CMIP6 Climate Data Service using Google Earth Engine

Fetches and processes temperature projection data from NASA's NEX-GDDP-CMIP6 dataset
via Google Earth Engine for fast, reliable access.

Data source: NASA/GDDP-CMIP6 on Google Earth Engine
Documentation: https://developers.google.com/earth-engine/datasets/catalog/NASA_GDDP-CMIP6
"""

import ee
import numpy as np
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
        """Initialize Google Earth Engine with service account or user credentials"""
        import os
        try:
            # Try service account credentials first
            sa_key = os.getenv('GOOGLE_APPLICATION_CREDENTIALS')
            sa_email = os.getenv('EE_SERVICE_ACCOUNT')
            if sa_key and sa_email and os.path.exists(sa_key):
                credentials = ee.ServiceAccountCredentials(sa_email, sa_key)
                ee.Initialize(credentials, project=self.ee_project)
                logger.info(f"Earth Engine initialized with service account: {sa_email}")
            elif self.ee_project:
                ee.Initialize(project=self.ee_project)
                logger.info("Earth Engine initialized with user credentials")
            else:
                ee.Initialize()
                logger.info("Earth Engine initialized with default credentials")
            self.initialized = True
        except Exception as e:
            logger.error(f"Failed to initialize Earth Engine: {e}")
            self.initialized = False

    def get_tile_url(self, bounds, year=2050, scenario='rcp45', mode='anomaly'):
        """
        Get Earth Engine tile URL for smooth heatmap visualization

        Args:
            bounds: Dict with 'north', 'south', 'east', 'west' keys
            year: Projection year (2015-2100)
            scenario: Climate scenario ('rcp26', 'rcp45', 'rcp85')
            mode: 'anomaly' or 'actual' temperature display

        Returns:
            Dict with 'tile_url' and 'metadata'
        """
        if not self.initialized:
            logger.error("Earth Engine not initialized")
            return None

        try:
            # Map RCP to SSP scenario
            ssp_scenario = self.SCENARIOS.get(scenario, 'ssp245')

            # Get the dataset
            dataset = ee.ImageCollection('NASA/GDDP-CMIP6')

            # Filter by model, scenario, and year
            filtered = dataset.filter(ee.Filter.eq('model', self.DEFAULT_MODEL)) \
                             .filter(ee.Filter.eq('scenario', ssp_scenario)) \
                             .filter(ee.Filter.calendarRange(year, year, 'year'))

            # Get tasmax (maximum temperature) and calculate mean for the year
            mean_tasmax = filtered.select('tasmax').mean()

            # Convert from Kelvin to Celsius
            temp_c = mean_tasmax.subtract(273.15)

            # Calculate anomaly or use actual temperature
            if mode == 'anomaly':
                temp_display = temp_c.subtract(self.BASELINE_TEMP_C)
                # White to red gradient for temperature anomaly
                vis_params = {
                    'min': 0,
                    'max': 8,
                    'palette': [
                        '#ffffff', '#fefce8', '#fef9c3', '#fef08a', '#fde047', '#facc15',
                        '#f59e0b', '#fb923c', '#f97316', '#ea580c', '#dc2626', '#ef4444',
                        '#dc2626', '#b91c1c', '#991b1b', '#7f1d1d'
                    ]
                }
            else:
                temp_display = temp_c
                # Blue to red gradient for actual temperature
                vis_params = {
                    'min': 10,
                    'max': 40,
                    'palette': [
                        '#1e3a8a', '#3b82f6', '#fef08a', '#fb923c', '#ef4444', '#7f1d1d', '#450a0a'
                    ]
                }

            # Resample to higher resolution with bilinear interpolation for smoother appearance at high zoom
            # Native resolution is ~25km, resample to ~5km for better visual quality
            temp_display_resampled = temp_display.resample('bilinear').reproject(
                crs='EPSG:4326',
                scale=5000  # 5km resolution
            )

            # Get map ID and tile URL
            map_id = temp_display_resampled.getMapId(vis_params)
            tile_url = map_id['tile_fetcher'].url_format

            # Calculate regional statistics for the viewport
            region = ee.Geometry.Rectangle([
                bounds['west'], bounds['south'],
                bounds['east'], bounds['north']
            ])

            # Get mean temperature for the region
            stats = temp_display_resampled.reduceRegion(
                reducer=ee.Reducer.mean(),
                geometry=region,
                scale=5000,
                maxPixels=1e9
            ).getInfo()

            mean_temp = stats.get('tasmax', None)

            # Calculate average temperature and anomaly
            if mode == 'anomaly':
                average_anomaly = mean_temp if mean_temp is not None else None
                average_temperature = (mean_temp + self.BASELINE_TEMP_C) if mean_temp is not None else None
            else:
                average_temperature = mean_temp
                average_anomaly = (mean_temp - self.BASELINE_TEMP_C) if mean_temp is not None else None

            logger.info(f"Generated tile URL for NASA temperature: {year}, {scenario}, mode={mode}")
            logger.info(f"Regional stats: avg_temp={average_temperature}, avg_anomaly={average_anomaly}")

            return {
                'tile_url': tile_url,
                'metadata': {
                    'source': 'NASA NEX-GDDP-CMIP6 via Earth Engine',
                    'model': self.DEFAULT_MODEL,
                    'scenario': scenario,
                    'ssp_scenario': ssp_scenario,
                    'year': year,
                    'mode': mode,
                    'isRealData': True,
                    'dataType': 'tiles',
                    'averageTemperature': round(average_temperature, 2) if average_temperature is not None else None,
                    'averageAnomaly': round(average_anomaly, 2) if average_anomaly is not None else None
                }
            }

        except Exception as e:
            logger.error(f"Failed to generate tile URL: {e}")
            import traceback
            logger.error(traceback.format_exc())
            return None

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
            logger.error("Earth Engine not initialized - cannot fetch temperature data")
            raise RuntimeError("Earth Engine not initialized. Please check server configuration and Earth Engine authentication.")

        # Validate bounding box size to prevent huge requests when zoomed way out
        # Earth Engine has a 5000 element limit for reduceRegions
        lat_span = bounds['north'] - bounds['south']
        lon_span = bounds['east'] - bounds['west']

        # Calculate approximate number of hexagons
        # H3 resolution area approximations (km²): expanded to support res 1-10
        resolution_area_km2 = {
            1: 600000,   # Very large hexagons for global/continental view
            2: 86000,    # Continental
            3: 12000,    # Multi-country
            4: 1700,     # Country/multi-state
            5: 240,      # State/regional
            6: 34,       # Metropolitan
            7: 4.8,      # City
            8: 0.7,      # Neighborhood
            9: 0.1,      # Street level
            10: 0.014    # Building level
        }
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
                f"Please zoom in closer to see temperature data."
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

            logger.info("=" * 80)
            logger.info(f"✅ REAL NASA DATA: Successfully loaded {len(hexagons['features'])} hexagon features")
            logger.info(f"✅ Source: NASA NEX-GDDP-CMIP6 via Earth Engine")
            logger.info(f"✅ Model: {self.DEFAULT_MODEL}, Scenario: {ssp_scenario}, Year: {year}")
            logger.info("=" * 80)
            return hexagons

        except Exception as e:
            import traceback
            logger.error("=" * 80)
            logger.error(f"🚨 NASA EARTH ENGINE FETCH FAILED")
            logger.error(f"Error type: {type(e).__name__}")
            logger.error(f"Error message: {str(e)}")
            logger.error(f"Request details: year={year}, scenario={scenario}, bounds={bounds}, resolution={resolution}")
            logger.error(f"Full traceback:\n{traceback.format_exc()}")
            logger.error("=" * 80)
            # Don't return fallback data - raise the error so frontend can handle it
            raise

    def _convert_hexagon_features_to_geojson(self, features, year, scenario, ssp_scenario):
        """Convert Earth Engine hexagon features with temperature data to GeoJSON

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

            # Get temperature from Earth Engine reduction (mean)
            if 'mean' not in feature['properties'] or feature['properties']['mean'] is None:
                # Skip hexagons with no data - DO NOT interpolate
                missing_count += 1
                continue

            tasmax_k = feature['properties']['mean']

            # Convert from Kelvin to Celsius
            temp_c = tasmax_k - 273.15

            # Calculate anomaly relative to baseline
            anomaly = temp_c - self.BASELINE_TEMP_C

            hexagon_data.append({
                'hex_id': hex_id,
                'lat': lat,
                'lon': lon,
                'boundary': boundary,
                'temp_anomaly': round(anomaly, 2),
                'temp_anomaly_f': round(anomaly * 1.8, 2)
            })

        if missing_count > 0:
            logger.info(f"Excluded {missing_count} hexagons with missing data (no interpolation applied)")

        return self._to_geojson(hexagon_data, year, scenario, ssp_scenario)

    def _get_hexagons_in_bounds(self, bounds, resolution):
        """
        Get all H3 hexagons that cover the bounding box with complete coverage

        Uses minimal buffering to prevent Earth Engine quota errors while still
        providing seamless coverage during panning.
        """
        # Very aggressive buffers to ensure hexagons reach all viewport edges
        # While staying under Earth Engine's 5000 hexagon limit
        # Must extend beyond viewport in all directions for complete coverage
        buffer_factors = {
            1: 1.0, 2: 1.0, 3: 0.9, 4: 0.85, 5: 0.75,
            6: 0.65, 7: 0.55, 8: 0.45, 9: 0.35, 10: 0.25
        }
        buffer_factor = buffer_factors.get(resolution, 0.50)

        # Calculate buffer in degrees based on viewport size
        lat_span = bounds['north'] - bounds['south']
        lon_span = bounds['east'] - bounds['west']
        lat_buffer = lat_span * buffer_factor
        lon_buffer = lon_span * buffer_factor

        # Expand bounds with minimal buffer
        buffered_bounds = {
            'north': min(90, bounds['north'] + lat_buffer),
            'south': max(-90, bounds['south'] - lat_buffer),
            'east': bounds['east'] + lon_buffer,
            'west': bounds['west'] - lon_buffer
        }

        logger.info(f"Generating hexagons with {buffer_factor*100:.0f}% buffer")
        logger.info(f"Original: N={bounds['north']:.3f} S={bounds['south']:.3f} E={bounds['east']:.3f} W={bounds['west']:.3f}")
        logger.info(f"Buffered: N={buffered_bounds['north']:.3f} S={buffered_bounds['south']:.3f} E={buffered_bounds['east']:.3f} W={buffered_bounds['west']:.3f}")

        try:
            # Use H3 v4 API: LatLngPoly with h3shape_to_cells for complete tessellation
            from h3 import LatLngPoly

            poly = LatLngPoly([
                (buffered_bounds['south'], buffered_bounds['west']),
                (buffered_bounds['south'], buffered_bounds['east']),
                (buffered_bounds['north'], buffered_bounds['east']),
                (buffered_bounds['north'], buffered_bounds['west'])
            ])

            hex_ids = h3.h3shape_to_cells(poly, resolution)
            logger.info(f"✅ Generated {len(hex_ids)} hexagons using h3shape_to_cells (with buffer)")
            return list(hex_ids)
        except Exception as e:
            logger.warning(f"h3shape_to_cells failed: {e}, using complete grid tessellation")

            # COMPLETE grid tessellation - ensures no gaps in coverage
            hex_set = set()

            # Calculate optimal step size for complete coverage
            # Step size must be smaller than hexagon diameter to prevent gaps
            # H3 hexagon edge lengths (approximate, in degrees at equator)
            edge_length_map = {
                1: 4.0,    # ~470 km
                2: 1.5,    # ~170 km
                3: 0.5,    # ~60 km
                4: 0.2,    # ~22 km
                5: 0.075,  # ~8 km
                6: 0.028,  # ~3 km
                7: 0.010,  # ~1.2 km
                8: 0.004,  # ~400 m
                9: 0.0015, # ~150 m
                10: 0.0005 # ~50 m
            }

            # Use step size that's 40% of edge length to ensure overlapping coverage
            base_step = edge_length_map.get(resolution, 0.01)
            step_size = base_step * 0.4

            logger.info(f"Using step size: {step_size:.6f}° for resolution {resolution}")

            # Generate dense grid
            lat = buffered_bounds['south']
            while lat <= buffered_bounds['north']:
                lon = buffered_bounds['west']
                while lon <= buffered_bounds['east']:
                    hex_id = h3.latlng_to_cell(lat, lon, resolution)
                    hex_set.add(hex_id)
                    lon += step_size
                lat += step_size

            logger.info(f"✅ Generated {len(hex_set)} hexagons using complete grid tessellation (with buffer)")
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
                'count': len(features),
                'isRealData': True,
                'dataType': 'real'
            }
        }
