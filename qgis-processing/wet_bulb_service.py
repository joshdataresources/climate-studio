"""
Wet Bulb Temperature Service

Calculates and provides wet bulb temperature data using Google Earth Engine.
Uses NASA NEX-GDDP-CMIP6 dataset with tasmax (temperature) and hurs (relative humidity).

Formula: Stull (2011) approximation
WBT = T * arctan[0.151977 * (RH% + 8.313659)^0.5] + arctan(T + RH%)
      - arctan(RH% - 1.676331) + 0.00391838 * (RH%)^1.5 * arctan(0.023101 * RH%)
      - 4.686035

Where:
- T = Air temperature (°C)
- RH = Relative humidity (%)
"""

import ee
import h3
import math
from typing import Dict, List, Tuple, Optional
from datetime import datetime

class WetBulbService:
    def __init__(self, project_id: str = 'josh-geo-the-second'):
        """Initialize Google Earth Engine with project credentials"""
        try:
            ee.Initialize(project=project_id)
            print(f"✅ Earth Engine initialized with project: {project_id}")
        except Exception as e:
            print(f"⚠️ Earth Engine initialization error: {e}")
            print("Attempting to authenticate...")
            ee.Authenticate()
            ee.Initialize(project=project_id)

    def calculate_wet_bulb_stull(self, temp_c: float, rh_percent: float) -> float:
        """
        Calculate wet bulb temperature using Stull (2011) formula

        Args:
            temp_c: Air temperature in Celsius
            rh_percent: Relative humidity as percentage (0-100)

        Returns:
            Wet bulb temperature in Celsius
        """
        import math

        T = temp_c
        RH = rh_percent

        # Stull (2011) formula
        wbt = (T * math.atan(0.151977 * (RH + 8.313659) ** 0.5)
               + math.atan(T + RH)
               - math.atan(RH - 1.676331)
               + 0.00391838 * (RH ** 1.5) * math.atan(0.023101 * RH)
               - 4.686035)

        return wbt

    def get_wet_bulb_hexagons(
        self,
        bounds: Tuple[float, float, float, float],
        year: int = 2025,
        scenario: str = 'ssp245',
        resolution: int = 4
    ) -> Dict:
        """
        Generate hexagonal grid with wet bulb temperature data

        Args:
            bounds: (west, south, east, north) bounding box
            year: Projection year (2025-2100)
            scenario: SSP scenario (ssp245, ssp585, etc.)
            resolution: H3 resolution (0-15, lower = larger hexagons)

        Returns:
            GeoJSON FeatureCollection with wet bulb temperature data
        """
        west, south, east, north = bounds

        print(f"🌡️ Fetching wet bulb data: year={year}, scenario={scenario}, bounds={bounds}")

        try:
            # Define the region of interest
            region = ee.Geometry.Rectangle([west, south, east, north])

            # Get NASA NEX-GDDP-CMIP6 dataset
            dataset = ee.ImageCollection('NASA/GDDP-CMIP6')

            # Filter by scenario and year
            # NASA data uses specific date ranges - we'll use summer months (June-August)
            start_date = f'{year}-06-01'
            end_date = f'{year}-08-31'

            # Filter for tasmax (maximum temperature) and hurs (relative humidity)
            tasmax_collection = (dataset
                .filter(ee.Filter.eq('scenario', scenario))
                .filter(ee.Filter.date(start_date, end_date))
                .select('tasmax'))

            hurs_collection = (dataset
                .filter(ee.Filter.eq('scenario', scenario))
                .filter(ee.Filter.date(start_date, end_date))
                .select('hurs'))

            # Calculate mean for the period
            tasmax_mean = tasmax_collection.mean().clip(region)
            hurs_mean = hurs_collection.mean().clip(region)

            # Convert temperature from Kelvin to Celsius
            temp_c = tasmax_mean.subtract(273.15)

            # Calculate wet bulb temperature using image expression
            # Implementing Stull formula in Earth Engine expression
            wet_bulb = temp_c.expression(
                'T * atan(0.151977 * pow(RH + 8.313659, 0.5)) + '
                'atan(T + RH) - atan(RH - 1.676331) + '
                '0.00391838 * pow(RH, 1.5) * atan(0.023101 * RH) - 4.686035',
                {
                    'T': temp_c,
                    'RH': hurs_mean
                }
            ).rename('wet_bulb_c')

            # Sample the image at hexagon centers
            hexagons = self._generate_h3_hexagons(bounds, resolution)

            # Create features for each hexagon
            features = []
            for hex_id in hexagons:
                hex_center = h3.cell_to_latlng(hex_id)
                # cell_to_boundary returns (lat, lng) tuples, need to convert to GeoJSON [lng, lat]
                boundary_latlngs = h3.cell_to_boundary(hex_id)
                hex_boundary = [[lng, lat] for lat, lng in boundary_latlngs]

                # Sample wet bulb temp at hexagon center
                point = ee.Geometry.Point([hex_center[1], hex_center[0]])
                sample = wet_bulb.sample(point, 1000).first()

                if sample:
                    try:
                        wbt_value = sample.get('wet_bulb_c').getInfo()

                        if wbt_value is not None:
                            features.append({
                                'type': 'Feature',
                                'geometry': {
                                    'type': 'Polygon',
                                    'coordinates': [hex_boundary]
                                },
                                'properties': {
                                    'hex_id': hex_id,
                                    'wet_bulb_c': round(wbt_value, 2),
                                    'wet_bulb_f': round(wbt_value * 9/5 + 32, 2),
                                    'year': year,
                                    'scenario': scenario,
                                    'danger_level': self._classify_danger(wbt_value)
                                }
                            })
                    except Exception as e:
                        print(f"⚠️ Error sampling hexagon {hex_id}: {e}")
                        continue

            print(f"✅ Generated {len(features)} hexagons with wet bulb data")

            return {
                'type': 'FeatureCollection',
                'features': features,
                'metadata': {
                    'year': year,
                    'scenario': scenario,
                    'resolution': resolution,
                    'bounds': bounds,
                    'generated_at': datetime.now().isoformat()
                }
            }

        except Exception as e:
            print(f"❌ Error generating wet bulb hexagons: {e}")
            raise

    def _generate_h3_hexagons(self, bounds: Tuple[float, float, float, float], resolution: int) -> List[str]:
        """Generate H3 hexagon IDs for the given bounds"""
        west, south, east, north = bounds

        # Create grid of points to seed hexagons
        hexagons = set()

        # Sample points across the bounds
        lat_step = (north - south) / 20
        lon_step = (east - west) / 20

        lat = south
        while lat <= north:
            lon = west
            while lon <= east:
                hex_id = h3.latlng_to_cell(lat, lon, resolution)
                hexagons.add(hex_id)
                lon += lon_step
            lat += lat_step

        return list(hexagons)

    def _classify_danger(self, wbt_c: float) -> str:
        """
        Classify wet bulb temperature danger level

        Based on research:
        - 35°C (95°F): Maximum survivable for healthy humans
        - 32°C (90°F): Extreme danger
        - 28°C (82°F): High danger
        - 24°C (75°F): Moderate danger
        """
        if wbt_c >= 35:
            return 'extreme'
        elif wbt_c >= 32:
            return 'very_high'
        elif wbt_c >= 28:
            return 'high'
        elif wbt_c >= 24:
            return 'moderate'
        else:
            return 'low'


if __name__ == '__main__':
    # Test the service
    service = WetBulbService()

    # Test bounds: Southwest USA
    bounds = (-115, 31, -103, 37)

    result = service.get_wet_bulb_hexagons(
        bounds=bounds,
        year=2025,
        scenario='ssp245',
        resolution=4
    )

    print(f"\n📊 Generated {len(result['features'])} hexagons")
    if result['features']:
        print(f"Sample feature: {result['features'][0]['properties']}")
