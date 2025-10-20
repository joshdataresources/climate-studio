# Layer Status Monitoring System

## Overview

The Layer Status Monitoring system provides real-time detection of fallback bugs, verification of real NASA CMIP6 data loading, and comprehensive event tracking for all climate layers.

## Architecture

### Components

1. **LayerStatusMonitor Agent** (`frontend/src/agents/LayerStatusMonitor.ts`)
   - Singleton agent that monitors all layer loading events
   - Detects when layers fall back to simulated data
   - Tracks loading history for debugging
   - Emits events for status changes

2. **useLayerStatus Hooks** (`frontend/src/hooks/useLayerStatus.ts`)
   - React hooks for subscribing to layer status events
   - Provides status summaries and fallback detection

3. **LayerStatusIndicator Components** (`frontend/src/components/LayerStatusIndicator.tsx`)
   - Visual indicators for layer status
   - Debug panel for monitoring all layer events

4. **Enhanced Python Logging** (`qgis-processing/services/nasa_ee_climate.py`)
   - Explicit fallback detection markers
   - Clear logging when real data fails to load
   - Metadata flags: `isRealData`, `dataType`

## Features

### 1. Early Fallback Detection

The system immediately detects when a layer falls back to simulated data and logs a warning:

```typescript
// Automatically detected and logged
🚨 FALLBACK DETECTED for layer "temperature_projection"
```

### 2. Real NASA CMIP6 Data Verification

Each response is analyzed to determine if it contains real or fallback data:

```typescript
import { layerStatusMonitor } from '../agents/LayerStatusMonitor';

const dataSource = layerStatusMonitor.analyzeLayerData('temperature_projection', data);
// Returns: 'real', 'fallback', or 'unknown'
```

**Detection Criteria:**
- ✅ Real data: `metadata.isRealData === true` or `metadata.dataType === 'real'`
- ⚠️ Fallback data: `metadata.isRealData === false` or `metadata.dataType === 'fallback'`
- ❓ Unknown: Unable to determine from metadata

### 3. Constant Hexagon Size

Hexagons now maintain a constant size across all zoom levels:

**Before:**
```typescript
// Dynamic resolution (hexagons changed size on zoom)
const resolution = getResolutionForZoom(zoom);
```

**After:**
```typescript
// Constant resolution (hexagons stay same size)
const resolution = 6; // ~10km hexagons
```

### 4. Layer Status Events

Subscribe to real-time layer status events:

```typescript
import { layerStatusMonitor } from '../agents/LayerStatusMonitor';

const unsubscribe = layerStatusMonitor.subscribe((event) => {
  console.log('Layer Status:', {
    layerId: event.layerId,
    status: event.status,
    dataSource: event.dataSource,
    metadata: event.metadata
  });
});

// Later, cleanup
unsubscribe();
```

## Usage

### Basic Monitoring

```typescript
import { useLayerStatus } from '../hooks/useLayerStatus';

function MyComponent() {
  const status = useLayerStatus('temperature_projection');

  if (status?.dataSource === 'fallback') {
    return <div>⚠️ Using simulated data</div>;
  }

  return <div>✅ Real NASA data loaded</div>;
}
```

### Status Indicator

```tsx
import { LayerStatusIndicator } from '../components/LayerStatusIndicator';

<LayerStatusIndicator
  layerId="temperature_projection"
  showDetails={true}
/>
```

### Debug Panel

Add to your main app component:

```tsx
import { LayerStatusDebugPanel } from '../components/LayerStatusIndicator';

function App() {
  return (
    <>
      {/* Your app content */}
      <LayerStatusDebugPanel />
    </>
  );
}
```

### Programmatic Monitoring

```typescript
import { layerStatusMonitor } from '../agents/LayerStatusMonitor';

// Get summary of all layers
const summary = layerStatusMonitor.getSummary();
console.log('Summary:', {
  totalLayers: summary.totalLayers,
  layersWithFallback: summary.layersWithFallback,
  layersWithRealData: summary.layersWithRealData
});

// Get history for a specific layer
const history = layerStatusMonitor.getHistory('temperature_projection');
console.log('Last 10 events:', history.slice(-10));

// Check if fallback was detected
const hasFallback = layerStatusMonitor.hasFallback('temperature_projection');
if (hasFallback) {
  console.warn('Layer has fallen back to simulated data');
}
```

### Browser Console Debugging

The monitor is exposed globally for debugging:

```javascript
// In browser console
window.layerStatusMonitor.getSummary()
window.layerStatusMonitor.getHistory('temperature_projection')
window.layerStatusMonitor.enableDebugLogging()
```

## Layer Status Event Structure

