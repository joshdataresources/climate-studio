/**
 * Universal Layer Rendering Utilities
 *
 * This module provides reusable functions for rendering different types of map layers
 * across all views (Climate, Water Access, Factories). Each function handles the
 * creation and configuration of Mapbox GL sources and layers based on layer definitions.
 */

import mapboxgl from 'mapbox-gl'
import type { LayerDefinition } from '../contexts/LayerContext'

/**
 * Render a GeoJSON layer on the map
 * Handles circle, fill, line, symbol, and heatmap layer types
 *
 * @param map - Mapbox GL map instance
 * @param layerDef - Layer definition with renderConfig
 * @param data - GeoJSON data to render (optional, will fetch from dataSource if not provided)
 */
export async function renderGeojsonLayer(
  map: mapboxgl.Map,
  layerDef: LayerDefinition,
  data?: GeoJSON.FeatureCollection
): Promise<void> {
  if (!layerDef.hasMapVisualization) {
    console.warn(`Layer ${layerDef.id} does not have map visualization enabled`)
    return
  }

  const sourceId = `${layerDef.id}-source`
  const layerId = `${layerDef.id}-layer`

  // Remove existing layer and source if present
  if (map.getLayer(layerId)) {
    map.removeLayer(layerId)
  }
  if (map.getSource(sourceId)) {
    map.removeSource(sourceId)
  }

  // Fetch data if not provided
  let geojsonData = data
  if (!geojsonData && layerDef.dataSource) {
    try {
      const response = await fetch(layerDef.dataSource)
      const jsonData = await response.json()

      // Handle different data formats - check if it's wrapped in a factories array
      if (jsonData.factories && Array.isArray(jsonData.factories)) {
        geojsonData = convertFactoriesToGeoJSON(jsonData.factories)
      } else if (jsonData.type === 'FeatureCollection') {
        geojsonData = jsonData
      } else {
        console.error(`Unsupported data format for layer ${layerDef.id}`)
        return
      }
    } catch (error) {
      console.error(`Failed to fetch data for layer ${layerDef.id}:`, error)
      return
    }
  }

  if (!geojsonData) {
    console.error(`No GeoJSON data available for layer ${layerDef.id}`)
    return
  }

  // Add source
  map.addSource(sourceId, {
    type: 'geojson',
    data: geojsonData
  })

  // Determine layer type from renderConfig or default to circle
  const layerType = layerDef.renderConfig?.layerType || 'circle'

  // Build layer configuration
  const layerConfig: any = {
    id: layerId,
    type: layerType,
    source: sourceId,
  }

  // Add paint properties if defined
  if (layerDef.renderConfig?.paint) {
    layerConfig.paint = {
      ...layerDef.renderConfig.paint,
      // Apply opacity from layer definition
      ...(layerType === 'circle' && {
        'circle-opacity': layerDef.opacity * (layerDef.renderConfig.paint['circle-opacity'] || 1)
      }),
      ...(layerType === 'fill' && {
        'fill-opacity': layerDef.opacity * (layerDef.renderConfig.paint['fill-opacity'] || 1)
      }),
      ...(layerType === 'line' && {
        'line-opacity': layerDef.opacity * (layerDef.renderConfig.paint['line-opacity'] || 1)
      })
    }
  }

  // Add layout properties if defined
  if (layerDef.renderConfig?.layout) {
    layerConfig.layout = {
      ...layerDef.renderConfig.layout,
      // Apply visibility from layer definition
      visibility: layerDef.visible ? 'visible' : 'none'
    }
  } else {
    layerConfig.layout = {
      visibility: layerDef.visible ? 'visible' : 'none'
    }
  }

  // Add the layer to the map
  map.addLayer(layerConfig)

  console.log(`✅ Rendered GeoJSON layer: ${layerDef.id}`)
}

/**
 * Render a factory layer specifically
 * This is a specialized version of renderGeojsonLayer for factories
 *
 * @param map - Mapbox GL map instance
 * @param layerDef - Factory layer definition
 * @param data - Factory data (optional, will fetch if not provided)
 */
