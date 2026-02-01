/**
 * Orchestrator Memory Service
 *
 * Provides persistent storage for orchestrator state across sessions.
 * Uses localStorage to save and restore layer states, user preferences,
 * and orchestrator configuration.
 */

import { LayerState } from '../orchestrators/LayerOrchestrator'

export interface OrchestratorMemoryState {
  // Layer states
  layerStates: Array<{
    id: string
    enabled: boolean
    opacity?: number
    lastViewed?: number
  }>

  // View preferences
  lastActiveView?: string
  viewPreferences: Record<string, {
    zoom?: number
    center?: [number, number]
    pitch?: number
    bearing?: number
  }>

  // Panel states
  activePanels: string[]
  panelPreferences: Record<string, {
    collapsed?: boolean
    width?: number
  }>

  // User preferences
  preferences: {
    autoRestoreSession?: boolean
    rememberLayerStates?: boolean
    rememberViewport?: boolean
  }

  // Metadata
  lastUpdated: number
  version: string
}

const STORAGE_KEY = 'climate-suite-orchestrator-memory'
const MEMORY_VERSION = '1.0.0'

export class OrchestratorMemory {
  private state: OrchestratorMemoryState
  private autoSaveEnabled = true
  private saveTimeout: NodeJS.Timeout | null = null

  constructor() {
    this.state = this.getDefaultState()
    this.loadFromStorage()
  }

  /**
   * Get default memory state
   */
  private getDefaultState(): OrchestratorMemoryState {
    return {
      layerStates: [],
      viewPreferences: {},
      activePanels: [],
      panelPreferences: {},
      preferences: {
        autoRestoreSession: true,
        rememberLayerStates: true,
        rememberViewport: true
      },
      lastUpdated: Date.now(),
      version: MEMORY_VERSION
    }
  }

  /**
   * Load state from localStorage
   */
  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as OrchestratorMemoryState

        // Version check - migrate if needed
        if (parsed.version !== MEMORY_VERSION) {
          console.log('🧠 OrchestratorMemory: Version mismatch, migrating...')
          this.state = this.migrateState(parsed)
        } else {
          this.state = parsed
        }

