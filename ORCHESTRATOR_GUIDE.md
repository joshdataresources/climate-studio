# Layer Orchestrator System

## Overview

The **Layer Orchestrator** is a robust system that ensures layers consistently render their map visualizations and right-side widgets while maintaining context across view changes, theme switches, and user interactions.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      LayerContext                            │
│  (Global state: which layers are enabled)                   │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                 LayerOrchestrator                            │
│  • Syncs LayerContext → Map Rendering                       │
│  • Manages layer lifecycle                                  │
│  • Prevents race conditions                                 │
│  • Maintains context across changes                         │
└─────────────────────┬───────────────────────────────────────┘
                      │
        ┌─────────────┼─────────────┐
        ▼             ▼             ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ layerRenderer│ │ Right Panels │ │ Layer State  │
│  (Mapbox GL) │ │  (React)     │ │  (Tracking)  │
└──────────────┘ └──────────────┘ └──────────────┘
```

## Key Components

### 1. **LayerOrchestrator** (`/src/orchestrators/LayerOrchestrator.ts`)

The core orchestrator class that manages the entire layer lifecycle.

**Responsibilities:**
- ✅ Sync LayerContext state with map rendering
- ✅ Add/remove layers when enabled/disabled
- ✅ Update layer opacity in real-time
- ✅ Track layer state (rendered, error, etc.)
- ✅ Handle style changes and re-render layers
- ✅ Trigger right panel updates
- ✅ Provide callbacks for layer events

**Key Methods:**
```typescript
// Initialize with map
setMap(map: mapboxgl.Map): void

// Process layer changes from LayerContext
processLayerChanges(enabledLayers: LayerDefinition[], viewId: string): Promise<void>

// Check layer status
isLayerRendered(layerId: string): boolean
getLayerState(layerId: string): LayerState | undefined
getLayersWithErrors(): LayerState[]
```

### 2. **useLayerOrchestrator Hook** (`/src/hooks/useLayerOrchestrator.ts`)

React hook for easy integration in view components.

**Usage:**
```tsx
function FactoriesView() {
  const { map } = useMap()
  const { getEnabledLayersForView } = useLayer()

  const { activePanels, isLayerRendered, getLayerState } = useLayerOrchestrator({
    map,
    viewId: 'factories',
    getEnabledLayers: () => getEnabledLayersForView('factories'),
    onLayerRendered: (layerId) => console.log(`Layer ${layerId} rendered`),
    onLayerError: (layerId, error) => console.error(`Layer ${layerId} error:`, error)
  })

  return (
    <div>
      {/* Your view content */}
      {activePanels.includes('factories') && <FactoryLayersPanel />}
    </div>
  )
}
```

### 3. **Layer Definitions** (`/src/config/layerDefinitions.ts`)

Each layer must have:

```typescript
{
  id: 'future_temperature_anomaly',
  name: 'Future Temperature Anomaly',
  hasMapVisualization: true,           // Does it render on map?
  requiresClimateWidget: true,         // Does it need Climate Projections?
  rightPanelComponent: ClimateLayerControlsPanel, // Right panel to show
  renderConfig: {
    layerType: 'fill',
    paint: {
      'fill-color': [...],
      'fill-opacity': 0.6
    }
  }
}
```

## How It Works

### Lifecycle Flow

1. **User enables a layer** in LayerLibraryPanel
   ```
   User clicks checkbox → LayerContext.setLayerEnabled(id, true)
   ```

2. **LayerContext updates state**
   ```
   Layer.enabled = true → triggers React re-render
   ```

3. **useLayerOrchestrator detects change**
   ```
   useEffect monitors getEnabledLayers() → calls orchestrator.processLayerChanges()
   ```

4. **Orchestrator processes change**
   ```
   - Checks if layer is already rendered
   - If not, calls addLayer(layer)
   - Updates activePanels state
   - Triggers callbacks
   ```

5. **Layer renders on map**
   ```
   addLayerToMap(map, layer) → Mapbox GL adds the layer
   ```

6. **Right panel appears**
   ```
   activePanels updated → React renders the panel component
   ```

### Context Maintenance

**Problem:** Layers disappear when:
- Theme changes (light ↔ dark)
- View switches (Climate → Factories)
- Map style updates

**Solution:** The orchestrator:
1. Listens to `map.on('style.load')` events
2. Automatically re-renders all enabled layers
3. Maintains layer state across changes
4. Uses singleton pattern to persist context

## Integration Guide

### Step 1: Update Your View Component

**Before (FactoriesView.tsx):**
```tsx
export function FactoriesView() {
  const [map, setMap] = useState<mapboxgl.Map | null>(null)
  const { getEnabledLayersForView } = useLayer()

  // Manual layer rendering logic
  useEffect(() => {
    if (!map) return
    const layers = getEnabledLayersForView('factories')
    // ... manual add/remove logic
  }, [map, ...])

  return <div>...</div>
}
```

**After (FactoriesView.tsx):**
```tsx
export function FactoriesView() {
  const { map } = useMap() // Use MapContext
  const { getEnabledLayersForView } = useLayer()

  // Orchestrator handles everything automatically
  const { activePanels, isLayerRendered } = useLayerOrchestrator({
    map,
    viewId: 'factories',
    getEnabledLayers: () => getEnabledLayersForView('factories')
  })

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      {/* Map */}
      <div ref={mapContainerRef} className="h-full w-full" />

      {/* Left panels */}
      <SearchAndViewsPanel viewId="factories" />
      <LayerLibraryPanel viewId="factories" />

      {/* Right panels - orchestrator controls visibility */}
      {activePanels.length > 0 && (
        <div className="absolute top-4 right-4">
          <LayerControlsPanel viewId="factories" />
        </div>
      )}
    </div>
  )
}
```

### Step 2: Remove Manual Layer Logic

**Delete:**
- ❌ Manual `useEffect` for layer rendering
- ❌ `currentLayersOnMap` state tracking
- ❌ Manual `addLayerToMap` / `removeLayerFromMap` calls
- ❌ Theme change re-rendering logic

**Keep:**
- ✅ Map initialization
- ✅ Factory-specific logic (filters, click handlers)
- ✅ Panel components

### Step 3: Verify Layer Definitions

Ensure all layers in `layerDefinitions.ts` have:

```typescript
{
  hasMapVisualization: true,  // If it should render on map
  renderConfig: {             // How to render it
    layerType: 'circle' | 'fill' | 'line' | 'heatmap' | 'symbol',
    paint: { ... }
  },
  rightPanelComponent: YourPanelComponent, // Optional
  dataSource: '/data/your-data.json'       // Optional (for auto-loading)
}
```

### Step 4: Test the System

1. **Enable a layer** → Map visualization should appear immediately
2. **Disable a layer** → Visualization should disappear
3. **Change theme** → Layers should persist
4. **Switch views** → Layers should maintain state
5. **Enable multiple layers** → All should render correctly

## Debugging

### Enable Debug Logs

The orchestrator has extensive logging. Check browser console for:

```
🎭 LayerOrchestrator: Map initialized
🎭 LayerOrchestrator: Processing layer changes
🎭 LayerOrchestrator: Adding layer future_temperature_anomaly
🎨 Adding layer to map: future_temperature_anomaly
✅ LayerOrchestrator: Layer future_temperature_anomaly rendered successfully
🎭 LayerOrchestrator: Updating right panels: ["future_temperature_anomaly"]
```

### Common Issues

**Layer not rendering?**
```typescript
// Check orchestrator state
const { getLayerState } = useLayerOrchestrator(...)
const state = getLayerState('future_temperature_anomaly')
console.log('Layer state:', state)
// Shows: { rendered: true, hasError: false, ... }
```

**Right panel not appearing?**
```typescript
// Check active panels
const { activePanels } = useLayerOrchestrator(...)
console.log('Active panels:', activePanels)
// Should include layer IDs with rightPanelComponent
```

**Layers disappearing after theme change?**
```typescript
// Orchestrator automatically re-renders on style.load
// Check console for:
// "🎭 LayerOrchestrator: Style loaded, re-rendering layers"
```

## Advanced Features

### Custom Callbacks

```typescript
useLayerOrchestrator({
  map,
  viewId: 'factories',
  getEnabledLayers: () => getEnabledLayersForView('factories'),
  onLayerRendered: (layerId) => {
    console.log(`✅ ${layerId} is now visible`)
    // Track analytics, update UI, etc.
  },
  onLayerError: (layerId, error) => {
    console.error(`❌ ${layerId} failed:`, error)
    // Show toast notification, log error, etc.
  }
})
```

### Error Handling

```typescript
const { getLayersWithErrors } = useLayerOrchestrator(...)

