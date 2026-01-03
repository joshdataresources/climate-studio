"""
Climate Data Server

Flask API for serving NASA NEX-GDDP-CMIP6 temperature projections
and other climate data layers.
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import logging
import sys
import os
import requests
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Add services directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'services'))

from nasa_ee_climate import NASAEEClimateService
from noaa_sea_level import NOAASeaLevelService
from urban_heat_island import UrbanHeatIslandService
from topographic_relief import TopographicReliefService
from precipitation_drought import PrecipitationDroughtService
from urban_expansion import UrbanExpansionService

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__)
CORS(app)

# Get Earth Engine project from environment
ee_project = os.getenv('EARTHENGINE_PROJECT', 'josh-geo-the-second')

# Initialize climate services
climate_service = NASAEEClimateService(ee_project=ee_project)
sea_level_service = NOAASeaLevelService()
heat_island_service = UrbanHeatIslandService(ee_project=ee_project)
relief_service = TopographicReliefService()
drought_service = PrecipitationDroughtService(ee_project=ee_project)
urban_expansion_service = UrbanExpansionService(ee_project=ee_project)

# Health check endpoint
@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'climate-data-server',
        'version': '1.0.0'
    })


@app.route('/api/climate/status', methods=['GET'])
def climate_status():
    """Climate server status endpoint for frontend status display"""
    # Check all Earth Engine services
    ee_services = {
        'nasa_climate': climate_service.initialized,
        'urban_heat': heat_island_service.initialized,
        'precipitation': drought_service.initialized,
        'topographic': relief_service.initialized,
        'urban_expansion': urban_expansion_service.initialized
    }
    
    all_ready = all(ee_services.values())
    any_ready = any(ee_services.values())
    
    if all_ready:
        message = 'All systems operational'
    elif any_ready:
        ready_services = [name for name, ready in ee_services.items() if ready]
        message = f'Partial: {len(ready_services)}/{len(ee_services)} Earth Engine services ready'
    else:
        message = 'Earth Engine not initialized - check authentication and project configuration'
    
    return jsonify({
        'status': 'healthy',
        'service': 'climate-data-server',
        'version': '1.0.0',
        'earthEngine': {
            'ready': all_ready,
            'partial': any_ready and not all_ready,
            'services': ee_services
        },
        'message': message
    })


@app.route('/api/climate/temperature-projection', methods=['GET'])
def temperature_projection():
    """
    Get temperature projection data for a bounding box

    Query Parameters:
        north (float): Northern latitude bound
        south (float): Southern latitude bound
        east (float): Eastern longitude bound
        west (float): Western longitude bound
        year (int): Projection year (2020-2100), default 2050
        scenario (str): Climate scenario (rcp26, rcp45, rcp85), default rcp45
        resolution (int): H3 hexagon resolution (0-15), default 7
        use_real_data (bool): Use real NASA data vs simulated, default false

    Returns:
        GeoJSON FeatureCollection with hexagonal temperature anomalies
    """
    try:
        # Parse query parameters
        north = request.args.get('north', type=float)
        south = request.args.get('south', type=float)
        east = request.args.get('east', type=float)
        west = request.args.get('west', type=float)
        year = request.args.get('year', default=2050, type=int)
        scenario = request.args.get('scenario', default='rcp45', type=str)
        resolution = request.args.get('resolution', default=7, type=int)
        # Validate required parameters
        if None in [north, south, east, west]:
            return jsonify({
                'success': False,
                'error': 'Missing required parameters: north, south, east, west'
            }), 400

        # Validate bounds
        if not (-90 <= south < north <= 90):
            return jsonify({
                'success': False,
                'error': 'Invalid latitude bounds'
            }), 400

        if not (-180 <= west < east <= 180):
            return jsonify({
                'success': False,
                'error': 'Invalid longitude bounds'
            }), 400

        # Validate year range
        if not (2020 <= year <= 2100):
            return jsonify({
                'success': False,
                'error': 'Year must be between 2020 and 2100'
            }), 400

        # Validate scenario
        if scenario not in ['rcp26', 'rcp45', 'rcp85']:
            return jsonify({
                'success': False,
                'error': 'Scenario must be one of: rcp26, rcp45, rcp85'
            }), 400

        # Validate resolution (expanded range to support all zoom levels)
        if not (1 <= resolution <= 10):
            return jsonify({
                'success': False,
                'error': 'Resolution must be between 1 and 10'
            }), 400

        logger.info(f"Temperature projection request: bounds=[{south},{north}]x[{west},{east}], "
                   f"year={year}, scenario={scenario}, resolution={resolution}")

        # Build bounds dict
        bounds = {
            'north': north,
            'south': south,
            'east': east,
            'west': west
        }

        # Get temperature projection
        data = climate_service.get_temperature_projection(
            bounds=bounds,
            year=year,
            scenario=scenario,
            resolution=resolution
        )

        return jsonify({
            'success': True,
            'data': data,
            'metadata': {
                'bounds': bounds,
                'year': year,
                'scenario': scenario,
                'resolution': resolution,
                'feature_count': len(data.get('features', []))
            }
        })

    except ValueError as e:
        logger.error(f"Validation error: {str(e)}")
        return jsonify({
            'success': False,
            'error': f'Invalid parameter: {str(e)}'
        }), 400

    except Exception as e:
        logger.error(f"Error processing temperature projection: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/climate/temperature-projection/tiles', methods=['GET'])
def temperature_projection_tiles():
    """
    Get temperature projection tile URL for smooth heatmap visualization

    Query Parameters:
        north (float): Northern latitude bound (optional, for API compatibility)
        south (float): Southern latitude bound (optional)
        east (float): Eastern longitude bound (optional)
        west (float): Western longitude bound (optional)
        year (int): Projection year (2020-2100), default 2050
        scenario (str): Climate scenario (rcp26, rcp45, rcp85), default rcp45
        mode (str): Display mode ('anomaly' or 'actual'), default 'anomaly'

    Returns:
        JSON with Earth Engine tile URL and metadata
    """
    try:
        # Parse query parameters
        north = request.args.get('north', type=float)
        south = request.args.get('south', type=float)
        east = request.args.get('east', type=float)
        west = request.args.get('west', type=float)
        year = request.args.get('year', default=2050, type=int)
        scenario = request.args.get('scenario', default='rcp45', type=str)
        mode = request.args.get('mode', default='anomaly', type=str)

        # Validate year range
        if not (2020 <= year <= 2100):
            return jsonify({
                'success': False,
                'error': 'Year must be between 2020 and 2100'
            }), 400

        # Validate scenario
        if scenario not in ['rcp26', 'rcp45', 'rcp85']:
            return jsonify({
                'success': False,
                'error': 'Scenario must be one of: rcp26, rcp45, rcp85'
            }), 400

        # Validate mode
        if mode not in ['anomaly', 'actual']:
            return jsonify({
                'success': False,
                'error': 'Mode must be one of: anomaly, actual'
            }), 400

        logger.info(f"Temperature projection tile request: year={year}, scenario={scenario}, mode={mode}")

        # Build bounds dict (optional, not used for global tiles)
        bounds = {
            'north': north or 90,
            'south': south or -90,
            'east': east or 180,
            'west': west or -180
        }

        # Get tile URL
        result = climate_service.get_tile_url(
            bounds=bounds,
            year=year,
            scenario=scenario,
            mode=mode
        )

        if result:
            return jsonify({
                'success': True,
                'tile_url': result['tile_url'],
                'metadata': result['metadata']
            })
        else:
            return jsonify({
                'success': False,
                'error': 'Could not generate tile URL'
            }), 500

    except Exception as e:
        logger.error(f"Error generating temperature tile URL: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/tiles/noaa-slr-metadata', methods=['GET'])
def noaa_slr_metadata():
    """
    Get metadata for NOAA Sea Level Rise tiles

    Query parameters:
        feet: Sea level rise in feet (0-10), default 3

    Returns:
        JSON with tile metadata
    """
    try:
        feet = request.args.get('feet', default=3, type=int)

        return jsonify({
            'success': True,
            'feet': feet,
            'tile_url': f'/api/tiles/noaa-slr/{feet}/{{z}}/{{x}}/{{y}}.png',
            'metadata': {
                'source': 'NOAA Sea Level Rise Viewer',
                'feet': feet
            }
        })
    except Exception as e:
        logger.error(f"Error getting NOAA metadata: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/tiles/noaa-slr/<int:feet>/<int:z>/<int:x>/<int:y>.png', methods=['GET'])
def noaa_slr_tile(feet, z, x, y):
    """
    Proxy NOAA Sea Level Rise tiles

    Args:
        feet: Sea level rise in feet (0-10)
        z: Zoom level
        x: Tile X coordinate
        y: Tile Y coordinate

    Returns:
        PNG tile image
    """
    try:
        # NOAA SLR tile URL pattern
        noaa_url = f"https://coast.noaa.gov/arcgis/rest/services/dc_slr/slr_{feet}ft/MapServer/tile/{z}/{y}/{x}"

        # Fetch tile from NOAA
        response = requests.get(noaa_url, timeout=10)

        if response.status_code == 200:
            return response.content, 200, {'Content-Type': 'image/png'}
        else:
            # Return empty PNG on error
            import io
            from PIL import Image
            img = Image.new('RGBA', (256, 256), (0, 0, 0, 0))
            buf = io.BytesIO()
            img.save(buf, format='PNG')
            buf.seek(0)
            return buf.getvalue(), 200, {'Content-Type': 'image/png'}

    except Exception as e:
        logger.error(f"Error fetching NOAA tile {z}/{x}/{y}: {str(e)}")
        # Return empty PNG on error
        import io
        from PIL import Image
        img = Image.new('RGBA', (256, 256), (0, 0, 0, 0))
        buf = io.BytesIO()
        img.save(buf, format='PNG')
        buf.seek(0)
        return buf.getvalue(), 200, {'Content-Type': 'image/png'}


@app.route('/api/climate/sea-level-rise', methods=['GET'])
def sea_level_rise():
    """
    Get sea level rise data as hexagonal grid

    Query Parameters:
        north (float): Northern latitude bound
        south (float): Southern latitude bound
        east (float): Eastern longitude bound
        west (float): Western longitude bound
        feet (int): Sea level rise in feet (0-10), default 3
        resolution (int): H3 hexagon resolution (8-10), default 9

    Returns:
        GeoJSON FeatureCollection with hexagonal sea level data
    """
    try:
        # Parse query parameters
        north = request.args.get('north', type=float)
        south = request.args.get('south', type=float)
        east = request.args.get('east', type=float)
        west = request.args.get('west', type=float)
        feet = request.args.get('feet', default=3, type=int)
        resolution = request.args.get('resolution', default=9, type=int)

        # Validate required parameters
        if None in [north, south, east, west]:
            return jsonify({
                'success': False,
                'error': 'Missing required parameters: north, south, east, west'
            }), 400

        # Validate bounds
        if not (-90 <= south <= north <= 90):
            return jsonify({
                'success': False,
                'error': 'Invalid latitude bounds'
            }), 400

        if not (-180 <= west <= 180 and -180 <= east <= 180):
            return jsonify({
                'success': False,
                'error': 'Invalid longitude bounds'
            }), 400

        # Validate feet range
        if not (0 <= feet <= 10):
            return jsonify({
                'success': False,
                'error': 'Feet must be between 0 and 10'
            }), 400

        # Validate resolution
        if not (6 <= resolution <= 10):
            return jsonify({
                'success': False,
                'error': 'Resolution must be between 6 and 10'
            }), 400

        logger.info(f"Sea level rise request: bounds=[{south},{north}]x[{west},{east}], "
                   f"feet={feet}, resolution={resolution}")

        # Build bounds dict
        bounds = {
            'north': north,
            'south': south,
            'east': east,
            'west': west
        }

        # Get sea level hexagons
        data = sea_level_service.get_sea_level_hexagons(
            bounds=bounds,
            feet=feet,
            resolution=resolution
        )

        return jsonify({
            'success': True,
            'data': data,
            'metadata': {
                'bounds': bounds,
                'feet': feet,
                'resolution': resolution,
                'feature_count': len(data.get('features', []))
            }
        })

    except ValueError as e:
        logger.error(f"Validation error: {str(e)}")
        return jsonify({
            'success': False,
            'error': f'Invalid parameter: {str(e)}'
        }), 400

    except Exception as e:
        logger.error(f"Error processing sea level rise: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/climate/urban-heat-island/tiles', methods=['GET'])
def urban_heat_island_tiles():
    """
    Get urban heat island tile URL for smooth heat map visualization

    Query Parameters:
        north (float): Northern latitude bound (optional, for API compatibility)
        south (float): Southern latitude bound (optional)
        east (float): Eastern longitude bound (optional)
        west (float): Western longitude bound (optional)
        season (str): 'summer' or 'winter', default 'summer'
        color_scheme (str): 'temperature', 'heat', or 'urban', default 'temperature'

    Returns:
        JSON with Earth Engine tile URL and metadata including actual collection dates
    """
    try:
        # Parse query parameters
        north = request.args.get('north', type=float)
        south = request.args.get('south', type=float)
        east = request.args.get('east', type=float)
        west = request.args.get('west', type=float)
        season = request.args.get('season', default='summer', type=str)
        color_scheme = request.args.get('color_scheme', default='temperature', type=str)

        logger.info(f"Urban heat island tile request: season={season}, color_scheme={color_scheme}")

        # Build bounds dict (optional, not used for global tiles)
        bounds = {
            'north': north or 90,
            'south': south or -90,
            'east': east or 180,
            'west': west or -180
        }

        # Get tile URL
        result = heat_island_service.get_tile_url(
            bounds=bounds,
            season=season,
            color_scheme=color_scheme
        )

        if result:
            return jsonify({
                'success': True,
                'tile_url': result['tile_url'],
                'metadata': result['metadata']
            })
        else:
            return jsonify({
                'success': False,
                'error': 'Could not generate tile URL'
            }), 500

    except Exception as e:
        logger.error(f"Error generating tile URL: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/climate/urban-heat-island', methods=['GET'])
def urban_heat_island():
    """
    Get urban heat island data as hexagonal grid

    Query Parameters:
        north (float): Northern latitude bound
        south (float): Southern latitude bound
        east (float): Eastern longitude bound
        west (float): Western longitude bound
        date (str): Analysis date (YYYY-MM-DD), optional
        resolution (int): H3 hexagon resolution (4-10), default 8

    Returns:
        GeoJSON FeatureCollection with hexagonal heat island intensity
    """
    try:
        # Parse query parameters
        north = request.args.get('north', type=float)
        south = request.args.get('south', type=float)
        east = request.args.get('east', type=float)
        west = request.args.get('west', type=float)
        date = request.args.get('date', type=str)
        resolution = request.args.get('resolution', default=8, type=int)

        # Validate required parameters
        if None in [north, south, east, west]:
            return jsonify({
                'success': False,
                'error': 'Missing required parameters: north, south, east, west'
            }), 400

        # Validate bounds
        if not (-90 <= south < north <= 90):
            return jsonify({
                'success': False,
                'error': 'Invalid latitude bounds'
            }), 400

        if not (-180 <= west < east <= 180):
            return jsonify({
                'success': False,
                'error': 'Invalid longitude bounds'
            }), 400

        # Validate resolution (expanded range to support all zoom levels)
        if not (1 <= resolution <= 10):
            return jsonify({
                'success': False,
                'error': 'Resolution must be between 1 and 10'
            }), 400

        logger.info(f"Urban heat island request: bounds=[{south},{north}]x[{west},{east}], "
                   f"date={date}, resolution={resolution}")

        # Build bounds dict
        bounds = {
            'north': north,
            'south': south,
            'east': east,
            'west': west
        }

        # Get urban heat island data
        data = heat_island_service.get_heat_island_data(
            bounds=bounds,
            date=date,
            resolution=resolution
        )

        return jsonify({
            'success': True,
            'data': data,
            'metadata': {
                'bounds': bounds,
                'date': date,
                'resolution': resolution,
                'feature_count': len(data.get('features', []))
            }
        })

    except ValueError as e:
        logger.error(f"Validation error: {str(e)}")
        return jsonify({
            'success': False,
            'error': f'Invalid parameter: {str(e)}'
        }), 400

    except Exception as e:
        logger.error(f"Error processing urban heat island: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/climate/topographic-relief/tiles', methods=['GET'])
def topographic_relief_tiles():
    """
    Get topographic relief (hillshade) tile URL with different style presets

    Query parameters:
        style: Style preset - 'classic', 'dark', 'depth', or 'dramatic' (default: 'classic')

    Returns:
        JSON with tile_url and metadata
    """
    try:
        # Get style parameter
        style = request.args.get('style', 'classic')

        # Validate style
        valid_styles = ['classic', 'dark', 'depth', 'dramatic']
        if style not in valid_styles:
            return jsonify({
                'success': False,
                'error': f'Invalid style. Must be one of: {", ".join(valid_styles)}'
            }), 400

        logger.info(f"Topographic relief tile request: style={style}")

        # Get hillshade tiles from service
        result = relief_service.get_hillshade_tiles(style=style)

        return jsonify(result)

    except ValueError as e:
        logger.error(f"Validation error: {str(e)}")
        return jsonify({
            'success': False,
            'error': f'Invalid parameter: {str(e)}'
        }), 400

    except Exception as e:
        logger.error(f"Error processing topographic relief: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/climate/precipitation-drought/tiles', methods=['GET'])
def precipitation_drought_tiles():
    """
    Get precipitation/drought tile URL for smooth heatmap visualization

    Query Parameters:
        north (float): Northern latitude bound (optional, for API compatibility)
        south (float): Southern latitude bound (optional)
        east (float): Eastern longitude bound (optional)
        west (float): Western longitude bound (optional)
        scenario (str): Climate scenario (rcp26, rcp45, rcp85), default rcp45
        year (int): Projection year (2020-2100), default 2050
        metric (str): Data type - 'precipitation', 'drought_index', or 'soil_moisture', default drought_index

    Returns:
        JSON with Earth Engine tile URL and metadata
    """
    try:
        # Parse query parameters
        north = request.args.get('north', type=float)
        south = request.args.get('south', type=float)
        east = request.args.get('east', type=float)
        west = request.args.get('west', type=float)
        scenario = request.args.get('scenario', default='rcp45', type=str)
        year = request.args.get('year', default=2050, type=int)
        metric = request.args.get('metric', default='drought_index', type=str)

        # Validate metric
        valid_metrics = ['precipitation', 'drought_index', 'soil_moisture']
        if metric not in valid_metrics:
            return jsonify({
                'success': False,
                'error': f'Invalid metric. Must be one of: {", ".join(valid_metrics)}'
            }), 400

        logger.info(f"Precipitation/drought tile request: metric={metric}, scenario={scenario}, year={year}")

        # Build bounds dict (optional, not used for global tiles)
        bounds = {
            'north': north or 90,
            'south': south or -90,
            'east': east or 180,
            'west': west or -180
        }

        # Get tile URL
        result = drought_service.get_tile_url(
            bounds=bounds,
            scenario=scenario,
            year=year,
            metric=metric
        )

        if result:
            return jsonify({
                'success': True,
                'tile_url': result['tile_url'],
                'metadata': result['metadata']
            })
        else:
            return jsonify({
                'success': False,
                'error': 'Could not generate tile URL'
            }), 500

    except Exception as e:
        logger.error(f"Error generating precipitation/drought tile URL: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/climate/precipitation-drought', methods=['GET'])
def precipitation_drought():
    """
    Get precipitation and drought data as hexagonal GeoJSON from CHIRPS dataset

    Query parameters:
        north, south, east, west: Bounding box coordinates
        scenario: Climate scenario (rcp26, rcp45, rcp85), default rcp45
        year: Projection year (2020-2100), default 2050
        metric: Data type - 'precipitation', 'drought_index', or 'soil_moisture', default drought_index
        resolution: H3 hexagon resolution (4-10), default 7

    Returns:
        GeoJSON FeatureCollection with hexagonal precipitation/drought data
    """
    try:
        # Get query parameters
        north = request.args.get('north', type=float)
        south = request.args.get('south', type=float)
        east = request.args.get('east', type=float)
        west = request.args.get('west', type=float)
        scenario = request.args.get('scenario', default='rcp45', type=str)
        year = request.args.get('year', default=2050, type=int)
        metric = request.args.get('metric', default='drought_index', type=str)
        resolution = request.args.get('resolution', default=7, type=int)

        # Validate required parameters
        if None in [north, south, east, west]:
            return jsonify({
                'success': False,
                'error': 'Missing required parameters: north, south, east, west'
            }), 400

        # Validate bounds
        if not (-90 <= south < north <= 90):
            return jsonify({
                'success': False,
                'error': 'Invalid latitude bounds'
            }), 400

        if not (-180 <= west < east <= 180):
            return jsonify({
                'success': False,
                'error': 'Invalid longitude bounds'
            }), 400

        # Validate metric
        valid_metrics = ['precipitation', 'drought_index', 'soil_moisture']
        if metric not in valid_metrics:
            return jsonify({
                'success': False,
                'error': f'Invalid metric. Must be one of: {", ".join(valid_metrics)}'
            }), 400

        # Validate resolution (expanded range to support all zoom levels)
        if not (1 <= resolution <= 10):
            return jsonify({
                'success': False,
                'error': 'Resolution must be between 1 and 10'
            }), 400

        logger.info(f"Precipitation/drought request: scenario={scenario}, year={year}, metric={metric}, resolution={resolution}")

        # Build bounds dict
        bounds = {
            'north': north,
            'south': south,
            'east': east,
            'west': west
        }

        # Get precipitation/drought data from service
        data = drought_service.get_drought_data(
            bounds=bounds,
            scenario=scenario,
            year=year,
            metric=metric,
            resolution=resolution
        )

        return jsonify({
            'success': True,
            'data': data,
            'metadata': {
                'bounds': bounds,
                'scenario': scenario,
                'year': year,
                'metric': metric,
                'resolution': resolution,
                'feature_count': len(data.get('features', []))
            }
        })

    except ValueError as e:
        logger.error(f"Validation error: {str(e)}")
        return jsonify({
            'success': False,
            'error': f'Invalid parameter: {str(e)}'
        }), 400

    except Exception as e:
        logger.error(f"Error processing precipitation/drought: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/climate/urban-expansion/tiles', methods=['GET'])
def urban_expansion_tiles():
    """
    Get urban expansion as H3 hexagon grid (true hexacomb pattern)

    Query Parameters:
        north (float): Northern latitude bound
        south (float): Southern latitude bound
        east (float): Eastern longitude bound
        west (float): Western longitude bound
        year (int): Projection year (2020-2100), default 2050
        scenario (str): Climate scenario (rcp26, rcp45, rcp85), default rcp45
        resolution (int): H3 hexagon resolution (2-6), default 4

    Returns:
        GeoJSON FeatureCollection with hexagonal growth patterns
    """
    try:
        # Parse query parameters
        north = request.args.get('north', type=float)
        south = request.args.get('south', type=float)
        east = request.args.get('east', type=float)
        west = request.args.get('west', type=float)
        year = request.args.get('year', default=2050, type=int)
        scenario = request.args.get('scenario', default='rcp45', type=str)
        resolution = request.args.get('resolution', default=4, type=int)

        # Validate bounds
        if north is None or south is None or east is None or west is None:
            return jsonify({
                'success': False,
                'error': 'Bounds (north, south, east, west) are required'
            }), 400

        # Validate year range
        if not (2020 <= year <= 2100):
            return jsonify({
                'success': False,
                'error': 'Year must be between 2020 and 2100'
            }), 400

        # Validate scenario
        if scenario not in ['rcp26', 'rcp45', 'rcp85']:
            return jsonify({
                'success': False,
                'error': 'Scenario must be one of: rcp26, rcp45, rcp85'
            }), 400

        logger.info(f"Urban expansion circular buffers request: year={year}, scenario={scenario}")

        # Build bounds dict
        bounds = {
            'north': north,
            'south': south,
            'east': east,
            'west': west
        }

        # Get circular buffer GeoJSON
        result = urban_expansion_service.get_urban_expansion_circles(
            bounds=bounds,
            year=year,
            scenario=scenario,
            min_density=0.3  # Only show significant urban areas
        )

        if result and result.get('features'):
            return jsonify({
                'success': True,
                'data': result
            })
        else:
            return jsonify({
                'success': False,
                'error': 'Could not generate circular buffer data'
            }), 500

    except Exception as e:
        logger.error(f"Error generating urban expansion circles: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/climate/population', methods=['GET'])
def population_at_point():
    """
    Get population projection at a specific point (for tooltips)

    Query Parameters:
        lat (float): Latitude
        lng (float): Longitude
        year (int): Projection year (2020-2100), default 2050
        scenario (str): Climate scenario (rcp26, rcp45, rcp85), default rcp45

    Returns:
        JSON with population value and metadata
    """
    try:
        # Parse query parameters
        lat = request.args.get('lat', type=float)
        lng = request.args.get('lng', type=float)
        year = request.args.get('year', default=2050, type=int)
        scenario = request.args.get('scenario', default='rcp45', type=str)

        # Validate required parameters
        if lat is None or lng is None:
            return jsonify({
                'success': False,
                'error': 'Missing required parameters: lat, lng'
            }), 400

        # Validate coordinates
        if not (-90 <= lat <= 90):
            return jsonify({
                'success': False,
                'error': 'Invalid latitude'
            }), 400

        if not (-180 <= lng <= 180):
            return jsonify({
                'success': False,
                'error': 'Invalid longitude'
            }), 400

        # Validate year range
        if not (2020 <= year <= 2100):
            return jsonify({
                'success': False,
                'error': 'Year must be between 2020 and 2100'
            }), 400

        logger.info(f"Population query: lat={lat}, lng={lng}, year={year}, scenario={scenario}")

        # Get population data
        data = urban_expansion_service.get_population_at_point(
            lat=lat,
            lng=lng,
            year=year,
            scenario=scenario
        )

        if data and 'error' not in data:
            return jsonify({
                'success': True,
                'data': data
            })
        else:
            return jsonify({
                'success': False,
                'error': data.get('error', 'Could not retrieve population data')
            }), 500

    except Exception as e:
        logger.error(f"Error querying population: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/climate/info', methods=['GET'])
def climate_info():
    """
    Get information about available climate data and parameters

    Returns:
        JSON with available scenarios, models, and parameter ranges
    """
    return jsonify({
        'success': True,
        'data': {
            'scenarios': {
                'rcp26': {
                    'name': 'RCP 2.6 (SSP1-2.6)',
                    'description': 'Low emissions scenario',
                    'temp_increase_2050': 1.5,
                    'temp_increase_2100': 2.0
                },
                'rcp45': {
                    'name': 'RCP 4.5 (SSP2-4.5)',
                    'description': 'Moderate emissions scenario',
                    'temp_increase_2050': 2.0,
                    'temp_increase_2100': 3.2
                },
                'rcp85': {
                    'name': 'RCP 8.5 (SSP5-8.5)',
                    'description': 'High emissions scenario',
                    'temp_increase_2050': 2.5,
                    'temp_increase_2100': 4.8
                }
            },
            'models': ['ACCESS-CM2'],
            'year_range': {
                'min': 2020,
                'max': 2100
            },
            'resolution_range': {
                'min': 0,
                'max': 15,
                'recommended': 7,
                'description': 'H3 hexagon resolution (7 = ~5km diameter)'
            },
            'data_source': {
                'name': 'NASA NEX-GDDP-CMIP6',
                'url': 'https://www.nccs.nasa.gov/services/data-collections/land-based-products/nex-gddp-cmip6',
                's3_bucket': 's3://nasa-nex-gddp-cmip6'
            },
            'baseline_period': '1986-2005'
        }
    })


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    logger.info(f"🌍 Starting Climate Data Server on port {port}")
    logger.info(f"📊 Endpoints:")
    logger.info(f"   GET  /health")
    logger.info(f"   GET  /api/climate/temperature-projection")
    logger.info(f"   GET  /api/climate/temperature-projection/tiles")
    logger.info(f"   GET  /api/climate/sea-level-rise")
    logger.info(f"   GET  /api/climate/urban-heat-island/tiles")
    logger.info(f"   GET  /api/climate/topographic-relief/tiles")
    logger.info(f"   GET  /api/climate/precipitation-drought")
    logger.info(f"   GET  /api/climate/precipitation-drought/tiles")
    logger.info(f"   GET  /api/climate/urban-expansion/tiles")
    logger.info(f"   GET  /api/climate/population")
    logger.info(f"   GET  /api/climate/info")

    app.run(
        host='0.0.0.0',
        port=port,
        debug=os.environ.get('FLASK_ENV') == 'development'
    )