        console.log('🧠 OrchestratorMemory: Loaded state from storage', {
          layerCount: this.state.layerStates.length,
          lastUpdated: new Date(this.state.lastUpdated).toISOString()
        })
      }
    } catch (error) {
      console.error('🧠 OrchestratorMemory: Failed to load from storage:', error)
      this.state = this.getDefaultState()
    }
  }

  /**
   * Save state to localStorage
   */
  private saveToStorage(): void {
    try {
      this.state.lastUpdated = Date.now()
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state))
      console.log('🧠 OrchestratorMemory: Saved state to storage')
    } catch (error) {
      console.error('🧠 OrchestratorMemory: Failed to save to storage:', error)
    }
  }

  /**
   * Debounced save to avoid excessive writes
   */
  private debouncedSave(): void {
    if (!this.autoSaveEnabled) return

    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout)
    }

    this.saveTimeout = setTimeout(() => {
      this.saveToStorage()
    }, 500)
  }

  /**
   * Migrate state from old version to new version
   */
  private migrateState(oldState: OrchestratorMemoryState): OrchestratorMemoryState {
    // For now, just return default state
    // Add migration logic here as versions evolve
    console.log('🧠 OrchestratorMemory: Migration complete')
    return {
      ...this.getDefaultState(),
      ...oldState,
      version: MEMORY_VERSION
    }
  }

  // ========== Layer State Management ==========

  /**
   * Save layer states
   */
  saveLayerStates(states: Map<string, LayerState>): void {
    this.state.layerStates = Array.from(states.entries()).map(([id, state]) => ({
      id,
      enabled: state.enabled,
      lastViewed: state.lastUpdated
    }))
    this.debouncedSave()
  }

  /**
   * Get saved layer states
   */
  getLayerStates(): Array<{ id: string; enabled: boolean; lastViewed?: number }> {
    return [...this.state.layerStates]
  }

  /**
   * Update single layer state
   */
  updateLayerState(layerId: string, enabled: boolean, opacity?: number): void {
    const existing = this.state.layerStates.find(l => l.id === layerId)
    if (existing) {
      existing.enabled = enabled
      if (opacity !== undefined) existing.opacity = opacity
      existing.lastViewed = Date.now()
    } else {
      this.state.layerStates.push({
        id: layerId,
        enabled,
        opacity,
        lastViewed: Date.now()
      })
    }
    this.debouncedSave()
  }

  /**
   * Remove layer state
   */
  removeLayerState(layerId: string): void {
    this.state.layerStates = this.state.layerStates.filter(l => l.id !== layerId)
    this.debouncedSave()
  }

  // ========== View Management ==========

  /**
   * Save current view
   */
  saveCurrentView(viewId: string): void {
    this.state.lastActiveView = viewId
    this.debouncedSave()
  }

  /**
   * Get last active view
   */
  getLastActiveView(): string | undefined {
    return this.state.lastActiveView
  }

  /**
   * Save view preferences (viewport, etc.)
   */
  saveViewPreferences(viewId: string, preferences: {
    zoom?: number
    center?: [number, number]
    pitch?: number
    bearing?: number
  }): void {
    this.state.viewPreferences[viewId] = {
      ...this.state.viewPreferences[viewId],
      ...preferences
    }
    this.debouncedSave()
  }

  /**
   * Get view preferences
   */
  getViewPreferences(viewId: string) {
    return this.state.viewPreferences[viewId]
  }

  // ========== Panel Management ==========

  /**
   * Save active panels
   */
  saveActivePanels(panels: string[]): void {
    this.state.activePanels = [...panels]
    this.debouncedSave()
  }

  /**
   * Get active panels
   */
  getActivePanels(): string[] {
    return [...this.state.activePanels]
  }

  /**
   * Save panel preferences
   */
  savePanelPreferences(panelId: string, preferences: {
    collapsed?: boolean
    width?: number
  }): void {
    this.state.panelPreferences[panelId] = {
      ...this.state.panelPreferences[panelId],
      ...preferences
    }
    this.debouncedSave()
  }

  /**
   * Get panel preferences
   */
  getPanelPreferences(panelId: string) {
    return this.state.panelPreferences[panelId]
  }

  // ========== User Preferences ==========

  /**
   * Update user preferences
   */
  updatePreferences(preferences: Partial<OrchestratorMemoryState['preferences']>): void {
    this.state.preferences = {
      ...this.state.preferences,
      ...preferences
    }
    this.debouncedSave()
  }

  /**
   * Get user preferences
   */
  getPreferences() {
    return { ...this.state.preferences }
  }

  // ========== Utility Methods ==========

  /**
   * Clear all memory
   */
  clear(): void {
    this.state = this.getDefaultState()
    localStorage.removeItem(STORAGE_KEY)
    console.log('🧠 OrchestratorMemory: Cleared all memory')
  }

  /**
   * Export state as JSON
   */
  export(): string {
    return JSON.stringify(this.state, null, 2)
  }

  /**
   * Import state from JSON
   */
  import(json: string): void {
    try {
      const imported = JSON.parse(json) as OrchestratorMemoryState
      this.state = this.migrateState(imported)
      this.saveToStorage()
      console.log('🧠 OrchestratorMemory: Imported state')
    } catch (error) {
      console.error('🧠 OrchestratorMemory: Failed to import state:', error)
      throw error
    }
  }

  /**
   * Get full state (for debugging)
   */
  getState(): OrchestratorMemoryState {
    return { ...this.state }
  }

  /**
   * Enable/disable auto-save
   */
  setAutoSave(enabled: boolean): void {
    this.autoSaveEnabled = enabled
    console.log(`🧠 OrchestratorMemory: Auto-save ${enabled ? 'enabled' : 'disabled'}`)
  }

  /**
   * Force immediate save
   */
  forceSave(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout)
      this.saveTimeout = null
    }
    this.saveToStorage()
  }
}

// Singleton instance
let memoryInstance: OrchestratorMemory | null = null

/**
 * Get or create the global OrchestratorMemory instance
 */
export function getOrchestratorMemory(): OrchestratorMemory {
  if (!memoryInstance) {
    memoryInstance = new OrchestratorMemory()
    console.log('🧠 Created global OrchestratorMemory instance')
  }
  return memoryInstance
}

/**
 * Reset the memory instance (useful for testing)
 */
export function resetOrchestratorMemory(): void {
  if (memoryInstance) {
    memoryInstance.clear()
    memoryInstance = null
    console.log('🧠 Reset global OrchestratorMemory instance')
  }
}
