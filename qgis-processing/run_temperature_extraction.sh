#!/bin/bash
#
# Run temperature extraction in background with logging
#
# Usage:
#   ./run_temperature_extraction.sh           # All metros
#   ./run_temperature_extraction.sh --limit 5 # Test with 5 metros
#

cd "$(dirname "$0")"

LOGFILE="temperature_extraction.log"
OUTPUT_FILE="metro_temperature_projections.json"

echo "🚀 Starting temperature extraction..."
echo "   Log file: $LOGFILE"
echo "   Output file: $OUTPUT_FILE"
echo ""

# Run in background, redirect output to log
nohup python3 services/metro_temperature_projections.py \
    --output-file "$OUTPUT_FILE" \
    "$@" \
    > "$LOGFILE" 2>&1 &

PID=$!

echo "✅ Process started (PID: $PID)"
echo ""
echo "Monitor progress:"
echo "   tail -f $LOGFILE"
echo ""
echo "Check status:"
echo "   ps -p $PID"
echo ""
echo "Estimated runtime: ~2 hours for all metros"
