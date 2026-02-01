/**
 * React hook for accessing orchestrator memory
 *
 * Provides easy access to persistent state management
 * for orchestrator configurations and user preferences.
 */

import { useState, useEffect, useCallback } from 'react'
import { getOrchestratorMemory } from '../services/OrchestratorMemory'

export function useOrchestratorMemory() {
  const memory = getOrchestratorMemory()
  const [preferences, setPreferences] = useState(memory.getPreferences())
  const [lastActiveView, setLastActiveView] = useState(memory.getLastActiveView())

  // Refresh preferences from memory
  const refreshPreferences = useCallback(() => {
    setPreferences(memory.getPreferences())
    setLastActiveView(memory.getLastActiveView())
  }, [memory])

  // Update preferences
  const updatePreferences = useCallback((prefs: {
    autoRestoreSession?: boolean
    rememberLayerStates?: boolean
    rememberViewport?: boolean
  }) => {
    memory.updatePreferences(prefs)
    refreshPreferences()
  }, [memory, refreshPreferences])

  // Get saved layer states
  const getSavedLayers = useCallback(() => {
    return memory.getLayerStates()
  }, [memory])

  // Get saved viewport
  const getSavedViewport = useCallback((viewId: string) => {
    return memory.getViewPreferences(viewId)
  }, [memory])

  // Save viewport
  const saveViewport = useCallback((viewId: string, viewport: {
    zoom?: number
    center?: [number, number]
    pitch?: number
    bearing?: number
  }) => {
    memory.saveViewPreferences(viewId, viewport)
  }, [memory])

  // Clear all memory
  const clearMemory = useCallback(() => {
    memory.clear()
    refreshPreferences()
  }, [memory, refreshPreferences])

  // Export memory
  const exportMemory = useCallback(() => {
    return memory.export()
  }, [memory])

  // Import memory
  const importMemory = useCallback((json: string) => {
    memory.import(json)
    refreshPreferences()
  }, [memory, refreshPreferences])

  // Get full state (for debugging)
  const getState = useCallback(() => {
    return memory.getState()
  }, [memory])

  return {
    // State
    preferences,
    lastActiveView,

    // Actions
    updatePreferences,
    getSavedLayers,
    getSavedViewport,
    saveViewport,
    clearMemory,
    exportMemory,
    importMemory,
    getState,
    refreshPreferences
  }
}
