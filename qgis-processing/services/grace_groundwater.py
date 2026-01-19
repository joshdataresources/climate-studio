"""
GRACE Groundwater Monitoring Service using Google Earth Engine

Fetches and processes groundwater storage anomaly data from NASA's GRACE mission
via Google Earth Engine for aquifer-specific visualization.

Data source: NASA/GRACE/MASS_GRIDS/V04/LAND on Google Earth Engine
Documentation: https://developers.google.com/earth-engine/datasets/catalog/NASA_GRACE_MASS_GRIDS_V04_LAND
"""

import ee
import json
import h3
from pathlib import Path
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class GRACEGroundwaterService:
    """Service for fetching GRACE groundwater storage anomalies via Earth Engine"""

    # GRACE dataset uses Liquid Water Equivalent thickness (cm)
    # Positive values = water gain, Negative values = water loss
    # Using MASCON (Mass Concentration) solution for better spatial localization
    DATASET_ID = 'NASA/GRACE/MASS_GRIDS_V04/MASCON_CRI'

    # Use lwe_thickness band (Liquid Water Equivalent thickness in cm)
    BAND_NAME = 'lwe_thickness'

    # Temporal coverage: 2002-2024 (GRACE + GRACE-FO)
    START_DATE = '2002-04-01'
    END_DATE = '2024-09-30'

    # Aquifer boundary files
    AQUIFERS_DIR = Path(__file__).parent.parent / 'data' / 'aquifers'

    AQUIFER_FILES = {
        'high_plains': 'high_plains.geojson',
        'central_valley': 'central_valley.geojson',
        'mississippi_embayment': 'mississippi_embayment.geojson'
    }

    def __init__(self, ee_project=None):
        """Initialize GRACE Groundwater Service with Earth Engine"""
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
            logger.info("Earth Engine initialized for GRACE groundwater data")
        except Exception as e:
            logger.error(f"Failed to initialize Earth Engine: {e}")
            self.initialized = False

        # Only load boundaries if initialized
        if self.initialized:
            self._load_aquifer_boundaries()

    def _load_aquifer_boundaries(self):
        """Load aquifer boundary GeoJSON files"""
        self.aquifer_geometries = {}

        for aquifer_id, filename in self.AQUIFER_FILES.items():
            filepath = self.AQUIFERS_DIR / filename
            if filepath.exists():
                with open(filepath, 'r') as f:
                    geojson_data = json.load(f)
                    # Convert to Earth Engine geometry
                    self.aquifer_geometries[aquifer_id] = ee.FeatureCollection(geojson_data)
                    logger.info(f"Loaded aquifer boundary: {aquifer_id}")
            else:
                logger.warning(f"Aquifer boundary file not found: {filepath}")

    def get_groundwater_depletion_viewport(self, bounds, resolution=7):
        """
        Get groundwater storage change for any viewport bounds (entire US or zoomed region)

        Args:
            bounds: Dict with 'west', 'east', 'south', 'north' keys (longitude, latitude in degrees)
            resolution: H3 hexagon resolution (6-8 recommended, lower=larger hexagons)

        Returns:
            GeoJSON FeatureCollection with hexagonal groundwater depletion data
        """
        if not self.initialized:
            logger.error("Earth Engine not initialized")
            raise RuntimeError("Earth Engine not initialized")

        try:
            logger.info(f"Fetching GRACE data for viewport bounds: {bounds}, resolution: {resolution}")

            # Create geometry from bounds
            viewport_geom = ee.Geometry.Rectangle([
                bounds['west'], bounds['south'],
                bounds['east'], bounds['north']
            ])

            # Get GRACE dataset
            grace = ee.ImageCollection(self.DATASET_ID) \
                     .select(self.BAND_NAME) \
                     .filterDate(self.START_DATE, self.END_DATE)

            # Calculate baseline (first 5 years: 2002-2007)
            baseline = grace.filterDate('2002-04-01', '2007-04-01').mean()

            # Calculate recent period (last 5 years: 2019-2024)
            recent = grace.filterDate('2019-01-01', '2024-09-30').mean()

            # Calculate change (recent - baseline)
            change = recent.subtract(baseline)

            # Calculate annual trend using linear regression
            def add_time_band(image):
                time = ee.Date(image.get('system:time_start')).difference(
                    ee.Date('2002-01-01'), 'year'
                )
                return image.addBands(ee.Image(time).rename('time').float())

            grace_with_time = grace.map(add_time_band)
            linear_fit = grace_with_time.select(['time', self.BAND_NAME]).reduce(ee.Reducer.linearFit())
            trend = linear_fit.select('scale')

            # Generate hexagons for viewport
            hex_ids = self._get_hexagons_in_bounds(bounds, resolution)
            logger.info(f"Generated {len(hex_ids)} hexagons for viewport")

            # Limit to prevent Earth Engine timeout
            if len(hex_ids) > 5000:
                logger.warning(f"Too many hexagons ({len(hex_ids)}), sampling to 5000")
                import random
                hex_ids = random.sample(hex_ids, 5000)

            # Convert hexagons to EE features
            hex_features = []
            for hex_id in hex_ids:
                boundary = h3.cell_to_boundary(hex_id)
                coords = [[lng, lat] for lat, lng in boundary]
                coords.append(coords[0])

                hex_features.append(ee.Feature(
                    ee.Geometry.Polygon([coords]),
                    {'hexId': hex_id}
                ))

            hex_fc = ee.FeatureCollection(hex_features)

            # Get trend and change for each hexagon
            hex_trends = trend.reduceRegions(
                collection=hex_fc,
                reducer=ee.Reducer.mean(),
                scale=111320
            )

            hex_changes = change.reduceRegions(
                collection=hex_fc,
                reducer=ee.Reducer.mean(),
                scale=111320
            )

            # Fetch results
            logger.info("Fetching results from Earth Engine...")
            trend_features = hex_trends.getInfo()['features']
            change_features = hex_changes.getInfo()['features']

            change_dict = {f['properties']['hexId']: f['properties'].get('mean')
                          for f in change_features}

            # Convert to GeoJSON
            hexagons = self._convert_to_geojson(
                trend_features,
                change_dict,
                'viewport'
            )

            logger.info(f"✅ GRACE viewport data: {len(hexagons['features'])} hexagons")
            return hexagons

        except Exception as e:
            import traceback
            logger.error(f"🚨 GRACE viewport fetch failed: {str(e)}")
            logger.error(f"Traceback:\n{traceback.format_exc()}")
            raise

    def get_groundwater_depletion(self, aquifer_id='high_plains', resolution=6):
        """
        Get groundwater storage change for a specific aquifer

        Args:
            aquifer_id: Aquifer identifier ('high_plains', 'central_valley', 'mississippi_embayment')
            resolution: H3 hexagon resolution (5-7 recommended for aquifer scale)

        Returns:
            GeoJSON FeatureCollection with hexagonal groundwater depletion data
        """
        if not self.initialized:
            logger.error("Earth Engine not initialized")
            raise RuntimeError("Earth Engine not initialized")

        if aquifer_id not in self.aquifer_geometries:
            raise ValueError(f"Unknown aquifer: {aquifer_id}. Available: {list(self.aquifer_geometries.keys())}")

        try:
            logger.info(f"Fetching GRACE data for {aquifer_id} aquifer at resolution {resolution}")

            # Get aquifer boundary
            aquifer_fc = self.aquifer_geometries[aquifer_id]
            aquifer_geom = aquifer_fc.geometry()

            # Get GRACE dataset
            grace = ee.ImageCollection(self.DATASET_ID) \
                     .select(self.BAND_NAME) \
                     .filterDate(self.START_DATE, self.END_DATE)

            # Calculate baseline (first 5 years: 2002-2007)
            baseline = grace.filterDate('2002-04-01', '2007-04-01').mean()

            # Calculate recent period (last 5 years: 2019-2024)
            recent = grace.filterDate('2019-01-01', '2024-09-30').mean()

            # Calculate change (recent - baseline)
            # Negative values = water loss (depletion)
            change = recent.subtract(baseline)

            # Calculate annual trend using linear regression
            # Add time band (years since start)
            def add_time_band(image):
                # Time in years since 2002-01-01
                time = ee.Date(image.get('system:time_start')).difference(
                    ee.Date('2002-01-01'), 'year'
                )
                return image.addBands(ee.Image(time).rename('time').float())

            grace_with_time = grace.map(add_time_band)

            # Linear fit: lwe_thickness = a * time + b
            linear_fit = grace_with_time.select(['time', self.BAND_NAME]) \
                .reduce(ee.Reducer.linearFit())

            # Get slope (cm/year) - this is the depletion rate
            trend = linear_fit.select('scale')  # slope of linear fit

            # Get hexagons covering the aquifer
            bounds = aquifer_geom.bounds().getInfo()['coordinates'][0]
            bbox = {
                'west': min(p[0] for p in bounds),
                'east': max(p[0] for p in bounds),
                'south': min(p[1] for p in bounds),
                'north': max(p[1] for p in bounds)
            }

            logger.info(f"Aquifer bounds: {bbox}")
            hex_ids = self._get_hexagons_in_aquifer(aquifer_geom, bbox, resolution)
            logger.info(f"Generated {len(hex_ids)} hexagons for {aquifer_id}")

            # Convert hexagons to EE features
            hex_features = []
            for hex_id in hex_ids:
                boundary = h3.cell_to_boundary(hex_id)
                coords = [[lng, lat] for lat, lng in boundary]
                coords.append(coords[0])  # Close polygon

                hex_features.append(ee.Feature(
                    ee.Geometry.Polygon([coords]),
                    {'hexId': hex_id}
                ))

            hex_fc = ee.FeatureCollection(hex_features)

            # Get trend (depletion rate) for each hexagon
            logger.info("Computing groundwater trends for each hexagon...")
            hex_trends = trend.reduceRegions(
                collection=hex_fc,
                reducer=ee.Reducer.mean(),
                scale=111320  # ~111km native GRACE resolution
            )

            # Get total change for each hexagon
            hex_changes = change.reduceRegions(
                collection=hex_fc,
                reducer=ee.Reducer.mean(),
                scale=111320
            )

            # Fetch results
            logger.info("Fetching results from Earth Engine...")
            trend_features = hex_trends.getInfo()['features']
            change_features = hex_changes.getInfo()['features']

            # Combine trend and change data
            change_dict = {f['properties']['hexId']: f['properties'].get('mean')
                          for f in change_features}

            logger.info(f"Got data for {len(trend_features)} hexagons")

            # Convert to GeoJSON
            hexagons = self._convert_to_geojson(
                trend_features,
                change_dict,
                aquifer_id
            )

            logger.info("=" * 80)
            logger.info(f"✅ REAL GRACE DATA: Successfully loaded {len(hexagons['features'])} hexagons")
            logger.info(f"✅ Source: NASA GRACE via Earth Engine")
            logger.info(f"✅ Aquifer: {aquifer_id}")
            logger.info("=" * 80)

            return hexagons

        except Exception as e:
            import traceback
            logger.error("=" * 80)
            logger.error(f"🚨 GRACE FETCH FAILED")
            logger.error(f"Error: {str(e)}")
            logger.error(f"Aquifer: {aquifer_id}, resolution: {resolution}")
            logger.error(f"Traceback:\n{traceback.format_exc()}")
            logger.error("=" * 80)
            raise

    def get_tile_url(self, year=None, season=None, color_scheme='red_blue'):
        """
        Get Earth Engine tile URL for GRACE groundwater visualization
        
        Args:
            year: Year to visualize (int)
            season: 'spring', 'summer', 'autumn', 'winter' or None (annual average)
            color_scheme: 'red_blue' (default)
            
        Returns:
            Dict with 'tile_url' and 'metadata', or None if failed
        """
        if not self.initialized:
            logger.warning("Earth Engine not initialized, cannot generate tiles")
            return None
            
        try:
            # Determine date range
            if year is None:
                year = 2017 # Default to 2017 (known good data year)

            if season == 'spring':
                start_date = f'{year}-03-01'
                end_date = f'{year}-05-31'
                time_label = f"Spring {year}"
            elif season == 'summer':
                start_date = f'{year}-06-01'
                end_date = f'{year}-08-31'
                time_label = f"Summer {year}"
            elif season == 'autumn':
                start_date = f'{year}-09-01'
                end_date = f'{year}-11-30'
                time_label = f"Autumn {year}"
            elif season == 'winter':
                start_date = f'{year}-12-01'
                end_date = f'{year+1}-02-28'
                time_label = f"Winter {year}"
            else:
                # Annual average
                start_date = f'{year}-01-01'
                end_date = f'{year}-12-31'
                time_label = f"Annual Average {year}"
                
            # Get GRACE dataset
            # Use mascon solution for better spatial localization
            grace = ee.ImageCollection(self.DATASET_ID) \
                     .select(self.BAND_NAME) \
                     .filterDate(start_date, end_date)
            
            # Reduce to single image (mean)
            image = grace.mean()
            
            # Clip to United States
            us_boundary = ee.FeatureCollection("USDOS/LSIB_SIMPLE/2017") \
                .filter(ee.Filter.eq("country_na", "United States"))
            
            image = image.clip(us_boundary)
            
            # Visualization parameters
            # Range: -20 to +20 cm liquid water equivalent thickness
            vis_params = {
                'min': -20, 
                'max': 20,
                'palette': ['#b2182b', '#ef8a62', '#fddbc7', '#f7f7f7', '#d1e5f0', '#67a9cf', '#2166ac']
            }
            
            # Get map ID
            map_id = image.getMapId(vis_params)
            tile_url = map_id['tile_fetcher'].url_format
            
            return {
                'tile_url': tile_url,
                'metadata': {
                    'source': 'NASA GRACE via Earth Engine',
                    'dataset': self.DATASET_ID,
                    'time_label': time_label,
                    'unit': 'cm (Liquid Water Equivalent)',
                    'description': 'Water Storage Anomaly (Red=Loss, Blue=Gain)'
                }
            }
            
        except Exception as e:
            logger.error(f"Error generating GRACE tile URL: {e}")
            return None

    def _get_hexagons_in_bounds(self, bounds, resolution):
        """Generate hexagons within viewport bounds (no filtering, for nationwide coverage)"""
        # Grid tessellation approach
        edge_length_map = {5: 0.075, 6: 0.028, 7: 0.010, 8: 0.004}
        step = edge_length_map.get(resolution, 0.01) * 0.4

        hex_set = set()
        lat = bounds['south']
        while lat <= bounds['north']:
            lon = bounds['west']
            while lon <= bounds['east']:
                hex_id = h3.latlng_to_cell(lat, lon, resolution)
                hex_set.add(hex_id)
                lon += step
            lat += step

        return list(hex_set)

    def _get_hexagons_in_aquifer(self, aquifer_geom, bbox, resolution):
        """Generate hexagons within aquifer boundary"""
        from h3 import LatLngPoly
        from shapely.geometry import Point, shape

        # Get aquifer geometry as shapely
        aquifer_shape = shape(aquifer_geom.getInfo())

        # Generate hexagons in bounding box
        try:
            poly = LatLngPoly([
                (bbox['south'], bbox['west']),
                (bbox['south'], bbox['east']),
                (bbox['north'], bbox['east']),
                (bbox['north'], bbox['west'])
            ])
            hex_ids = list(h3.h3shape_to_cells(poly, resolution))
        except:
            # Fallback: grid tessellation
            edge_length_map = {5: 0.075, 6: 0.028, 7: 0.010, 8: 0.004}
            step = edge_length_map.get(resolution, 0.01) * 0.4

            hex_set = set()
            lat = bbox['south']
            while lat <= bbox['north']:
                lon = bbox['west']
                while lon <= bbox['east']:
                    hex_id = h3.latlng_to_cell(lat, lon, resolution)
                    hex_set.add(hex_id)
                    lon += step
                lat += step
            hex_ids = list(hex_set)

        # Filter to only hexagons within aquifer boundary
        filtered_hexagons = []
        for hex_id in hex_ids:
            lat, lon = h3.cell_to_latlng(hex_id)
            point = Point(lon, lat)
            if aquifer_shape.contains(point):
                filtered_hexagons.append(hex_id)

        logger.info(f"Filtered {len(hex_ids)} hexagons to {len(filtered_hexagons)} within aquifer boundary")
        return filtered_hexagons

    def _convert_to_geojson(self, trend_features, change_dict, aquifer_id):
        """Convert hexagon features to GeoJSON"""
        hexagon_data = []
        missing_count = 0

        for feature in trend_features:
            hex_id = feature['properties']['hexId']

            # Skip if no data
            if 'mean' not in feature['properties'] or feature['properties']['mean'] is None:
                missing_count += 1
                continue

            trend_cm_per_year = feature['properties']['mean']
            total_change_cm = change_dict.get(hex_id)

            if total_change_cm is None:
                missing_count += 1
                continue

            lat, lon = h3.cell_to_latlng(hex_id)
            boundary = h3.cell_to_boundary(hex_id)

            hexagon_data.append({
                'hex_id': hex_id,
                'lat': lat,
                'lon': lon,
                'boundary': boundary,
                'trend_cm_per_year': round(trend_cm_per_year, 2),
                'total_change_cm': round(total_change_cm, 2),
                'status': self._classify_depletion(trend_cm_per_year)
            })

        if missing_count > 0:
            logger.info(f"Excluded {missing_count} hexagons with missing data")

        return self._to_geojson(hexagon_data, aquifer_id)

    def _classify_depletion(self, trend_cm_per_year):
        """Classify depletion status based on trend"""
        if trend_cm_per_year < -2:
            return 'severe_depletion'
        elif trend_cm_per_year < -0.5:
            return 'moderate_depletion'
        elif trend_cm_per_year < 0.5:
            return 'stable'
        else:
            return 'recharge'

    def _to_geojson(self, hexagons, aquifer_id):
        """Convert hexagon data to GeoJSON FeatureCollection"""
        features = []

        for hex_data in hexagons:
            coordinates = [[
                [lng, lat] for lat, lng in hex_data['boundary']
            ]]
            coordinates[0].append(coordinates[0][0])  # Close polygon

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
                    'trendCmPerYear': hex_data['trend_cm_per_year'],
                    'totalChangeCm': hex_data['total_change_cm'],
                    'status': hex_data['status'],
                    'aquifer': aquifer_id
                }
            })

        return {
            'type': 'FeatureCollection',
            'features': features,
            'metadata': {
                'source': 'NASA GRACE via Earth Engine',
                'dataset': self.DATASET_ID,
                'temporalCoverage': f'{self.START_DATE} to {self.END_DATE}',
                'aquifer': aquifer_id,
                'count': len(features),
                'isRealData': True
            }
        }
