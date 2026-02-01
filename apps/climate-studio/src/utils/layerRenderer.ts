// Universal Layer Renderer - Renders layers on Mapbox maps based on layerDefinitions.ts
import mapboxgl from 'mapbox-gl'
import { LayerDefinition } from '../config/layerDefinitions'

/**
 * Adds a layer to the map based on its renderConfig
 * @param map - The Mapbox map instance
 * @param layer - The layer definition from layerDefinitions.ts
 * @param data - GeoJSON data for the layer (optional, can be loaded from dataSource)
 */
export async function addLayerToMap(
  map: mapboxgl.Map,
  layer: LayerDefinition,
  data?: GeoJSON.FeatureCollection
): Promise<void> {
  console.log(`🎨 Adding layer to map:`, layer.id, {
    hasMapVisualization: layer.hasMapVisualization,
    renderConfig: layer.renderConfig,
    dataSource: layer.dataSource,
    requiresDeckGL: layer.requiresDeckGL
  })

  if (!layer.hasMapVisualization || !layer.renderConfig) {
    console.log(`⏭️ Skipping layer ${layer.id}: no map visualization or renderConfig`)
    return
  }

  // Skip DeckGL-only layers (they need the Climate view's DeckGLMap component)
  if (layer.requiresDeckGL) {
    console.warn(`⚠️ Layer ${layer.id} requires DeckGL - only available in Climate view`)
    console.log(`💡 This layer uses NASA Earth Engine / hexagon grid rendering`)
    return
  }

  // Check if source already exists
  if (map.getSource(layer.id)) {
    console.log(`⚠️ Source ${layer.id} already exists, skipping...`)
    return
  }

  // Load data if not provided
  let geojsonData = data
  if (!geojsonData && layer.dataSource) {
    try {
      console.log(`📥 Fetching data for ${layer.id} from ${layer.dataSource}...`)
      const response = await fetch(layer.dataSource)
      geojsonData = await response.json()
      console.log(`📦 Loaded data for ${layer.id}:`, {
        type: geojsonData.type,
        features: geojsonData.features?.length || 0
      })
    } catch (error) {
      console.error(`❌ Failed to load data for ${layer.id}:`, error)
      return
    }
  }

  if (!geojsonData) {
    console.error(`❌ No data available for layer ${layer.id}`)
    return
  }

  // Add source
  map.addSource(layer.id, {
    type: 'geojson',
    data: geojsonData
  })

  console.log(`✅ Added source for ${layer.id}`)

  // Add layer based on type
  const { layerType, paint, layout } = layer.renderConfig

  const mapboxLayer: mapboxgl.AnyLayer = {
    id: `${layer.id}-layer`,
    type: layerType || 'circle',
    source: layer.id,
    paint: paint || {},
    layout: layout || {}
  }

  console.log(`🗺️ Adding ${layerType} layer with config:`, { paint, layout })
  map.addLayer(mapboxLayer)
  console.log(`✅ Layer added successfully: ${layer.id}`)

  // Add labels if it's a circle or symbol layer
  if (layerType === 'circle' && geojsonData.features[0]?.properties?.name) {
    map.addLayer({
      id: `${layer.id}-labels`,
      type: 'symbol',
      source: layer.id,
      layout: {
        'text-field': ['get', 'name'],
        'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
        'text-size': 11,
        'text-offset': [0, 1.5],
        'text-anchor': 'top',
        'text-max-width': 12
      },
      paint: {
        'text-color': '#1f2937',
        'text-halo-color': '#ffffff',
        'text-halo-width': 1.5
      }
    })
    console.log(`✅ Added labels for ${layer.id}`)
  }

  // Set layer opacity
  if (layer.opacity !== undefined && layer.opacity !== 1.0) {
    setLayerOpacity(map, layer.id, layer.opacity)
  }
}

/**
 * Removes a layer from the map
 * @param map - The Mapbox map instance
 * @param layerId - The layer ID to remove
 */
export function removeLayerFromMap(map: mapboxgl.Map, layerId: string): void {
  // Remove labels first (if they exist)
  if (map.getLayer(`${layerId}-labels`)) {
    map.removeLayer(`${layerId}-labels`)
    console.log(`🗑️ Removed labels for ${layerId}`)
  }

  // Remove main layer
  if (map.getLayer(`${layerId}-layer`)) {
    map.removeLayer(`${layerId}-layer`)
    console.log(`🗑️ Removed layer ${layerId}`)
  }

  // Remove source
  if (map.getSource(layerId)) {
    map.removeSource(layerId)
    console.log(`🗑️ Removed source ${layerId}`)
  }
}

/**
 * Updates layer opacity
 * @param map - The Mapbox map instance
 * @param layerId - The layer ID
 * @param opacity - Opacity value (0-1)
 */
export function setLayerOpacity(map: mapboxgl.Map, layerId: string, opacity: number): void {
  const layerName = `${layerId}-layer`
  if (!map.getLayer(layerName)) {
    console.warn(`⚠️ Layer ${layerName} not found`)
    return
  }

  const layer = map.getLayer(layerName)
  const opacityProperty = getOpacityProperty(layer.type as any)

  if (opacityProperty) {
    map.setPaintProperty(layerName, opacityProperty, opacity)
    console.log(`🎨 Set opacity for ${layerId} to ${opacity}`)
  }
}

/**
 * Gets the appropriate opacity property for a layer type
 */
function getOpacityProperty(layerType: string): string | null {
  const opacityMap: Record<string, string> = {
    circle: 'circle-opacity',
    fill: 'fill-opacity',
    line: 'line-opacity',
    symbol: 'text-opacity',
    heatmap: 'heatmap-opacity'
  }
  return opacityMap[layerType] || null
}

/**
 * Syncs all enabled layers to the map
 * @param map - The Mapbox map instance
 * @param enabledLayers - Array of enabled layer definitions
 * @param currentLayerIds - Set of layer IDs currently on the map
 */
export async function syncLayersToMap(
  map: mapboxgl.Map,
  enabledLayers: LayerDefinition[],
  currentLayerIds: Set<string>
): Promise<Set<string>> {
  const newLayerIds = new Set<string>()

  // Add new layers
  for (const layer of enabledLayers) {
    if (layer.hasMapVisualization && !currentLayerIds.has(layer.id)) {
      await addLayerToMap(map, layer)
    }
    if (layer.hasMapVisualization) {
      newLayerIds.add(layer.id)
    }
  }

  // Remove disabled layers
  for (const layerId of currentLayerIds) {
    const stillEnabled = enabledLayers.find(l => l.id === layerId && l.hasMapVisualization)
    if (!stillEnabled) {
      removeLayerFromMap(map, layerId)
    }
  }

  return newLayerIds
}
