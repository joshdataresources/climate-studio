"""
Urban Heat Island Service

Provides urban heat island intensity data from real Landsat LST data
with simulated fallback using H3 hexagons.
"""

import h3
import numpy as np
from datetime import datetime
import logging
from landsat_lst import LandsatLSTService

logger = logging.getLogger(__name__)


class UrbanHeatIslandService:
    """Service for generating urban heat island data"""

    def __init__(self):
        """Initialize with Landsat LST service"""
        self.landsat_service = LandsatLSTService()
        self.use_real_data = self.landsat_service.initialized

    def get_tile_url(self, bounds, season='summer', color_scheme='temperature'):
        """
        Get Earth Engine tile URL for smooth heat map visualization

        Args:
            bounds: Dict with 'north', 'south', 'east', 'west' keys
            season: 'summer' or 'winter' - which season to show
            color_scheme: 'temperature', 'heat', or 'urban' - color palette

        Returns:
            Dict with 'tile_url' and 'metadata', or None if not available
        """
        if self.use_real_data:
            return self.landsat_service.get_tile_url(bounds, season, color_scheme)
        return None

    def get_heat_island_data(self, bounds, date=None, resolution=8, use_real_data=True):
        """
        Generate urban heat island data from real Landsat LST or simulation

        Args:
            bounds: Dict with 'north', 'south', 'east', 'west' keys
            date: ISO date string (YYYY-MM-DD), optional
            resolution: H3 resolution level (0-15), default 8
            use_real_data: Whether to use real Landsat data (True) or simulation (False)

        Returns:
            GeoJSON FeatureCollection with features
        """
        # Try to use real Landsat data if requested and available
        if use_real_data and self.use_real_data:
            logger.info("Fetching real Landsat LST data for urban heat island")
            try:
                lst_data = self.landsat_service.get_lst_data(bounds, date)
                if lst_data:
                    geojson = self.landsat_service.format_as_geojson(lst_data)
                    if geojson:
                        logger.info("Successfully retrieved real Landsat LST data")
                        return geojson
                logger.warning("Could not fetch real data, falling back to simulation")
            except Exception as e:
                logger.error(f"Error fetching Landsat data: {e}, falling back to simulation")

        # Fall back to simulated data
        logger.info(f"Generating simulated urban heat island data: resolution {resolution}")
        # Clamp resolution to valid H3 range
        resolution = max(0, min(15, resolution))

        # Get hexagons covering the bounds
        hex_ids = self._get_hexagons_in_bounds(bounds, resolution)

        # Calculate center point (urban core)
        center_lat = (bounds['north'] + bounds['south']) / 2
        center_lon = (bounds['east'] + bounds['west']) / 2

        hexagons = []

        # Create multiple urban centers based on viewport size
        # Larger viewports = more potential urban centers
        bbox_width = bounds['east'] - bounds['west']
        bbox_height = bounds['north'] - bounds['south']
        bbox_area = bbox_width * bbox_height

        # Create 1-3 urban centers depending on viewport size
        num_centers = min(3, max(1, int(bbox_area * 20)))

        urban_centers = []
        for i in range(num_centers):
            # Use deterministic "random" placement based on bounds
            seed_x = np.sin((bounds['west'] + bounds['east']) * (i + 1) * 12.9898) * 43758.5453
            seed_y = np.sin((bounds['north'] + bounds['south']) * (i + 1) * 78.233) * 43758.5453
            offset_x = (seed_x - np.floor(seed_x)) * bbox_width
            offset_y = (seed_y - np.floor(seed_y)) * bbox_height

            center_lon = bounds['west'] + offset_x
            center_lat = bounds['south'] + offset_y

            # Vary the intensity of each urban center
            intensity_seed = np.sin((center_lat + center_lon) * 45.678) * 23456.789
            max_temp = 3.0 + (intensity_seed - np.floor(intensity_seed)) * 3.0  # 3-6°C

            urban_centers.append({
                'lat': center_lat,
                'lon': center_lon,
                'max_temp': max_temp,
                'radius': 0.02 + (intensity_seed - np.floor(intensity_seed)) * 0.03  # varying size
            })

        for hex_id in hex_ids:
            # Get hexagon center
            lat, lon = h3.cell_to_latlng(hex_id)

            # Get hexagon boundary
            boundary = h3.cell_to_boundary(hex_id)

            # Calculate intensity based on distance from urban centers
            # Urban heat island effect: hottest at center, gradual cooling with distance
            intensity = 0.0

            for center in urban_centers:
                # Calculate distance from this urban center
                dist = np.sqrt((lat - center['lat'])**2 + (lon - center['lon'])**2)

                # Apply heat island effect with smooth falloff
                if dist < center['radius']:
                    # Core urban area - high intensity
                    # Use inverse square for realistic falloff
                    center_effect = center['max_temp'] * (1 - (dist / center['radius']) ** 2)
                else:
                    # Suburban/rural - exponential decay
                    decay = np.exp(-(dist - center['radius']) / (center['radius'] * 2))
                    center_effect = center['max_temp'] * 0.4 * decay

                intensity += center_effect

            # Add small-scale variation (buildings, parks, streets)
            # This creates texture without random noise
            micro_seed = np.sin(lat * 1000.0 + lon * 1000.0) * 43758.5453
            micro_variation = (micro_seed - np.floor(micro_seed)) * 1.0 - 0.5  # ±0.5°C
            intensity += micro_variation

            # Add occasional cool spots (parks, water bodies)
            cool_spot_seed = np.sin(lat * 234.567 + lon * 345.678) * 12345.678
            if (cool_spot_seed - np.floor(cool_spot_seed)) > 0.88:  # 12% chance
                intensity -= 2.0  # Significant cooling from vegetation/water

            # Clamp to reasonable range (0-6°C)
            intensity = max(0, min(6.0, intensity))

            hexagons.append({
                'hex_id': hex_id,
                'center': [lon, lat],
                'boundary': boundary,
                'intensity': round(intensity, 2),
                'level': self._classify_level(intensity)
            })

        logger.info(f"Generated {len(hexagons)} urban heat island hexagons")

        # Convert to GeoJSON
        return self._to_geojson(hexagons, date, resolution)

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
                'source': 'Simulated Urban Heat Island',
                'description': 'Urban heat island intensity showing temperature differences between urban and rural areas'
            }
        }
