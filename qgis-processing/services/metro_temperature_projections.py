"""
Metro Temperature Projections Service

Extracts decadal temperature projections for US metro areas using
NASA NEX-GDDP-CMIP6 climate models from Google Earth Engine.

Data Source: NASA Earth Exchange Global Daily Downscaled Projections (NEX-GDDP-CMIP6)
Resolution: 0.25 degrees (~25km)
Coverage: 2015-2100
Scenarios: SSP2-4.5 (moderate emissions), SSP5-8.5 (high emissions)
"""

import ee
import json
import os
from typing import Dict, List, Optional
from pathlib import Path
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class MetroTemperatureService:
    """Extract temperature projections for metro areas from NASA NEX-GDDP-CMIP6"""

    # Multi-model ensemble for robustness
    MODELS = [
        'ACCESS-CM2',      # Australian model
        'CMCC-ESM2',       # Italian model
        'MIROC6',          # Japanese model
        'MRI-ESM2-0'       # Japanese Meteorological model
    ]

    SCENARIOS = ['ssp245', 'ssp585']  # Moderate and high emissions

    # Decadal periods for analysis
    DECADES = [2025, 2035, 2045, 2055, 2065, 2075, 2085, 2095]

    # Baseline period for comparison (IPCC standard)
    BASELINE_START = '1995-01-01'
    BASELINE_END = '2014-12-31'

    def __init__(self, ee_project: str):
        """Initialize Earth Engine with project ID"""
        self.ee_project = ee_project
        try:
            ee.Initialize(project=ee_project)
            logger.info(f"✅ Earth Engine initialized (project: {ee_project})")
        except Exception as e:
            logger.error(f"❌ Failed to initialize Earth Engine: {e}")
            raise

    def get_baseline_temperatures(
        self,
        lat: float,
        lon: float,
        radius_km: float = 50
    ) -> Optional[Dict]:
        """
        Get 1995-2014 baseline temperatures for comparison

        Args:
            lat: Latitude of metro center
            lon: Longitude of metro center
            radius_km: Buffer radius around center point

        Returns:
            Dict with avg_summer_max, avg_winter_min, avg_annual (in Fahrenheit)
        """
        try:
            # Create region geometry
            point = ee.Geometry.Point([lon, lat])
            region = point.buffer(radius_km * 1000)  # km to meters

            # Use historical scenario data from CMIP6
            dataset = ee.ImageCollection('NASA/GDDP-CMIP6') \
                .filter(ee.Filter.date(self.BASELINE_START, self.BASELINE_END)) \
                .filter(ee.Filter.eq('scenario', 'historical')) \
                .filter(ee.Filter.eq('model', 'ACCESS-CM2')) \
                .select(['tasmax', 'tasmin'])

            # Calculate mean temperatures over baseline period
            mean_image = dataset.mean()

            # Extract values for region
            stats = mean_image.reduceRegion(
                reducer=ee.Reducer.mean(),
                geometry=region,
                scale=25000,  # 25km (matches NEX-GDDP resolution)
                maxPixels=1e9
            ).getInfo()

            if not stats or 'tasmax' not in stats or 'tasmin' not in stats:
                logger.warning(f"Missing baseline data at ({lat}, {lon})")
                return None

            # Convert Kelvin to Fahrenheit
            tasmax_k = stats['tasmax']
            tasmin_k = stats['tasmin']

            tasmax_f = self._kelvin_to_fahrenheit(tasmax_k)
            tasmin_f = self._kelvin_to_fahrenheit(tasmin_k)
            avg_annual = (tasmax_f + tasmin_f) / 2

            return {
                'avg_summer_max': round(tasmax_f, 1),
                'avg_winter_min': round(tasmin_f, 1),
                'avg_annual': round(avg_annual, 1)
            }

        except Exception as e:
            logger.error(f"Error getting baseline for ({lat}, {lon}): {e}")
            return None

    def get_decadal_projections(
        self,
        lat: float,
        lon: float,
        scenario: str,
        decade: int,
        radius_km: float = 50
    ) -> Optional[Dict]:
        """
        Get temperature projection for a specific decade

        Args:
            lat: Latitude of metro center
            lon: Longitude of metro center
            scenario: 'ssp245' or 'ssp585'
            decade: Start year of decade (e.g., 2025 for 2025-2034)
            radius_km: Buffer radius around center point

        Returns:
            Dict with summer_max, winter_min, annual_avg (in Fahrenheit)
        """
        try:
            # Create region geometry
            point = ee.Geometry.Point([lon, lat])
            region = point.buffer(radius_km * 1000)

            # Define decade date range
            start_year = decade
            end_year = decade + 9
            start_date = f'{start_year}-01-01'
            end_date = f'{end_year}-12-31'

            # Multi-model ensemble averaging
            model_results = []

            for model in self.MODELS:
                try:
                    # Query NEX-GDDP-CMIP6 for this model/scenario/decade
                    dataset = ee.ImageCollection('NASA/GDDP-CMIP6') \
                        .filter(ee.Filter.date(start_date, end_date)) \
                        .filter(ee.Filter.eq('scenario', scenario)) \
                        .filter(ee.Filter.eq('model', model)) \
                        .select(['tasmax', 'tasmin'])

                    # Check if collection has data
                    size = dataset.size().getInfo()
                    if size == 0:
                        logger.warning(f"No data for {model}/{scenario}/{decade}")
                        continue

                    # Calculate mean over decade
                    mean_image = dataset.mean()

                    # Extract values
                    stats = mean_image.reduceRegion(
                        reducer=ee.Reducer.mean(),
                        geometry=region,
                        scale=25000,
                        maxPixels=1e9
                    ).getInfo()

                    if stats and 'tasmax' in stats and 'tasmin' in stats:
                        model_results.append({
                            'model': model,
                            'tasmax': stats['tasmax'],
                            'tasmin': stats['tasmin']
                        })
                        logger.debug(f"✓ {model} data extracted")

                except Exception as e:
                    logger.warning(f"Error with {model}: {e}")
                    continue

            if not model_results:
                logger.error(f"No models returned data for {scenario}/{decade}")
                return None

            # Average across models
            avg_tasmax_k = sum(r['tasmax'] for r in model_results) / len(model_results)
            avg_tasmin_k = sum(r['tasmin'] for r in model_results) / len(model_results)

            # Convert to Fahrenheit
            tasmax_f = self._kelvin_to_fahrenheit(avg_tasmax_k)
            tasmin_f = self._kelvin_to_fahrenheit(avg_tasmin_k)
            annual_avg = (tasmax_f + tasmin_f) / 2

            return {
                'summer_max': round(tasmax_f, 1),
                'winter_min': round(tasmin_f, 1),
                'annual_avg': round(annual_avg, 1),
                'models_used': len(model_results)
            }

        except Exception as e:
            logger.error(f"Error getting projection for ({lat}, {lon}) {scenario}/{decade}: {e}")
            return None

    def generate_metro_projections(self, metro: Dict) -> Optional[Dict]:
        """
        Generate all temperature projections for a single metro

        Args:
            metro: Dict with 'name', 'lat', 'lon' keys

        Returns:
            Dict with baseline and projections for both scenarios
        """
        name = metro['name']
        lat = metro['lat']
        lon = metro['lon']

        logger.info(f"📍 Processing {name} ({lat:.2f}, {lon:.2f})")

        # Get baseline
        logger.info(f"   Fetching baseline (1995-2014)...")
        baseline = self.get_baseline_temperatures(lat, lon)

        if not baseline:
            logger.error(f"   ❌ Failed to get baseline for {name}")
            return None

        logger.info(f"   ✓ Baseline: {baseline['avg_annual']}°F annual avg")

        # Get projections for both scenarios
        projections = {}

        for scenario in self.SCENARIOS:
            logger.info(f"   Fetching {scenario.upper()} projections...")
            projections[scenario] = {}

            for decade in self.DECADES:
                proj = self.get_decadal_projections(lat, lon, scenario, decade)

                if proj:
                    projections[scenario][str(decade)] = proj
                    logger.info(f"      {decade}s: {proj['annual_avg']}°F ({proj['models_used']} models)")
                else:
                    logger.warning(f"      {decade}s: No data")

        return {
            'name': name,
            'lat': lat,
            'lon': lon,
            'baseline_1995_2014': baseline,
            'projections': projections
        }

    def generate_all_metro_projections(
        self,
        metros: List[Dict],
        output_file: Optional[str] = None
    ) -> Dict:
        """
        Generate temperature projections for all metros

        Args:
            metros: List of metro dicts with 'name', 'lat', 'lon'
            output_file: Optional path to save results

        Returns:
            Dict mapping metro names to projection data
        """
        results = {}
        total = len(metros)

        logger.info(f"🌡️  Extracting temperature projections for {total} metros")
        logger.info(f"   Models: {', '.join(self.MODELS)}")
        logger.info(f"   Scenarios: {', '.join(self.SCENARIOS)}")
        logger.info(f"   Decades: {self.DECADES}\n")

        for i, metro in enumerate(metros, 1):
            logger.info(f"[{i}/{total}] {metro['name']}")

            try:
                metro_data = self.generate_metro_projections(metro)

                if metro_data:
                    results[metro['name']] = metro_data
                    logger.info(f"   ✅ Complete\n")
                else:
                    logger.warning(f"   ⚠️  Incomplete data\n")

            except Exception as e:
                logger.error(f"   ❌ Error: {e}\n")
                continue

        # Save results if output file specified
        if output_file:
            output_path = Path(output_file)
            output_path.parent.mkdir(parents=True, exist_ok=True)

            with open(output_path, 'w') as f:
                json.dump(results, f, indent=2)

            logger.info(f"💾 Results saved to {output_file}")

        logger.info(f"✅ Completed {len(results)}/{total} metros")

        return results

    @staticmethod
    def _kelvin_to_fahrenheit(kelvin: float) -> float:
        """Convert Kelvin to Fahrenheit"""
        celsius = kelvin - 273.15
        fahrenheit = celsius * 9/5 + 32
        return fahrenheit


