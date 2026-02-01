"use client"

import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react'
import { layerDefinitions, type LayerDefinition } from '../config/layerDefinitions'

// Re-export LayerDefinition type for use in other files
export type { LayerDefinition }

interface LayerContextType {
  // All available layers in the system
  availableLayers: LayerDefinition[]

  // Add a new layer definition
  registerLayer: (layer: LayerDefinition) => void

  // Remove a layer definition
  unregisterLayer: (layerId: string) => void

  // Toggle layer visibility
  toggleLayerVisibility: (layerId: string) => void

  // Enable/disable layer
  setLayerEnabled: (layerId: string, enabled: boolean) => void

  // Set layer opacity
  setLayerOpacity: (layerId: string, opacity: number) => void

  // Get layers for a specific view
  getLayersForView: (viewId: string) => LayerDefinition[]

  // Get enabled layers for a specific view
  getEnabledLayersForView: (viewId: string) => LayerDefinition[]
}

const LayerContext = createContext<LayerContextType | undefined>(undefined)

const STORAGE_KEY = 'climate-studio-layer-state'

// Load layer state from localStorage
function loadLayerState(): Record<string, { enabled: boolean; opacity: number }> {
  if (typeof window === 'undefined') return {}

  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return {}
    return JSON.parse(stored)
  } catch (error) {
    console.error('Failed to load layer state from localStorage:', error)
    return {}
  }
}

// Save layer state to localStorage
function saveLayerState(layers: LayerDefinition[]) {
  if (typeof window === 'undefined') return

  try {
    const state = layers.reduce((acc, layer) => {
      acc[layer.id] = {
        enabled: layer.enabled,
        opacity: layer.opacity
      }
      return acc
    }, {} as Record<string, { enabled: boolean; opacity: number }>)

    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch (error) {
    console.error('Failed to save layer state to localStorage:', error)
  }
}

export function LayerProvider({ children }: { children: ReactNode }) {
  // Initialize with layer definitions from config, merged with localStorage state
  const [availableLayers, setAvailableLayers] = useState<LayerDefinition[]>(() => {
    const savedState = loadLayerState()

    return layerDefinitions.map(layer => {
      const saved = savedState[layer.id]
      if (saved) {
        return {
          ...layer,
          enabled: saved.enabled,
          opacity: saved.opacity
        }
      }
      return layer
    })
  })

  const registerLayer = useCallback((layer: LayerDefinition) => {
    setAvailableLayers(prev => {
      // Check if layer already exists
      const exists = prev.find(l => l.id === layer.id)
      if (exists) {
        // Update existing layer
        return prev.map(l => l.id === layer.id ? { ...l, ...layer } : l)
      }
      // Add new layer
      return [...prev, layer]
    })
  }, [])

  const unregisterLayer = useCallback((layerId: string) => {
    setAvailableLayers(prev => prev.filter(l => l.id !== layerId))
  }, [])

  const toggleLayerVisibility = useCallback((layerId: string) => {
    setAvailableLayers(prev =>
      prev.map(layer =>
        layer.id === layerId ? { ...layer, visible: !layer.visible } : layer
      )
    )
  }, [])

  const setLayerEnabled = useCallback((layerId: string, enabled: boolean) => {
    setAvailableLayers(prev =>
      prev.map(layer =>
        layer.id === layerId ? { ...layer, enabled } : layer
      )
    )
  }, [])

  const setLayerOpacity = useCallback((layerId: string, opacity: number) => {
    setAvailableLayers(prev =>
      prev.map(layer =>
        layer.id === layerId ? { ...layer, opacity } : layer
      )
    )
  }, [])

  const getLayersForView = useCallback((viewId: string) => {
    return availableLayers.filter(layer => {
      // If availableInViews is empty, layer is available in all views
      if (!layer.availableInViews || layer.availableInViews.length === 0) {
        return true
      }
      // Otherwise, check if this view is in the list
      return layer.availableInViews.includes(viewId)
    })
  }, [availableLayers])

  const getEnabledLayersForView = useCallback((viewId: string) => {
    return getLayersForView(viewId).filter(layer => layer.enabled)
  }, [getLayersForView])

  // Persist layer state to localStorage whenever it changes
  useEffect(() => {
    saveLayerState(availableLayers)
  }, [availableLayers])

  return (
    <LayerContext.Provider
      value={{
        availableLayers,
        registerLayer,
        unregisterLayer,
        toggleLayerVisibility,
        setLayerEnabled,
        setLayerOpacity,
        getLayersForView,
        getEnabledLayersForView
      }}
    >
      {children}
    </LayerContext.Provider>
  )
}

export function useLayer() {
  const context = useContext(LayerContext)
  if (!context) {
    throw new Error('useLayer must be used within a LayerProvider')
  }
  return context
}
