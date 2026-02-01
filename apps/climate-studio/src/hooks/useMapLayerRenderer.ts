/**
 * useMapLayerRenderer Hook
 *
 * A custom React hook that provides universal layer rendering capabilities
 * for any Mapbox GL map instance. This hook:
 * - Monitors enabled layers from LayerContext
 * - Automatically adds/removes map layers based on enabled state
 * - Uses layer definitions and renderConfig for styling
 * - Provides helper functions for layer management
 *
 * Usage:
 * ```tsx
 * const { addLayer, removeLayer, updateVisibility, updateOpacity } = useMapLayerRenderer(mapRef.current, 'factories')
 * ```
 */

import { useEffect, useCallback, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import { useLayer } from '../contexts/LayerContext'
import type { LayerDefinition } from '../contexts/LayerContext'
import {
  renderGeojsonLayer,
  renderFactoryLayer,
  renderRasterLayer,
  renderClimateLayer,
  removeLayer as removeLayerUtil,
  updateLayerVisibility,
  updateLayerOpacity
} from '../utils/layerRenderers'

export interface UseMapLayerRendererOptions {
  /**
   * Optional callback when a layer is clicked
   */
  onLayerClick?: (layerId: string, feature: any) => void

  /**
   * Optional data provider for layers
   * Allows passing pre-loaded data instead of fetching
   */
  dataProvider?: {
    [layerId: string]: any
  }

  /**
   * Whether to automatically sync with LayerContext enabled state
   * Default: true
   */
  autoSync?: boolean
}

export interface UseMapLayerRendererReturn {
  /**
   * Add a layer to the map
   */
  addLayer: (layerDef: LayerDefinition, data?: any) => Promise<void>

  /**
   * Remove a layer from the map
   */
  removeLayer: (layerId: string) => void

  /**
   * Update layer visibility
   */
  updateVisibility: (layerId: string, visible: boolean) => void

  /**
   * Update layer opacity
   */
  updateOpacity: (layerId: string, opacity: number) => void

  /**
   * Refresh all layers (useful after style changes)
   */
  refreshLayers: () => Promise<void>

  /**
   * Get currently rendered layer IDs
   */
  getRenderedLayers: () => string[]
}

/**
 * Custom hook for rendering map layers
 *
 * @param map - Mapbox GL map instance
 * @param viewId - Current view ID (e.g., 'climate', 'water', 'factories')
 * @param options - Optional configuration
 * @returns Layer management functions
 */
export function useMapLayerRenderer(
  map: mapboxgl.Map | null,
  viewId: string,
  options: UseMapLayerRendererOptions = {}
): UseMapLayerRendererReturn {
  const { getEnabledLayersForView, availableLayers } = useLayer()
  const renderedLayersRef = useRef<Set<string>>(new Set())
  const clickHandlersRef = useRef<Map<string, (e: any) => void>>(new Map())

  const {
    onLayerClick,
    dataProvider,
    autoSync = true
  } = options

  /**
   * Add a layer to the map based on its type
   */
  const addLayer = useCallback(async (layerDef: LayerDefinition, data?: any) => {
    if (!map || !map.isStyleLoaded()) {
      console.warn('Map not ready for layer rendering')
      return
    }

    // Skip if layer doesn't have map visualization
    if (!layerDef.hasMapVisualization) {
      console.log(`Skipping layer ${layerDef.id} - no map visualization`)
      return
    }

    // Get data from provider if available
    const layerData = data || dataProvider?.[layerDef.id]

    try {
      // Route to appropriate renderer based on layer type
      switch (layerDef.type) {
        case 'geojson':
          if (layerDef.id === 'factories') {
            // Use specialized factory renderer
            await renderFactoryLayer(map, layerDef, layerData)
          } else {
            await renderGeojsonLayer(map, layerDef, layerData)
          }
          break

        case 'raster':
          await renderRasterLayer(map, layerDef)
          break

        case 'climate':
          await renderClimateLayer(map, layerDef)
          break

        case 'vector':
          // Vector tiles - similar to GeoJSON but from vector tile source
          await renderGeojsonLayer(map, layerDef, layerData)
          break

        default:
          console.warn(`Unknown layer type: ${layerDef.type}`)
      }

      // Track rendered layer
      renderedLayersRef.current.add(layerDef.id)

      // Add click handler if callback provided
      if (onLayerClick) {
        const circleLayerId = `${layerDef.id}-circles`
        const layerId = `${layerDef.id}-layer`

        const clickHandler = (e: any) => {
          if (e.features && e.features[0]) {
            onLayerClick(layerDef.id, e.features[0])
          }
        }

        // Try both layer ID variations
        if (map.getLayer(circleLayerId)) {
          map.on('click', circleLayerId, clickHandler)
          clickHandlersRef.current.set(circleLayerId, clickHandler)

          // Add cursor pointer on hover
          map.on('mouseenter', circleLayerId, () => {
            map.getCanvas().style.cursor = 'pointer'
          })
          map.on('mouseleave', circleLayerId, () => {
            map.getCanvas().style.cursor = ''
          })
        } else if (map.getLayer(layerId)) {
          map.on('click', layerId, clickHandler)
          clickHandlersRef.current.set(layerId, clickHandler)

          // Add cursor pointer on hover
          map.on('mouseenter', layerId, () => {
            map.getCanvas().style.cursor = 'pointer'
          })
          map.on('mouseleave', layerId, () => {
            map.getCanvas().style.cursor = ''
          })
        }
      }

      console.log(`✅ Layer ${layerDef.id} rendered successfully`)
    } catch (error) {
      console.error(`Failed to render layer ${layerDef.id}:`, error)
    }
  }, [map, onLayerClick, dataProvider])

  /**
   * Remove a layer from the map
   */
  const removeLayer = useCallback((layerId: string) => {
    if (!map) return

    // Remove click handlers
    const circleLayerId = `${layerId}-circles`
    const layerOnlyId = `${layerId}-layer`

    const handler1 = clickHandlersRef.current.get(circleLayerId)
    const handler2 = clickHandlersRef.current.get(layerOnlyId)

    if (handler1) {
      map.off('click', circleLayerId, handler1)
      map.off('mouseenter', circleLayerId, () => {})
      map.off('mouseleave', circleLayerId, () => {})
      clickHandlersRef.current.delete(circleLayerId)
    }

    if (handler2) {
      map.off('click', layerOnlyId, handler2)
      map.off('mouseenter', layerOnlyId, () => {})
      map.off('mouseleave', layerOnlyId, () => {})
      clickHandlersRef.current.delete(layerOnlyId)
    }

    // Remove layer and source
    removeLayerUtil(map, layerId)
    renderedLayersRef.current.delete(layerId)
  }, [map])

  /**
   * Update layer visibility
   */
  const updateVisibility = useCallback((layerId: string, visible: boolean) => {
    if (!map) return
    updateLayerVisibility(map, layerId, visible)
  }, [map])

  /**
   * Update layer opacity
   */
  const updateOpacity = useCallback((layerId: string, opacity: number) => {
    if (!map) return
    updateLayerOpacity(map, layerId, opacity)
  }, [map])

  /**
   * Refresh all currently rendered layers
   * Useful after style changes or data updates
   */
  const refreshLayers = useCallback(async () => {
    if (!map || !map.isStyleLoaded()) return

    const layersToRefresh = Array.from(renderedLayersRef.current)

    // Clear all layers first
    layersToRefresh.forEach(layerId => {
      removeLayer(layerId)
    })

    // Re-add enabled layers
    const enabledLayers = getEnabledLayersForView(viewId)
    for (const layer of enabledLayers) {
      if (layer.hasMapVisualization) {
        await addLayer(layer)
      }
    }
  }, [map, viewId, getEnabledLayersForView, addLayer, removeLayer])

  /**
   * Get currently rendered layer IDs
   */
  const getRenderedLayers = useCallback(() => {
    return Array.from(renderedLayersRef.current)
  }, [])

  /**
   * Auto-sync with LayerContext enabled state
   * Automatically adds/removes layers when enabled state changes
   */
  useEffect(() => {
    if (!map || !autoSync || !map.isStyleLoaded()) return

    const enabledLayers = getEnabledLayersForView(viewId)
    const enabledLayerIds = new Set(enabledLayers.map(l => l.id))
    const currentlyRendered = renderedLayersRef.current

    // Add newly enabled layers
    enabledLayers.forEach(async (layer) => {
      if (layer.hasMapVisualization && !currentlyRendered.has(layer.id)) {
        await addLayer(layer)
      }
    })

    // Remove disabled layers
    currentlyRendered.forEach(layerId => {
      if (!enabledLayerIds.has(layerId)) {
        removeLayer(layerId)
      }
    })
  }, [map, viewId, autoSync, getEnabledLayersForView, addLayer, removeLayer])

  /**
   * Sync visibility and opacity changes
   */
  useEffect(() => {
    if (!map || !map.isStyleLoaded()) return

    // Update visibility and opacity for rendered layers when layer state changes
    availableLayers.forEach(layer => {
      if (renderedLayersRef.current.has(layer.id)) {
        updateVisibility(layer.id, layer.visible)
        updateOpacity(layer.id, layer.opacity)
      }
    })
  }, [map, availableLayers, updateVisibility, updateOpacity])

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      // Remove all click handlers
      clickHandlersRef.current.forEach((handler, layerId) => {
        if (map) {
          map.off('click', layerId, handler)
          map.off('mouseenter', layerId, () => {})
          map.off('mouseleave', layerId, () => {})
        }
      })
      clickHandlersRef.current.clear()
      renderedLayersRef.current.clear()
    }
  }, [map])

  return {
    addLayer,
    removeLayer,
    updateVisibility,
    updateOpacity,
    refreshLayers,
    getRenderedLayers
  }
}
