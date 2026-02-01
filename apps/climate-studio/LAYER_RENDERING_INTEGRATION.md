# Universal Layer Rendering System - Integration Guide

## Overview

The universal layer rendering system allows ANY layer to render on ANY view in the climate visualization app. It consists of two main components:

1. **Layer Renderer Utilities** (`/src/utils/layerRenderers.ts`) - Reusable functions for rendering different layer types
2. **useMapLayerRenderer Hook** (`/src/hooks/useMapLayerRenderer.ts`) - React hook for automatic layer management

## Files Created

### 1. `/src/utils/layerRenderers.ts`

Provides low-level rendering functions:

- `renderGeojsonLayer()` - Renders GeoJSON data (circles, fills, lines, symbols, heatmaps)
- `renderFactoryLayer()` - Specialized renderer for factory data with labels
- `renderRasterLayer()` - Renders raster tile layers (topographic relief, etc.)
- `renderClimateLayer()` - Renders climate data layers (with DeckGL support placeholder)
- `removeLayer()` - Cleans up layers and sources
- `updateLayerVisibility()` - Toggle layer visibility
- `updateLayerOpacity()` - Update layer opacity

### 2. `/src/hooks/useMapLayerRenderer.ts`

React hook that provides:

- Automatic syncing with LayerContext enabled state
- Click handler registration
- Layer lifecycle management
- Data provider support for pre-loaded data

## How to Integrate

### Option 1: Automatic Layer Rendering (Recommended)

Use the hook with `autoSync: true` to automatically render all enabled layers:

```tsx
import { useMapLayerRenderer } from '../hooks/useMapLayerRenderer'
import { useLayer } from '../contexts/LayerContext'

function MyMapView() {
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const [mapLoaded, setMapLoaded] = useState(false)

  // Initialize hook with auto-sync
  const { refreshLayers } = useMapLayerRenderer(
    mapRef.current,
    'factories', // or 'climate', 'water', etc.
    {
      autoSync: true, // Automatically add/remove layers based on LayerContext
      onLayerClick: (layerId, feature) => {
        console.log('Layer clicked:', layerId, feature)
        // Handle click events (e.g., open detail panel)
      }
    }
  )

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [-98.5795, 39.8283],
      zoom: 4
    })

    mapRef.current = map

    map.on('load', () => {
      setMapLoaded(true)
      // Layers will be added automatically via autoSync
    })

    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [])

  // Refresh layers when style changes
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return

    const newStyle = isDark ? 'mapbox://styles/mapbox/dark-v11' : 'mapbox://styles/mapbox/light-v11'
    mapRef.current.setStyle(newStyle)

    mapRef.current.once('style.load', () => {
      refreshLayers() // Re-add all enabled layers
    })
  }, [isDark, mapLoaded, refreshLayers])

  return <div ref={mapContainerRef} className="w-full h-full" />
}
```

### Option 2: Manual Layer Control

Use the hook with `autoSync: false` for manual control:

```tsx
const { addLayer, removeLayer, updateVisibility } = useMapLayerRenderer(
  mapRef.current,
  'water',
  { autoSync: false }
)

// Manually add a layer
const handleAddFactories = async () => {
  const factoryLayer = getLayerById('factories')
  if (factoryLayer) {
    await addLayer(factoryLayer)
  }
}

// Remove a layer
const handleRemoveFactories = () => {
  removeLayer('factories')
}

// Toggle visibility
const handleToggleVisibility = () => {
  updateVisibility('factories', !isVisible)
}
```

### Option 3: Using Utilities Directly

For more control, use the utility functions directly:

```tsx
import {
  renderFactoryLayer,
  renderGeojsonLayer,
  removeLayer
} from '../utils/layerRenderers'
import { getLayerById } from '../config/layerDefinitions'

// In your component
const setupLayers = async (map: mapboxgl.Map) => {
  const factoryLayer = getLayerById('factories')

  if (factoryLayer) {
    // Render with pre-loaded data
    await renderFactoryLayer(map, factoryLayer, factoriesData.factories)

    // Or let it fetch from dataSource
    await renderFactoryLayer(map, factoryLayer)
  }

  // Render other layers
  const damLayer = getLayerById('major_dams')
  if (damLayer) {
    await renderGeojsonLayer(map, damLayer)
  }
}
```

