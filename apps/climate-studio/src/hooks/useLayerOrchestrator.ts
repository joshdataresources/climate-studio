/**
 * React hook for using the LayerOrchestrator
 *
 * Usage in view components:
 *
 * ```tsx
 * function FactoriesView() {
 *   const { map } = useMap()
 *   const { getEnabledLayersForView } = useLayer()
 *
 *   // Initialize orchestrator
 *   useLayerOrchestrator({
 *     map,
 *     viewId: 'factories',
 *     getEnabledLayers: () => getEnabledLayersForView('factories')
 *   })
 *
 *   return <div>...</div>
 * }
 * ```
 */

import { useEffect, useRef, useCallback, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import { LayerDefinition } from '../config/layerDefinitions'
import { getLayerOrchestrator, LayerOrchestrator } from '../orchestrators/LayerOrchestrator'

export interface UseLayerOrchestratorOptions {
  map: mapboxgl.Map | null
  viewId: string
  getEnabledLayers: () => LayerDefinition[]
  onLayerRendered?: (layerId: string) => void
  onLayerRemoved?: (layerId: string) => void
  onLayerError?: (layerId: string, error: string) => void
}

export function useLayerOrchestrator(options: UseLayerOrchestratorOptions) {
  const {
    map,
    viewId,
    getEnabledLayers,
    onLayerRendered,
    onLayerRemoved,
    onLayerError
  } = options

  const orchestratorRef = useRef<LayerOrchestrator | null>(null)
  const [activePanels, setActivePanels] = useState<string[]>([])
  const previousLayersRef = useRef<string>('')

  // Initialize orchestrator
  useEffect(() => {
    if (!orchestratorRef.current) {
      orchestratorRef.current = getLayerOrchestrator({
        onLayerRendered,
        onLayerRemoved,
        onLayerError,
        onPanelUpdate: (panels) => {
          console.log('🎭 useLayerOrchestrator: Panels updated:', panels)
          setActivePanels(panels)
        }
      })
    }
  }, [onLayerRendered, onLayerRemoved, onLayerError])

  // Set map when it becomes available
  useEffect(() => {
    if (map && orchestratorRef.current) {
      console.log('🎭 useLayerOrchestrator: Setting map on orchestrator')
      orchestratorRef.current.setMap(map)
    }
  }, [map])

  // Process layer changes when enabled layers change
  useEffect(() => {
    if (!orchestratorRef.current || !map) return

    const enabledLayers = getEnabledLayers()
    const currentLayersKey = enabledLayers.map(l => `${l.id}:${l.opacity}`).join(',')

    // Only process if layers actually changed
    if (currentLayersKey !== previousLayersRef.current) {
      console.log('🎭 useLayerOrchestrator: Enabled layers changed, processing...')
      previousLayersRef.current = currentLayersKey

      orchestratorRef.current.processLayerChanges(enabledLayers, viewId)
    }
  }, [map, viewId, getEnabledLayers])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (orchestratorRef.current) {
        console.log('🎭 useLayerOrchestrator: Cleaning up on unmount')
        // Don't cleanup completely - let the orchestrator persist across view changes
        // orchestratorRef.current.cleanup()
      }
    }
  }, [])

  // Return helper functions
  const isLayerRendered = useCallback((layerId: string): boolean => {
    return orchestratorRef.current?.isLayerRendered(layerId) ?? false
  }, [])

  const getLayerState = useCallback((layerId: string) => {
    return orchestratorRef.current?.getLayerState(layerId)
  }, [])

  const getLayersWithErrors = useCallback(() => {
    return orchestratorRef.current?.getLayersWithErrors() ?? []
  }, [])

  return {
    activePanels,
    isLayerRendered,
    getLayerState,
    getLayersWithErrors,
    orchestrator: orchestratorRef.current
  }
}
