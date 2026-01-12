#!/bin/bash
#
# Check status of temperature extraction
#

cd "$(dirname "$0")"

LOGFILE="temperature_extraction.log"
OUTPUT_FILE="metro_temperature_projections.json"

echo "📊 Temperature Extraction Status"
echo "================================"
echo ""

# Check if process is running
RUNNING_PID=$(ps aux | grep "[p]ython3 services/metro_temperature_projections.py" | awk '{print $2}')

if [ -n "$RUNNING_PID" ]; then
    echo "✅ Process running (PID: $RUNNING_PID)"
else
    echo "⏸️  No process currently running"
fi

echo ""

# Check log file
if [ -f "$LOGFILE" ]; then
    echo "📝 Latest log entries:"
    echo "---"
    tail -10 "$LOGFILE"
    echo "---"
    echo ""

    # Count completed metros
    COMPLETED=$(grep -c "✅ Complete" "$LOGFILE")
    echo "   Metros completed: $COMPLETED"
else
    echo "⚠️  Log file not found: $LOGFILE"
fi

echo ""

# Check output file
if [ -f "$OUTPUT_FILE" ]; then
    FILE_SIZE=$(ls -lh "$OUTPUT_FILE" | awk '{print $5}')
    METRO_COUNT=$(python3 -c "import json; print(len(json.load(open('$OUTPUT_FILE'))))" 2>/dev/null || echo "?")

    echo "💾 Output file: $OUTPUT_FILE"
    echo "   Size: $FILE_SIZE"
    echo "   Metros in file: $METRO_COUNT"
else
    echo "⚠️  Output file not created yet"
fi

echo ""
echo "To monitor live:"
echo "   tail -f $LOGFILE"
