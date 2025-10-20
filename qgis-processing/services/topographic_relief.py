"""
Topographic Relief / Hillshade Service

Generates hillshade terrain visualization from Google Earth Engine DEM data
with multiple style presets for different visualization needs.
"""

import ee
import logging
import os

logger = logging.getLogger(__name__)


class TopographicReliefService:
    """Service for generating hillshade terrain visualizations"""

    def __init__(self):
        self.initialized = False
        self.cached_tiles = {}  # Cache tiles by style
        self._initialize_ee()

    def _initialize_ee(self):
        """Initialize Google Earth Engine"""
        try:
            project = os.environ.get('EARTHENGINE_PROJECT')

            if project:
                logger.info(f"Initializing Earth Engine for terrain with project: {project}")
                ee.Initialize(project=project)
            else:
                logger.info("Initializing Earth Engine for terrain with default settings")
                try:
                    ee.Initialize()
                except Exception as e1:
                    logger.info("Trying high volume endpoint")
                    ee.Initialize(opt_url='https://earthengine-highvolume.googleapis.com')

            self.initialized = True
            logger.info("Earth Engine initialized for topographic relief")
        except Exception as e:
            logger.warning(f"Could not initialize Earth Engine for terrain: {e}")
            logger.warning("Topographic relief will use simulated data")
            self.initialized = False

    def _get_dem(self):
        """Get the best available DEM dataset"""
        if not self.initialized:
            return None

        try:
            # Use SRTM 90m global coverage - more reliable for hillshade
            dem = ee.Image('USGS/SRTMGL1_003')
            return dem.select('elevation')
        except Exception as e:
            logger.error(f"Could not load DEM: {e}")
            return None

    def _get_style_params(self, style):
        """Get hillshade parameters for each style preset"""
        styles = {
            'classic': {
                'azimuth': 315,  # Northwest lighting
                'elevation': 45,  # Standard angle
                'min': 0,
                'max': 255,
                'palette': ['000000', 'ffffff']  # Black to white
            },
            'dark': {
                'azimuth': 315,
                'elevation': 45,
                'min': 0,
                'max': 200,  # Darker max value
                'palette': ['000000', 'aaaaaa']  # Black to dark gray
            },
            'depth': {
                'azimuth': 315,
                'elevation': 30,  # Lower elevation for more depth
                'min': 50,
                'max': 255,
                'palette': ['1a1a1a', 'f5f5f5']  # Enhanced contrast
            },
            'dramatic': {
                'azimuth': 300,  # Slightly different angle
                'elevation': 25,  # Low angle for long shadows
                'min': 20,
                'max': 240,
                'palette': ['0f0f0f', 'e8e8e8']  # High contrast
            }
        }
        return styles.get(style, styles['classic'])

    def get_hillshade_tiles(self, style='classic'):
        """
        Generate hillshade tile URL for the given style

        Args:
            style: One of 'classic', 'dark', 'depth', 'dramatic'

        Returns:
            dict with tile_url and metadata
        """
        # Check cache first
        if style in self.cached_tiles:
            logger.info(f"Returning cached hillshade tile for {style} style")
            return self.cached_tiles[style]

        if not self.initialized:
            return self._generate_simulated_hillshade(style)

        try:
            # Get DEM
            dem = self._get_dem()
            if dem is None:
                return self._generate_simulated_hillshade(style)

            # Get style parameters
            params = self._get_style_params(style)

            # Generate hillshade
            hillshade = ee.Terrain.hillshade(
                dem,
                azimuth=params['azimuth'],
                elevation=params['elevation']
            )

            # Apply visualization parameters
            vis_params = {
                'min': params['min'],
                'max': params['max'],
                'palette': params['palette']
            }

            # Get tile URL
            map_id = hillshade.getMapId(vis_params)
            tile_url = map_id['tile_fetcher'].url_format

            result = {
                'success': True,
                'tile_url': tile_url,
                'style': style,
                'source': 'Copernicus DEM GLO-30',
                'azimuth': params['azimuth'],
                'elevation_angle': params['elevation']
            }

            # Cache the result
            self.cached_tiles[style] = result

            logger.info(f"Generated hillshade tile URL for {style} style")
            return result

        except Exception as e:
            logger.error(f"Error generating hillshade: {e}")
            return self._generate_simulated_hillshade(style)

    def _generate_simulated_hillshade(self, style):
        """
        Generate a simulated hillshade response when Earth Engine is unavailable
        """
        logger.info(f"Generating simulated hillshade for {style} style")

        # Return a simple response indicating simulation mode
        return {
            'success': True,
            'tile_url': None,
            'style': style,
            'source': 'Simulated (Earth Engine unavailable)',
            'message': 'Earth Engine not initialized. Real hillshade requires authentication.'
        }
