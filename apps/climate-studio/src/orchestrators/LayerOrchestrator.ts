/**
 * Layer Orchestrator - Ensures layers consistently render visualizations and widgets
 *
 * This orchestrator:
 * 1. Maintains sync between LayerContext state and map rendering
 * 2. Ensures right-side panels appear when layers are enabled
 * 3. Handles layer lifecycle (enable -> render -> update -> disable)
 * 4. Prevents race conditions and ensures proper cleanup
 * 5. Maintains context across view changes and theme switches
 */

import mapboxgl from 'mapbox-gl'
import { LayerDefinition } from '../config/layerDefinitions'
import { addLayerToMap, removeLayerFromMap, setLayerOpacity } from '../utils/layerRenderer'
import { getOrchestratorMemory, OrchestratorMemory } from '../services/OrchestratorMemory'

export interface LayerState {
  id: string
  enabled: boolean
  rendered: boolean
  hasError: boolean
  errorMessage?: string
  lastUpdated: number
}

export interface OrchestratorCallbacks {
  onLayerRendered?: (layerId: string) => void
  onLayerRemoved?: (layerId: string) => void
  onLayerError?: (layerId: string, error: string) => void
  onPanelUpdate?: (panels: string[]) => void
}

export class LayerOrchestrator {
  private map: mapboxgl.Map | null = null
  private layerStates: Map<string, LayerState> = new Map()
  private callbacks: OrchestratorCallbacks = {}
  private renderQueue: string[] = []
  private isProcessing = false
  private memory: OrchestratorMemory

  constructor(callbacks?: OrchestratorCallbacks) {
    this.callbacks = callbacks || {}
    this.memory = getOrchestratorMemory()

    // Restore state from memory if preferences allow
    this.restoreFromMemory()
  }

  /**
   * Restore orchestrator state from persistent memory
   */
  private restoreFromMemory(): void {
    const preferences = this.memory.getPreferences()

    if (!preferences.autoRestoreSession) {
      console.log('🧠 LayerOrchestrator: Auto-restore disabled')
      return
    }

    const savedLayers = this.memory.getLayerStates()
    console.log('🧠 LayerOrchestrator: Restoring from memory', {
      layerCount: savedLayers.length
    })

    // Note: Actual layer restoration happens in processLayerChanges
    // when the LayerContext provides the layer definitions
  }

  /**
   * Initialize orchestrator with a Mapbox map instance
   */
  setMap(map: mapboxgl.Map): void {
    console.log('🎭 LayerOrchestrator: Map initialized')
    this.map = map

    // Listen for style changes to re-render layers
    map.on('style.load', () => {
      console.log('🎭 LayerOrchestrator: Style loaded, re-rendering layers')
      this.reRenderAllLayers()
    })
  }

  /**
   * Process layer changes - called when LayerContext state changes
   */
  async processLayerChanges(
    enabledLayers: LayerDefinition[],
    viewId: string
  ): Promise<void> {
    if (!this.map) {
      console.warn('🎭 LayerOrchestrator: No map instance, skipping')
      return
    }

    console.log('🎭 LayerOrchestrator: Processing layer changes', {
      enabledLayers: enabledLayers.map(l => l.id),
      viewId
    })

    // Save current view to memory
    this.memory.saveCurrentView(viewId)

    // Get currently enabled layer IDs
    const enabledLayerIds = new Set(enabledLayers.map(l => l.id))
    const currentLayerIds = new Set(this.layerStates.keys())

    // Find layers to add
    const layersToAdd = enabledLayers.filter(
      layer => !currentLayerIds.has(layer.id) && layer.hasMapVisualization
    )

    // Find layers to remove
    const layersToRemove = Array.from(currentLayerIds).filter(
      id => !enabledLayerIds.has(id)
    )

    // Remove disabled layers
    for (const layerId of layersToRemove) {
      await this.removeLayer(layerId)
    }

    // Add new layers
    for (const layer of layersToAdd) {
      await this.addLayer(layer)
    }

    // Update right panels
    this.updateRightPanels(enabledLayers)

    // Update opacity for existing layers
    for (const layer of enabledLayers) {
      if (this.layerStates.has(layer.id) && layer.opacity !== undefined) {
        this.updateLayerOpacity(layer.id, layer.opacity)
      }
    }

    // Save layer states to memory
    this.memory.saveLayerStates(this.layerStates)
  }