export async function renderFactoryLayer(
  map: mapboxgl.Map,
  layerDef: LayerDefinition,
  data?: any[]
): Promise<void> {
  if (!layerDef.hasMapVisualization) {
    console.warn(`Layer ${layerDef.id} does not have map visualization enabled`)
    return
  }

  const sourceId = `${layerDef.id}-source`
  const circleLayerId = `${layerDef.id}-circles`
  const labelLayerId = `${layerDef.id}-labels`

  // Remove existing layers and source if present
  if (map.getLayer(labelLayerId)) {
    map.removeLayer(labelLayerId)
  }
  if (map.getLayer(circleLayerId)) {
    map.removeLayer(circleLayerId)
  }
  if (map.getSource(sourceId)) {
    map.removeSource(sourceId)
  }

  // Fetch data if not provided
  let factoryData = data
  if (!factoryData && layerDef.dataSource) {
    try {
      const response = await fetch(layerDef.dataSource)
      const jsonData = await response.json()
      factoryData = jsonData.factories || jsonData
    } catch (error) {
      console.error(`Failed to fetch factory data for layer ${layerDef.id}:`, error)
      return
    }
  }

  if (!factoryData || !Array.isArray(factoryData)) {
    console.error(`No factory data available for layer ${layerDef.id}`)
    return
  }

  // Convert factories to GeoJSON
  const geojson = convertFactoriesToGeoJSON(factoryData)

  console.log(`🏭 Setting up factory layer with ${geojson.features.length} factories...`)

  // Add source
  map.addSource(sourceId, {
    type: 'geojson',
    data: geojson
  })

  // Add factory circle layer with renderConfig from layer definition
  const circleConfig: any = {
    id: circleLayerId,
    type: 'circle',
    source: sourceId,
    paint: layerDef.renderConfig?.paint || {
      'circle-radius': 12,
      'circle-color': [
        'interpolate',
        ['linear'],
        ['get', 'risk_score'],
        0, '#10b981',  // green-500
        3, '#eab308',  // yellow-500
        5, '#f97316',  // orange-500
        7, '#ef4444'   // red-500
      ],
      'circle-opacity': 0.8,
      'circle-stroke-width': 2,
      'circle-stroke-color': '#ffffff',
      'circle-stroke-opacity': 0.9
    },
    layout: {
      visibility: layerDef.visible ? 'visible' : 'none'
    }
  }

  // Apply opacity from layer definition
  if (circleConfig.paint['circle-opacity']) {
    circleConfig.paint['circle-opacity'] = layerDef.opacity * circleConfig.paint['circle-opacity']
  }

  map.addLayer(circleConfig)

  // Add factory labels
  map.addLayer({
    id: labelLayerId,
    type: 'symbol',
    source: sourceId,
    layout: {
      'text-field': ['get', 'name'],
      'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
      'text-size': 11,
      'text-offset': [0, 1.5],
      'text-anchor': 'top',
      'text-max-width': 12,
      visibility: layerDef.visible ? 'visible' : 'none'
    },
    paint: {
      'text-color': '#1f2937',
      'text-halo-color': '#ffffff',
      'text-halo-width': 1.5,
      'text-opacity': layerDef.opacity
    }
  })

  console.log(`✅ Factory layer and labels added: ${layerDef.id}`)
}

/**
 * Render a raster layer on the map
 * Used for topographic relief and other raster data sources
 *
 * @param map - Mapbox GL map instance
 * @param layerDef - Layer definition with raster source
 */
export async function renderRasterLayer(
  map: mapboxgl.Map,
  layerDef: LayerDefinition
): Promise<void> {
  if (!layerDef.hasMapVisualization) {
    console.warn(`Layer ${layerDef.id} does not have map visualization enabled`)
    return
  }

  const sourceId = `${layerDef.id}-source`
  const layerId = `${layerDef.id}-layer`

  // Remove existing layer and source if present
  if (map.getLayer(layerId)) {
    map.removeLayer(layerId)
  }
  if (map.getSource(sourceId)) {
    map.removeSource(sourceId)
  }

  // For raster layers, we need a tile URL or URL template
  if (!layerDef.dataSource) {
    console.error(`No data source URL provided for raster layer ${layerDef.id}`)
    return
  }

  // Add raster source
  map.addSource(sourceId, {
    type: 'raster',
    url: layerDef.dataSource,
    tileSize: 256
  })

  // Add raster layer
  map.addLayer({
    id: layerId,
    type: 'raster',
    source: sourceId,
    paint: {
      'raster-opacity': layerDef.opacity,
      ...(layerDef.renderConfig?.paint || {})
    },
    layout: {
      visibility: layerDef.visible ? 'visible' : 'none',
      ...(layerDef.renderConfig?.layout || {})
    }
  })

  console.log(`✅ Rendered raster layer: ${layerDef.id}`)
}

/**
 * Render a climate layer on the map
 * Climate layers may require special handling or DeckGL integration
 *
 * @param map - Mapbox GL map instance
 * @param layerDef - Climate layer definition
 */
