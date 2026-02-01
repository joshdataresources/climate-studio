"use client"

import React, { useState, useMemo } from 'react'
import { useLayer } from '../../contexts/LayerContext'
import { useTheme } from '../../contexts/ThemeContext'
import { Checkbox } from '../ui/checkbox'
import { Layers } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select"

interface LayerLibraryPanelProps {
  currentViewId: string // 'climate', 'waterAccess', 'factories'
}

export function LayerLibraryPanel({ currentViewId }: LayerLibraryPanelProps) {
  const { theme } = useTheme()
  const { availableLayers, setLayerEnabled, getLayersForView } = useLayer()

  // Get layers available for this view
  const viewLayers = useMemo(() => {
    return getLayersForView(currentViewId)
  }, [currentViewId, getLayersForView])

  // Get enabled layers
  const enabledLayers = viewLayers.filter(layer => layer.enabled)

  // Get disabled layers for the dropdown
  const disabledLayers = viewLayers.filter(layer => !layer.enabled)

  const handleLayerToggle = (layerId: string, checked: boolean) => {
    setLayerEnabled(layerId, checked)
  }

  const handleAddLayer = (layerId: string) => {
    if (layerId && layerId !== 'none') {
      setLayerEnabled(layerId, true)
    }
  }

  return (
    <div className="widget-container">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-blue-500" />
          <h3 className="text-sm font-semibold">Climate Layers</h3>
        </div>
        {/* Sources toggle - could be implemented later */}
        <div className="text-xs text-muted-foreground">Sources</div>
      </div>

      {/* Enabled Layers - Each as a separate card */}
      <div className="space-y-2 mb-3">
        {enabledLayers.map(layer => {
          const IconComponent = layer.icon

          return (
            <div
              key={layer.id}
              className="flex items-center gap-3 p-3 rounded-lg border-2 border-blue-500 bg-blue-50 dark:bg-blue-950/20 transition-all hover:border-blue-600"
            >
              <Checkbox
                id={`layer-${layer.id}`}
                checked={layer.enabled}
                onCheckedChange={(checked) => handleLayerToggle(layer.id, checked as boolean)}
                className="data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500"
              />
              <div className="flex-1">
                <label
                  htmlFor={`layer-${layer.id}`}
                  className="text-sm font-medium cursor-pointer block"
                >
                  {layer.name}
                </label>
                {layer.description && (
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {layer.description}
                  </div>
                )}
                <div className="text-xs text-muted-foreground mt-1">
                  Source: {layer.sourceAttribution}
                </div>
              </div>
              <IconComponent className="h-5 w-5 text-blue-500 flex-shrink-0" />
            </div>
          )
        })}
      </div>

      {/* "Add more layers" dropdown */}
      <Select onValueChange={handleAddLayer}>
        <SelectTrigger className="w-full">
          <div className="flex items-center gap-2">
            <span className="text-lg">+</span>
            <SelectValue placeholder="Add more layers" />
          </div>
        </SelectTrigger>
        <SelectContent>
          {disabledLayers.length > 0 ? (
            disabledLayers.map(layer => {
              const IconComponent = layer.icon

              return (
                <SelectItem
                  key={layer.id}
                  value={layer.id}
                  className="cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <IconComponent className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="font-medium">{layer.name}</div>
                      {layer.description && (
                        <div className="text-xs text-muted-foreground">
                          {layer.description}
                        </div>
                      )}
                    </div>
                  </div>
                </SelectItem>
              )
            })
          ) : (
            <SelectItem value="none" disabled>
              No more layers available
            </SelectItem>
          )}
        </SelectContent>
      </Select>
    </div>
  )
}