  /**
   * Add a layer to the map
   */
  private async addLayer(layer: LayerDefinition): Promise<void> {
    if (!this.map) return

    // Initialize layer state
    const state: LayerState = {
      id: layer.id,
      enabled: true,
      rendered: false,
      hasError: false,
      lastUpdated: Date.now()
    }
    this.layerStates.set(layer.id, state)

    console.log(`🎭 LayerOrchestrator: Adding layer ${layer.id}`)

    try {
      // Skip DeckGL layers on non-Climate views
      if (layer.requiresDeckGL) {
        console.log(`🎭 LayerOrchestrator: Skipping DeckGL layer ${layer.id}`)
        state.rendered = false
        state.hasError = true
        state.errorMessage = 'Requires Climate view (DeckGL)'
        return
      }

      // Add to map using layerRenderer utility
      await addLayerToMap(this.map, layer)

      // Update state
      state.rendered = true
      state.hasError = false
      state.lastUpdated = Date.now()
      this.layerStates.set(layer.id, state)

      // Save to memory
      this.memory.updateLayerState(layer.id, true, layer.opacity)

      // Callback
      this.callbacks.onLayerRendered?.(layer.id)

      console.log(`✅ LayerOrchestrator: Layer ${layer.id} rendered successfully`)
    } catch (error) {
      console.error(`❌ LayerOrchestrator: Failed to add layer ${layer.id}:`, error)
      state.hasError = true
      state.errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this.layerStates.set(layer.id, state)

      // Callback
      this.callbacks.onLayerError?.(layer.id, state.errorMessage || 'Unknown error')
    }
  }

  /**
   * Remove a layer from the map
   */
  private async removeLayer(layerId: string): Promise<void> {
    if (!this.map) return

    console.log(`🎭 LayerOrchestrator: Removing layer ${layerId}`)

    try {
      removeLayerFromMap(this.map, layerId)
      this.layerStates.delete(layerId)

      // Update memory
      this.memory.removeLayerState(layerId)

      // Callback
      this.callbacks.onLayerRemoved?.(layerId)

      console.log(`✅ LayerOrchestrator: Layer ${layerId} removed successfully`)
    } catch (error) {
      console.error(`❌ LayerOrchestrator: Failed to remove layer ${layerId}:`, error)
    }
  }

  /**
   * Update layer opacity
   */
  private updateLayerOpacity(layerId: string, opacity: number): void {
    if (!this.map) return

    const state = this.layerStates.get(layerId)
    if (!state || !state.rendered) return

    try {
      setLayerOpacity(this.map, layerId, opacity)
      console.log(`🎨 LayerOrchestrator: Updated opacity for ${layerId} to ${opacity}`)
    } catch (error) {
      console.error(`❌ LayerOrchestrator: Failed to update opacity for ${layerId}:`, error)
    }
  }

  /**
   * Re-render all enabled layers (used after style changes)
   */
  private async reRenderAllLayers(): Promise<void> {
    if (!this.map) return

    console.log('🎭 LayerOrchestrator: Re-rendering all layers after style change')

    // Get all layer IDs that were rendered
    const layerIds = Array.from(this.layerStates.keys())

    // Clear state but keep track of what was enabled
    const previousStates = new Map(this.layerStates)
    this.layerStates.clear()

    // Re-add layers that were rendered (this will be triggered by the view component)
    // For now, just clear the states - the view will call processLayerChanges again
    console.log('🎭 LayerOrchestrator: Cleared layer states, waiting for view to re-sync')
  }

