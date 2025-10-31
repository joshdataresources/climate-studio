"use client"

import { useEffect, useRef, useMemo } from "react"
import Globe from "react-globe.gl"
import type { LayerStateMap } from "../hooks/useClimateLayerData"
import { LatLngBoundsLiteral } from "../types/geography"
import { useClimate } from "@climate-studio/core"

interface ReactGlobeProps {
  className?: string
  center: { lat: number; lng: number }
  zoom: number
  onViewportChange?: (viewport: { center: { lat: number; lng: number }; zoom: number }) => void
  onMapBoundsChange?: (bounds: LatLngBoundsLiteral) => void
  layerStates: LayerStateMap
}

export function ReactGlobe({
  className,
  center,
  zoom,
  onViewportChange,
  onMapBoundsChange,
  layerStates,
}: ReactGlobeProps) {
  const globeRef = useRef<any>(null)
  const { controls, isLayerActive } = useClimate()

  // Get active layers
  const temperatureProjectionActive = isLayerActive("temperature_projection")
  const tempProjectionData = layerStates.temperature_projection?.data

  // Convert GeoJSON to polygons for globe.gl
  const polygons = useMemo(() => {
    if (!temperatureProjectionActive || !tempProjectionData) return []

    if ('features' in tempProjectionData) {
      return tempProjectionData.features.map((feature: any) => ({
        ...feature,
        properties: {
          ...feature.properties,
          // Add color based on temperature anomaly
          color: getTempColor(feature.properties?.tempAnomaly || 0)
        }
      }))
    }
    return []
  }, [temperatureProjectionActive, tempProjectionData])

  // Helper function to get temperature color
  const getTempColor = (anomaly: number) => {
    const value = Math.max(0, Math.min(8, anomaly || 0))

    if (value < 1) return 'rgba(59, 130, 246, 0.6)'
    if (value < 2) return 'rgba(96, 165, 250, 0.6)'
    if (value < 3) return 'rgba(147, 197, 253, 0.6)'
    if (value < 4) return 'rgba(254, 240, 138, 0.6)'
    if (value < 5) return 'rgba(251, 191, 36, 0.6)'
    if (value < 6) return 'rgba(251, 146, 60, 0.6)'
    if (value < 8) return 'rgba(239, 68, 68, 0.6)'
    return 'rgba(127, 29, 29, 0.6)'
  }

  // Update globe camera when center/zoom changes
  useEffect(() => {
    if (globeRef.current) {
      const altitude = 2.5 / zoom

      globeRef.current.pointOfView({
        lat: center.lat,
        lng: center.lng,
        altitude: altitude
      }, 1000) // 1 second animation
    }
  }, [center.lat, center.lng, zoom])

  return (
    <div className={`h-full w-full ${className ?? ""}`}>
      <Globe
        ref={globeRef}
        globeImageUrl="https://unpkg.com/three-globe@2.31.1/example/img/earth-blue-marble.jpg"
        bumpImageUrl="https://unpkg.com/three-globe@2.31.1/example/img/earth-topology.png"
        backgroundImageUrl="https://unpkg.com/three-globe@2.31.1/example/img/night-sky.png"

        // Temperature polygons
        polygonsData={polygons}
        polygonAltitude={0.01}
        polygonCapColor={(d: any) => d.properties?.color || 'rgba(0,0,0,0)'}
        polygonSideColor={() => 'rgba(0, 0, 0, 0)'}
        polygonsTransitionDuration={300}

        // Lighting
        atmosphereColor="#1a5490"
        atmosphereAltitude={0.15}

        // Controls
        enablePointerInteraction={true}

        // Track camera changes
        onZoom={(coords: any) => {
          if (coords && onViewportChange) {
            onViewportChange({
              center: { lat: coords.lat || 0, lng: coords.lng || 0 },
              zoom: 2.5 / (coords.altitude || 2)
            })
          }
        }}
      />
    </div>
  )
}
