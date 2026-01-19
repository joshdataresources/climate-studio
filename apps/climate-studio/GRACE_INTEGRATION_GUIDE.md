# GRACE Groundwater Integration Guide

## Current Status

✅ **What's Working:**
- GRACE demo page at `/grace-demo` (standalone visualization)
- Mock GRACE data showing depletion zones
- Color-coded hexagons (red=severe depletion, green=stable)
- Interactive popups with depletion statistics

❌ **What's Not Working:**
- GRACE API endpoint returns errors
- Data not integrated into main Water Access view

## Quick Integration into Water Access View

### Step 1: Add GRACE Layer Toggle

In `WaterAccessView.tsx` around line 510, add:

```typescript
const [showGRACELayer, setShowGRACELayer] = useState(false)
```

### Step 2: Import GRACE Component

At the top of `WaterAccessView.tsx`:

```typescript
import { GRACELayer } from './GRACELayerDemo'
import graceMockData from '../data/grace-mock-data.json'
```

### Step 3: Add GRACE Layer to Map

In the JSX where other layers are rendered (search for `showMetroHumidityLayer`), add:

```tsx
{/* GRACE Groundwater Depletion Layer */}
{showGRACELayer && map && (
  <GRACELayer
    map={map}
    aquifer="all"
    resolution={6}
  />
)}
```

### Step 4: Add Toggle Checkbox

In the layer controls panel, add a checkbox:

```tsx
<label>
  <input
    type="checkbox"
    checked={showGRACELayer}
    onChange={(e) => setShowGRACELayer(e.target.checked)}
  />
  GRACE Depletion Zones
</label>
```

## What GRACE Data Shows

**GRACE (Gravity Recovery and Climate Experiment)** measures groundwater storage changes via satellite:

- **Red zones** (-2+ cm/year): Severe groundwater depletion
- **Orange zones** (-1 to -2 cm/year): Moderate depletion
- **Green zones** (0 to +1 cm/year): Stable or recharging

### Example Data Points (High Plains Aquifer):
- Kansas (severe): -2.3 cm/year, -45.8 cm total change
- Nebraska (moderate): -1.8 cm/year, -36.2 cm total
- Colorado (stable): -0.3 cm/year, -6.1 cm total

## Files Created

1. **`/components/GRACELayerDemo.tsx`** - Reusable GRACE visualization component
2. **`/pages/GRACEDemo.tsx`** - Standalone demo page
3. **`/data/grace-mock-data.json`** - Mock data for testing
4. **`/App.tsx`** - Added `/grace-demo` route

## Testing

**View standalone demo:**
```
http://localhost:8080/grace-demo
```

**Once integrated into Water Access:**
```
http://localhost:8082/water-access
(Toggle "GRACE Depletion Zones" checkbox)
```

## Fixing the GRACE API

The real GRACE API at `/api/climate/groundwater` exists but returns errors. To debug:

1. Check server logs: `lsof -ti :5001 | xargs ps -p`
2. Test endpoint: `curl http://localhost:5001/api/climate/groundwater?aquifer=high_plains&resolution=6`
3. Check Earth Engine authentication in `grace_groundwater.py`

## Future Enhancements

- [ ] Fix GRACE API to use real Earth Engine data
- [ ] Add temporal slider to show depletion over time
- [ ] Integrate with aquifer boundaries (highlight depleted aquifers)
- [ ] Add export functionality for depletion data
- [ ] Connect to your GRACE Tellus API key for latest data

## Current Limitations

- Using mock data (9 sample hexagons over Kansas)
- No temporal component (only shows current state)
- API integration incomplete
- Not yet in main Water Access view (standalone only)

## Next Steps

1. **Quick win**: Add GRACE toggle to Water Access (5 min integration)
2. **API fix**: Debug Earth Engine connection in `grace_groundwater.py`
3. **Real data**: Switch from mock data to live GRACE satellite data
4. **Polish**: Add legend, time slider, and better visual integration
