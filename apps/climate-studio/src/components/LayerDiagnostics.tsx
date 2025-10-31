"use client"

import { useClimate } from "@climate-studio/core"
import { useClimateLayerData } from "../hooks/useClimateLayerData"
import { useMemo } from "react"

export function LayerDiagnostics({ bounds }: { bounds: any }) {
  const { activeLayerIds } = useClimate()
  const { layers } = useClimateLayerData(bounds)

  const tempData = layers.temperature_projection

  // Calculate hexagon bounds from features
  const hexagonBounds = useMemo(() => {
    if (!tempData?.data?.features?.length) return null

    let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180

    tempData.data.features.forEach((feature: any) => {
      if (feature.geometry?.type === 'Polygon') {
        feature.geometry.coordinates[0].forEach((coord: number[]) => {
          const [lng, lat] = coord
          minLat = Math.min(minLat, lat)
          maxLat = Math.max(maxLat, lat)
          minLng = Math.min(minLng, lng)
          maxLng = Math.max(maxLng, lng)
        })
      }
    })

    return { north: maxLat, south: minLat, east: maxLng, west: minLng }
  }, [tempData?.data?.features])

  if (!activeLayerIds.includes('temperature_projection')) {
    return null
  }

  return (
    <div className="w-80 rounded-lg border border-border/60 bg-card/95 backdrop-blur-lg p-4 text-xs space-y-3">
      <h3 className="font-semibold text-sm">🔍 Temperature Layer Diagnostics</h3>

      <div className="space-y-2">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Status:</span>
          <span className="font-medium text-foreground">{tempData?.status || 'N/A'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Has Data:</span>
          <span className="font-medium text-foreground">{tempData?.data ? 'YES' : 'NO'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Features:</span>
          <span className="font-medium text-foreground">{tempData?.data?.features?.length || 0}</span>
        </div>
        {tempData?.error && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Error:</span>
            <span className="font-medium text-red-500">{tempData.error}</span>
          </div>
        )}
      </div>

      {bounds && (
        <div className="pt-3 border-t border-border/60 space-y-2">
          <div className="font-semibold text-foreground">Map Viewport Bounds:</div>
          <div className="grid grid-cols-2 gap-2 text-[10px]">
            <div className="text-muted-foreground">North: <span className="font-mono text-foreground">{bounds.north?.toFixed(3)}</span></div>
            <div className="text-muted-foreground">South: <span className="font-mono text-foreground">{bounds.south?.toFixed(3)}</span></div>
            <div className="text-muted-foreground">East: <span className="font-mono text-foreground">{bounds.east?.toFixed(3)}</span></div>
            <div className="text-muted-foreground">West: <span className="font-mono text-foreground">{bounds.west?.toFixed(3)}</span></div>
          </div>
          <div className="text-muted-foreground">Zoom: <span className="font-mono text-foreground">{bounds.zoom?.toFixed(1)}</span></div>
        </div>
      )}

      {hexagonBounds && (
        <div className="pt-3 border-t border-border/60 space-y-2">
          <div className="font-semibold text-foreground">Hexagon Coverage Bounds:</div>
          <div className="grid grid-cols-2 gap-2 text-[10px]">
            <div className="text-muted-foreground">North: <span className="font-mono text-green-600">{hexagonBounds.north?.toFixed(3)}</span></div>
            <div className="text-muted-foreground">South: <span className="font-mono text-green-600">{hexagonBounds.south?.toFixed(3)}</span></div>
            <div className="text-muted-foreground">East: <span className="font-mono text-green-600">{hexagonBounds.east?.toFixed(3)}</span></div>
            <div className="text-muted-foreground">West: <span className="font-mono text-green-600">{hexagonBounds.west?.toFixed(3)}</span></div>
          </div>
        </div>
      )}

      {bounds && hexagonBounds && (
        <div className="pt-3 border-t border-border/60 space-y-2">
          <div className="font-semibold text-foreground">Coverage Analysis:</div>
          <div className="space-y-1 text-[10px]">
            <div className={`${Math.abs(hexagonBounds.north - bounds.north) < 0.1 ? 'text-green-600' : 'text-red-500'}`}>
              North gap: {Math.abs(hexagonBounds.north - bounds.north).toFixed(3)}°
            </div>
            <div className={`${Math.abs(hexagonBounds.south - bounds.south) < 0.1 ? 'text-green-600' : 'text-red-500'}`}>
              South gap: {Math.abs(hexagonBounds.south - bounds.south).toFixed(3)}°
            </div>
            <div className={`${Math.abs(hexagonBounds.east - bounds.east) < 0.1 ? 'text-green-600' : 'text-red-500'}`}>
              East gap: {Math.abs(hexagonBounds.east - bounds.east).toFixed(3)}°
            </div>
            <div className={`${Math.abs(hexagonBounds.west - bounds.west) < 0.1 ? 'text-green-600' : 'text-red-500'}`}>
              West gap: {Math.abs(hexagonBounds.west - bounds.west).toFixed(3)}°
            </div>
          </div>
        </div>
      )}

      {tempData?.data?.metadata && (
        <div className="pt-3 border-t border-border/60 space-y-2">
          <div className="font-semibold text-foreground">Metadata:</div>
          <div className="grid grid-cols-2 gap-2 text-[10px]">
            <div className="text-muted-foreground">Source:</div>
            <div className="font-medium text-green-600 text-right">{tempData.data.metadata.source}</div>
            <div className="text-muted-foreground">Is Real:</div>
            <div className="font-medium text-green-600 text-right">{String(tempData.data.metadata.isRealData)}</div>
            <div className="text-muted-foreground">Type:</div>
            <div className="font-medium text-green-600 text-right">{tempData.data.metadata.dataType}</div>
          </div>
        </div>
      )}

      <div className="pt-3 border-t border-border/60 text-[10px] text-muted-foreground">
        Check browser console for detailed fetch logs
      </div>
    </div>
  )
}
