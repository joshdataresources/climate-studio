# Layer Persistence & Smart Resize - Minimal Fixes

## Problems Identified

### 1. Layer Doesn't Stay Active
- **Root cause:** `defaultActive: false` + no localStorage persistence
- **Current behavior:** Layer turns off when page refreshes
- **Location:** [climateLayers.ts:120](frontend/src/config/climateLayers.ts#L120)

### 2. No Smart Resize
- **Root cause:** Fixed resolution buckets create visual jumps
- **Current behavior:**
  - Zoom 7-8: res 5 (hexagons suddenly change size at zoom 9)
  - Zoom 9-10: res 6 (hexagons suddenly change size at zoom 11)
  - Zoom 11-13: res 7
- **Needed:** Smooth scaling without visible size changes

## Minimal Fixes (3 Edits)

### Fix 1: Make Layer Persistent (Option A - Simple)
**Just enable it by default:**

```typescript
// frontend/src/config/climateLayers.ts:120
defaultActive: true,  // Changed from false
```

**Result:** Layer stays on by default, but still resets on refresh.

---

### Fix 1: Make Layer Persistent (Option B - Best)
**Add localStorage persistence to ClimateContext:**

```typescript
// frontend/src/contexts/ClimateContext.tsx
// After line 57, add localStorage helper:

const STORAGE_KEY = 'climate-active-layers';

const getInitialActiveLayers = (): ClimateLayerId[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      console.log('✅ Restored active layers from localStorage:', parsed);
      return parsed;
    }
  } catch (e) {
    console.warn('Failed to load active layers from localStorage:', e);
  }
  return defaultActiveLayers.length > 0 ? defaultActiveLayers : [];
};

// Line 75, replace:
const [activeLayerIds, setActiveLayerIds] = useState<ClimateLayerId[]>(
  defaultActiveLayers.length > 0 ? defaultActiveLayers : []
);

// With:
const [activeLayerIds, setActiveLayerIds] = useState<ClimateLayerId[]>(
  getInitialActiveLayers()
);

// After line 86, add persistence effect:
useEffect(() => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(activeLayerIds));
  console.log('💾 Saved active layers to localStorage:', activeLayerIds);
}, [activeLayerIds]);
```

**Result:** Active layers persist across page refreshes.

---

### Fix 2: Smart Resize (Smooth Hex Scaling)

**Replace fixed buckets with continuous formula:**

```typescript
// frontend/src/config/climateLayers.ts:134-147
// DELETE the old bucket system:
/*
const z = zoom || 10;
let resolution;
if (z <= 8) {
  resolution = 5;
} else if (z <= 10) {
  resolution = 6;
} else {
  resolution = 7;
}
*/

// ADD smart resize formula:
// Target: ~40px hex height at all zoom levels
// Formula: Higher zoom = higher resolution (more hexagons)
// But with smooth transitions to avoid visual jumps
const z = zoom || 10;
let resolution;

// Smooth scaling: resolution increases gradually with zoom
if (z < 7) {
  resolution = 4;  // Far out
} else if (z < 8.5) {
  resolution = 5;  // Zooming in
} else if (z < 10.5) {
  resolution = 6;  // Medium
} else if (z < 12.5) {
  resolution = 7;  // Close
} else {
  resolution = 8;  // Very close
}

// Smart resize: Only fetch new resolution if changed significantly
// This prevents refetching on every tiny zoom change
const prevResolution = (window as any).__lastTempResolution;
if (prevResolution && Math.abs(prevResolution - resolution) < 1) {
  resolution = prevResolution; // Reuse previous to avoid refetch
}
(window as any).__lastTempResolution = resolution;

console.log(`🔷 Smart resize: zoom ${z.toFixed(1)} → resolution ${resolution}`);
```

**Even Smarter Option - Logarithmic Scaling:**

```typescript
// frontend/src/config/climateLayers.ts:134-147
// Ultra-smooth scaling using continuous formula
const z = zoom || 10;

// Logarithmic formula for smooth transitions
// Maps zoom 7→13 to resolution 5→8 smoothly
const rawResolution = 2.8 + (z * 0.42);  // Tuned for zoom 7-13
const resolution = Math.round(Math.max(4, Math.min(9, rawResolution)));

// Anti-flicker: Only change resolution if zoom changed by 0.5+ levels
const prevZoom = (window as any).__lastTempZoom || z;
const prevResolution = (window as any).__lastTempResolution || resolution;

if (Math.abs(z - prevZoom) < 0.5) {
  // Small zoom change - keep same resolution to avoid refetch
  resolution = prevResolution;
} else {
  // Significant zoom change - update
  (window as any).__lastTempZoom = z;
  (window as any).__lastTempResolution = resolution;
  console.log(`🔷 Smart resize: zoom ${z.toFixed(1)} → resolution ${resolution}`);
}
```

---

### Fix 3: Add Visual Feedback for Layer State

**Show when layer is loading/active:**

```typescript
// frontend/src/components/LayerStatusIndicator.tsx
// Add persistent state indicator (already exists, just need to use it)

// In your layer panel component, add:
import { useLayerStatus } from '../hooks/useLayerStatus';

const status = useLayerStatus('temperature_projection');
const isPersistent = localStorage.getItem('climate-active-layers')?.includes('temperature_projection');

// Show indicator:
{isPersistent && <span>📌 Persistent</span>}
{status?.dataSource === 'real' && <span>✅ Real NASA Data</span>}
```

