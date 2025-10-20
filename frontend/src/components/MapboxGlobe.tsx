"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import Map, { NavigationControl, GeolocateControl, ScaleControl, Source, Layer } from "react-map-gl"
import 'mapbox-gl/dist/mapbox-gl.css'
import type { LayerStateMap } from "../hooks/useClimateLayerData"
import { LatLngBoundsLiteral } from "../types/geography"
import type { MapRef } from "react-map-gl"
import { useClimate } from "../contexts/ClimateContext"

interface MapboxGlobeProps {
  className?: string
  center: { lat: number; lng: number }
  zoom: number
  onViewportChange?: (viewport: { center: { lat: number; lng: number }; zoom: number }) => void
  onMapBoundsChange?: (bounds: LatLngBoundsLiteral) => void
  layerStates: LayerStateMap
}

const MAPBOX_TOKEN = 'pk.eyJ1Ijoiam9zaHVhYmJ1dGxlciIsImEiOiJjbWcwNXpyNXUwYTdrMmtva2tiZ2NjcGxhIn0.Fc3d_CloJGiw9-BE4nI_Kw'

export function MapboxGlobe({
  className,
  center,
  zoom,
  onViewportChange,
  onMapBoundsChange,
  layerStates,
}: MapboxGlobeProps) {
  const mapRef = useRef<MapRef>(null)
  const { controls, isLayerActive } = useClimate()
  const [viewState, setViewState] = useState({
    longitude: center.lng,
    latitude: center.lat,
    zoom: zoom,
    pitch: 0, // Top-down view
    bearing: 0,
  })

  // Get active layers
  const temperatureProjectionActive = isLayerActive("temperature_projection")
  const seaLevelActive = isLayerActive("sea_level_rise")
  const urbanHeatActive = isLayerActive("urban_heat_island")
  const topographicReliefActive = isLayerActive("topographic_relief")

  // Get layer data
  const tempProjectionData = layerStates.temperature_projection?.data
  const seaLevelData = layerStates.sea_level_rise?.data
  const urbanHeatData = layerStates.urban_heat_island?.data
  const topographicReliefData = layerStates.topographic_relief?.data

  // Debug: Log when urban heat data changes
  useEffect(() => {
    if (urbanHeatActive) {
      console.log('Urban Heat Island Active:', urbanHeatActive)
      console.log('Urban Heat Island Data:', urbanHeatData)
      console.log('Urban Heat Island Features:', urbanHeatData?.features?.length)
    }
  }, [urbanHeatActive, urbanHeatData])

  // Update view state when props change
  useEffect(() => {
    setViewState(prev => ({
      ...prev,
      longitude: center.lng,
      latitude: center.lat,
      zoom: zoom,
    }))
  }, [center.lng, center.lat, zoom])

  const handleMove = useCallback((evt: any) => {
    setViewState(evt.viewState)

    const { longitude, latitude, zoom } = evt.viewState
    onViewportChange?.({
      center: { lat: latitude, lng: longitude },
      zoom: zoom,
    })

    // Get map bounds
    if (mapRef.current) {
      const map = mapRef.current.getMap()
      const bounds = map.getBounds()

      onMapBoundsChange?.({
        north: bounds.getNorth(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        west: bounds.getWest(),
      })
    }
  }, [onViewportChange, onMapBoundsChange])

  const handleLoad = useCallback(() => {
    if (mapRef.current) {
      const map = mapRef.current.getMap()

      // Wait for style to load before setting projection
      map.once('style.load', () => {
        // Set globe projection for 3D sphere with no distortion
        map.setProjection('globe')

        // Add atmosphere and stars for better globe visualization
        map.setFog({
          range: [0.8, 8],
          color: '#ffffff',
          'horizon-blend': 0.1,
          'high-color': '#245bde',
          'space-color': '#000000',
          'star-intensity': 0.15
        })

        // Add sky layer for better 3D effect
        map.addLayer({
          'id': 'sky',
          'type': 'sky',
          'paint': {
            'sky-type': 'atmosphere',
            'sky-atmosphere-sun': [0.0, 0.0],
            'sky-atmosphere-sun-intensity': 15
          }
        })

        // Add 3D terrain
        map.addSource('mapbox-dem', {
          type: 'raster-dem',
          url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
          tileSize: 512,
          maxzoom: 14
        })

        map.setTerrain({
          source: 'mapbox-dem',
          exaggeration: 1.5
        })
      })

      // Trigger initial bounds calculation
      const bounds = map.getBounds()
      onMapBoundsChange?.({
        north: bounds.getNorth(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        west: bounds.getWest(),
      })
    }
  }, [onMapBoundsChange])

  return (
    <div className={`h-full w-full ${className ?? ""}`}>
      <Map
        ref={mapRef}
        {...viewState}
        onMove={handleMove}
        onLoad={handleLoad}
        mapboxAccessToken={MAPBOX_TOKEN}
        mapStyle="mapbox://styles/mapbox/dark-v11"
        style={{ width: '100%', height: '100%' }}
        attributionControl={true}
        projection="globe"
        fog={{
          range: [0.8, 8],
          color: '#ffffff',
          'horizon-blend': 0.1,
          'high-color': '#245bde',
          'space-color': '#000000',
          'star-intensity': 0.15
        }}
      >
        {/* Temperature Projection Layer */}
        {temperatureProjectionActive && tempProjectionData && (
          <Source id="temperature-projection" type="geojson" data={tempProjectionData}>
            <Layer
              id="temperature-projection-layer"
              type="fill"
              paint={{
                'fill-color': controls.temperatureMode === 'actual' ? [
                  'interpolate',
                  ['linear'],
                  ['get', 'projected'],
                  10, '#1e3a8a',
                  15, '#3b82f6',
                  20, '#fef08a',
                  25, '#fb923c',
                  30, '#ef4444',
                  35, '#7f1d1d',
                  40, '#450a0a'
                ] : [
                  'interpolate',
                  ['linear'],
                  ['get', 'tempAnomaly'],
                  0, '#3b82f6',
                  1, '#60a5fa',
                  2, '#93c5fd',
                  3, '#fef08a',
                  4, '#fbbf24',
                  5, '#fb923c',
                  6, '#ef4444',
                  8, '#7f1d1d'
                ],
                'fill-opacity': controls.projectionOpacity || 0.6
              }}
            />
          </Source>
        )}

        {/* Sea Level Rise Layer - using raster tiles from backend */}
        {seaLevelActive && (
          <Source
            id="sea-level-rise"
            type="raster"
            tiles={[`${window.location.origin.replace(':8080', ':3001')}/api/tiles/noaa-slr/${controls.seaLevelFeet}/{z}/{x}/{y}.png`]}
            tileSize={256}
          >
            <Layer
              id="sea-level-rise-layer"
              type="raster"
              paint={{
                'raster-opacity': controls.seaLevelOpacity || 0.7
              }}
            />
          </Source>
        )}

        {/* Topographic Relief Layer - using raster tiles from Earth Engine */}
        {topographicReliefActive && topographicReliefData && typeof topographicReliefData === 'object' && 'tile_url' in topographicReliefData && (
          <Source
            id="topographic-relief"
            type="raster"
            tiles={[topographicReliefData.tile_url]}
            tileSize={256}
          >
            <Layer
              id="topographic-relief-layer"
              type="raster"
              paint={{
                'raster-opacity': controls.reliefOpacity || 0.7
              }}
            />
          </Source>
        )}

        {/* Urban Heat Island Layer - using raster tiles from Earth Engine */}
        {urbanHeatActive && urbanHeatData && typeof urbanHeatData === 'object' && 'tile_url' in urbanHeatData && (
          <Source
            id="urban-heat-island"
            type="raster"
            tiles={[urbanHeatData.tile_url]}
            tileSize={256}
          >
            <Layer
              id="urban-heat-island-layer"
              type="raster"
              paint={{
                'raster-opacity': controls.urbanHeatOpacity || 0.7
              }}
            />
          </Source>
        )}

        <NavigationControl position="bottom-right" />
        <GeolocateControl position="bottom-right" />
        <ScaleControl position="bottom-left" />
      </Map>
    </div>
  )
}
