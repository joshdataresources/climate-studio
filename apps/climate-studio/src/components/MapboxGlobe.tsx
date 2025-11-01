"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import Map, { NavigationControl, GeolocateControl, ScaleControl, Source, Layer } from "react-map-gl"
import 'mapbox-gl/dist/mapbox-gl.css'
import type { LayerStateMap } from "../hooks/useClimateLayerData"
import { LatLngBoundsLiteral } from "../types/geography"
import type { MapRef } from "react-map-gl"
import { useClimate } from "@climate-studio/core"

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
  const [hoverInfo, setHoverInfo] = useState<{
    x: number
    y: number
    lng: number
    lat: number
  } | null>(null)

  // Get active layers
  const temperatureProjectionActive = isLayerActive("temperature_projection")
  const seaLevelActive = isLayerActive("sea_level_rise")
  const urbanHeatActive = isLayerActive("urban_heat_island")
  const topographicReliefActive = isLayerActive("topographic_relief")
  const precipitationDroughtActive = isLayerActive("precipitation_drought")

  // Get layer data (sea level uses tiles, not data)
  const tempProjectionData = layerStates.temperature_projection?.data
  const urbanHeatData = layerStates.urban_heat_island?.data
  const topographicReliefData = layerStates.topographic_relief?.data
  const precipitationDroughtData = layerStates.precipitation_drought?.data

  // Direct data usage - no persistence to allow immediate updates on pan/zoom
  // This will cause flickering during loads, but ensures fresh data is always displayed

  // Sea level now uses raster tiles, no need for GeoJSON persistence

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

  const handleMouseMove = useCallback((evt: any) => {
    if (evt.lngLat) {
      setHoverInfo({
        x: evt.point.x,
        y: evt.point.y,
        lng: evt.lngLat.lng,
        lat: evt.lngLat.lat
      })
    }
  }, [])

  const handleMouseLeave = useCallback(() => {
    setHoverInfo(null)
  }, [])

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

  // Calculate sea level feet from projection year
  const yearToFeet = (year: number): number => {
    if (year <= 2025) return 1;
    if (year >= 2100) return 10;
    return Math.round(1 + ((year - 2025) / (2100 - 2025)) * 9);
  };
  const seaLevelFeet = yearToFeet(controls.projectionYear);

  // Extract climate data from layer states
  const tempAnomalyData = layerStates.temperature_projection?.data?.metadata?.averageAnomaly;
  const actualTempData = layerStates.temperature_projection?.data?.metadata?.averageTemperature;
  const precipitationData = layerStates.precipitation_drought?.data?.metadata?.averagePrecipitation;
  const droughtIndexData = layerStates.precipitation_drought?.data?.metadata?.droughtIndex;
  const soilMoistureData = layerStates.precipitation_drought?.data?.metadata?.soilMoisture;

  return (
    <div className={`h-full w-full relative ${className ?? ""}`}>
      <Map
        ref={mapRef}
        {...viewState}
        onMove={handleMove}
        onLoad={handleLoad}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
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
        interactiveLayerIds={[
          'temperature-projection-layer',
          'sea-level-rise-layer',
          'precipitation-drought-layer',
          'topographic-relief-layer',
          'urban-heat-island-layer'
        ]}
      >
        {/* Temperature Projection Layer - using Earth Engine raster tiles */}
        {temperatureProjectionActive && tempProjectionData && typeof tempProjectionData === 'object' && 'tile_url' in tempProjectionData && (
          <Source
            id="temperature-projection"
            type="raster"
            tiles={[tempProjectionData.tile_url]}
            tileSize={256}
          >
            <Layer
              id="temperature-projection-layer"
              type="raster"
              paint={{
                'raster-opacity': controls.projectionOpacity || 0.6
              }}
            />
          </Source>
        )}

        {/* Sea Level Rise Layer - using NOAA raster tiles */}
        {seaLevelActive && (() => {
          // Convert projection year to sea level feet using NOAA projections
          // 2025: 1ft, 2050: 3ft, 2075: 6ft, 2100: 10ft (intermediate scenario)
          const yearToFeet = (year: number): number => {
            if (year <= 2025) return 1;
            if (year >= 2100) return 10;
            return Math.round(1 + ((year - 2025) / (2100 - 2025)) * 9);
          };
          const feet = yearToFeet(controls.projectionYear);

          return (
            <Source
              id="sea-level-rise"
              type="raster"
              tiles={[`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001'}/api/tiles/noaa-slr/${feet}/{z}/{x}/{y}.png`]}
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
          );
        })()}

        {/* Precipitation & Drought Layer - using Earth Engine raster tiles */}
        {precipitationDroughtActive && precipitationDroughtData && typeof precipitationDroughtData === 'object' && 'tile_url' in precipitationDroughtData && (
          <Source
            id="precipitation-drought"
            type="raster"
            tiles={[precipitationDroughtData.tile_url]}
            tileSize={256}
          >
            <Layer
              id="precipitation-drought-layer"
              type="raster"
              paint={{
                'raster-opacity': controls.droughtOpacity || 0.6
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

      {/* Coordinates Tooltip */}
      {hoverInfo && (
        <div
          className="absolute z-10 pointer-events-none bg-card/95 backdrop-blur-lg border border-border/60 rounded-lg shadow-lg px-2.5 py-1.5 text-xs"
          style={{
            left: hoverInfo.x + 10,
            top: hoverInfo.y + 10
          }}
        >
          <div className="font-semibold text-foreground">
            {hoverInfo.lat.toFixed(4)}°, {hoverInfo.lng.toFixed(4)}°
          </div>
        </div>
      )}
    </div>
  )
}