## Migrating Existing Views

### Current FactoriesView (Before)

The FactoriesView currently has custom layer rendering logic in the `setupFactoryLayers` callback:

```tsx
// OLD - Custom implementation in FactoriesView.tsx (lines 62-189)
const setupFactoryLayers = useCallback((map: mapboxgl.Map) => {
  if (!map || map.getSource('factories')) return

  // Convert to GeoJSON
  const geojson = { /* ... */ }

  // Add source
  map.addSource('factories', { /* ... */ })

  // Add layers
  map.addLayer({ /* circle layer */ })
  map.addLayer({ /* label layer */ })

  // Add click handlers
  map.on('click', 'factory-circles', handler)
}, [])
```

### Refactored FactoriesView (After)

Replace with the universal hook:

```tsx
// NEW - Using universal hook
import { useMapLayerRenderer } from '../hooks/useMapLayerRenderer'
import factoriesExpandedData from '../data/factories-expanded.json'

export default function FactoriesView() {
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const [selectedFactory, setSelectedFactory] = useState<SelectedFactory | null>(null)

  // Use the universal hook with factory data
  useMapLayerRenderer(
    mapRef.current,
    'factories',
    {
      autoSync: true,
      dataProvider: {
        factories: factoriesExpandedData.factories
      },
      onLayerClick: (layerId, feature) => {
        if (layerId === 'factories') {
          const factoryId = feature.properties?.id
          const fullFactory = factoriesExpandedData.factories.find(f => f.id === factoryId)
          if (fullFactory) {
            setSelectedFactory(fullFactory)
          }
        }
      }
    }
  )

  // Rest of component stays the same...
  // Map initialization, filters, etc.
}
```

## Layer Configuration

All layer rendering is configured in `/src/config/layerDefinitions.ts`:

```typescript
{
  id: 'factories',
  name: 'Factories',
  type: 'geojson',
  category: 'infrastructure',
  hasMapVisualization: true, // IMPORTANT: Must be true to render
  dataSource: '/data/factories-expanded.json',
  renderConfig: {
    layerType: 'circle',
    paint: {
      'circle-radius': 12,
      'circle-color': [
        'interpolate',
        ['linear'],
        ['get', 'risk_score'],
        0, '#10b981',
        3, '#eab308',
        5, '#f97316',
        7, '#ef4444'
      ],
      'circle-opacity': 0.8,
      'circle-stroke-width': 2,
      'circle-stroke-color': '#ffffff'
    }
  }
}
```

## Adding New Layers

To add a new layer that works across all views:

1. **Add layer definition** to `layerDefinitions.ts`:

```typescript
{
  id: 'major_dams',
  name: 'Major Dams',
  type: 'geojson',
  category: 'water',
  hasMapVisualization: true,
  dataSource: '/data/dams.json',
  renderConfig: {
    layerType: 'circle',
    paint: {
      'circle-radius': 8,
      'circle-color': '#3b82f6',
      'circle-opacity': 0.7
    }
  }
}
```

2. **Enable in Layer Library** - Users can toggle it on in any view

3. **It just works!** - The hook automatically renders it based on the configuration

## Features

### Automatic Rendering

- ✅ Layers auto-render when enabled in LayerContext
- ✅ Layers auto-remove when disabled
- ✅ Visibility and opacity sync automatically
- ✅ Works across style changes (light/dark theme)

### Click Handling

```tsx
useMapLayerRenderer(map, 'factories', {
  onLayerClick: (layerId, feature) => {
    // Handle any layer click
    switch(layerId) {
      case 'factories':
        openFactoryDetail(feature)
        break
      case 'major_dams':
        openDamDetail(feature)
        break
    }
  }
})
```

### Pre-loaded Data

```tsx
useMapLayerRenderer(map, 'water', {
  dataProvider: {
    major_dams: damsData,
    factories: factoriesData,
    river_flow_status: riverData
  }
})
```

## Layer Types Supported

- **GeoJSON** - Points, lines, polygons from local files or APIs
- **Raster** - Tile-based layers like topographic relief
- **Climate** - Climate data (with DeckGL integration planned)
- **Vector** - Vector tile sources

