"use client"

import { useEffect, useRef } from "react"
import Map from "ol/Map"
import View from "ol/View"
import TileLayer from "ol/layer/Tile"
import VectorLayer from "ol/layer/Vector"
import XYZ from "ol/source/XYZ"
import VectorSource from "ol/source/Vector"
import GeoJSON from "ol/format/GeoJSON"
import { fromLonLat, toLonLat } from "ol/proj"
import { Fill, Stroke, Style } from "ol/style"
import "ol/ol.css"
import type { LayerStateMap } from "../hooks/useClimateLayerData"
import { LatLngBoundsLiteral } from "../types/geography"
import { useClimate } from "../contexts/ClimateContext"

interface OpenLayersGlobeProps {
  className?: string
  center: { lat: number; lng: number }
  zoom: number
  onViewportChange?: (viewport: { center: { lat: number; lng: number }; zoom: number }) => void
  onMapBoundsChange?: (bounds: LatLngBoundsLiteral) => void
  layerStates: LayerStateMap
}

export function OpenLayersGlobe({
  className,
  center,
  zoom,
  onViewportChange,
  onMapBoundsChange,
  layerStates,
}: OpenLayersGlobeProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const olMapRef = useRef<Map | null>(null)
  const tempLayerRef = useRef<VectorLayer<VectorSource> | null>(null)
  const { controls, isLayerActive } = useClimate()

  // Get active layers
  const temperatureProjectionActive = isLayerActive("temperature_projection")
  const tempProjectionData = layerStates.temperature_projection?.data

  // Helper function to get temperature color
  const getTempColor = (anomaly: number) => {
    const value = Math.max(0, Math.min(8, anomaly || 0))

    if (value < 1) return [59, 130, 246, 0.6]
    if (value < 2) return [96, 165, 250, 0.6]
    if (value < 3) return [147, 197, 253, 0.6]
    if (value < 4) return [254, 240, 138, 0.6]
    if (value < 5) return [251, 191, 36, 0.6]
    if (value < 6) return [251, 146, 60, 0.6]
    if (value < 8) return [239, 68, 68, 0.6]
    return [127, 29, 29, 0.6]
  }

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || olMapRef.current) return

    // Create base layer with OpenStreetMap
    const osmLayer = new TileLayer({
      source: new XYZ({
        url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        attributions: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      })
    })

    // Create terrain layer with Mapzen terrain tiles
    const terrainLayer = new TileLayer({
      source: new XYZ({
        url: 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png',
        attributions: 'Terrain: <a href="https://github.com/tilezen/joerd">Mapzen Terrain Tiles</a>',
        crossOrigin: 'anonymous'
      }),
      opacity: 0.5
    })

    const map = new Map({
      target: mapRef.current,
      layers: [osmLayer, terrainLayer],
      view: new View({
        center: fromLonLat([center.lng, center.lat]),
        zoom: Math.max(2, zoom), // Ensure minimum zoom
        projection: 'EPSG:3857', // Web Mercator
        constrainResolution: true,
        enableRotation: false,
        minZoom: 2,
        maxZoom: 19
      }),
      controls: [] // We'll add custom controls if needed
    })

    olMapRef.current = map

    // Track view changes with debounce
    let moveTimeout: NodeJS.Timeout
    map.on('moveend', () => {
      clearTimeout(moveTimeout)
      moveTimeout = setTimeout(() => {
        const view = map.getView()
        const mapCenter = view.getCenter()
        const mapZoom = view.getZoom()

        if (mapCenter && mapZoom !== undefined) {
          const lonLat = toLonLat(mapCenter)
          onViewportChange?.({
            center: { lat: lonLat[1], lng: lonLat[0] },
            zoom: mapZoom
          })
        }
      }, 100)
    })

    return () => {
      clearTimeout(moveTimeout)
      map.setTarget(undefined)
      olMapRef.current = null
    }
  }, [])

  // Update center and zoom when props change
  useEffect(() => {
    if (olMapRef.current) {
      const view = olMapRef.current.getView()
      view.animate({
        center: fromLonLat([center.lng, center.lat]),
        zoom: zoom,
        duration: 1000
      })
    }
  }, [center.lat, center.lng, zoom])

  // Handle temperature layer
  useEffect(() => {
    if (!olMapRef.current) return

    // Remove existing temperature layer
    if (tempLayerRef.current) {
      olMapRef.current.removeLayer(tempLayerRef.current)
      tempLayerRef.current = null
    }

    // Add new temperature layer if active
    if (temperatureProjectionActive && tempProjectionData) {
      const vectorSource = new VectorSource({
        features: new GeoJSON().readFeatures(tempProjectionData, {
          featureProjection: 'EPSG:3857'
        })
      })

      const vectorLayer = new VectorLayer({
        source: vectorSource,
        style: (feature) => {
          const tempAnomaly = feature.get('tempAnomaly') || 0
          const [r, g, b, a] = getTempColor(tempAnomaly)
          const opacity = a * (controls.projectionOpacity || 0.6)

          return new Style({
            fill: new Fill({
              color: `rgba(${r}, ${g}, ${b}, ${opacity})`
            }),
            stroke: new Stroke({
              // Use matching color with same opacity to eliminate gaps between hexagons
              color: `rgba(${r}, ${g}, ${b}, ${opacity})`,
              width: 0.5
            })
          })
        }
      })

      tempLayerRef.current = vectorLayer
      olMapRef.current.addLayer(vectorLayer)
    }
  }, [temperatureProjectionActive, tempProjectionData, controls.projectionOpacity])

  return (
    <div
      ref={mapRef}
      className={`h-full w-full ${className ?? ""}`}
      style={{ position: 'relative', zIndex: 0 }}
    />
  )
}
