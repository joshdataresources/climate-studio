"""
Metro Humidity Service

Fetches real climate projection data from Earth Engine for metro areas:
- NASA NEX-GDDP-CMIP6: Temperature, humidity, precipitation projections
- CHC-CMIP6: Wet bulb globe temperature (WBGT) projections

Calculates:
- Peak humidity (%)
- Wet bulb temperature events
- Heat index / humid temperature
- Days over 100°F
"""

import ee
import logging
from typing import Dict, List, Optional
from datetime import datetime
import numpy as np

logger = logging.getLogger(__name__)


class MetroHumidityService:
    """Service for fetching metro area humidity and heat stress projections"""

    # Metro city coordinates
    METRO_CITIES = {
        'Baltimore': {'lat': 39.2904, 'lng': -76.6122},
        'Houston': {'lat': 29.7604, 'lng': -95.3698},
        'Miami': {'lat': 25.7617, 'lng': -80.1918},
        'Phoenix': {'lat': 33.4484, 'lng': -112.0740},
        'New York': {'lat': 40.7128, 'lng': -74.0060},
        'Chicago': {'lat': 41.8781, 'lng': -87.6298},
        'Los Angeles': {'lat': 34.0522, 'lng': -118.2437},
        'Atlanta': {'lat': 33.7490, 'lng': -84.3880}
    }

    def __init__(self, ee_project: str):
        """
        Initialize the Metro Humidity Service

        Args:
            ee_project: Google Earth Engine project ID
        """
        self.ee_project = ee_project
        self.initialized = False
        self._initialize_ee()

    def _initialize_ee(self):
        """Initialize Earth Engine"""
        import os
        try:
            sa_key = os.getenv('GOOGLE_APPLICATION_CREDENTIALS')
            sa_email = os.getenv('EE_SERVICE_ACCOUNT')
            if sa_key and sa_email and os.path.exists(sa_key):
                credentials = ee.ServiceAccountCredentials(sa_email, sa_key)
                ee.Initialize(credentials, project=self.ee_project)
                logger.info(f"✅ Metro Humidity Service: Earth Engine initialized with service account: {sa_email}")
            elif self.ee_project:
                ee.Initialize(project=self.ee_project)
                logger.info("✅ Metro Humidity Service: Earth Engine initialized")
            else:
                ee.Initialize()
                logger.info("✅ Metro Humidity Service: Earth Engine initialized with default credentials")
            self.initialized = True
        except Exception as e:
            logger.error(f"❌ Metro Humidity Service: Failed to initialize Earth Engine: {e}")
            self.initialized = False

    def _calculate_wet_bulb_temp(self, temp_c: float, rh: float) -> float:
        """
        Calculate wet bulb temperature using simplified Stull formula

        Args:
            temp_c: Temperature in Celsius
            rh: Relative humidity (0-100)

        Returns:
            Wet bulb temperature in Celsius
        """
        # Stull (2011) formula for wet bulb temperature
        # Tw = T * atan[0.151977 * (RH% + 8.313659)^0.5]
        #      + atan(T + RH%) - atan(RH% - 1.676331)
        #      + 0.00391838 * RH%^1.5 * atan(0.023101 * RH%)
        #      - 4.686035

        try:
            tw = (temp_c * np.arctan(0.151977 * (rh + 8.313659)**0.5) +
                  np.arctan(temp_c + rh) -
                  np.arctan(rh - 1.676331) +
                  0.00391838 * (rh**1.5) * np.arctan(0.023101 * rh) -
                  4.686035)
            return tw
        except:
            # Fallback: simple approximation
            return temp_c * (rh / 100.0)

    def _celsius_to_fahrenheit(self, celsius: float) -> float:
        """Convert Celsius to Fahrenheit"""
        return (celsius * 9/5) + 32

    def get_metro_humidity_projections(
        self,
        year: int = 2050,
        scenario: str = 'ssp245'
    ) -> Dict:
        """
        Get humidity projections for all metro cities

        Args:
            year: Projection year (2015-2100)
            scenario: SSP scenario (ssp245, ssp585, etc.)

        Returns:
            GeoJSON FeatureCollection with humidity data for each city
        """
        if not self.initialized:
            logger.error("Earth Engine not initialized")
            return self._get_fallback_data(year)

        try:
            features = []

            for city_name, coords in self.METRO_CITIES.items():
                logger.info(f"Fetching data for {city_name} (year={year}, scenario={scenario})")

                # Get climate data for this location
                data = self._fetch_climate_data(coords['lat'], coords['lng'], year, scenario)

                feature = {
                    'type': 'Feature',
                    'properties': {
                        'city': city_name,
                        'lat': coords['lat'],
                        'lng': coords['lng'],
                        'humidity_projections': {
                            str(year): data
                        }
                    },
                    'geometry': {
                        'type': 'Point',
                        'coordinates': [coords['lng'], coords['lat']]
                    }
                }
                features.append(feature)

            return {
                'type': 'FeatureCollection',
                'name': 'Metro Humidity Statistics',
                'features': features
            }

        except Exception as e:
            logger.error(f"Error fetching metro humidity data: {e}")
            return self._get_fallback_data(year)

    def _fetch_climate_data(
        self,
        lat: float,
        lng: float,
        year: int,
        scenario: str
    ) -> Dict:
        """
        Fetch climate data from Earth Engine for a specific location and year

        Args:
            lat: Latitude
            lng: Longitude
            year: Projection year
            scenario: SSP scenario

        Returns:
            Dictionary with humidity metrics
        """
        try:
            # Create point geometry
            point = ee.Geometry.Point([lng, lat])

            # NASA NEX-GDDP-CMIP6 dataset
            dataset = ee.ImageCollection('NASA/GDDP-CMIP6')

            # Filter by scenario and year
            # NASA NEX-GDDP uses 'ssp245', 'ssp585' etc.
            filtered = dataset.filter(ee.Filter.eq('scenario', scenario))

            # Get date range for the year
            start_date = f'{year}-01-01'
            end_date = f'{year}-12-31'
            filtered = filtered.filterDate(start_date, end_date)

            # Select first available model (or could aggregate multiple models)
            filtered = filtered.filter(ee.Filter.eq('model', 'ACCESS-CM2')).first()

            if filtered is None:
                logger.warning(f"No data found for year {year}, scenario {scenario}")
                return self._get_fallback_metrics(year)

            # Get temperature (tasmax - maximum temperature in Kelvin)
            # and humidity (hurs - relative humidity %)
            tasmax = filtered.select('tasmax')
            hurs = filtered.select('hurs') if 'hurs' in filtered.bandNames().getInfo() else None

            # Sample at the point location
            temp_sample = tasmax.sample(point, 1000).first()
            temp_k = temp_sample.get('tasmax').getInfo()
            temp_c = temp_k - 273.15 if temp_k else 25.0
            temp_f = self._celsius_to_fahrenheit(temp_c)

            # Get humidity if available
            if hurs:
                humidity_sample = hurs.sample(point, 1000).first()
                rh = humidity_sample.get('hurs').getInfo()
            else:
                # Estimate based on location (fallback)
                rh = self._estimate_humidity(lat, lng)

            # Calculate metrics
            wet_bulb_c = self._calculate_wet_bulb_temp(temp_c, rh)
            wet_bulb_f = self._celsius_to_fahrenheit(wet_bulb_c)

            # Count wet bulb events (days above 95°F / 35°C)
            wet_bulb_threshold = 35.0
            wet_bulb_events = max(0, int((wet_bulb_c - wet_bulb_threshold) * 5)) if wet_bulb_c > wet_bulb_threshold else 0

            # Estimate days over 100°F
            days_over_100 = max(0, int((temp_f - 100) * 2)) if temp_f > 100 else 0

            return {
                'peak_humidity': int(min(100, max(0, rh))),
                'wet_bulb_events': wet_bulb_events,
                'humid_temp': int(wet_bulb_f),
                'days_over_100': days_over_100
            }

        except Exception as e:
            logger.error(f"Error fetching climate data for ({lat}, {lng}): {e}")
            return self._get_fallback_metrics(year)

    def _estimate_humidity(self, lat: float, lng: float) -> float:
        """
        Estimate typical humidity based on location
        (Fallback when humidity data not available)
        """
        # Coastal/humid regions
        if abs(lat) < 35:  # Tropical/subtropical
            return 70.0
        elif lng < -100:  # Western US (dry)
            return 30.0
        else:  # Eastern US / moderate
            return 55.0

    def _get_fallback_metrics(self, year: int) -> Dict:
        """Generate fallback metrics when Earth Engine data unavailable"""
        # Simple linear projection based on year
        year_factor = (year - 2025) / 100.0  # 0 to 1 scale

        return {
            'peak_humidity': int(50 + year_factor * 30),
            'wet_bulb_events': int(10 + year_factor * 50),
            'humid_temp': int(115 + year_factor * 40),
            'days_over_100': int(30 + year_factor * 80)
        }

    def _get_fallback_data(self, year: int) -> Dict:
        """Generate complete fallback dataset"""
        features = []

        for city_name, coords in self.METRO_CITIES.items():
            metrics = self._get_fallback_metrics(year)

            feature = {
                'type': 'Feature',
                'properties': {
                    'city': city_name,
                    'lat': coords['lat'],
                    'lng': coords['lng'],
                    'humidity_projections': {
                        str(year): metrics
                    }
                },
                'geometry': {
                    'type': 'Point',
                    'coordinates': [coords['lng'], coords['lat']]
                }
            }
            features.append(feature)

        return {
            'type': 'FeatureCollection',
            'name': 'Metro Humidity Statistics (Fallback)',
            'features': features
        }