export async function renderClimateLayer(
  map: mapboxgl.Map,
  layerDef: LayerDefinition
): Promise<void> {
  if (!layerDef.hasMapVisualization) {
    console.warn(`Layer ${layerDef.id} does not have map visualization enabled`)
    return
  }

  // Climate layers may require DeckGL integration
  // For now, we'll handle them as GeoJSON if they have renderConfig
  if (layerDef.renderConfig && layerDef.dataSource) {
    console.log(`📊 Rendering climate layer as GeoJSON: ${layerDef.id}`)
    await renderGeojsonLayer(map, layerDef)
  } else {
    console.warn(`Climate layer ${layerDef.id} requires DeckGL integration - not yet implemented`)
    // Future: Implement DeckGL integration here
    // This would involve creating DeckGL layers and overlaying them on the Mapbox map
  }
}

/**
 * Remove a layer from the map
 * Handles cleanup of both the layer and its source
 *
 * @param map - Mapbox GL map instance
 * @param layerId - ID of the layer to remove
 */
export function removeLayer(map: mapboxgl.Map, layerId: string): void {
  const sourceId = `${layerId}-source`
  const circleLayerId = `${layerId}-circles`
  const labelLayerId = `${layerId}-labels`
  const layerOnlyId = `${layerId}-layer`

  // Remove all possible layer variations
  const layerIds = [layerId, circleLayerId, labelLayerId, layerOnlyId]

  layerIds.forEach(id => {
    if (map.getLayer(id)) {
      map.removeLayer(id)
      console.log(`🗑️ Removed layer: ${id}`)
    }
  })

  // Remove source
  if (map.getSource(sourceId)) {
    map.removeSource(sourceId)
    console.log(`🗑️ Removed source: ${sourceId}`)
  }
}

/**
 * Update layer visibility
 *
 * @param map - Mapbox GL map instance
 * @param layerId - ID of the layer to update
 * @param visible - Whether the layer should be visible
 */
export function updateLayerVisibility(
  map: mapboxgl.Map,
  layerId: string,
  visible: boolean
): void {
  const circleLayerId = `${layerId}-circles`
  const labelLayerId = `${layerId}-labels`
  const layerOnlyId = `${layerId}-layer`

  const visibility = visible ? 'visible' : 'none'
  const layerIds = [layerId, circleLayerId, labelLayerId, layerOnlyId]

  layerIds.forEach(id => {
    if (map.getLayer(id)) {
      map.setLayoutProperty(id, 'visibility', visibility)
    }
  })

  console.log(`👁️ Updated visibility for ${layerId}: ${visibility}`)
}

/**
 * Update layer opacity
 *
 * @param map - Mapbox GL map instance
 * @param layerId - ID of the layer to update
 * @param opacity - Opacity value (0-1)
 */
export function updateLayerOpacity(
  map: mapboxgl.Map,
  layerId: string,
  opacity: number
): void {
  const circleLayerId = `${layerId}-circles`
  const labelLayerId = `${layerId}-labels`
  const layerOnlyId = `${layerId}-layer`

  // Update circle layer opacity
  if (map.getLayer(circleLayerId)) {
    const currentOpacity = map.getPaintProperty(circleLayerId, 'circle-opacity')
    if (typeof currentOpacity === 'number') {
      map.setPaintProperty(circleLayerId, 'circle-opacity', opacity)
    }
  }

  // Update label opacity
  if (map.getLayer(labelLayerId)) {
    map.setPaintProperty(labelLayerId, 'text-opacity', opacity)
  }

  // Update generic layer opacity
  if (map.getLayer(layerOnlyId)) {
    const layer = map.getLayer(layerOnlyId)
    if (layer?.type === 'circle') {
      map.setPaintProperty(layerOnlyId, 'circle-opacity', opacity)
    } else if (layer?.type === 'fill') {
      map.setPaintProperty(layerOnlyId, 'fill-opacity', opacity)
    } else if (layer?.type === 'line') {
      map.setPaintProperty(layerOnlyId, 'line-opacity', opacity)
    } else if (layer?.type === 'raster') {
      map.setPaintProperty(layerOnlyId, 'raster-opacity', opacity)
    }
  }

  console.log(`🔆 Updated opacity for ${layerId}: ${opacity}`)
}

/**
 * Helper function to convert factory data to GeoJSON
 *
 * @param factories - Array of factory objects
 * @returns GeoJSON FeatureCollection
 */
function convertFactoriesToGeoJSON(factories: any[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: factories.map((factory: any) => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [
          factory.location.coordinates.lon,
          factory.location.coordinates.lat
        ]
      },
      properties: {
        id: factory.id,
        name: factory.name,
        company: factory.company,
        city: factory.location.city,
        state: factory.location.state,
        status: factory.status,
        sector: factory.sector,
        risk_score: factory.environmental_risk?.overall_risk_score || 5,
        total_investment: factory.investment?.total || 1000000000,
      }
    }))
  }
}