def main():
    """Main execution: Extract temps for all metros in megaregion-data.json"""
    import argparse

    parser = argparse.ArgumentParser(description='Extract metro temperature projections')
    parser.add_argument(
        '--metros-file',
        default='../apps/climate-studio/src/data/megaregion-data.json',
        help='Path to megaregion data file'
    )
    parser.add_argument(
        '--output-file',
        default='metro_temperature_projections.json',
        help='Output file path'
    )
    parser.add_argument(
        '--limit',
        type=int,
        default=None,
        help='Limit number of metros (for testing)'
    )
    parser.add_argument(
        '--ee-project',
        default=os.getenv('EARTHENGINE_PROJECT', 'josh-geo-the-second'),
        help='Earth Engine project ID'
    )

    args = parser.parse_args()

    # Load metro data
    logger.info(f"📂 Loading metros from {args.metros_file}")
    with open(args.metros_file) as f:
        data = json.load(f)

    metros = data['metros']

    # Limit for testing if specified
    if args.limit:
        metros = metros[:args.limit]
        logger.info(f"   Testing with first {args.limit} metros")

    # Initialize service
    service = MetroTemperatureService(ee_project=args.ee_project)

    # Generate projections
    results = service.generate_all_metro_projections(
        metros=metros,
        output_file=args.output_file
    )

    # Print summary
    logger.info("\n" + "="*80)
    logger.info("📊 SUMMARY")
    logger.info("="*80)

    if results:
        # Find hottest cities in 2095 SSP5-8.5
        hottest = []
        for name, data in results.items():
            if 'ssp585' in data['projections'] and '2095' in data['projections']['ssp585']:
                temp_2095 = data['projections']['ssp585']['2095']['annual_avg']
                baseline = data['baseline_1995_2014']['avg_annual']
                increase = temp_2095 - baseline
                hottest.append((name, temp_2095, increase))

        hottest.sort(key=lambda x: x[1], reverse=True)

        logger.info(f"\n🔥 Top 5 Hottest Cities by 2095 (SSP5-8.5):")
        for i, (name, temp, increase) in enumerate(hottest[:5], 1):
            logger.info(f"   {i}. {name}: {temp:.1f}°F (+{increase:.1f}°F from baseline)")

    logger.info(f"\n✅ Done! Output: {args.output_file}")


if __name__ == '__main__':
    main()
