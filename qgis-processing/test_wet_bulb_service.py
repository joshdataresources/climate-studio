
import sys
import os
import logging
import json

# Add current directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from services.wet_bulb_service import WetBulbService

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def test_wet_bulb_service():
    """Test Wet Bulb Service functionality"""
    try:
        # Initialize service
        service = WetBulbService(project_id='josh-geo-the-second')
        if not service.initialized:
            logger.error("Failed to initialize WetBulbService")
            return

        logger.info("WetBulbService initialized successfully")

        # Test bounds (approximate US bounds)
        bounds = (-125, 24, -66, 50)
        
        # Test parameters
        year = 2050
        scenario = 'ssp585'
        resolution = 2 # Low resolution for fast test

        logger.info(f"Fetching wet bulb data for {year}, {scenario}, res={resolution}...")
        
        # Fetch data
        data = service.get_wet_bulb_hexagons(bounds, year, scenario, resolution)
        
        # Verify output
        if not data:
            logger.error("No data returned")
            return

        if data['type'] != 'FeatureCollection':
            logger.error("Invalid GeoJSON type")
            return

        features = data.get('features', [])
        logger.info(f"Returned {len(features)} hexagons")

        if features:
            sample = features[0]
            props = sample.get('properties', {})
            logger.info("Sample feature properties:")
            logger.info(json.dumps(props, indent=2))
            
            # Check for required fields
            required_fields = ['wet_bulb_c', 'risk_level', 'h3_index']
            missing = [f for f in required_fields if f not in props]
            if missing:
                logger.error(f"Missing fields in properties: {missing}")
            else:
                logger.info("All required fields present")
                
            # Check values
            wb = props.get('wet_bulb_c')
            if wb is not None:
                logger.info(f"Sample Wet Bulb Temp: {wb:.2f}°C")
            
    except Exception as e:
        logger.error(f"Test failed with error: {e}", exc_info=True)

if __name__ == "__main__":
    test_wet_bulb_service()
