#!/bin/bash
# Start the climate server with Earth Engine configuration
#
# Usage:
#   ./start_climate_server.sh                           # Use simulated data
#   ./start_climate_server.sh your-project-id           # Use real Earth Engine data
#   PORT=3002 ./start_climate_server.sh your-project-id # Custom port

# Set default port
PORT=${PORT:-5000}

# If project ID is provided, set it as environment variable
if [ -n "$1" ]; then
    export EARTHENGINE_PROJECT="$1"
    echo "🌍 Starting Climate Data Server on port $PORT with Earth Engine project: $EARTHENGINE_PROJECT"
else
    echo "🌍 Starting Climate Data Server on port $PORT with simulated data"
    echo "💡 To use real Earth Engine data, provide project ID:"
    echo "   ./start_climate_server.sh your-project-id"
fi

# Start the server
python3 climate_server.py
