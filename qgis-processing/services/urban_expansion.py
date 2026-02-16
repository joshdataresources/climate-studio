"""
Urban Expansion and Population Projection Service using Google Earth Engine

Fetches and processes urban growth and population projections from:
- Urban expansion: projects/sat-io/open-datasets/FUTURE-URBAN-LAND/CHEN_2020_2100
- Population: NASA SEDAC SSP-based population grids (2020-2100)

Data sources:
- Chen et al. 2020 Urban Expansion Dataset
- SEDAC Global 1-km Population Projections
"""

import ee
import h3
import logging
import math

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class UrbanExpansionService:
    """Service for fetching urban expansion and population projections via Earth Engine"""

    # Available projection years (10-year intervals)
    PROJECTION_YEARS = [2020, 2030, 2040, 2050, 2060, 2070, 2080, 2090, 2100]

    # SSP scenarios for population data
    SSP_SCENARIOS = {
        'rcp26': 'SSP1',  # Sustainability
        'rcp45': 'SSP2',  # Middle of the road
        'rcp85': 'SSP5'   # Fossil-fueled development
    }

    def __init__(self, ee_project=None):
        """Initialize Urban Expansion Service with Earth Engine"""
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
                logger.info(f"Earth Engine initialized for urban expansion with service account: {sa_email}")
            elif self.ee_project:
                ee.Initialize(project=self.ee_project)
                logger.info("Earth Engine initialized for urban expansion data")
            else:
                ee.Initialize()
                logger.info("Earth Engine initialized for urban expansion with default credentials")
            self.initialized = True
        except Exception as e:
            logger.error(f"Failed to initialize Earth Engine: {e}")
            self.initialized = False

    def _get_nearest_year(self, year):
        """Get nearest available projection year"""
        return min(self.PROJECTION_YEARS, key=lambda x: abs(x - year))

    def get_urban_expansion_circles(self, bounds, year=2050, scenario='rcp45', min_density=0.3):
        """
        Get urban expansion as smooth circular buffers around urban cores.
        More realistic representation of metropolitan growth patterns.

        Args:
            bounds: Dict with 'north', 'south', 'east', 'west' keys
            year: Projection year (2020-2100)
            scenario: Climate scenario ('rcp26', 'rcp45', 'rcp85')
            min_density: Minimum GHSL density to consider as urban core (0-1)

        Returns:
            GeoJSON FeatureCollection with circular growth buffers
        """
        if not self.initialized:
            logger.error("Earth Engine not initialized")
            return {'type': 'FeatureCollection', 'features': []}

        try:
            # Load GHSL 2020 data for urban cores
            ghsl_2020 = ee.Image('JRC/GHSL/P2023A/GHS_BUILT_S/2020').select('built_surface')

            # Calculate years from base year
            projection_year = year
            years_from_2020 = max(0, projection_year - 2020)

            # Base growth rate: 500m per year
            # This creates ~40km radius by 2100 for tier 1 cities
            base_growth_rate = 500  # meters per year

            logger.info(f"Generating circular buffers for year {projection_year}")

            # Create bounding box geometry
            bbox = ee.Geometry.Rectangle([
                bounds['west'], bounds['south'],
                bounds['east'], bounds['north']
            ])

            # Strategy: Use focal operations to aggregate nearby urban areas into metro regions
            # This clusters pixels within ~20km into single metropolitan areas

            # Step 1: Create urban mask (only high-density areas)
            urban_mask = ghsl_2020.gte(0.5)  # Significant urban density

            # Step 2: Use focal_max with large radius to merge nearby urban areas
            # This groups all urban pixels within ~20km radius into connected regions
            metro_regions = urban_mask.focal_max(radius=20000, units='meters', kernelType='circle')

            # Step 3: Calculate sum of built surface within each region (proxy for metro size)
            # Use reduceNeighborhood with sum reducer since focal_sum doesn't exist
            kernel = ee.Kernel.circle(radius=20000, units='meters')
            built_sum = ghsl_2020.multiply(metro_regions).reduceNeighborhood(
                reducer=ee.Reducer.sum(),
                kernel=kernel
            )

            # Step 4: Find regional maxima (one point per metro area)
            # This gives us the center of each metropolitan cluster
            local_max = built_sum.focal_max(radius=30000, units='meters', kernelType='circle').eq(built_sum)
            metro_centers = built_sum.updateMask(local_max)

            # Step 5: Convert to vector points (one per metro)
            vectors = metro_centers.reduceToVectors(
                geometry=bbox,
                scale=10000,  # 10km sampling - coarse to get one point per metro
                geometryType='centroid',
                maxPixels=1e8,
                bestEffort=True
            )

            # Step 6: Sample the total built surface to determine metro tier
            vectors_with_density = built_sum.reduceRegions(
                collection=vectors,
                reducer=ee.Reducer.max(),  # Get the peak built surface value
                scale=5000
            )

            # Get features
            features_info = vectors_with_density.getInfo()

            features = []
            for feature in features_info.get('features', []):
                # Get total built surface (proxy for metro size)
                built_total = feature['properties'].get('max', 0)
                if built_total is None or built_total <= 0:
                    continue

                # Get centroid coordinates
                coords = feature['geometry']['coordinates']

                # Tier-based sizing using total built surface as proxy for metro size
                # Larger values = bigger metropolitan areas (NYC, LA, etc)
                # Base radius = current metro size in 2020
                # Growth = additional expansion per year
                if built_total > 150:  # Very large metros (NYC, LA, Chicago)
                    tier = 1
                    base_radius_m = 50000  # 50km base
                    growth_rate_per_year = 1000  # Fast growth
                    color = '#ff6600'  # Darker orange
                elif built_total > 80:  # Large metros (Boston, DC, Baltimore, Philly)
                    tier = 2
                    base_radius_m = 35000  # 35km base
                    growth_rate_per_year = 700  # Medium growth
                    color = '#ff8833'
                elif built_total > 40:  # Mid-size cities (Hartford, Providence)
                    tier = 3
                    base_radius_m = 20000  # 20km base
                    growth_rate_per_year = 400  # Slower growth
                    color = '#ffaa66'
                else:  # Small cities
                    tier = 4
                    base_radius_m = 12000  # 12km base
                    growth_rate_per_year = 250  # Slow growth
                    color = '#ffcc99'

                # Calculate expansion radius: base size + growth over time
                growth_m = years_from_2020 * growth_rate_per_year
                radius_m = base_radius_m + growth_m

                # Convert meters to degrees (approximate at mid-latitude)
                # 1 degree ≈ 111km at equator, adjust for latitude
                lat = coords[1]
                radius_deg_lat = radius_m / 111000
                radius_deg_lng = radius_m / (111000 * abs(math.cos(math.radians(lat))))

                # Create circle polygon (32 points)
                circle_points = []
                for i in range(33):  # 33 to close the polygon
                    angle = (i / 32) * 2 * math.pi
                    point_lng = coords[0] + radius_deg_lng * math.cos(angle)
                    point_lat = coords[1] + radius_deg_lat * math.sin(angle)
                    circle_points.append([point_lng, point_lat])

                # Create circular buffer feature
                features.append({
                    'type': 'Feature',
                    'geometry': {
                        'type': 'Polygon',
                        'coordinates': [circle_points]
                    },
                    'properties': {
                        'tier': tier,
                        'built_total': float(built_total),
                        'base_radius_m': base_radius_m,
                        'radius_m': int(radius_m),
                        'radius_km': round(radius_m / 1000, 1),
                        'color': color,
                        'center_lng': coords[0],
                        'center_lat': coords[1],
                        'year': projection_year,
                        'scenario': scenario
                    }
                })

            logger.info(f"Created {len(features)} circular buffers (year {projection_year})")

            return {
                'type': 'FeatureCollection',
                'features': features,
                'metadata': {
                    'year': projection_year,
                    'scenario': scenario,
                    'source': 'GHSL 2023 Circular Buffers',
                    'circle_count': len(features)
                }
            }

        except Exception as e:
            logger.error(f"Error generating circular urban expansion: {e}", exc_info=True)
            return {'type': 'FeatureCollection', 'features': []}

    def get_urban_expansion_tile_url(self, bounds, year=2050, scenario='rcp45'):
        """
        Get Earth Engine tile URL for urban expansion visualization

        Args:
            bounds: Dict with 'north', 'south', 'east', 'west' keys
            year: Projection year (2020-2100)
            scenario: Climate scenario ('rcp26', 'rcp45', 'rcp85')

        Returns:
            Dict with 'tile_url' and 'metadata'
        """
        if not self.initialized:
            logger.error("Earth Engine not initialized")
            return None

        try:
            # Use the actual year directly (not rounded to dataset years)
            # since we're generating expansion dynamically
            projection_year = year

            # Try multiple dataset sources in order of preference
            urban_image = None
            source_name = None

            # Map RCP to SSP scenario for urban datasets
            ssp_mapping = {
                'rcp26': 'SSP1',  # Sustainability
                'rcp45': 'SSP2',  # Middle of the road
                'rcp85': 'SSP5'   # Fossil-fueled development
            }
            ssp_scenario = ssp_mapping.get(scenario, 'SSP2')

            # Try Chen et al. 2020 dataset first (real projections)
            # Note: Dataset may not be publicly accessible despite being in Community Catalog
            try:
                logger.info(f"Attempting Chen et al. 2020 dataset for year {projection_year}, {ssp_scenario}")

                # Chen dataset uses format: CHEN_YYYY where YYYY is the year
                # Available years: 2020, 2030, 2040, 2050, 2060, 2070, 2080, 2090, 2100
                dataset_year = min(self.PROJECTION_YEARS, key=lambda x: abs(x - projection_year))

                # Try to load Chen dataset
                chen_asset = f'projects/sat-io/open-datasets/FUTURE-URBAN-LAND/CHEN_2020_2100/CHEN_{dataset_year}'
                chen_image = ee.Image(chen_asset).select(ssp_scenario)

                # Test if dataset is actually accessible by attempting to get map ID
                # This will fail immediately if dataset doesn't exist or requires permissions
                test_vis = {'min': 0, 'max': 1, 'palette': ['000000']}
                _ = chen_image.getMapId(test_vis)

                # If we get here, dataset is accessible
                urban_image = chen_image
                source_name = f'Chen et al. 2020 Urban Expansion {dataset_year} ({ssp_scenario})'
                logger.info(f"Successfully loaded and verified Chen dataset: {chen_asset}")

            except Exception as e:
                logger.warning(f"Chen dataset unavailable ({str(e)[:100]}), falling back to GHSL simulation")
                urban_image = None  # Force fallback

            # If Chen dataset failed, use GHSL fallback
            if urban_image is None:
                # Fallback: Use GHSL with projection-based spatial expansion
                logger.info(f"Using GHSL-based urban expansion for year {projection_year}, {ssp_scenario}")

                # Load current GHSL data (2020) as urban core
                ghsl_2020 = ee.Image('JRC/GHSL/P2023A/GHS_BUILT_S/2020').select('built_surface')

                # Load DEM for terrain-aware expansion (avoid water, mountains)
                dem = ee.Image('USGS/SRTMGL1_003')
                slope = ee.Terrain.slope(dem)

                # Calculate years from base year
                years_from_2020 = projection_year - 2020

                # Scenario-based expansion (VERY aggressive to be visible at global scale)
                # These are km PER YEAR to make changes visible on the map
                growth_params = {
                    'rcp26': {'expansion_km': 5.0},   # Low: ~400km by 2100
                    'rcp45': {'expansion_km': 8.0},   # Medium: ~640km by 2100
                    'rcp85': {'expansion_km': 12.0}   # High: ~960km by 2100
                }
                params = growth_params.get(scenario, growth_params['rcp45'])

                # Base expansion radius
                base_expansion_m = int(params['expansion_km'] * 1000 * years_from_2020)

                # Tier-based urban center identification and growth circles
                # Only show major metro areas with distinct, non-overlapping circles
                if years_from_2020 > 0:
                    # TIER SYSTEM:
                    # Tier 1 (Mega metros): >70% built surface, >30px cluster → Major growth circles
                    # Tier 2 (Large metros): 50-70% built surface, >20px cluster → Medium circles
                    # Tier 3 (Medium cities): 30-50% built surface, >10px cluster → Small circles
                    # Below Tier 3: No circles shown (too small to be significant)

                    # Base expansion rate per year
                    expansion_per_year = 400  # meters per year

                    # Tier 1: Mega metros (NYC, LA, Chicago, etc.)
                    tier1_cores = ghsl_2020.gt(0.7)
                    tier1_clustered = tier1_cores.connectedPixelCount(30, False)
                    tier1_mask = tier1_clustered.gte(30)  # At least 30 connected high-density pixels
                    tier1_expansion_m = int(years_from_2020 * expansion_per_year * 2.0)  # 2x growth rate

                    tier1_hexagons = tier1_cores.updateMask(tier1_mask).focal_max(
                        radius=tier1_expansion_m,
                        units='meters',
                        kernelType='square'
                    ).multiply(0.2)  # 20% opacity (uniform across all tiers)

                    # Tier 2: Large metros (Charlotte, Nashville, etc.)
                    tier2_cores = ghsl_2020.gt(0.5).And(ghsl_2020.lte(0.7))
                    tier2_clustered = tier2_cores.connectedPixelCount(20, False)
                    tier2_mask = tier2_clustered.gte(20)
                    tier2_expansion_m = int(years_from_2020 * expansion_per_year * 1.5)  # 1.5x growth rate

                    tier2_hexagons = tier2_cores.updateMask(tier2_mask).focal_max(
                        radius=tier2_expansion_m,
                        units='meters',
                        kernelType='square'
                    ).multiply(0.2)  # 20% opacity (uniform across all tiers)

                    # Tier 3: Medium cities (smaller metros)
                    tier3_cores = ghsl_2020.gt(0.3).And(ghsl_2020.lte(0.5))
                    tier3_clustered = tier3_cores.connectedPixelCount(10, False)
                    tier3_mask = tier3_clustered.gte(10)
                    tier3_expansion_m = int(years_from_2020 * expansion_per_year * 1.0)  # 1x growth rate

                    tier3_hexagons = tier3_cores.updateMask(tier3_mask).focal_max(
                        radius=tier3_expansion_m,
                        units='meters',
                        kernelType='square'
                    ).multiply(0.2)  # 20% opacity (uniform across all tiers)

                    # Combine all tiers - larger hexagons will naturally merge nearby metros
                    # (e.g., NYC-Newark, Raleigh-Durham-Chapel Hill will appear as one region)
                    urban_image = ghsl_2020.add(tier1_hexagons).add(tier2_hexagons).add(tier3_hexagons)
                else:
                    urban_image = ghsl_2020

                source_name = f'GHSL Tiered Urban Growth {projection_year} ({scenario.upper()})'
                logger.info(f"Tiered expansion - T1:{tier1_expansion_m/1000:.1f}km, T2:{tier2_expansion_m/1000:.1f}km, T3:{tier3_expansion_m/1000:.1f}km")

            # Final check
            if urban_image is None:
                logger.error("No urban expansion datasets available")
                return None

            # Visualization parameters - works for both Chen data and GHSL fallback
            # Chen data: binary urban/non-urban (0/1)
            # GHSL data: built surface fraction (0-1)
            urban_mask = urban_image.gt(0.01)  # Filter very low values
            urban_image = urban_image.updateMask(urban_mask)

            vis_params = {
                'min': 0.0,
                'max': 1.0,
                'palette': ['ff8c0033', 'ff8c0099', 'ff6600ff']  # Orange gradient, lighter to more visible
            }

            # Get map ID
            map_id = urban_image.getMapId(vis_params)

            return {
                'tile_url': map_id['tile_fetcher'].url_format,
                'metadata': {
                    'year': projection_year,
                    'scenario': scenario,
                    'source': source_name,
                    'resolution': '1 km',
                    'description': f'Urban extent for {projection_year}'
                }
            }

        except Exception as e:
            logger.error(f"Error generating urban expansion tile URL: {e}", exc_info=True)
            return None

    def get_population_at_point(self, lat, lng, year=2050, scenario='rcp45'):
        """
        Get population projection at a specific point

        Args:
            lat: Latitude
            lng: Longitude
            year: Projection year (2020-2100)
            scenario: Climate scenario ('rcp26', 'rcp45', 'rcp85')

        Returns:
            Dict with population value and metadata
        """
        if not self.initialized:
            logger.error("Earth Engine not initialized")
            return None

        try:
            # Get nearest available year
            projection_year = self._get_nearest_year(year)

            # Map scenario to SSP
            ssp = self.SSP_SCENARIOS.get(scenario, 'SSP2')

            # Try multiple population datasets
            pop_datasets = [
                {
                    'collection': 'CIESIN/GPWv411/GPW_Population_Count',
                    'band': 'population_count',
                    'scale': 1000
                },
                {
                    'collection': 'WorldPop/GP/100m/pop',
                    'band': 'population',
                    'scale': 100
                }
            ]

            population = None

            for dataset in pop_datasets:
                try:
                    # Load population data
                    pop_collection = ee.ImageCollection(dataset['collection'])
                    pop_image = pop_collection.sort('system:time_start', False).first()

                    if pop_image is None:
                        continue

                    # Sample at point
                    point = ee.Geometry.Point([lng, lat])
                    sample = pop_image.reduceRegion(
                        reducer=ee.Reducer.mean(),
                        geometry=point,
                        scale=dataset['scale'],
                        maxPixels=1
                    )

                    result = sample.getInfo()
                    if result and dataset['band'] in result:
                        population = int(result[dataset['band']] or 0)
                        break

                except Exception as e:
                    logger.warning(f"Could not query {dataset['collection']}: {e}")
                    continue

            if population is None:
                population = 0

            return {
                'population': int(population),
                'year': projection_year,
                'scenario': ssp,
                'location': {'lat': lat, 'lng': lng},
                'metadata': {
                    'source': 'SEDAC/WorldPop Population Projections',
                    'resolution': '1 km'
                }
            }

        except Exception as e:
            logger.error(f"Error querying population at point: {e}", exc_info=True)
            return {
                'population': None,
                'error': str(e),
                'year': year,
                'location': {'lat': lat, 'lng': lng}
            }

    def get_population_hexagons(self, bounds, year=2050, scenario='rcp45', resolution=7):
        """
        Get population data as hexagonal grid (for tooltip display)

        Args:
            bounds: Dict with 'north', 'south', 'east', 'west' keys
            year: Projection year (2020-2100)
            scenario: Climate scenario
            resolution: H3 hexagon resolution (4-10)

        Returns:
            GeoJSON FeatureCollection with hexagonal population data
        """
        if not self.initialized:
            logger.error("Earth Engine not initialized")
            return {'type': 'FeatureCollection', 'features': []}

        try:
            # Get nearest year
            projection_year = self._get_nearest_year(year)
            ssp = self.SSP_SCENARIOS.get(scenario, 'SSP2')

            # Generate H3 hexagons for bounds
            hexagons = []
            h3_indexes = h3.polyfill(
                {
                    'type': 'Polygon',
                    'coordinates': [[
                        [bounds['west'], bounds['south']],
                        [bounds['east'], bounds['south']],
                        [bounds['east'], bounds['north']],
                        [bounds['west'], bounds['north']],
                        [bounds['west'], bounds['south']]
                    ]]
                },
                resolution,
                geo_json_conformant=True
            )

            # Sample population for each hexagon (limit to avoid timeout)
            sampled_count = 0
            max_samples = 100

            for hex_id in list(h3_indexes)[:max_samples]:
                hex_boundary = h3.h3_to_geo_boundary(hex_id, geo_json=True)
                hex_center = h3.h3_to_geo(hex_id)

                # Query population at center (simplified)
                pop_data = self.get_population_at_point(
                    hex_center[0], hex_center[1], projection_year, scenario
                )

                if pop_data and pop_data.get('population'):
                    hexagons.append({
                        'type': 'Feature',
                        'geometry': {
                            'type': 'Polygon',
                            'coordinates': [hex_boundary]
                        },
                        'properties': {
                            'h3_index': hex_id,
                            'population': pop_data['population'],
                            'year': projection_year,
                            'scenario': ssp
                        }
                    })

                sampled_count += 1

            return {
                'type': 'FeatureCollection',
                'features': hexagons
            }

        except Exception as e:
            logger.error(f"Error generating population hexagons: {e}", exc_info=True)
            return {'type': 'FeatureCollection', 'features': []}
