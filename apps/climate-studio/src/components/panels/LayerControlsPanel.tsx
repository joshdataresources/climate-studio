"use client"

import React from 'react'
import { useLayer } from '../../contexts/LayerContext'
import { FactoryLayersPanel } from './FactoryLayersPanel'

interface LayerControlsPanelProps {
  viewId: string
  // Props that are passed down to the specific panel component
  [key: string]: any
}

/**
 * Generic wrapper component that renders the appropriate right panel
 * based on which layers are enabled and have rightPanelComponent defined.
 *
 * This component:
 * - Gets enabled layers from LayerContext for the current view
 * - Finds layers with `rightPanelComponent` defined
 * - Renders the appropriate panel component dynamically
 *
 * How it works:
 * 1. Queries LayerContext for enabled layers in the current view
 * 2. Filters layers that have a `rightPanelComponent` property
 * 3. Renders the first matching panel component (if any)
 * 4. Passes all props through to the panel component
 *
 * For now, only the Factories layer has a dedicated right panel (FactoryLayersPanel).
 * Other layers can be extended in the future by:
 * 1. Creating their panel component
 * 2. Adding `rightPanelComponent` to their layer definition in layerDefinitions.ts
 *
 * Example usage in a view:
 * ```tsx
 * <LayerControlsPanel
 *   viewId="factories"
 *   // All other props get passed to the specific panel
 *   {...filterProps}
 * />
 * ```
 */
export function LayerControlsPanel({ viewId, ...props }: LayerControlsPanelProps) {
  const { getEnabledLayersForView } = useLayer()

  // Get all enabled layers for this view
  const enabledLayers = getEnabledLayersForView(viewId)

  // Find layers that have a rightPanelComponent defined
  const layersWithPanels = enabledLayers.filter(layer => layer.rightPanelComponent)

  // For now, we only render the first panel we find
  // In the future, this could be extended to support multiple panels or stacked panels
  const layerWithPanel = layersWithPanels[0]

  if (!layerWithPanel || !layerWithPanel.rightPanelComponent) {
    // No panel to show - return null
    return null
  }

  // Special handling for factories layer
  // This hardcoded check is temporary until we have layer definitions
  // that can reference their panel components directly
  if (layerWithPanel.id === 'factories') {
    return <FactoryLayersPanel {...props} />
  }

  // Generic rendering for climate and other layers
  const PanelComponent = layerWithPanel.rightPanelComponent
  return <PanelComponent layerName={layerWithPanel.name} layerId={layerWithPanel.id} {...props} />
}
