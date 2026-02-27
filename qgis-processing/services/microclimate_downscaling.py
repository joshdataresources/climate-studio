"""
Microclimate Downscaling Service

Combines coarse NASA CMIP6 projections (~25km) with high-resolution
Yale YCEO Urban Heat Island data (300m) to produce city-level
temperature projections via statistical downscaling.

Formula: projected_local_temp = CMIP6_regional_anomaly + UHI_spatial_pattern

At zoom < 10:  delegates to standard CMIP6 tiles (current behavior)
At zoom >= 10: blends CMIP6 anomaly with 300m UHI spatial variation
"""

import ee
import logging

logger = logging.getLogger(__name__)


class MicroclimateDownscalingService:
    """
    Statistical downscaling service that blends coarse climate projections
    with fine-resolution urban heat island spatial patterns.
    """

    # Baseline temperature for anomaly calculation (1986-2005 avg, °C)
    BASELINE_TEMP_C = 14.5

    # Scenario mapping (RCP → SSP)
    SCENARIOS = {
        'rcp26': 'ssp126',
        'rcp45': 'ssp245',
        'rcp85': 'ssp585',
    }

    DEFAULT_MODEL = 'ACCESS-CM2'

    # Zoom threshold for switching to downscaled tiles
    DOWNSCALE_ZOOM_THRESHOLD = 10

    def __init__(self, ee_project=None):
        self.ee_project = ee_project
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
                logger.info("Microclimate downscaling service: EE initialized with service account")
            elif self.ee_project:
                ee.Initialize(project=self.ee_project)
                logger.info("Microclimate downscaling service: EE initialized with project")
            else:
                ee.Initialize()
                logger.info("Microclimate downscaling service: EE initialized with defaults")
            self.initialized = True
        except Exception as e:
            logger.error(f"Microclimate downscaling: failed to initialize EE: {e}")
            self.initialized = False

    def should_downscale(self, zoom):
        """Return True if zoom level warrants downscaled tiles."""
        return zoom >= self.DOWNSCALE_ZOOM_THRESHOLD

    def get_downscaled_tile_url(self, year=2050, scenario='rcp45', mode='anomaly'):
        """
        Generate a downscaled tile URL that combines CMIP6 projections
        with Yale YCEO UHI spatial patterns at 300m resolution.

        The resulting tile shows:
        - The CMIP6 regional anomaly as a baseline shift
        - UHI spatial variation at 300m showing parks, downtown, suburbs

        Args:
            year: Projection year (2020-2100)
            scenario: Climate scenario ('rcp26', 'rcp45', 'rcp85')
            mode: 'anomaly' or 'actual'

        Returns:
            Dict with 'tile_fetcher' and 'metadata', or None on failure
        """
        if not self.initialized:
            logger.error("Microclimate downscaling: EE not initialized")
            return None

        try:
            ssp_scenario = self.SCENARIOS.get(scenario, 'ssp245')

            # --- Step 1: Get CMIP6 regional temperature (coarse, ~25km) ---
            cmip6 = ee.ImageCollection('NASA/GDDP-CMIP6') \
                .filter(ee.Filter.eq('model', self.DEFAULT_MODEL)) \
                .filter(ee.Filter.eq('scenario', ssp_scenario)) \
                .filter(ee.Filter.calendarRange(year, year, 'year')) \
                .select('tasmax') \
                .mean() \
                .subtract(273.15)  # Kelvin → Celsius

            # --- Step 2: Get UHI spatial pattern (fine, 300m) ---
            # Yale YCEO: nighttime surface UHI intensity (°C difference from rural)
            uhi_pattern = ee.ImageCollection(
                'YALE/YCEO/UHI/Summer_UHI_yearly_pixel/v4'
            ).select('Nighttime').mean()

            # --- Step 3: Statistical downscaling ---
            if mode == 'anomaly':
                # Anomaly = (CMIP6_temp - baseline) + UHI_local_modifier
                cmip6_anomaly = cmip6.subtract(self.BASELINE_TEMP_C)

                # Combine: regional anomaly + local UHI variation
                # UHI values are already in °C (urban-rural difference)
                downscaled = cmip6_anomaly.add(uhi_pattern)

                # Where UHI data is missing (rural/ocean), fall back to CMIP6 alone
                # Resample CMIP6 to match UHI resolution for the unmask
                cmip6_anomaly_resampled = cmip6_anomaly.resample('bilinear').reproject(
                    crs='EPSG:4326', scale=300
                )
                downscaled = downscaled.unmask(cmip6_anomaly_resampled)

                vis_params = {
                    'min': -1,
                    'max': 12,
                    'palette': [
                        '#313695', '#4575b4', '#74add1',  # cool (UHI-reduced areas)
                        '#ffffff', '#fefce8', '#fef9c3',  # neutral
                        '#fef08a', '#fde047', '#facc15',  # warm
                        '#f59e0b', '#fb923c', '#f97316',  # hot
                        '#ea580c', '#dc2626', '#b91c1c',  # very hot
                        '#7f1d1d'                          # extreme
                    ]
                }
            else:
                # Actual temperature mode
                # projected_local = CMIP6_actual + UHI_modifier
                downscaled = cmip6.add(uhi_pattern)

                cmip6_resampled = cmip6.resample('bilinear').reproject(
                    crs='EPSG:4326', scale=300
                )
                downscaled = downscaled.unmask(cmip6_resampled)

                vis_params = {
                    'min': 5,
                    'max': 45,
                    'palette': [
                        '#1e3a8a', '#3b82f6', '#93c5fd',
                        '#fef08a', '#fb923c',
                        '#ef4444', '#991b1b', '#450a0a'
                    ]
                }

            # Reproject to 300m for high-res tile output
            downscaled_300m = downscaled.reproject(
                crs='EPSG:4326', scale=300
            )

            # Generate tile fetcher
            map_id = downscaled_300m.getMapId(vis_params)
            tile_fetcher = map_id['tile_fetcher']

            logger.info(
                f"Generated downscaled tile fetcher: year={year}, "
                f"scenario={scenario}, mode={mode}, resolution=300m"
            )

            return {
                'tile_fetcher': tile_fetcher,
                'metadata': {
                    'source': 'NASA NEX-GDDP-CMIP6 + Yale YCEO UHI (Statistical Downscaling)',
                    'model': self.DEFAULT_MODEL,
                    'scenario': scenario,
                    'ssp_scenario': ssp_scenario,
                    'year': year,
                    'mode': mode,
                    'resolution': '300m',
                    'method': 'statistical_downscaling',
                    'components': {
                        'projection': 'NASA/GDDP-CMIP6 (tasmax)',
                        'spatial_detail': 'YALE/YCEO/UHI/Summer_UHI_yearly_pixel/v4 (Nighttime)',
                    },
                    'isRealData': True,
                    'dataType': 'tiles',
                }
            }

        except Exception as e:
            logger.error(f"Microclimate downscaling failed: {e}", exc_info=True)
            return None