// Show error banner if layers fail
const errors = getLayersWithErrors()
if (errors.length > 0) {
  return (
    <div className="error-banner">
      Failed to load: {errors.map(e => e.id).join(', ')}
    </div>
  )
}
```

### Conditional Rendering

```typescript
const { isLayerRendered } = useLayerOrchestrator(...)

// Only show controls when layer is actually rendered
{isLayerRendered('factories') && (
  <FactoryLayersPanel />
)}
```

## Benefits

### Before Orchestrator
- ❌ Manual layer sync logic in every view
- ❌ Layers disappear on theme change
- ❌ Race conditions with async data loading
- ❌ Context lost when switching views
- ❌ Duplicate code across components
- ❌ Hard to debug layer issues

### After Orchestrator
- ✅ Automatic layer sync everywhere
- ✅ Layers persist across theme changes
- ✅ Proper async handling with error tracking
- ✅ Context maintained globally
- ✅ Single source of truth
- ✅ Comprehensive logging and debugging

## Next Steps

1. **Integrate into FactoriesView** - Replace manual layer logic
2. **Test thoroughly** - Verify all layers render correctly
3. **Apply to ClimateView** - Use same pattern
4. **Apply to WaterAccessView** - Complete the migration
5. **Add data sources** - Define `dataSource` for all layers
6. **Implement loading states** - Show spinners while layers load

## File Structure

```
src/
├── orchestrators/
│   └── LayerOrchestrator.ts          # Core orchestrator class
├── hooks/
│   └── useLayerOrchestrator.ts       # React hook
├── config/
│   └── layerDefinitions.ts           # Layer metadata
├── utils/
│   └── layerRenderer.ts              # Mapbox rendering utilities
└── components/
    ├── FactoriesView.tsx             # Uses orchestrator
    ├── ClimateView.tsx               # Uses orchestrator
    └── WaterAccessView.tsx           # Uses orchestrator
```

## Summary

The Layer Orchestrator provides a **robust, centralized system** for managing layer rendering and maintaining context across your entire application. It eliminates manual layer management, prevents common bugs, and ensures a consistent user experience.
