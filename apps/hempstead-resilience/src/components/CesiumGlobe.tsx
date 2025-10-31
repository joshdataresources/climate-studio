"use client"

import { useEffect, useRef } from "react"
import {
  Viewer,
  Ion,
  Cartesian3,
  Color,
  CesiumTerrainProvider,
  IonResource,
  Math as CesiumMath,
  GeoJsonDataSource,
} from "cesium"
import type { LayerStateMap } from "../hooks/useClimateLayerData"
import { LatLngBoundsLiteral } from "../types/geography"
import { useClimate } from "@climate-studio/core"

interface CesiumGlobeProps {
  className?: string
  center: { lat: number; lng: number }
  zoom: number
  onViewportChange?: (viewport: { center: { lat: number; lng: number }; zoom: number }) => void
  onMapBoundsChange?: (bounds: LatLngBoundsLiteral) => void
  layerStates: LayerStateMap
}

const CESIUM_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJiNDU3OGE0Yi1lMzNjLTQyNDgtOWU4My04MTIyZDFiYWY1NTEiLCJpZCI6MzUxMjg5LCJpYXQiOjE3NjA2NDI3Njh9.B9CxqZy5lgK9DP8y2Onegcuv1kefP1ikgBEhyQrXM8E'

// Set Cesium Ion token
Ion.defaultAccessToken = CESIUM_TOKEN

