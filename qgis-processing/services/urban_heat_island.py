"""
Urban Heat Island Service

Provides urban heat island intensity data from Yale YCEO dataset via Google Earth Engine.
"""

import ee
import h3
import numpy as np
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


class UrbanHeatIslandService:
    """Service for generating urban heat island data from Yale YCEO UHI dataset"""

    def __init__(self, ee_project=None):
        """Initialize with Earth Engine"""
        self.initialized = False
        self.ee_project = ee_project
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
                logger.info(f"Earth Engine initialized for UHI with service account: {sa_email}")
            elif self.ee_project:
                ee.Initialize(project=self.ee_project)
                logger.info("Earth Engine initialized for Yale UHI data")
            else:
                ee.Initialize()
                logger.info("Earth Engine initialized for UHI with default credentials")
            self.initialized = True
        except Exception as e:
            logger.error(f"Failed to initialize Earth Engine: {e}")
            self.initialized = False

    def get_tile_url(self, bounds, season='summer', color_scheme='temperature'):
        """
        Get Earth Engine tile URL for smooth heat map visualization using Yale YCEO UHI data

        Args:
            bounds: Dict with 'north', 'south', 'east', 'west' keys
            season: 'summer' or 'winter' - not used for yearly data, kept for API compatibility
            color_scheme: 'temperature', 'heat', or 'urban' - color palette

        Returns:
            Dict with 'tile_url' and 'metadata', or None if not available
        """
        if not self.initialized:
            logger.error("Earth Engine not initialized")
            return None

        try:
            # Yale YCEO Summer UHI dataset (2003-2018)
            dataset = ee.ImageCollection('YALE/YCEO/UHI/Summer_UHI_yearly_pixel/v4')

            # Get the most recent year available (2018)
            # Use mean to create a composite showing typical UHI patterns
            uhi_composite = dataset.select('Nighttime').mean()

            # Color palettes based on preference
            if color_scheme == 'heat':
                # Yellow to red gradient (heat emphasis)
                palette = [
                    '#ffffcc', '#ffeda0', '#fed976', '#feb24c', '#fd8d3c',
                    '#fc4e2a', '#e31a1c', '#bd0026', '#800026'
                ]
            elif color_scheme == 'urban':
                # Purple to orange gradient (urban emphasis)
                palette = [
                    '#f7fcf0', '#e0f3db', '#ccebc5', '#a8ddb5', '#7bccc4',
                    '#4eb3d3', '#2b8cbe', '#0868ac', '#084081'
                ]
            else:  # temperature (default)
                # Cool to warm gradient
                palette = [
                    '#313695', '#4575b4', '#74add1', '#abd9e9', '#e0f3f8',
                    '#ffffbf', '#fee090', '#fdae61', '#f46d43', '#d73027', '#a50026'
                ]

            vis_params = {
                'min': -1.5,
                'max': 7.5,
                'palette': palette
            }

            # Get map ID and tile URL
            map_id = uhi_composite.getMapId(vis_params)
            tile_url = map_id['tile_fetcher'].url_format

            # Calculate regional statistics for the viewport
            region = ee.Geometry.Rectangle([
                bounds['west'], bounds['south'],
                bounds['east'], bounds['north']
            ])

            # Get mean UHI intensity for the region
            stats = uhi_composite.reduceRegion(
                reducer=ee.Reducer.mean(),
                geometry=region,
                scale=300,  # 300m native resolution
                maxPixels=1e9
            ).getInfo()

            mean_uhi = stats.get('Nighttime', None)

            return {
                'tile_url': tile_url,
                'metadata': {
                    'source': 'Yale YCEO Urban Heat Island (Summer UHI v4)',
                    'dataset': 'YALE/YCEO/UHI/Summer_UHI_yearly_pixel/v4',
                    'temporal_coverage': '2003-2018',
                    'resolution': '300m',
                    'band': 'Nighttime',
                    'color_scheme': color_scheme,
                    'average_uhi_intensity': round(mean_uhi, 2) if mean_uhi is not None else None,
                    'description': 'Nighttime surface urban heat island intensity (°C)'
                }
            }

        except Exception as e:
            logger.error(f"Error generating UHI tile URL: {e}")
            return None

    def get_heat_island_data(self, bounds, date=None, resolution=8):
        """
        Generate urban heat island data from Yale YCEO dataset via Earth Engine

        Args:
            bounds: Dict with 'north', 'south', 'east', 'west' keys
            date: ISO date string (YYYY-MM-DD), optional (not used, kept for API compatibility)
            resolution: H3 resolution level (0-15), default 8

        Returns:
            GeoJSON FeatureCollection with hexagonal features
        """
        if not self.initialized:
            logger.error("Earth Engine not initialized, cannot fetch UHI data")
            return self._empty_geojson()

        try:
            logger.info(f"Fetching Yale UHI data: resolution {resolution}")

            # Clamp resolution to valid H3 range
            resolution = max(0, min(15, resolution))

            # Get Yale YCEO UHI dataset
            dataset = ee.ImageCollection('YALE/YCEO/UHI/Summer_UHI_yearly_pixel/v4')
            uhi_image = dataset.select('Nighttime').mean()

            # Define the region
            region = ee.Geometry.Rectangle([
                bounds['west'], bounds['south'],
                bounds['east'], bounds['north']
            ])

            # Sample the UHI data at hexagon centers
            hex_ids = self._get_hexagons_in_bounds(bounds, resolution)

            hexagons = []
            for hex_id in hex_ids:
                lat, lon = h3.cell_to_latlng(hex_id)
                boundary = h3.cell_to_boundary(hex_id)

                # Sample UHI intensity at this location
                point = ee.Geometry.Point([lon, lat])
                sample = uhi_image.sample(point, 300).first()

                if sample:
                    try:
                        intensity = sample.get('Nighttime').getInfo()
                        if intensity is not None and not np.isnan(intensity):
                            hexagons.append({
                                'hex_id': hex_id,
                                'center': [lon, lat],
                                'boundary': boundary,
                                'intensity': round(float(intensity), 2),
                                'level': self._classify_level(float(intensity))
                            })
                    except:
                        pass  # Skip hexagons with no data

            logger.info(f"Generated {len(hexagons)} Yale UHI hexagons")
            return self._to_geojson(hexagons, date, resolution)

        except Exception as e:
            logger.error(f"Error fetching Yale UHI data: {e}")
            return self._empty_geojson()

    def _empty_geojson(self):
        """Return empty GeoJSON FeatureCollection"""
        return {
            'type': 'FeatureCollection',
            'features': [],
            'metadata': {
                'error': 'Could not fetch UHI data',
                'count': 0
            }
        }

    def _get_hexagons_in_bounds(self, bounds, resolution):
        """Get H3 hexagon IDs that cover the bounding box"""
        # Build polygon in GeoJSON format (lon, lat order)
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

        # Use h3 v4 API
        hex_ids = h3.geo_to_cells(polygon_geojson, resolution)
        return list(hex_ids)

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

    def _to_geojson(self, hexagons, date, resolution):
        """Convert hexagons to GeoJSON FeatureCollection"""
        features = []

        for hex_data in hexagons:
            # Convert boundary to proper GeoJSON coordinates format
            # h3.cell_to_boundary returns list of (lat, lon) tuples
            # GeoJSON needs [[lon, lat], ...] with first = last
            coordinates = [[lon, lat] for lat, lon in hex_data['boundary']]
            coordinates.append(coordinates[0])  # Close the polygon

            feature = {
                'type': 'Feature',
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': [coordinates]
                },
                'properties': {
                    'hex_id': hex_data['hex_id'],
                    'heatIslandIntensity': hex_data['intensity'],
                    'level': hex_data['level'],
                    'center': hex_data['center'],
                    'resolution': resolution
                }
            }

            features.append(feature)

        return {
            'type': 'FeatureCollection',
            'features': features,
            'metadata': {
                'date': date or datetime.now().isoformat().split('T')[0],
                'resolution': resolution,
                'count': len(features),
                'source': 'Yale YCEO Urban Heat Island (Summer UHI v4)',
                'temporal_coverage': '2003-2018',
                'description': 'Urban heat island intensity from MODIS LST data (°C)'
            }
        }
