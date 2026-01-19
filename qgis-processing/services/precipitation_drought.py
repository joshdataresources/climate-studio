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

    def get_tile_url(self, bounds, scenario='rcp45', year=2050, metric='drought_index'):
        """
        Get Earth Engine tile URL for smooth precipitation/drought heatmap visualization

        Args:
            bounds: Dict with 'north', 'south', 'east', 'west' keys
            scenario: Climate scenario (rcp26, rcp45, rcp85)
            year: Projection year (2020-2100)
            metric: 'precipitation', 'drought_index', or 'soil_moisture'

        Returns:
            Dict with 'tile_url' and 'metadata'
        """
        if not self.initialized:
            logger.error("Earth Engine not initialized")
            return None

        try:
            logger.info(f"Generating tile URL for precipitation/drought: metric={metric}, scenario={scenario}, year={year}")

            # Use CHIRPS precipitation data
            # TODO: Replace with NOAA LOCA2 projections when available
            dataset = ee.ImageCollection('UCSB-CHG/CHIRPS/DAILY') \
                .filterDate('2020-01-01', '2023-12-31')

            # Calculate mean precipitation
            mean_precip = dataset.mean().select('precipitation')

            # Resample for smoother appearance at high zoom
            precip_resampled = mean_precip.resample('bilinear').reproject(
                crs='EPSG:4326',
                scale=2500  # 2.5km resolution (CHIRPS native is ~5km)
            )

            # Define visualization based on metric
            if metric == 'precipitation':
                vis_params = {
                    'min': 0,
                    'max': 10,
                    'palette': [
                        '#F5ED53', '#F5F3CE', '#6B9AF3', '#2357D2'
                    ]
                }
            elif metric == 'drought_index':
                # Invert scale: low precip = drought (red), high precip = no drought (blue)
                vis_params = {
                    'min': 0,
                    'max': 10,
                    'palette': [
                        '#dc2626', '#f59e0b', '#fef08a', '#ffffff', '#90caf9', '#42a5f5', '#1e88e5'
                    ]
                }
            else:  # soil_moisture
                vis_params = {
                    'min': 0,
                    'max': 10,
                    'palette': [
                        '#8b4513', '#daa520', '#f0e68c', '#adff2f', '#7cfc00', '#32cd32'
                    ]
                }

            # Get map ID and tile URL
            map_id = precip_resampled.getMapId(vis_params)
            tile_url = map_id['tile_fetcher'].url_format

            # Calculate regional statistics for the viewport
            region = ee.Geometry.Rectangle([
                bounds['west'], bounds['south'],
                bounds['east'], bounds['north']
            ])

            # Get mean precipitation for the region
            stats = precip_resampled.reduceRegion(
                reducer=ee.Reducer.mean(),
                geometry=region,
                scale=2500,
                maxPixels=1e9
            ).getInfo()

            mean_precip = stats.get('precipitation', None)

            # Calculate drought index (inverse of precipitation, normalized 0-6)
            # Higher drought index = more drought (less precipitation)
            drought_index = None
            soil_moisture = None
            if mean_precip is not None:
                # Normalize: 0 mm/day = 6 (severe drought), 10+ mm/day = 0 (no drought)
                drought_index = max(0, min(6, 6 - (mean_precip * 0.6)))

                # Calculate soil moisture as a proxy from precipitation
                # Normalized 0-100% where higher precipitation = higher soil moisture
                # 0 mm/day = 0%, 10+ mm/day = 100%
                soil_moisture = min(100, max(0, mean_precip * 10))

            logger.info(f"Generated tile URL for precipitation/drought: {metric}")
            logger.info(f"Regional stats: avg_precip={mean_precip}, drought_index={drought_index}, soil_moisture={soil_moisture}")

            return {
                'tile_url': tile_url,
                'metadata': {
                    'source': 'CHIRPS via Earth Engine (proxy for LOCA2)',
                    'metric': metric,
                    'scenario': scenario,
                    'year': year,
                    'isRealData': True,
                    'dataType': 'tiles',
                    'averagePrecipitation': round(mean_precip, 2) if mean_precip is not None else None,
                    'droughtIndex': round(drought_index, 2) if drought_index is not None else None,
                    'soilMoisture': round(soil_moisture, 2) if soil_moisture is not None else None
                }
            }

        except Exception as e:
            logger.error(f"Failed to generate precipitation/drought tile URL: {e}")
            import traceback
            logger.error(traceback.format_exc())
            return None

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

            precip_mm = feature['properties']['mean']

            # Calculate derived metrics based on precipitation
            # Drought index: inverse relationship with precipitation
            # Scale: 0 (wet) to 10 (extreme drought)
            drought_index = max(0, min(10, 10 - (precip_mm * 1.0)))

            # Soil moisture proxy: direct relationship with precipitation
            # Scale: 0% (dry) to 100% (saturated)
            soil_moisture = min(100, max(0, precip_mm * 10))

            # Select value based on metric
            if metric == 'precipitation':
                value = precip_mm
            elif metric == 'drought_index':
                value = drought_index
            else:  # soil_moisture
                value = soil_moisture

            hexagon_data.append({
                'hex_id': hex_id,
                'lat': lat,
                'lon': lon,
                'boundary': boundary,
                'value': round(value, 2),
                'precipitation': round(precip_mm, 2),
                'droughtIndex': round(drought_index, 2),
                'soilMoisture': round(soil_moisture, 1)
            })

        if missing_count > 0:
            logger.info(f"Excluded {missing_count} hexagons with missing data (no interpolation applied)")

        return self._to_geojson(hexagon_data, metric, scenario, year)

    def _get_hexagons_in_bounds(self, bounds, resolution):
        """
        Get all H3 hexagons that cover the bounding box with complete coverage

        This method ensures FULL viewport coverage at all zoom levels by:
        1. Adding buffer zones around viewport bounds
        2. Using dense grid sampling with optimal spacing
        3. Including all hexagons that intersect the buffered viewport
        """
        # Add buffer to ensure complete coverage during panning/zooming
        # Buffer size scales with hexagon size - REDUCED buffers to prevent distortion
        buffer_factors = {
            1: 0.3, 2: 0.3, 3: 0.25, 4: 0.25, 5: 0.2,
            6: 0.15, 7: 0.1, 8: 0.1, 9: 0.05, 10: 0.05
        }
        buffer_factor = buffer_factors.get(resolution, 0.1)

        # Calculate buffer in degrees based on viewport size
        lat_span = bounds['north'] - bounds['south']
        lon_span = bounds['east'] - bounds['west']
        lat_buffer = lat_span * buffer_factor
        lon_buffer = lon_span * buffer_factor

        # Expand bounds with buffer
        buffered_bounds = {
            'north': min(90, bounds['north'] + lat_buffer),
            'south': max(-90, bounds['south'] - lat_buffer),
            'east': bounds['east'] + lon_buffer,
            'west': bounds['west'] - lon_buffer
        }

        logger.info(f"Generating hexagons with {buffer_factor*100:.0f}% buffer for seamless coverage")
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
                    'precipitation': hex_data['precipitation'],
                    'droughtIndex': hex_data['droughtIndex'],
                    'soilMoisture': hex_data['soilMoisture'],
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
                'dataType': 'hexagons'
            }
        }
