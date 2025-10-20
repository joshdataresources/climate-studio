"""
Landsat Land Surface Temperature Service

Fetches real Landsat 8/9 surface temperature data from Google Earth Engine
and calculates urban heat island intensity.
"""

import ee
import numpy as np
from datetime import datetime, timedelta
import logging
import os

logger = logging.getLogger(__name__)


class LandsatLSTService:
    """Service for fetching real Landsat surface temperature data"""

    def __init__(self):
        self.initialized = False
        self.cached_tiles = {}  # Cache tiles by season
        self._initialize_ee()

    def _initialize_ee(self):
        """Initialize Google Earth Engine"""
        try:
            # Try to initialize with a cloud project
            # First, try to use environment variable
            project = os.environ.get('EARTHENGINE_PROJECT')

            if project:
                logger.info(f"Initializing Earth Engine with project: {project}")
                ee.Initialize(project=project)
            else:
                # Try common project patterns or use default
                # You can also use ee.Initialize(opt_url='https://earthengine-highvolume.googleapis.com')
                logger.info("Initializing Earth Engine with default settings")
                try:
                    # Try new API first (requires project)
                    ee.Initialize()
                except Exception as e1:
                    # Fall back to high volume endpoint which may not require project
                    logger.info("Trying high volume endpoint")
                    ee.Initialize(opt_url='https://earthengine-highvolume.googleapis.com')

            self.initialized = True
            logger.info("Google Earth Engine initialized successfully")
        except Exception as e:
            logger.warning(f"Could not initialize Earth Engine: {e}")
            logger.warning("Urban Heat Island will use simulated data. To use real data:")
            logger.warning("1. Create a Google Cloud project with Earth Engine enabled")
            logger.warning("2. Set environment variable: export EARTHENGINE_PROJECT='your-project-id'")
            logger.warning("3. Or authenticate: earthengine authenticate")
            self.initialized = False

    def get_lst_data(self, bounds, date=None, days_back=30):
        """
        Fetch Landsat surface temperature data and calculate urban heat island intensity
        Returns data as a complete hexagonal grid covering the viewport

        Args:
            bounds: Dict with 'north', 'south', 'east', 'west' keys
            date: ISO date string (YYYY-MM-DD), optional - defaults to most recent
            days_back: Number of days to look back for cloud-free imagery

        Returns:
            Dict with 'hexagons' (list of hex data) and 'metadata'
        """
        if not self.initialized:
            logger.warning("Earth Engine not initialized, returning None")
            return None

        try:
            import h3

            # Define region of interest
            roi = ee.Geometry.Rectangle([
                bounds['west'], bounds['south'],
                bounds['east'], bounds['north']
            ])

            # Set date range
            if date:
                end_date = datetime.fromisoformat(date)
            else:
                end_date = datetime.now()

            start_date = end_date - timedelta(days=days_back)

            # Get Landsat 8/9 Collection 2 Level 2 data
            landsat8 = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2')
            landsat9 = ee.ImageCollection('LANDSAT/LC09/C02/T1_L2')

            # Merge collections
            collection = landsat8.merge(landsat9)

            # Filter by date, region, and cloud cover
            collection = (collection
                .filterDate(start_date.strftime('%Y-%m-%d'), end_date.strftime('%Y-%m-%d'))
                .filterBounds(roi)
                .filter(ee.Filter.lt('CLOUD_COVER', 20))
            )

            # Get the most recent image
            image = collection.sort('system:time_start', False).first()

            if image is None:
                logger.warning("No Landsat images found for the specified date range")
                return None

            # Get surface temperature band (ST_B10)
            # Convert from Kelvin * 0.00341802 + 149.0 to Celsius
            lst = image.select('ST_B10').multiply(0.00341802).add(149.0).subtract(273.15)

            # Calculate urban mask using NDVI
            # Bands for Landsat 8/9: NIR=SR_B5, Red=SR_B4
            ndvi = image.normalizedDifference(['SR_B5', 'SR_B4'])

            # Urban areas typically have NDVI < 0.2
            urban_mask = ndvi.lt(0.2)
            rural_mask = ndvi.gt(0.4)

            # Calculate mean temperatures
            urban_temp = lst.updateMask(urban_mask).reduceRegion(
                reducer=ee.Reducer.mean(),
                geometry=roi,
                scale=30,
                maxPixels=1e9
            ).get('ST_B10')

            rural_temp = lst.updateMask(rural_mask).reduceRegion(
                reducer=ee.Reducer.mean(),
                geometry=roi,
                scale=30,
                maxPixels=1e9
            ).get('ST_B10')

            # Calculate UHI intensity
            uhi_intensity = lst.subtract(ee.Image.constant(rural_temp))

            # Create complete hexagonal grid covering the viewport
            import h3

            # Use resolution 8 for better performance (larger hexagons, fewer of them)
            h3_resolution = 8  # ~461m edge, good balance of detail and performance

            # Get all hexagons that cover the bounding box
            polygon = [
                [bounds['west'], bounds['north']],
                [bounds['east'], bounds['north']],
                [bounds['east'], bounds['south']],
                [bounds['west'], bounds['south']],
                [bounds['west'], bounds['north']]
            ]

            polygon_geojson = {
                'type': 'Polygon',
                'coordinates': [polygon]
            }

            # Get complete grid of hexagons
            hex_ids = list(h3.geo_to_cells(polygon_geojson, h3_resolution))
            logger.info(f"Creating complete grid of {len(hex_ids)} hexagons")

            # If still too many hexagons, limit to first 4000 to stay under EE limit
            if len(hex_ids) > 4000:
                logger.warning(f"Too many hexagons ({len(hex_ids)}), limiting to 4000")
                hex_ids = hex_ids[:4000]

            # Create points at the center of each hexagon for batch sampling
            hex_centers = []
            hex_id_map = {}
            for hex_id in hex_ids:
                lat, lon = h3.cell_to_latlng(hex_id)
                hex_centers.append([lon, lat])
                hex_id_map[f"{lon},{lat}"] = {
                    'hex_id': hex_id,
                    'lat': lat,
                    'lon': lon
                }

            # Create a FeatureCollection of points for batch sampling
            points_list = [ee.Geometry.Point(coords) for coords in hex_centers]
            points_fc = ee.FeatureCollection(points_list)

            # Sample all points in one batch operation
            samples = uhi_intensity.sampleRegions(
                collection=points_fc,
                scale=30,
                geometries=True
            )

            # Convert to Python list
            features_list = samples.getInfo().get('features', [])

            if not features_list:
                logger.warning("No samples returned from Earth Engine")
                return None

            # Match samples back to hexagons
            hexagons_with_data = []
            for feature in features_list:
                coords = feature['geometry']['coordinates']
                intensity = feature['properties'].get('ST_B10')

                if intensity is not None:
                    lon, lat = coords[0], coords[1]
                    key = f"{lon},{lat}"
                    if key in hex_id_map:
                        hex_info = hex_id_map[key]
                        hexagons_with_data.append({
                            'hex_id': hex_info['hex_id'],
                            'lat': hex_info['lat'],
                            'lon': hex_info['lon'],
                            'intensity': intensity
                        })

            if not hexagons_with_data:
                logger.warning("No hexagons with valid LST data")
                return None

            # Get image metadata
            image_info = image.getInfo()
            acquisition_date = datetime.fromtimestamp(
                image_info['properties']['system:time_start'] / 1000
            ).isoformat()

            metadata = {
                'date': acquisition_date,
                'source': 'Landsat 8/9 Collection 2 Level 2',
                'urban_temp_c': urban_temp.getInfo() if urban_temp else None,
                'rural_temp_c': rural_temp.getInfo() if rural_temp else None,
                'cloud_cover': image_info['properties'].get('CLOUD_COVER'),
                'scene_id': image_info['properties'].get('LANDSAT_PRODUCT_ID'),
                'count': len(hexagons_with_data)
            }

            logger.info(f"Retrieved {len(hexagons_with_data)} hexagons with LST data")
            logger.info(f"Urban: {metadata['urban_temp_c']:.1f}°C, Rural: {metadata['rural_temp_c']:.1f}°C")

            return {
                'hexagons': hexagons_with_data,
                'metadata': metadata
            }

        except Exception as e:
            logger.error(f"Error fetching Landsat LST data: {e}", exc_info=True)
            return None

    def format_as_geojson(self, data):
        """
        Format LST hexagon data as GeoJSON FeatureCollection

        Args:
            data: Dict with 'hexagons' and 'metadata' from get_lst_data

        Returns:
            GeoJSON FeatureCollection with hexagon polygons
        """
        if not data or 'hexagons' not in data:
            return None

        import h3

        features = []
        for hex_data in data['hexagons']:
            hex_id = hex_data['hex_id']
            intensity = hex_data['intensity']

            # Classify intensity level
            level = self._classify_level(intensity)

            # Get hexagon boundary
            boundary = h3.cell_to_boundary(hex_id)

            # Convert boundary to GeoJSON format [[lon, lat], ...]
            coordinates = [[lon, lat] for lat, lon in boundary]
            coordinates.append(coordinates[0])  # Close the polygon

            features.append({
                'type': 'Feature',
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': [coordinates]
                },
                'properties': {
                    'heatIslandIntensity': round(intensity, 2),
                    'level': level,
                    'hex_id': hex_id
                }
            })

        return {
            'type': 'FeatureCollection',
            'features': features,
            'metadata': data['metadata']
        }

    def _classify_level(self, intensity):
        """Classify heat island intensity level"""
        if intensity < 0.5:
            return 'none'
        elif intensity < 1.5:
            return 'low'
        elif intensity < 3.0:
            return 'moderate'
        elif intensity < 4.5:
            return 'high'
        else:
            return 'extreme'

    def get_tile_url(self, bounds=None, season='summer', color_scheme='temperature'):
        """
        Get Earth Engine tile URL for smooth heat map visualization
        GLOBAL coverage - generates once per season and caches

        Args:
            bounds: Dict with 'north', 'south', 'east', 'west' keys (ignored, kept for API compatibility)
            season: 'summer' or 'winter' - which season to show
            color_scheme: 'temperature', 'heat', or 'urban' - color palette

        Returns:
            Dict with 'tile_url' and 'metadata', or None if failed
        """
        if not self.initialized:
            logger.warning("Earth Engine not initialized, cannot generate tiles")
            return None

        # Create cache key
        cache_key = f"{season}_{color_scheme}"

        # Return cached tile if available
        if cache_key in self.cached_tiles:
            logger.info(f"Returning cached tile URL for {season} with {color_scheme} colors")
            return self.cached_tiles[cache_key]

        try:
            # Define seasonal date ranges (Northern Hemisphere)
            current_year = datetime.now().year

            if season == 'summer':
                # June-August
                start_date = f"{current_year}-06-01"
                end_date = f"{current_year}-08-31"
                season_name = "Summer (Jun-Aug)"
            elif season == 'winter':
                # December-February (use previous year's Dec)
                start_date = f"{current_year-1}-12-01"
                end_date = f"{current_year}-02-28"
                season_name = "Winter (Dec-Feb)"
            else:
                # Default to recent data
                end_date_obj = datetime.now()
                start_date_obj = end_date_obj - timedelta(days=30)
                start_date = start_date_obj.strftime('%Y-%m-%d')
                end_date = end_date_obj.strftime('%Y-%m-%d')
                season_name = "Recent (30 days)"

            # Get Landsat 8/9 Collection 2 Level 2 data
            landsat8 = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2')
            landsat9 = ee.ImageCollection('LANDSAT/LC09/C02/T1_L2')

            # Merge collections
            collection = landsat8.merge(landsat9)

            # Filter by date and cloud cover GLOBALLY
            collection = (collection
                .filterDate(start_date, end_date)
                .filter(ee.Filter.lt('CLOUD_COVER', 20))
            )

            # Create a global mosaic - median composite for smooth coverage
            mosaic = collection.median()

            # Get surface temperature band (ST_B10)
            # Convert from Kelvin * 0.00341802 + 149.0 to Celsius
            lst = mosaic.select('ST_B10').multiply(0.00341802).add(149.0).subtract(273.15)

            # Define color schemes
            color_palettes = {
                'temperature': {
                    'min': 10, 'max': 40,
                    'palette': [
                        '#0571b0',  # 10°C - deep blue
                        '#92c5de',  # 15°C - light blue
                        '#f7f7f7',  # 20°C - white
                        '#fddbc7',  # 25°C - light orange
                        '#f4a582',  # 30°C - orange
                        '#d6604d',  # 35°C - red
                        '#b2182b'   # 40°C+ - dark red
                    ]
                },
                'heat': {
                    'min': 10, 'max': 40,
                    'palette': [
                        '#440154',  # viridis purple (cold)
                        '#3b528b',  # blue
                        '#21918c',  # teal
                        '#5ec962',  # green
                        '#fde725'   # yellow (hot)
                    ]
                },
                'urban': {
                    'min': 10, 'max': 40,
                    'palette': [
                        '#60a5fa',  # cool blue
                        '#93c5fd',  # light blue
                        '#fef08a',  # yellow
                        '#fbbf24',  # orange
                        '#fb923c',  # dark orange
                        '#ef4444',  # red
                        '#991b1b'   # dark red
                    ]
                }
            }

            # Get visualization parameters
            vis_params = color_palettes.get(color_scheme, color_palettes['temperature'])

            # Get map ID for tiles - this creates GLOBAL tiles
            map_id = lst.getMapId(vis_params)

            # Get actual image dates from collection
            image_dates = collection.aggregate_array('system:time_start').getInfo()
            if image_dates:
                actual_dates = [datetime.fromtimestamp(d / 1000).strftime('%Y-%m-%d') for d in image_dates[:10]]  # First 10 dates
                date_info = f"{len(image_dates)} images from {actual_dates[0]} to {actual_dates[-1] if len(actual_dates) > 1 else actual_dates[0]}"
            else:
                date_info = "No date information available"

            metadata = {
                'season': season_name,
                'source': 'Landsat 8/9 Collection 2 Level 2 - Global Median Composite',
                'coverage': 'Global',
                'date_range': f"{start_date} to {end_date}",
                'color_scheme': color_scheme,
                'actual_images': date_info,
                'image_count': len(image_dates) if image_dates else 0
            }

            logger.info(f"Generated GLOBAL tile URL for {season_name} with {color_scheme} colors")
            logger.info(f"Date range: {metadata['date_range']}")
            logger.info(f"Images used: {metadata['actual_images']}")

            # Cache the results
            tile_url = map_id['tile_fetcher'].url_format
            result = {
                'tile_url': tile_url,
                'metadata': metadata
            }
            self.cached_tiles[cache_key] = result

            return result

        except Exception as e:
            logger.error(f"Error generating tile URL: {e}", exc_info=True)
            return None