```typescript
interface LayerStatusEvent {
  layerId: string;                    // e.g., 'temperature_projection'
  status: 'loading' | 'success' | 'error' | 'fallback';
  timestamp: number;                  // Unix timestamp
  dataSource: 'real' | 'fallback' | 'unknown';
  metadata?: {
    featureCount?: number;            // Number of features loaded
    source?: string;                  // Data source attribution
    model?: string;                   // Climate model name
    scenario?: string;                // Climate scenario
    year?: number;                    // Projection year
    isRealData?: boolean;             // Explicit real/fallback flag
    errorMessage?: string;            // Error details if failed
    fallbackReason?: string;          // Why fallback was used
  };
}
```

## Python Backend Logging

Enhanced logging helps identify fallback bugs early:

```python
# Real data success
logger.info(f"Successfully created {len(hexagons['features'])} hexagon features")

# Fallback triggered
logger.error("=" * 80)
logger.error(f"🚨 NASA EARTH ENGINE FETCH FAILED - FALLING BACK TO SIMULATED DATA")
logger.error(f"Error type: {type(e).__name__}")
logger.error(f"Error message: {str(e)}")
logger.error(f"Request details: year={year}, scenario={scenario}, bounds={bounds}")
logger.error("=" * 80)
logger.warning("⚠️ RETURNING FALLBACK DATA - This is simulated, not real NASA data!")
```

## Troubleshooting

### Fallback Detected Immediately

**Symptoms:**
- Layer loads but shows "Using simulated data"
- Console shows `🚨 FALLBACK DETECTED`

**Diagnosis:**
1. Check Python service logs for Earth Engine errors
2. Verify Earth Engine credentials are set up correctly
3. Check network connectivity to Earth Engine API

**Solution:**
```bash
# Check Python service logs
docker logs urban-studio-qgis

# Look for lines like:
# 🚨 NASA EARTH ENGINE FETCH FAILED
# Error type: ...
# Error message: ...
```

### Unknown Data Source

**Symptoms:**
- `dataSource: 'unknown'`
- Unable to determine if data is real or fallback

**Diagnosis:**
- Response missing metadata
- Backend not setting `isRealData` or `dataType` flags

**Solution:**
- Ensure backend returns proper metadata structure
- Update `nasa_ee_climate.py` to include data type flags

### Hexagons Change Size on Zoom

**Symptoms:**
- Hexagons appear larger/smaller when zooming

**Cause:**
- Dynamic resolution calculation still enabled
- Frontend passing zoom-based resolution

**Solution:**
- Verify `climateLayers.ts` uses constant resolution (6)
- Check backend respects frontend resolution parameter

## Best Practices

1. **Always enable debug logging during development:**
   ```typescript
   layerStatusMonitor.enableDebugLogging();
   ```

2. **Monitor fallback rates in production:**
   ```typescript
   const summary = layerStatusMonitor.getSummary();
   const fallbackRate = summary.layersWithFallback / summary.totalLayers;
   if (fallbackRate > 0.1) {
     // Alert: More than 10% fallback rate
   }
   ```

3. **Clear history periodically:**
   ```typescript
   // Reset monitoring for a layer
   layerStatusMonitor.reset('temperature_projection');

   // Reset all
   layerStatusMonitor.reset();
   ```

4. **Use React hooks in components:**
   ```typescript
   // Better than manual subscription
   const status = useLayerStatus('temperature_projection');
   ```

## API Reference

### LayerStatusMonitor

#### Methods

- `subscribe(listener)` - Subscribe to status events
- `emit(event)` - Emit a status event
- `analyzeLayerData(layerId, data)` - Analyze if data is real/fallback
- `createStatusEvent(layerId, status, data?, error?)` - Create event object
- `getHistory(layerId)` - Get status history
- `getLatestStatus(layerId)` - Get most recent status
- `hasFallback(layerId)` - Check if fallback was detected
- `getSummary()` - Get monitoring summary
- `reset(layerId?)` - Clear history
- `enableDebugLogging()` - Enable console logging

### React Hooks

- `useLayerStatus(layerId)` - Subscribe to layer status
- `useAllLayerStatuses()` - Subscribe to all events
- `useLayerStatusSummary()` - Get monitoring summary
- `useLayerFallbackStatus(layerId)` - Check fallback status

### Components

- `<LayerStatusIndicator layerId={...} showDetails={...} />`
- `<LayerStatusDebugPanel />`

## Future Enhancements

1. **Automatic Recovery:**
   - Retry failed requests with backoff
   - Switch between data sources automatically

2. **Performance Metrics:**
   - Track layer load times
   - Monitor cache hit rates

3. **Alerts:**
   - Email notifications on fallback
   - Slack integration for monitoring

4. **Analytics:**
   - Dashboard for layer health
   - Historical fallback trends