export function CesiumGlobe({
  className,
  center,
  zoom,
  onViewportChange,
  onMapBoundsChange,
  layerStates,
}: CesiumGlobeProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<Viewer | null>(null)
  const tempDataSourceRef = useRef<GeoJsonDataSource | null>(null)
  const { controls, isLayerActive } = useClimate()

  // Get active layers
  const temperatureProjectionActive = isLayerActive("temperature_projection")
  const tempProjectionData = layerStates.temperature_projection?.data

  // Helper function to get temperature color
  const getTempColor = (value: number, isActualTemp: boolean = false) => {
    // Different color scales for anomaly vs actual temperature
    let normalizedValue: number
    let stops: Array<{ value: number; color: [number, number, number] }>

    if (isActualTemp) {
      // Actual temperature scale: -40°C to 40°C
      normalizedValue = Math.max(-40, Math.min(40, value))
      stops = [
        { value: -40, color: [30, 40, 100] },     // Deep blue (very cold)
        { value: -20, color: [59, 130, 246] },    // Blue
        { value: 0, color: [147, 197, 253] },     // Light blue
        { value: 10, color: [134, 239, 172] },    // Light green
        { value: 20, color: [254, 240, 138] },    // Yellow
        { value: 25, color: [251, 191, 36] },     // Orange
        { value: 30, color: [251, 146, 60] },     // Dark orange
        { value: 35, color: [239, 68, 68] },      // Red
        { value: 40, color: [127, 29, 29] }       // Dark red (very hot)
      ]
    } else {
      // Anomaly scale: 0°C to 8°C
      normalizedValue = Math.max(0, Math.min(8, value || 0))
      stops = [
        { value: 0, color: [59, 130, 246] },
        { value: 1, color: [96, 165, 250] },
        { value: 2, color: [147, 197, 253] },
        { value: 3, color: [254, 240, 138] },
        { value: 4, color: [251, 191, 36] },
        { value: 5, color: [251, 146, 60] },
        { value: 6, color: [239, 68, 68] },
        { value: 8, color: [127, 29, 29] }
      ]
    }

    let left = stops[0]
    let right = stops[stops.length - 1]
    for (let i = 0; i < stops.length - 1; i++) {
      if (normalizedValue >= stops[i].value && normalizedValue <= stops[i + 1].value) {
        left = stops[i]
        right = stops[i + 1]
        break
      }
    }

    const range = right.value - left.value || 1
    const t = Math.min(1, Math.max(0, (normalizedValue - left.value) / range))
    const r = left.color[0] + (right.color[0] - left.color[0]) * t
    const g = left.color[1] + (right.color[1] - left.color[1]) * t
    const b = left.color[2] + (right.color[2] - left.color[2]) * t
    return Color.fromBytes(Math.round(r), Math.round(g), Math.round(b), Math.round((controls.projectionOpacity || 0.6) * 255))
  }

  // Initialize Cesium viewer
  useEffect(() => {
    if (!containerRef.current || viewerRef.current) return

    const viewer = new Viewer(containerRef.current, {
      animation: false,
      timeline: false,
      homeButton: true,
      geocoder: false,
      baseLayerPicker: false,
      sceneModePicker: false,
      navigationHelpButton: false,
      infoBox: false,
      selectionIndicator: false,
      shouldAnimate: true,
    })

    viewerRef.current = viewer

    // Set terrain provider
    viewer.terrainProvider = new CesiumTerrainProvider({
      url: IonResource.fromAssetId(1),
      requestWaterMask: true,
      requestVertexNormals: true,
    })

    // Enable lighting based on sun position
    viewer.scene.globe.enableLighting = true

    // Set initial camera view
    const altitude = 40000000 / Math.pow(2, zoom)
    viewer.camera.setView({
      destination: Cartesian3.fromDegrees(center.lng, center.lat, altitude),
    })

    // Listen to camera move events
    let moveTimeout: NodeJS.Timeout
    viewer.camera.moveEnd.addEventListener(() => {
      clearTimeout(moveTimeout)
      moveTimeout = setTimeout(() => {
        const camera = viewer.camera
        const position = camera.positionCartographic

        const lat = CesiumMath.toDegrees(position.latitude)
        const lng = CesiumMath.toDegrees(position.longitude)
        const height = position.height

        // Convert height back to zoom level (approximate)
        const newZoom = Math.log2(40000000 / height)

        onViewportChange?.({
          center: { lat, lng },
          zoom: newZoom,
        })

        // Calculate bounds
        const rect = viewer.camera.computeViewRectangle()
        if (rect) {
          onMapBoundsChange?.({
            north: CesiumMath.toDegrees(rect.north),
            south: CesiumMath.toDegrees(rect.south),
            east: CesiumMath.toDegrees(rect.east),
            west: CesiumMath.toDegrees(rect.west),
          })
        }
      }, 100)
    })

    // Cleanup
    return () => {
      clearTimeout(moveTimeout)
      viewer.destroy()
      viewerRef.current = null
    }
  }, [])

  // Update camera position when center/zoom changes
  useEffect(() => {
    if (!viewerRef.current) return

    const viewer = viewerRef.current
    const altitude = 40000000 / Math.pow(2, zoom)

    viewer.camera.flyTo({
      destination: Cartesian3.fromDegrees(center.lng, center.lat, altitude),
      duration: 1.5,
    })
  }, [center.lat, center.lng, zoom])

  // Handle temperature projection layer
  useEffect(() => {
    if (!viewerRef.current) return
    const viewer = viewerRef.current

    // Remove existing data source
    if (tempDataSourceRef.current) {
      viewer.dataSources.remove(tempDataSourceRef.current)
      tempDataSourceRef.current = null
    }

    // Add new data source if active and data exists
    if (temperatureProjectionActive && tempProjectionData) {
      GeoJsonDataSource.load(tempProjectionData).then(dataSource => {
        tempDataSourceRef.current = dataSource
        viewer.dataSources.add(dataSource)

        // Style the entities based on temperature mode
        const entities = dataSource.entities.values
        const isActualMode = controls.temperatureMode === 'actual'
        for (const entity of entities) {
          if (entity.polygon && entity.properties) {
            // Get the appropriate temperature value based on mode
            const tempValue = isActualMode
              ? entity.properties.projected?.getValue()
              : entity.properties.tempAnomaly?.getValue()

            if (tempValue !== undefined) {
              entity.polygon.material = getTempColor(tempValue, isActualMode)
              entity.polygon.outline = false
            }
          }
        }
      }).catch(err => {
        console.error("Failed to load temperature data:", err)
      })
    }
  }, [temperatureProjectionActive, tempProjectionData, controls.projectionOpacity, controls.temperatureMode])

  return (
    <div
      ref={containerRef}
      className={`h-full w-full ${className ?? ""}`}
      style={{ position: 'relative' }}
    />
  )
}
