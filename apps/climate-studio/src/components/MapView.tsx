import { useState, useCallback } from "react"
import { DeckGLMap } from "./DeckGLMap"
import { EarthEngineStatus } from "./EarthEngineStatus"
import { useClimateLayerData } from "../hooks/useClimateLayerData"
import { LatLngBoundsLiteral } from "../types/geography"

interface ViewportState {
  center: { lat: number; lng: number }
  zoom: number
}

interface MapViewProps {
  viewport: ViewportState
  onViewportChange: (viewport: ViewportState) => void
  onMapBoundsChange?: (bounds: LatLngBoundsLiteral) => void
}

export function MapView({ viewport, onViewportChange, onMapBoundsChange }: MapViewProps) {
  const [mapBounds, setMapBounds] = useState<LatLngBoundsLiteral | null>(null)
  const { layers: layerStates } = useClimateLayerData(mapBounds)

  const handleBoundsChange = useCallback((bounds: LatLngBoundsLiteral) => {
    setMapBounds(bounds)
    onMapBoundsChange?.(bounds)
  }, [onMapBoundsChange])

  const handleViewportChange = useCallback((nextViewport: ViewportState) => {
    onViewportChange(nextViewport)
    setMapBounds(prev => prev ? { ...prev, zoom: nextViewport.zoom } : null)
  }, [onViewportChange])

  return (
    <div className="relative h-full w-full">
      <EarthEngineStatus />
      <DeckGLMap
        center={viewport.center}
        zoom={viewport.zoom}
        onViewportChange={handleViewportChange}
        onMapBoundsChange={handleBoundsChange}
        layerStates={layerStates}
      />
      <div className="absolute bottom-20 left-4 widget-container px-4 py-2 text-xs">
        <div className="font-semibold">Viewport</div>
        <div className="mt-1 space-y-1 text-muted-foreground">
          <div>Lat/Lng: {viewport.center.lat.toFixed(3)}, {viewport.center.lng.toFixed(3)}</div>
          <div>Zoom: {viewport.zoom.toFixed(1)}</div>
        </div>
      </div>
    </div>
  )
}