## Custom Renderers

For specialized rendering (like factories with labels), create custom renderer functions:

```typescript
// In layerRenderers.ts
export async function renderDamLayer(
  map: mapboxgl.Map,
  layerDef: LayerDefinition
): Promise<void> {
  // Custom logic for dams
  // Add multiple layers, custom interactions, etc.
}
```

Then use in the hook:

```typescript
// The hook will route to renderGeojsonLayer by default
// Or handle custom logic in the addLayer function
```

## Issues and Limitations

### Current Limitations

1. **Climate Layers** - DeckGL integration not yet implemented. Climate layers with `requiresClimateWidget: true` may need special handling.

2. **Layer Ordering** - Layers are added in the order they're enabled. For z-index control, you may need to manually reorder using Mapbox's `map.moveLayer()`.

3. **Data Formats** - Currently supports:
   - GeoJSON FeatureCollection
   - Factory data format (with `factories` array wrapper)
   - Raster tile URLs

4. **Filter State** - The hook doesn't handle complex filters (like FactoriesView status/sector/risk filters). These should be managed separately using `map.setFilter()`.

### Known Issues

- **Style Changes** - When changing map style, layers must be re-added. Use `refreshLayers()` in the `style.load` event.

- **Factory Labels** - Only factory layers get automatic labels. Other layers need custom implementation.

### Workarounds

For view-specific filters (like FactoriesView), keep the existing filter logic:

```tsx
// Keep this logic for view-specific filtering
const updateMapFilters = useCallback(() => {
  if (!mapRef.current || !mapLoaded) return

  const filter = ['all', /* your filters */]

  if (mapRef.current.getLayer('factories-circles')) {
    mapRef.current.setFilter('factories-circles', filter)
  }
}, [/* dependencies */])
```

## Testing

Test the implementation by:

1. **Enable/Disable Layers** - Toggle layers in the Layer Library panel
2. **Switch Views** - Verify layers render correctly in different views
3. **Change Theme** - Test light/dark mode transitions
4. **Click Interactions** - Verify click handlers work
5. **Opacity Changes** - Adjust layer opacity in Layer Library

## Next Steps

1. **Migrate FactoriesView** - Replace custom `setupFactoryLayers` with the hook
2. **Migrate WaterAccessView** - Consolidate water layer rendering
3. **Migrate ClimateView** - Add climate layer support
4. **Implement DeckGL** - Add support for climate visualization layers
5. **Add Layer Ordering** - Implement z-index control for layer stacking
6. **Add Animation** - Support for animated/time-series layers

## Example: Complete View Implementation

```tsx
import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import { useMapLayerRenderer } from '../hooks/useMapLayerRenderer'
import { useTheme } from '../contexts/ThemeContext'
import factoriesData from '../data/factories-expanded.json'

export default function UniversalMapView() {
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  // Universal layer rendering
  const { refreshLayers } = useMapLayerRenderer(
    mapRef.current,
    'factories',
    {
      autoSync: true,
      dataProvider: { factories: factoriesData.factories },
      onLayerClick: (layerId, feature) => {
        console.log('Clicked:', layerId, feature.properties)
      }
    }
  )

  // Initialize map once
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: isDark ? 'mapbox://styles/mapbox/dark-v11' : 'mapbox://styles/mapbox/light-v11',
      center: [-98.5795, 39.8283],
      zoom: 4
    })

    mapRef.current = map
    map.on('load', () => setMapLoaded(true))

    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [])

  // Handle theme changes
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return

    const newStyle = isDark ? 'mapbox://styles/mapbox/dark-v11' : 'mapbox://styles/mapbox/light-v11'
    mapRef.current.setStyle(newStyle)
    mapRef.current.once('style.load', refreshLayers)
  }, [isDark, mapLoaded, refreshLayers])

  return <div ref={mapContainerRef} className="w-full h-full" />
}
```

## Summary

The universal layer rendering system standardizes layer management across all views, making it easy to:

- Add new layers without writing view-specific code
- Share layers across multiple views
- Maintain consistent styling and behavior
- Reduce code duplication
- Enable users to customize which layers appear in each view

All layer configuration is centralized in `layerDefinitions.ts`, and the rendering logic is reusable across the entire application.
