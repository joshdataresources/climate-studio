"use client"

import React, { useState } from 'react'
import { climateLayers, ClimateLayerDefinition } from '@climate-studio/core/config'
import { useClimate } from '@climate-studio/core'
import { GripVertical, Settings, X, ChevronDown } from 'lucide-react'
import { Button } from './ui/button'
import { Switch } from './ui/switch'
import { Checkbox } from './ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'

interface LayerPaletteProps {
  className?: string
}

export function LayerPalette({ className = '' }: LayerPaletteProps) {
  const { activeLayerIds, toggleLayer } = useClimate()

  // State for which layers are visible in the palette (not the same as enabled/active)
  const [visibleLayers, setVisibleLayers] = useState<Set<string>>(() =>
    new Set(climateLayers.map(l => l.id))
  )

  // State for showing/hiding source attribution
  const [showSources, setShowSources] = useState(true)

  // State for select all checkbox
  const [selectAll, setSelectAll] = useState(false)

  // Get the list of layers that should be shown in the palette
  const displayedLayers = climateLayers.filter(layer =>
    visibleLayers.has(layer.id)
  )

  // Toggle a layer's visibility in the palette (Manage Layers dropdown)
  const toggleLayerVisibility = (layerId: string) => {
    setVisibleLayers(prev => {
      const next = new Set(prev)
      if (next.has(layerId)) {
        next.delete(layerId)
      } else {
        next.add(layerId)
      }
      return next
    })
  }

  // Handle "Select All" checkbox
  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked)
    if (checked) {
      // Enable all displayed layers
      displayedLayers.forEach(layer => {
        if (!activeLayerIds.includes(layer.id)) {
          toggleLayer(layer.id)
        }
      })
    } else {
      // Disable all displayed layers
      displayedLayers.forEach(layer => {
        if (activeLayerIds.includes(layer.id)) {
          toggleLayer(layer.id)
        }
      })
    }
  }

  // Calculate max height based on number of layers
  const maxHeight = displayedLayers.length > 6 ? '400px' : 'auto'

  return (
    <div
      className={`widget-container widget-container-no-padding ${className}`}
      style={{
        maxHeight,
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      {/* Header with title and Manage Layers dropdown */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
        padding: '16px 16px 0 16px'
      }}>
        <h3 className="text-sm font-semibold text-foreground">Layers</h3>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
            >
              Manage Layers
              <ChevronDown className="ml-1 h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {climateLayers.map(layer => (
              <DropdownMenuCheckboxItem
                key={layer.id}
                checked={visibleLayers.has(layer.id)}
                onCheckedChange={() => toggleLayerVisibility(layer.id)}
              >
                {layer.title}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Scrollable layer list */}
      <div
        style={{
          flex: 1,
          overflowY: displayedLayers.length > 6 ? 'auto' : 'visible',
          padding: '0 16px 12px 16px',
          borderBottom: '1px solid',
          borderColor: 'hsl(var(--border))'
        }}
        className="space-y-2"
      >
        {displayedLayers.map((layer) => (
          <LayerItem
            key={layer.id}
            layer={layer}
            isActive={activeLayerIds.includes(layer.id)}
            showSource={showSources}
            onToggle={() => toggleLayer(layer.id)}
          />
        ))}
      </div>

      {/* Footer with Select All and Sources toggle */}
      <div
        style={{
          padding: '12px 16px 16px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <div className="flex items-center gap-2">
          <Checkbox
            id="select-all"
            checked={selectAll}
            onCheckedChange={handleSelectAll}
          />
          <label
            htmlFor="select-all"
            className="text-xs font-medium cursor-pointer"
          >
            Select All
          </label>
        </div>

        <div className="flex items-center gap-2">
          <label
            htmlFor="show-sources"
            className="text-xs text-muted-foreground"
          >
            Sources
          </label>
          <Switch
            id="show-sources"
            checked={showSources}
            onCheckedChange={setShowSources}
          />
        </div>
      </div>
    </div>
  )
}

interface LayerItemProps {
  layer: ClimateLayerDefinition
  isActive: boolean
  showSource: boolean
  onToggle: () => void
}

function LayerItem({ layer, isActive, showSource, onToggle }: LayerItemProps) {
  return (
    <div
      className="rounded-md border transition-colors"
      style={{
        backgroundColor: isActive
          ? 'hsl(var(--accent))'
          : 'hsl(var(--background))',
        borderColor: isActive
          ? 'hsl(var(--primary))'
          : 'hsl(var(--border))',
        padding: '8px 12px'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* Drag handle */}
        <button
          className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
          style={{ cursor: 'grab' }}
        >
          <GripVertical className="h-4 w-4" />
        </button>

        {/* Layer info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="text-sm font-medium text-foreground truncate">
            {layer.title}
          </div>
          {showSource && (
            <div className="text-xs text-muted-foreground truncate">
              Source: {layer.source.name}
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 4 }}>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={(e) => {
              e.stopPropagation()
              // TODO: Open settings panel
            }}
          >
            <Settings className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={(e) => {
              e.stopPropagation()
              onToggle()
            }}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  )
}