  /**
   * Update right panels based on enabled layers
   */
  private updateRightPanels(enabledLayers: LayerDefinition[]): void {
    const panelsToShow = enabledLayers
      .filter(layer => layer.rightPanelComponent && layer.enabled)
      .map(layer => layer.id)

    console.log('🎭 LayerOrchestrator: Updating right panels:', panelsToShow)

    // Save to memory
    this.memory.saveActivePanels(panelsToShow)

    // Callback to notify view components
    this.callbacks.onPanelUpdate?.(panelsToShow)
  }

  /**
   * Get current layer state
   */
  getLayerState(layerId: string): LayerState | undefined {
    return this.layerStates.get(layerId)
  }

  /**
   * Get all layer states
   */
  getAllLayerStates(): Map<string, LayerState> {
    return new Map(this.layerStates)
  }

  /**
   * Check if a layer is currently rendered
   */
  isLayerRendered(layerId: string): boolean {
    const state = this.layerStates.get(layerId)
    return state?.rendered === true && state?.hasError === false
  }

  /**
   * Get layers that have errors
   */
  getLayersWithErrors(): LayerState[] {
    return Array.from(this.layerStates.values()).filter(state => state.hasError)
  }

  /**
   * Cleanup - remove all layers and reset state
   */
  cleanup(): void {
    console.log('🎭 LayerOrchestrator: Cleaning up')

    if (this.map) {
      for (const layerId of this.layerStates.keys()) {
        try {
          removeLayerFromMap(this.map, layerId)
        } catch (error) {
          console.error(`Failed to remove layer ${layerId} during cleanup:`, error)
        }
      }
    }

    this.layerStates.clear()
    this.map = null
  }

  // ========== Memory Management Methods ==========

  /**
   * Get the memory instance
   */
  getMemory(): OrchestratorMemory {
    return this.memory
  }

  /**
   * Get saved layer states from memory
   */
  getSavedLayerStates() {
    return this.memory.getLayerStates()
  }

  /**
   * Get last active view from memory
   */
  getLastActiveView() {
    return this.memory.getLastActiveView()
  }

  /**
   * Save current viewport to memory
   */
  saveViewport(viewId: string, viewport: {
    zoom?: number
    center?: [number, number]
    pitch?: number
    bearing?: number
  }): void {
    this.memory.saveViewPreferences(viewId, viewport)
  }

  /**
   * Get saved viewport from memory
   */
  getSavedViewport(viewId: string) {
    return this.memory.getViewPreferences(viewId)
  }

  /**
   * Update memory preferences
   */
  updateMemoryPreferences(preferences: {
    autoRestoreSession?: boolean
    rememberLayerStates?: boolean
    rememberViewport?: boolean
  }): void {
    this.memory.updatePreferences(preferences)
  }

  /**
   * Get memory preferences
   */
  getMemoryPreferences() {
    return this.memory.getPreferences()
  }

  /**
   * Clear all memory
   */
  clearMemory(): void {
    this.memory.clear()
  }

  /**
   * Export memory state as JSON
   */
  exportMemory(): string {
    return this.memory.export()
  }

  /**
   * Import memory state from JSON
   */
  importMemory(json: string): void {
    this.memory.import(json)
  }

  /**
   * Force save current state to memory
   */
  forceSaveMemory(): void {
    this.memory.saveLayerStates(this.layerStates)
    this.memory.forceSave()
  }
}

// Singleton instance for global access
let orchestratorInstance: LayerOrchestrator | null = null

/**
 * Get or create the global LayerOrchestrator instance
 */
export function getLayerOrchestrator(callbacks?: OrchestratorCallbacks): LayerOrchestrator {
  if (!orchestratorInstance) {
    orchestratorInstance = new LayerOrchestrator(callbacks)
    console.log('🎭 Created global LayerOrchestrator instance')
  }
  return orchestratorInstance
}

/**
 * Reset the global orchestrator instance (useful for testing or view changes)
 */
export function resetLayerOrchestrator(): void {
  if (orchestratorInstance) {
    orchestratorInstance.cleanup()
    orchestratorInstance = null
    console.log('🎭 Reset global LayerOrchestrator instance')
  }
}
