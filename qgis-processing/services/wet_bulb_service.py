"""
Wet Bulb Temperature Service using Google Earth Engine

Calculates Wet Bulb Temperature (WBT) using NASA NEX-GDDP-CMIP6 data.
Variables:
- tasmax (Daily Maximum Near-Surface Air Temperature)
- hurs (Near-Surface Relative Humidity)

Formula: Stull (2011)
"""

import ee
import h3
import logging
import numpy as np

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class WetBulbService:
    """Service for calculating and fetching Wet Bulb Temperature data via Earth Engine"""

    # NASA NEX-GDDP-CMIP6
    DATASET = 'NASA/GDDP-CMIP6'
    
    # Model selection - using ACCESS-CM2 as default (consistent with other services)
    DEFAULT_MODEL = "ACCESS-CM2"

    SCENARIOS = {
        'rcp26': 'ssp126',
        'rcp45': 'ssp245',
        'rcp85': 'ssp585'
    }

    # WBT Thresholds for coloring (Celsius)
    # 35°C = Theoetical limit of human survival
    # 32°C = Extreme Danger
    # 28°C = Danger
    # 24°C = High Risk

    def __init__(self, project_id=None):
        """Initialize Wet Bulb Service"""
        self.ee_project = project_id
        self.initialized = False
        self._initialize_ee()

    def _initialize_ee(self):
        """Initialize Google Earth Engine"""
        import os
        try:
            sa_key = os.getenv('GOOGLE_APPLICATION_CREDENTIALS')
            sa_email = os.getenv('EE_SERVICE_ACCOUNT')
            if sa_key and sa_email and os.path.exists(sa_key):
                credentials = ee.ServiceAccountCredentials(sa_email, sa_key)
                ee.Initialize(credentials, project=self.ee_project)
                logger.info(f"✅ Wet Bulb Service: Earth Engine initialized with service account: {sa_email}")
            elif self.ee_project:
                ee.Initialize(project=self.ee_project)
                logger.info("✅ Wet Bulb Service: Earth Engine initialized")
            else:
                ee.Initialize()
                logger.info("✅ Wet Bulb Service: Earth Engine initialized with default credentials")
            self.initialized = True
        except Exception as e:
            logger.error(f"❌ Wet Bulb Service: Failed to initialize Earth Engine: {e}")
            self.initialized = False

    def get_wet_bulb_hexagons(self, bounds, year=2050, scenario='rcp45', resolution=6):
        """
        Get Wet Bulb Temperature hexagons for a bounding box.
        
        Args:
            bounds: Dict with 'north', 'south', 'east', 'west'
            year: Projection year
            scenario: 'rcp26', 'rcp45', 'rcp85'
            resolution: H3 resolution (default 6)
            
        Returns:
            GeoJSON FeatureCollection
        """
        if not self.initialized:
            raise RuntimeError("Earth Engine not initialized")

        try:
            ssp_scenario = self.SCENARIOS.get(scenario, 'ssp245')
            
            # Normalize bounds
            if isinstance(bounds, (list, tuple)):
                west, south, east, north = bounds
            else:
                west = bounds['west']
                south = bounds['south']
                east = bounds['east']
                north = bounds['north']
                
            # Create region
            region = ee.Geometry.Rectangle([west, south, east, north])

            # Get dataset
            dataset = ee.ImageCollection(self.DATASET) \
                .filter(ee.Filter.eq('model', self.DEFAULT_MODEL)) \
                .filter(ee.Filter.eq('scenario', ssp_scenario)) \
                .filter(ee.Filter.calendarRange(year, year, 'year'))
            
            # We need both Temperature (tasmax) and Humidity (hurs)
            # Filter to summer months (June-August) for max risk in northern hemisphere
            # TODO: Make season dynamic based on latitude if needed, but US focus implies Summer.
            summer_data = dataset.filter(ee.Filter.calendarRange(6, 8, 'month'))
            
            # Get mean for the summer
            # tasmax in Kelvin, hurs in %
            image = summer_data.select(['tasmax', 'hurs']).mean()
            
            # Convert Kelvin to Celsius
            temp_c = image.select('tasmax').subtract(273.15)
            rh = image.select('hurs')

            # Calculate Wet Bulb Temperature using Stull formula (implemented in EE)
            # This is complex to do purely in EE server-side math for the atan calls.
            # Stull (2011) formula:
            # Tw = T * atan[0.151977 * (RH% + 8.313659)^0.5] + atan(T + RH%) - atan(RH% - 1.676331) + ...
            
            # For simplicity and performance in EE, we can use a linear approximation 
            # OR compute it properly if EE supports atan (it does).
            # Let's try the full expression.
            
            # Variables for expression
            # T = temp_c
            # RH = rh
            
            # Expression string
            # atan is 'atan()' in EE expression
            # pow is 'pow(x, y)'
            
            expression = (
                "T * atan(0.151977 * pow(RH + 8.313659, 0.5)) + " +
                "atan(T + RH) - " +
                "atan(RH - 1.676331) + " +
                "0.00391838 * pow(RH, 1.5) * atan(0.023101 * RH) - " +
                "4.686035"
            )
            
            wet_bulb = image.expression(
                expression,
                {
                    'T': temp_c,
                    'RH': rh
                }
            ).rename('wet_bulb_c')
            
            # Generate hexagons
            hex_ids = self._get_hexagons_in_bounds({
                'west': west, 'south': south,
                'east': east, 'north': north
            }, resolution)
            
            # Create features
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
            
            # Reduce region to get mean Wet Bulb for each hexagon
            hex_stats = wet_bulb.reduceRegions(
                collection=hex_fc,
                reducer=ee.Reducer.mean(),
                scale=25000 # ~25km native resolution
            )
            
            features = hex_stats.getInfo()['features']
            
            geojson_features = []
            for f in features:
                props = f['properties']
                if 'mean' not in props or props['mean'] is None:
                    continue
                    
                wbt = props['mean']
                hex_id = props['hexId']
                lat, lon = h3.cell_to_latlng(hex_id)
                boundary = h3.cell_to_boundary(hex_id)
                
                # Classify risk
                risk = 'Low'
                if wbt >= 35: risk = 'Extreme (Fatal)'
                elif wbt >= 32: risk = 'Critical'
                elif wbt >= 28: risk = 'Danger'
                elif wbt >= 24: risk = 'High'
                
                geojson_features.append({
                    'type': 'Feature',
                    'geometry': {
                        'type': 'Polygon',
                        'coordinates': [[[lng, lat] for lat, lng in boundary] + [[[lng, lat] for lat, lng in boundary][0]]]
                    },
                    'properties': {
                        'hexId': hex_id,
                        'wet_bulb_c': round(wbt, 2),
                        'wet_bulb_f': round(wbt * 9/5 + 32, 1),
                        'risk_level': risk,
                        'year': year,
                        'scenario': scenario
                    }
                })
                
            return {
                'type': 'FeatureCollection',
                'features': geojson_features
            }
            
        except Exception as e:
            logger.error(f"Error fetching wet bulb hexagons: {e}")
            import traceback
            logger.error(traceback.format_exc())
            raise

    def get_wet_bulb_tiles(self, year=2050, scenario='rcp45'):
        """Get tile URL for Wet Bulb layer"""
        # TODO: Implement raster tile generation if needed for smoother zoom
        pass

    def _get_hexagons_in_bounds(self, bounds, resolution):
        """Get H3 hexagons covering bounds"""
        # Simple grid tessellation
        # NOTE: Copying logic from nasa_ee_climate.py for consistency
        # Assuming simple rectangular bounds for now
        
        # H3 edge lengths approx
        edge_len = 0.01 # Default
        if resolution == 4: edge_len = 0.2
        if resolution == 5: edge_len = 0.075
        if resolution == 6: edge_len = 0.028
        if resolution == 7: edge_len = 0.010
        
        step = edge_len * 0.4
        
        hex_set = set()
        lat = bounds['south']
        while lat <= bounds['north']:
            lon = bounds['west']
            while lon <= bounds['east']:
                hex_set.add(h3.latlng_to_cell(lat, lon, resolution))
                lon += step
            lat += step
            
        return list(hex_set)
