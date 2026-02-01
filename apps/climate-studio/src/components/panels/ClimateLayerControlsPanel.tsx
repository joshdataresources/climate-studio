"use client"

import React from 'react'
import { useLayer } from '../../contexts/LayerContext'
import { Slider } from '../ui/slider'
import { TrendingUp } from 'lucide-react'

interface ClimateLayerControlsPanelProps {
  layerName: string
  layerId: string
}

/**
 * Generic right panel for climate layers
 * Matches styling from WaterAccessView exactly
 */
export function ClimateLayerControlsPanel({ layerName, layerId }: ClimateLayerControlsPanelProps) {
  const { setLayerOpacity, availableLayers } = useLayer()

  // Get current layer opacity
  const layer = availableLayers.find(l => l.id === layerId)
  const opacity = layer ? Math.round(layer.opacity * 100) : 70

  const handleOpacityChange = (values: number[]) => {
    setLayerOpacity(layerId, values[0] / 100)
  }

  return (
    <div className="widget-container">
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16
      }}>
        <h3 className="text-sm font-medium text-foreground">
          {layerName}
        </h3>
        <span style={{
          fontSize: 18,
          fontWeight: 700,
          color: '#3b82f6'
        }}>
          {opacity}%
        </span>
      </div>

      {/* Slider */}
      <div className="space-y-2">
        <Slider
          value={[opacity]}
          min={0}
          max={100}
          step={1}
          onValueChange={handleOpacityChange}
        />
      </div>

      {/* Gradient Legend */}
      <div className="space-y-1 mt-3">
        <div className="h-3 w-full rounded-full" style={{
          background: 'linear-gradient(to right, #22c55e 0%, #3b82f6 33%, #f97316 66%, #ef4444 100%)'
        }} />
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>0%</span>
          <span>25%</span>
          <span>50%</span>
          <span>75%</span>
          <span>100%</span>
        </div>
      </div>
    </div>
  )
}
