"use client"

import React, { useEffect, useMemo, useRef, useState, useCallback, memo } from "react"
import { Map, useControl, Source, Layer, Marker } from 'react-map-gl'
import { MapboxOverlay } from '@deck.gl/mapbox'
import { GeoJsonLayer, BitmapLayer, TextLayer, ScatterplotLayer } from '@deck.gl/layers'
import { HeatmapLayer } from '@deck.gl/aggregation-layers'
import { TileLayer } from '@deck.gl/geo-layers'
import type { MapViewState } from '@deck.gl/core'
import { useClimate } from "@climate-studio/core"
import type { LayerStateMap } from "../hooks/useClimateLayerData"
import { getClimateLayer } from "@climate-studio/core/config"
import megaregionData from "../data/megaregion-data.json"
import metroTemperatureData from "../data/metro_temperature_projections.json"
import expandedWetBulbData from "../data/expanded_wet_bulb_projections.json"
import { useTheme } from "../contexts/ThemeContext"
import {
  getWetBulbColorRGBA,
  interpolateWetBulbProjection,
  calculateWetBulbC
} from "../utils/wetBulbCalculator"
import { MetroTooltipBubble } from './MetroTooltipBubble'
import 'mapbox-gl/dist/mapbox-gl.css'

// Memoized DeckGL overlay for better performance
const DeckGLOverlay = memo(function DeckGLOverlay(props: { layers: any[], getTooltip?: any }) {
  const overlay = useControl<MapboxOverlay>(() => new MapboxOverlay({
    ...props,
    // Performance optimizations
    interleaved: false, // Render DeckGL in separate canvas below Mapbox layers
  }), {
    position: 'top-left' // Position doesn't matter, but required for useControl
  })
  overlay.setProps(props)
  return null
})

// Throttle function for viewport updates
function throttle<T extends (...args: any[]) => void>(func: T, limit: number): T {
  let inThrottle: boolean
  return function(this: any, ...args: any[]) {
    if (!inThrottle) {
      func.apply(this, args)
      inThrottle = true
      setTimeout(() => inThrottle = false, limit)
    }
  } as T
}

// Debounce for bounds changes (less critical updates)
function debounce<T extends (...args: any[]) => void>(func: T, wait: number): T {
  let timeout: NodeJS.Timeout
  return function(this: any, ...args: any[]) {
    clearTimeout(timeout)
    timeout = setTimeout(() => func.apply(this, args), wait)
  } as T
}

interface DeckGLMapProps {
  className?: string
  center: { lat: number; lng: number }
  zoom: number
  onViewportChange?: (viewport: { center: { lat: number; lng: number }; zoom: number }) => void
  onMapBoundsChange?: (bounds: any) => void
  layerStates: LayerStateMap
}

const MAPBOX_ACCESS_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || 'pk.eyJ1Ijoiam9zaHVhYmJ1dGxlciIsImEiOiJjbWcwNXpyNXUwYTdrMmtva2tiZ2NjcGxhIn0.Fc3d_CloJGiw9-BE4nI_Kw'
// Use empty string for relative URLs (goes through Vite proxy to port 5001), or explicit URL if set
const backendUrl = import.meta.env.VITE_BACKEND_URL || ''

export function DeckGLMap({
  className,
  center,
  zoom,
  onViewportChange,
  onMapBoundsChange,
  layerStates,
}: DeckGLMapProps) {
  const { controls, isLayerActive, setReliefStyle } = useClimate()
  const { theme } = useTheme()

  // Determine map style based on theme
  const mapStyle = theme === 'light'
    ? "mapbox://styles/mapbox/light-v11"  // Monochrome light style
    : "mapbox://styles/mapbox/dark-v11"  // Dark style

  // Auto-select relief style based on theme and force layer refresh
  useEffect(() => {
    if (theme === 'light') {
      setReliefStyle('classic')
    } else {
      setReliefStyle('dramatic')
    }

    // If map style changed, trigger layer refresh after a short delay
    // to ensure the new style has loaded
    if (prevMapStyleRef.current !== mapStyle) {
      console.log('🎨 Theme changed, refreshing layers...')
      prevMapStyleRef.current = mapStyle

      // Wait for style to load, then refresh layers
      setTimeout(() => {
        setLayerRefreshKey(prev => prev + 1)
        console.log('✅ Layers refreshed after theme change')
      }, 500)
    }
  }, [theme, mapStyle, setReliefStyle])

  const [viewState, setViewState] = useState<MapViewState>({
    longitude: center.lng,
    latitude: center.lat,
    zoom: zoom,
    pitch: 0,
    bearing: 0,
  })

  // Track container dimensions for proper canvas sizing
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const [isContainerReady, setIsContainerReady] = useState(false)

  // Check if container is ready and trigger map resize on window resize
  useEffect(() => {
    if (!containerRef.current) {
      return
    }

    // Mark container as ready once it has dimensions
    const checkReady = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        if (rect.width > 0 && rect.height > 0) {
          setIsContainerReady(true)
        }
      }
    }

    // Initial check
    checkReady()

    // Watch for resize and trigger map resize
    const resizeObserver = new ResizeObserver(() => {
      checkReady()
      // Trigger map resize when container changes
      if (mapRef.current?.resize) {
        mapRef.current.resize()
      }
    })
    resizeObserver.observe(containerRef.current)

    // Also listen for window resize as a fallback
    const handleWindowResize = () => {
      if (mapRef.current?.resize) {
        mapRef.current.resize()
      }
    }
    window.addEventListener('resize', handleWindowResize)

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('resize', handleWindowResize)
    }
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Clean up map reference
      if (mapRef.current) {
        try {
          // DeckGL/Mapbox cleanup is handled by React components
          mapRef.current = null
        } catch (error) {
          console.warn('Error during DeckGLMap cleanup:', error)
        }
      }
    }
  }, [])

  // Track if viewport change is from user interaction or programmatic
  const isUserInteractionRef = useRef(false)
  const lastViewportRef = useRef({ center, zoom })

  // Track style change for DeckGL layer refresh
  const [layerRefreshKey, setLayerRefreshKey] = useState(0)
  const prevMapStyleRef = useRef(mapStyle)

  // Force Mapbox layers to render above DeckGL canvas by directly manipulating DOM
  useEffect(() => {
    if (!mapRef.current) return
    
    const map = mapRef.current.getMap()
    
    const fixZIndex = () => {
      const container = map.getContainer()
      
      // Find all DeckGL canvas elements and force them below
      const deckCanvases = container.querySelectorAll('canvas[class*="deck"], canvas[data-deck]')
      deckCanvases.forEach((canvas) => {
        const el = canvas as HTMLElement
        el.style.zIndex = '0'
        el.style.position = 'absolute'
      })
      
      // Find DeckGL container divs
      const deckContainers = container.querySelectorAll('[class*="deck"], [data-deck]')
      deckContainers.forEach((div) => {
        const el = div as HTMLElement
        if (el.tagName !== 'CANVAS') {
          el.style.zIndex = '0'
          el.style.position = 'relative'
        }
      })
      
      // Force Mapbox canvas container above
      const mapboxContainer = container.querySelector('.mapboxgl-canvas-container')
      if (mapboxContainer) {
        const el = mapboxContainer as HTMLElement
        el.style.zIndex = '10'
        el.style.position = 'relative'
      }
      
      // Force all Mapbox canvas elements above
      const mapboxCanvases = container.querySelectorAll('.mapboxgl-canvas-container canvas')
      mapboxCanvases.forEach((canvas) => {
        const el = canvas as HTMLElement
        el.style.zIndex = '10'
      })
      
      // Apply positioning adjustments to mapboxgl-canvas elements
      const mapboxCanvas = container.querySelector('.mapboxgl-canvas') as HTMLElement
      if (mapboxCanvas) {
        mapboxCanvas.style.left = '50px'
        mapboxCanvas.style.top = '6px'
      }
    }
    
    // Fix z-index after map loads and on style changes
    map.once('load', fixZIndex)
    map.once('style.load', fixZIndex)
    
    // Use MutationObserver to catch when DeckGL canvas is added
    const observer = new MutationObserver(() => {
      fixZIndex()
    })
    
    observer.observe(map.getContainer(), {
      childList: true,
      subtree: true
    })
    
    // Also fix periodically to catch any late additions
    const intervalId = setInterval(fixZIndex, 100)
    const timeoutId = setTimeout(() => clearInterval(intervalId), 5000)
    
    return () => {
      map.off('load', fixZIndex)
      map.off('style.load', fixZIndex)
      observer.disconnect()
      clearInterval(intervalId)
      clearTimeout(timeoutId)
    }
  }, [mapStyle, layerRefreshKey, isContainerReady])

  // Update map style when theme changes
  useEffect(() => {
    if (!mapRef.current) return
    
    // Skip if style hasn't actually changed
    if (prevMapStyleRef.current === mapStyle) return
    prevMapStyleRef.current = mapStyle
    
    const map = mapRef.current.getMap()
    
    // Store current viewport
    const center = map.getCenter()
    const zoom = map.getZoom()
    const pitch = map.getPitch()
    const bearing = map.getBearing()
    
    console.log('🎨 DeckGLMap: Changing map style to:', mapStyle)
    
    // Change the style
    map.setStyle(mapStyle)
    
    // After style loads, restore viewport and refresh DeckGL overlay
    // The overlay needs to be refreshed to ensure it renders correctly with the new map style
    const onStyleLoad = () => {
      console.log('✅ DeckGLMap: New style loaded, restoring viewport and refreshing layers')
      
      // Restore viewport
      map.setCenter(center)
      map.setZoom(zoom)
      map.setPitch(pitch)
      map.setBearing(bearing)
      
      // Refresh the DeckGL overlay to ensure layers render correctly with new style
      // This doesn't lose layer data - it just forces a re-render
      setLayerRefreshKey(prev => prev + 1)
      
      console.log('✅ DeckGLMap: Viewport restored, layers refreshed')
    }
    
    map.once('style.load', onStyleLoad)
    
    return () => {
      map.off('style.load', onStyleLoad)
    }
  }, [mapStyle])

  // Update viewState when props change (with animation for programmatic changes)
  useEffect(() => {
    // Skip if this is from user interaction
    if (isUserInteractionRef.current) {
      isUserInteractionRef.current = false
      lastViewportRef.current = { center, zoom }
      return
    }

    // Check if viewport actually changed
    const hasChanged = 
      Math.abs(lastViewportRef.current.center.lat - center.lat) > 0.001 ||
      Math.abs(lastViewportRef.current.center.lng - center.lng) > 0.001 ||
      Math.abs(lastViewportRef.current.zoom - zoom) > 0.1

    if (!hasChanged) return

    // If map is ready, use flyTo for smooth animation
    if (mapRef.current) {
      try {
        const map = mapRef.current.getMap()
        if (map && typeof map.flyTo === 'function') {
          map.flyTo({
            center: [center.lng, center.lat],
            zoom: zoom,
            duration: 1000
          })
          lastViewportRef.current = { center, zoom }
          return
        }
      } catch (error) {
        console.warn('Error animating map:', error)
      }
    }

    // Fallback to direct update if flyTo not available
    setViewState(prev => ({
      ...prev,
      longitude: center.lng,
      latitude: center.lat,
      zoom: zoom,
    }))
    lastViewportRef.current = { center, zoom }
  }, [center.lng, center.lat, zoom])

  // Helper function to calculate and report bounds
  const updateBounds = useCallback(() => {
    if (!mapRef.current) return

    try {
      const map = mapRef.current.getMap()
      if (!map) return

      const bounds = map.getBounds()
      if (!bounds) return

      const boundsData = {
        north: bounds.getNorth(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        west: bounds.getWest(),
        zoom: map.getZoom()
      }

      console.log('🗺️  Bounds updated:', boundsData)
      onMapBoundsChange?.(boundsData)
    } catch (error) {
      console.error('❌ Failed to get map bounds:', error)
    }
  }, [onMapBoundsChange])

  // Update bounds when map loads
  useEffect(() => {
    if (!mapRef.current || !isContainerReady) return

    const timer = setTimeout(() => {
      updateBounds()
    }, 100) // Small delay to ensure map is fully initialized

    return () => clearTimeout(timer)
  }, [updateBounds, isContainerReady])

  // Throttled viewport change handler for smoother interaction
  const throttledViewportChange = useMemo(
    () => throttle((viewport: { center: { lat: number; lng: number }; zoom: number }) => {
      onViewportChange?.(viewport)
    }, 100), // Update external state at most every 100ms
    [onViewportChange]
  )

  // Debounced bounds update for data fetching
  const debouncedBoundsUpdate = useMemo(
    () => debounce(() => {
      updateBounds()
    }, 300), // Wait 300ms after movement stops to update bounds
    [updateBounds]
  )

  const onViewStateChange = useCallback(({ viewState: newViewState }: { viewState: MapViewState }) => {
    // Mark as user interaction
    isUserInteractionRef.current = true
    
    // Update local state immediately for smooth rendering
    setViewState(newViewState)
    
    // Throttle updates to parent components
    throttledViewportChange({
      center: { lat: newViewState.latitude, lng: newViewState.longitude },
      zoom: newViewState.zoom,
    })
    
    // Debounce bounds updates for data fetching
    debouncedBoundsUpdate()
  }, [throttledViewportChange, debouncedBoundsUpdate])


  // Temperature Current Layer - GPU-accelerated heatmap
  const temperatureHeatmapLayer = useMemo(() => {
    if (!isLayerActive("temperature_current")) return null
    if (layerStates.temperature_current?.status !== "success") return null
    if (!layerStates.temperature_current?.data?.features) return null

    const points = layerStates.temperature_current.data.features
      .map((feature: any) => {
        const [lon, lat] = feature.geometry?.coordinates ?? []
        if (typeof lon !== "number" || typeof lat !== "number") return null
        const anomaly = feature.properties?.anomaly ?? 0
        const weight = Math.min(1, Math.max(0, (anomaly + 5) / 10))
        return { coordinates: [lon, lat], weight }
      })
      .filter(Boolean)

    if (points.length === 0) return null

    return new HeatmapLayer({
      id: 'temperature-heatmap-layer',
      data: points,
      getPosition: (d: any) => d.coordinates,
      getWeight: (d: any) => d.weight,
      radiusPixels: 25,
      intensity: 1,
      threshold: 0.05,
      colorRange: [
        [5, 48, 97],    // Dark blue
        [33, 102, 172], // Blue
        [67, 147, 195], // Light blue
        [244, 165, 130],// Light red
        [214, 96, 77],  // Red
        [103, 0, 31]    // Dark red
      ]
    })
  }, [
    isLayerActive("temperature_current"),
    layerStates.temperature_current
  ])

  // Shared tile loading configuration for optimal performance
  const tileLoadConfig = useMemo(() => ({
    refinementStrategy: 'best-available' as const,
  }), [])

  // Simple tile image loader
  const loadTileImage = useCallback((tileUrl: string, tile: any): Promise<HTMLImageElement> => {
    const { x, y, z } = tile.index
    const url = tileUrl.replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y))
    
    console.log(`🗺️ Loading tile: z=${z}, x=${x}, y=${y}`)
    console.log(`📍 Tile URL: ${url.substring(0, 100)}...`)
    
    return new Promise((resolve, reject) => {
      const image = new Image()
      image.crossOrigin = 'anonymous'
      image.decoding = 'async'
      image.onload = () => {
        console.log(`✅ Tile loaded: z=${z}, x=${x}, y=${y}, size=${image.width}x${image.height}`)
        resolve(image)
      }
      image.onerror = (err) => {
        console.error(`❌ Tile failed: z=${z}, x=${x}, y=${y}`, err)
        reject(err)
      }
      image.src = url
    })
  }, [])

  // Temperature Projection Tile Layer - raster tiles from Earth Engine
  const temperatureProjectionTileLayer = useMemo(() => {
    if (!isLayerActive("temperature_projection")) return null
    const data = layerStates.temperature_projection?.data as any
    if (!data || !data.tile_url) return null

    const tileUrl = data.tile_url
    return new TileLayer({
      id: 'temperature-projection-tiles',
      data: tileUrl,
      minZoom: 0,
      maxZoom: 19,
      tileSize: 256,
      opacity: controls.projectionOpacity ?? 0.2,
      ...tileLoadConfig,
      getTileData: (tile: any) => loadTileImage(tileUrl, tile),
      renderSubLayers: (props: any) => {
        const { tile, data } = props
        if (!data) return null
        const { boundingBox } = tile
        const bounds: [number, number, number, number] = [
          boundingBox[0][0], boundingBox[0][1], 
          boundingBox[1][0], boundingBox[1][1]
        ]
        return new BitmapLayer({
          id: `${props.id}-bitmap`,
          image: data,
          bounds,
          opacity: props.opacity ?? 1,
        })
      },
      pickable: false,
      updateTriggers: {
        opacity: controls.projectionOpacity
      }
    })
  }, [
    isLayerActive("temperature_projection"),
    layerStates.temperature_projection,
    controls.projectionOpacity,
    tileLoadConfig,
    loadTileImage
  ])

  // Helper function to get extreme color for drought/precipitation value
  const getDroughtColor = (value: number, metric: string): [number, number, number, number] => {
    const opacity = 255

    if (metric === 'drought_index') {
      // Drought Index: 0 (wet/no drought) to 10 (extreme drought)
      // EXTREME colors: deep blue → white → bright yellow → orange → deep red
      if (value <= 1) return [0, 71, 171, opacity]       // Deep blue - very wet
      if (value <= 2) return [30, 136, 229, opacity]     // Blue - wet
      if (value <= 3) return [144, 202, 249, opacity]    // Light blue - slightly wet
      if (value <= 4) return [255, 255, 255, opacity]    // White - normal
      if (value <= 5) return [255, 241, 118, opacity]    // Bright yellow - slightly dry
      if (value <= 6) return [255, 213, 79, opacity]     // Yellow - dry
      if (value <= 7) return [255, 167, 38, opacity]     // Orange - moderate drought
      if (value <= 8) return [244, 81, 30, opacity]      // Deep orange - severe drought
      if (value <= 9) return [211, 47, 47, opacity]      // Dark red - extreme drought
      return [136, 14, 79, opacity]                      // Deep maroon - exceptional drought
    }
    else if (metric === 'precipitation') {
      // Precipitation: 0 (dry) to 10+ mm/day (very wet)
      // EXTREME colors: deep brown → yellow → green → bright blue
      if (value <= 1) return [121, 85, 72, opacity]      // Deep brown - very dry
      if (value <= 2) return [161, 136, 127, opacity]    // Brown - dry
      if (value <= 3) return [255, 213, 79, opacity]     // Yellow - low precip
      if (value <= 4) return [255, 241, 118, opacity]    // Light yellow
      if (value <= 5) return [205, 220, 57, opacity]     // Yellow-green - normal
      if (value <= 6) return [156, 204, 101, opacity]    // Light green
      if (value <= 7) return [76, 175, 80, opacity]      // Green - good precip
      if (value <= 8) return [3, 169, 244, opacity]      // Light blue - high precip
      if (value <= 9) return [2, 119, 189, opacity]      // Blue - very high
      return [0, 71, 171, opacity]                       // Deep blue - extreme precip
    }
    else {
      // Soil Moisture: 0% (dry) to 100% (saturated)
      // EXTREME colors: deep brown → tan → green → deep blue
      const normalized = value / 100
      if (normalized <= 0.1) return [101, 67, 33, opacity]      // Deep brown - bone dry
      if (normalized <= 0.2) return [141, 110, 99, opacity]     // Brown - very dry
      if (normalized <= 0.3) return [188, 170, 164, opacity]    // Tan - dry
      if (normalized <= 0.4) return [220, 231, 117, opacity]    // Light yellow-green
      if (normalized <= 0.5) return [205, 220, 57, opacity]     // Yellow-green - normal
      if (normalized <= 0.6) return [156, 204, 101, opacity]    // Light green
      if (normalized <= 0.7) return [76, 175, 80, opacity]      // Green - moist
      if (normalized <= 0.8) return [38, 166, 154, opacity]     // Teal - wet
      if (normalized <= 0.9) return [2, 119, 189, opacity]      // Blue - very wet
      return [0, 71, 171, opacity]                              // Deep blue - saturated
    }
  }

  // Precipitation & Drought Layer - TILES ONLY (smooth raster visualization)
  const precipitationDroughtLayer = useMemo(() => {
    if (!isLayerActive("precipitation_drought")) return null

    const tileData = layerStates.precipitation_drought?.data as any
    if (!tileData || !tileData.tile_url) return null

    return new TileLayer({
      id: 'precipitation-drought-tiles',
      data: tileData.tile_url,
      minZoom: 0,
      maxZoom: 19,
      tileSize: 256,
      opacity: controls.droughtOpacity ?? 0.75,
      getTileData: (tile: any) => {
        const { x, y, z } = tile.index
        const url = tileData.tile_url.replace('{z}', z).replace('{x}', x).replace('{y}', y)
        return new Promise((resolve, reject) => {
          const image = new Image()
          image.crossOrigin = 'anonymous'
          image.onload = () => resolve(image)
          image.onerror = reject
          image.src = url
        })
      },
      renderSubLayers: (props: any) => {
        const { tile, data } = props
        if (!data) return null
        const { boundingBox } = tile
        const bounds: [number, number, number, number] = [
          boundingBox[0][0], boundingBox[0][1],
          boundingBox[1][0], boundingBox[1][1]
        ]
        return new BitmapLayer({
          id: `${props.id}-bitmap`,
          image: data,
          bounds,
          opacity: props.opacity ?? 1,
        })
      },
      pickable: false
    })
  }, [
    isLayerActive("precipitation_drought"),
    layerStates.precipitation_drought,
    controls.droughtOpacity
  ])

  // Groundwater Depletion Hexagon Layer with Aquifer Boundaries
  const groundwaterDepletionLayer = useMemo(() => {
    if (!isLayerActive("groundwater_depletion")) return null
    const data = layerStates.groundwater_depletion?.data as any
    if (!data || !data.features || data.features.length === 0) return null

    // Color scale for depletion: red (severe depletion) → yellow (moderate) → white (stable) → blue (recharge)
    const getDepletionColor = (trendCmPerYear: number): [number, number, number, number] => {
      const opacity = 255 * (controls.groundwaterOpacity ?? 0.7)

      // Severe depletion (< -2 cm/year) - dark red
      if (trendCmPerYear < -2) return [139, 0, 0, opacity]
      // Strong depletion (-2 to -1 cm/year) - red
      if (trendCmPerYear < -1) return [220, 38, 38, opacity]
      // Moderate depletion (-1 to -0.5 cm/year) - orange-red
      if (trendCmPerYear < -0.5) return [239, 68, 68, opacity]
      // Slight depletion (-0.5 to -0.2 cm/year) - orange
      if (trendCmPerYear < -0.2) return [251, 146, 60, opacity]
      // Minor depletion (-0.2 to 0 cm/year) - yellow
      if (trendCmPerYear < 0) return [250, 204, 21, opacity]
      // Stable (0 to 0.2 cm/year) - light gray
      if (trendCmPerYear < 0.2) return [229, 231, 235, opacity]
      // Slight recharge (0.2 to 0.5 cm/year) - light blue
      if (trendCmPerYear < 0.5) return [147, 197, 253, opacity]
      // Moderate recharge (0.5 to 1 cm/year) - blue
      if (trendCmPerYear < 1) return [59, 130, 246, opacity]
      // Strong recharge (> 1 cm/year) - dark blue
      return [29, 78, 216, opacity]
    }

    return new GeoJsonLayer({
      id: 'groundwater-depletion-hexagons',
      data,
      filled: true,
      stroked: true,
      getFillColor: (d: any) => getDepletionColor(d.properties.trendCmPerYear),
      getLineColor: [100, 100, 100, 180],
      getLineWidth: 1,
      lineWidthMinPixels: 0.5,
      pickable: true,
      autoHighlight: true,
      highlightColor: [255, 255, 255, 100],
      updateTriggers: {
        getFillColor: [controls.groundwaterOpacity]
      }
    })
  }, [
    isLayerActive("groundwater_depletion"),
    layerStates.groundwater_depletion,
    controls.groundwaterOpacity
  ])

  // Aquifer Boundary Outlines - shown when groundwater layer is active
  const aquiferBoundaryLayer = useMemo(() => {
    if (!isLayerActive("groundwater_depletion")) return null
    const data = layerStates.groundwater_depletion?.data as any
    if (!data || !data.features || data.features.length === 0) return null

    // Group features by aquifer to draw boundaries
    const aquiferGroups = data.features.reduce((acc: any, feature: any) => {
      const aquifer = feature.properties.aquifer
      if (!acc[aquifer]) acc[aquifer] = []
      acc[aquifer].push(feature)
      return acc
    }, {})

    // Create boundary features - just use the outer extent
    const boundaryFeatures: any[] = []
    Object.entries(aquiferGroups).forEach(([aquifer, features]: [string, any]) => {
      if (features.length === 0) return

      // Get all unique coordinates from hexagons
      const allCoords: any[] = []
      features.forEach((f: any) => {
        if (f.geometry?.coordinates?.[0]) {
          allCoords.push(...f.geometry.coordinates[0])
        }
      })

      // Create a simple bounding feature for visual reference
      if (allCoords.length > 0) {
        const lons = allCoords.map((c: any) => c[0])
        const lats = allCoords.map((c: any) => c[1])
        const minLon = Math.min(...lons)
        const maxLon = Math.max(...lons)
        const minLat = Math.min(...lats)
        const maxLat = Math.max(...lats)

        boundaryFeatures.push({
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: [
              [minLon, minLat],
              [maxLon, minLat],
              [maxLon, maxLat],
              [minLon, maxLat],
              [minLon, minLat]
            ]
          },
          properties: { aquifer }
        })
      }
    })

    if (boundaryFeatures.length === 0) return null

    return new GeoJsonLayer({
      id: 'aquifer-boundaries',
      data: {
        type: 'FeatureCollection',
        features: boundaryFeatures
      },
      stroked: true,
      filled: false,
      getLineColor: [100, 150, 200, 255],
      getLineWidth: 3,
      lineWidthMinPixels: 2,
      pickable: false
    })
  }, [
    isLayerActive("groundwater_depletion"),
    layerStates.groundwater_depletion
  ])

  // Urban Heat Island Tile Layer - raster tiles
  const urbanHeatTileLayer = useMemo(() => {
    if (!isLayerActive("urban_heat_island")) return null
    const data = layerStates.urban_heat_island?.data as any
    if (!data || !data.tile_url) return null

    return new TileLayer({
      id: 'urban-heat-island-tiles',
      data: data.tile_url,
      minZoom: 0,
      maxZoom: 19,
      tileSize: 256,
      opacity: controls.urbanHeatOpacity ?? 0.3,
      getTileData: (tile: any) => {
        const { x, y, z } = tile.index
        const url = data.tile_url.replace('{z}', z).replace('{x}', x).replace('{y}', y)
        return new Promise((resolve, reject) => {
          const image = new Image()
          image.crossOrigin = 'anonymous'
          image.onload = () => resolve(image)
          image.onerror = reject
          image.src = url
        })
      },
      renderSubLayers: (props: any) => {
        const { tile, data } = props
        if (!data) return null
        const { boundingBox } = tile
        const bounds: [number, number, number, number] = [
          boundingBox[0][0], boundingBox[0][1],
          boundingBox[1][0], boundingBox[1][1]
        ]
        return new BitmapLayer({
          id: `${props.id}-bitmap`,
          image: data,
          bounds,
          opacity: props.opacity ?? 1,
        })
      },
      pickable: false
    })
  }, [
    isLayerActive("urban_heat_island"),
    layerStates.urban_heat_island,
    controls.urbanHeatOpacity
  ])

  // Topographic Relief Tile Layer - raster tiles
  const topographicReliefTileLayer = useMemo(() => {
    if (!isLayerActive("topographic_relief")) return null
    const data = layerStates.topographic_relief?.data as any

    const opacityValue = controls.reliefOpacity ?? 0.3
    console.log('🏔️ Topographic Relief Layer State:', {
      isActive: isLayerActive("topographic_relief"),
      hasData: !!data,
      hasTileUrl: !!data?.tile_url,
      tileUrl: data?.tile_url,
      OPACITY: opacityValue,
      controls_reliefOpacity: controls.reliefOpacity,
      fullData: data
    })
    if (!data || !data.tile_url) return null

    return new TileLayer({
      id: 'topographic-relief-tiles',
      data: data.tile_url,
      minZoom: 0,
      maxZoom: 19,
      tileSize: 256,
      opacity: opacityValue,
      getTileData: (tile: any) => {
        const { x, y, z } = tile.index
        const url = data.tile_url.replace('{z}', z).replace('{x}', x).replace('{y}', y)
        return new Promise((resolve, reject) => {
          const image = new Image()
          image.crossOrigin = 'anonymous'
          image.onload = () => resolve(image)
          image.onerror = reject
          image.src = url
        })
      },
      onTileLoad: (tile: any) => {
        console.log('🏔️ Topographic tile loaded:', tile.index, 'hasData:', !!tile.data, 'dataType:', typeof tile.data, 'isImage:', tile.data instanceof HTMLImageElement)
      },
      onTileError: (error: any, tile: any) => {
        console.error('🏔️ Topographic tile error:', tile.index, error)
      },
      renderSubLayers: (props: any) => {
        const { tile, data } = props
        if (!data) return null
        const { boundingBox } = tile
        const bounds: [number, number, number, number] = [
          boundingBox[0][0], boundingBox[0][1], 
          boundingBox[1][0], boundingBox[1][1]
        ]
        return new BitmapLayer({
          id: `${props.id}-bitmap`,
          image: data,
          bounds,
          opacity: opacityValue,
        })
      },
      pickable: false,
      updateTriggers: {
        opacity: controls.reliefOpacity
      }
    })
  }, [
    isLayerActive("topographic_relief"),
    layerStates.topographic_relief,
    controls.reliefOpacity
  ])

  // Urban Expansion Layer - GeoJSON polygons
  const urbanExpansionLayer = useMemo(() => {
    if (!isLayerActive("urban_expansion")) return null
    if (layerStates.urban_expansion?.status !== "success") return null
    if (!layerStates.urban_expansion?.data?.features) return null

    return new GeoJsonLayer({
      id: 'urban-expansion-layer',
      data: layerStates.urban_expansion.data,
      pickable: true,
      stroked: true,
      filled: true,
      getFillColor: [255, 140, 0, 255], // Orange - opacity controlled by layer
      getLineColor: [255, 140, 0, 255],
      getLineWidth: 2,
      opacity: controls.urbanExpansionOpacity ?? 0.3
    })
  }, [
    isLayerActive("urban_expansion"),
    layerStates.urban_expansion,
    controls.urbanExpansionOpacity
  ])


  // Helper functions for megaregion circles
  const populationToRadius = (population: number): number => {
    const scaleFactor = 0.015
    const baseRadius = Math.sqrt(population) * scaleFactor
    return Math.max(baseRadius, 30)
  }

  const getGrowthColorRGB = (currentPop: number, previousPop: number): string => {
    if (!previousPop || previousPop === 0) return 'rgb(136, 136, 136)'

    const growthRate = (currentPop - previousPop) / previousPop

    // Warm colors (red → yellow) for DECLINE (negative growth)
    if (growthRate < -0.05) return 'rgb(220, 38, 38)'   // Dark red - strong decline
    if (growthRate < -0.03) return 'rgb(239, 68, 68)'   // Red - moderate decline
    if (growthRate < -0.01) return 'rgb(249, 115, 22)'  // Orange - slight decline
    if (growthRate < 0) return 'rgb(234, 179, 8)'       // Yellow - minor decline

    // Cool colors (purple → blue → green) for GROWTH (positive)
    if (growthRate < 0.02) return 'rgb(168, 85, 247)'   // Purple - minimal growth
    if (growthRate < 0.04) return 'rgb(139, 92, 246)'   // Violet - low growth
    if (growthRate < 0.06) return 'rgb(59, 130, 246)'   // Blue - moderate growth
    if (growthRate < 0.08) return 'rgb(14, 165, 233)'   // Sky blue - good growth
    if (growthRate < 0.10) return 'rgb(6, 182, 212)'    // Cyan - strong growth
    return 'rgb(16, 185, 129)' // Green - 10%+ excellent growth
  }

  const getGrowthColorRGBA = (currentPop: number, previousPop: number): [number, number, number, number] => {
    // White for year 2025 (baseline year with no previous data)
    if (!previousPop || previousPop === 0) return [255, 255, 255, 255]

    const growthRate = (currentPop - previousPop) / previousPop

    // Warm colors (red → yellow) for DECLINE (negative growth)
    if (growthRate < -0.05) return [220, 38, 38, 255]   // Dark red - strong decline
    if (growthRate < -0.03) return [239, 68, 68, 255]   // Red - moderate decline
    if (growthRate < -0.01) return [249, 115, 22, 255]  // Orange - slight decline
    if (growthRate < 0) return [234, 179, 8, 255]       // Yellow - minor decline

    // Cool colors (purple → blue → green) for GROWTH (positive)
    if (growthRate < 0.02) return [168, 85, 247, 255]   // Purple - minimal growth
    if (growthRate < 0.04) return [139, 92, 246, 255]   // Violet - low growth
    if (growthRate < 0.06) return [59, 130, 246, 255]   // Blue - moderate growth
    if (growthRate < 0.08) return [14, 165, 233, 255]   // Sky blue - good growth
    if (growthRate < 0.10) return [6, 182, 212, 255]    // Cyan - strong growth
    return [16, 185, 129, 255] // Green - 10%+ excellent growth
  }

  const createCircle = (lng: number, lat: number, radiusKm: number, points: number = 64): number[][] => {
    const coords: number[][] = []
    const earthRadiusKm = 6371

    for (let i = 0; i <= points; i++) {
      const angle = (i / points) * 2 * Math.PI
      const latOffset = (radiusKm / earthRadiusKm) * (180 / Math.PI)
      const lngOffset = (radiusKm / earthRadiusKm) * (180 / Math.PI) / Math.cos(lat * Math.PI / 180)
      const newLat = lat + latOffset * Math.cos(angle)
      const newLng = lng + lngOffset * Math.sin(angle)
      coords.push([newLng, newLat])
    }

    return coords
  }

  // Megaregion Center Dots Layer - Always visible for tooltips (invisible dots)
  const megaregionCenterDotsLayer = useMemo(() => {
    if (!isLayerActive("megaregion_timeseries")) {
      console.log('🔵 Center dots: layer not active')
      return null
    }

    const data = megaregionData as any
    const metros = data.metros.map((metro: any) => ({
      ...metro,
      position: [metro.lon, metro.lat]
    }))

    console.log('🔵 Center dots layer created:', {
      metroCount: metros.length,
      showPopulation: controls.megaregionShowPopulation,
      showTemperature: controls.megaregionShowTemperature
    })

    return new ScatterplotLayer({
      id: 'megaregion-center-dots',
      data: metros,
      getPosition: (d: any) => d.position,
      getRadius: 15000, // 15km radius for easier hovering
      getFillColor: [0, 0, 0, 0], // Completely transparent
      pickable: true,
      autoHighlight: false,
      radiusMinPixels: 5, // Minimum 5px radius for easier picking
      radiusMaxPixels: 50 // Max 50px radius
    })
  }, [isLayerActive("megaregion_timeseries"), controls.megaregionShowPopulation, controls.megaregionShowTemperature])

  // Megaregion Population Bubbles Layer (only visible when "Projected Population" is checked)
  const megaregionCirclesLayer = useMemo(() => {
    if (!isLayerActive("megaregion_timeseries")) return null
    if (!controls.megaregionShowPopulation) return null // Only show if population checkbox is checked

    const year = controls.projectionYear ?? 2050
    const availableYears = [2025, 2035, 2045, 2055, 2065, 2075, 2085, 2095]
    const closestYear = availableYears.reduce((prev, curr) =>
      Math.abs(curr - year) < Math.abs(prev - year) ? curr : prev
    )
    const yearIndex = availableYears.indexOf(closestYear)

    // If slider year is after 2025 but closest data year is 2025, use 2035 data instead
    // This ensures colors show for 2026-2034 range
    const displayYear = (year > 2025 && closestYear === 2025) ? 2035 : closestYear
    const displayYearIndex = availableYears.indexOf(displayYear)

    // Always compare to previous decade, or to 2025 baseline if it's the first year
    const previousYear = displayYearIndex > 0 ? availableYears[displayYearIndex - 1] : null

    const data = megaregionData as any
    const features = data.metros
      .map((metro: any) => {
        const currentPop = metro.populations?.[String(displayYear)]
        // Skip if population data is missing
        if (currentPop == null || typeof currentPop !== 'number') {
          return null
        }
        // For 2025, previousPop is 0 (no comparison). For all other years, compare to previous decade.
        const previousPop = previousYear ? (metro.populations?.[String(previousYear)] || 0) : 0
        const radius = populationToRadius(currentPop)
        const colorRGBA = getGrowthColorRGBA(currentPop, previousPop)

        // Calculate population change percentage
        const popChange = previousYear ? ((currentPop - previousPop) / previousPop * 100) : 0

        // Validate coordinates
        if (typeof metro.lon !== 'number' || typeof metro.lat !== 'number' ||
            isNaN(metro.lon) || isNaN(metro.lat)) {
          return null
        }

        return {
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: [createCircle(metro.lon, metro.lat, radius)]
          },
          properties: {
            name: metro.name,
            population: currentPop,
            previousPopulation: previousPop,
            populationChange: popChange,
            displayYear: displayYear,
            previousYear: previousYear,
            radius: radius,
            fillColor: colorRGBA,
            lineColor: colorRGBA,
            center: [metro.lon, metro.lat]
          }
        }
      })
      .filter((f: any) => f !== null)

    const geojson: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features
    }

    return new GeoJsonLayer({
      id: 'megaregion-circles',
      data: geojson as any,
      filled: true,
      stroked: false, // No stroke - solid filled circles
      getFillColor: (d: any) => d.properties.fillColor,
      opacity: controls.megaregionOpacity ?? 0.5,
      pickable: true,
      updateTriggers: {
        getFillColor: [displayYear],
        opacity: controls.megaregionOpacity
      }
    })
  }, [
    isLayerActive("megaregion_timeseries"),
    controls.projectionYear,
    controls.megaregionOpacity,
    controls.megaregionShowPopulation
  ])

  // Wet Bulb Temperature Danger Zone Layer
  const wetBulbDangerZoneLayer = useMemo(() => {
    if (!isLayerActive("wet_bulb")) return null

    const year = controls.projectionYear ?? 2050
    const availableYears = [2025, 2035, 2045, 2055, 2065, 2075]

    // Find closest available year
    const closestYear = availableYears.reduce((prev, curr) =>
      Math.abs(curr - year) < Math.abs(prev - year) ? curr : prev
    )

    const wetBulbDataTyped = expandedWetBulbData as Record<string, {
      name: string
      lat: number
      lon: number
      population_2024: number
      metro_population_2024: number
      baseline_humidity: number
      projections: Record<string, {
        avg_summer_humidity: number
        peak_humidity: number
        wet_bulb_events: number
        days_over_95F: number
        days_over_100F: number
        estimated_at_risk_population: number
        casualty_rate_percent: number
        extent_radius_km: number
      }>
    }>

    const features = Object.entries(wetBulbDataTyped)
      .map(([cityKey, cityData]) => {
        const { lat, lon, name, projections, metro_population_2024, baseline_humidity } = cityData

        // Interpolate projection data for the selected year
        const projection = interpolateWetBulbProjection(projections, year)

        // Calculate wet bulb temperature from summer temp estimate and humidity
        // Use days_over_95F as a proxy for summer temperature intensity
        const estimatedSummerTempF = 90 + (projection.days_over_95F / 20)
        const wetBulbTempC = calculateWetBulbC(
          (estimatedSummerTempF - 32) * 5 / 9,
          projection.avg_summer_humidity
        )

        // Get color based on wet bulb danger level
        const colorRGBA = getWetBulbColorRGBA(wetBulbTempC, 180)

        // Use extent_radius_km from projections
        const radiusKm = projection.extent_radius_km

        return {
          type: 'Feature' as const,
          geometry: {
            type: 'Polygon' as const,
            coordinates: [createCircle(lon, lat, radiusKm)]
          },
          properties: {
            name,
            cityKey,
            year: closestYear,
            wet_bulb_events: projection.wet_bulb_events,
            wet_bulb_temp_c: Math.round(wetBulbTempC * 10) / 10,
            avg_summer_humidity: projection.avg_summer_humidity,
            peak_humidity: projection.peak_humidity,
            days_over_95F: projection.days_over_95F,
            days_over_100F: projection.days_over_100F,
            at_risk_population: projection.estimated_at_risk_population,
            casualty_rate_percent: projection.casualty_rate_percent,
            extent_radius_km: radiusKm,
            metro_population: metro_population_2024,
            fillColor: colorRGBA,
            center: [lon, lat]
          }
        }
      })
      .filter(f => f.properties.wet_bulb_events > 0 || year >= 2045) // Show all cities by 2045

    const geojson: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features
    }

    return new GeoJsonLayer({
      id: 'wet-bulb-danger-zones',
      data: geojson as any,
      filled: true,
      stroked: true,
      lineWidthMinPixels: 1,
      getLineColor: [153, 27, 27, 200], // Dark red border
      getFillColor: (d: any) => d.properties.fillColor,
      opacity: controls.wetBulbOpacity ?? 0.6,
      pickable: true,
      updateTriggers: {
        getFillColor: [year],
        opacity: controls.wetBulbOpacity
      }
    })
  }, [
    isLayerActive("wet_bulb"),
    controls.projectionYear,
    controls.wetBulbOpacity
  ])

  // Megaregion Labels GeoJSON (for Mapbox symbol layers)
  const megaregionLabelsGeoJSON = useMemo(() => {
    if (!isLayerActive("megaregion_timeseries")) return null

    const year = controls.projectionYear ?? 2050
    const availableYears = [2025, 2035, 2045, 2055, 2065, 2075, 2085, 2095]
    const closestYear = availableYears.reduce((prev, curr) =>
      Math.abs(curr - year) < Math.abs(prev - year) ? curr : prev
    )

    // If slider year is after 2025 but closest data year is 2025, use 2035 data instead
    const displayYear = (year > 2025 && closestYear === 2025) ? 2035 : closestYear
    const displayYearIndex = availableYears.indexOf(displayYear)
    const previousYear = displayYearIndex > 0 ? availableYears[displayYearIndex - 1] : null

    const data = megaregionData as any
    const features = data.metros
      .map((metro: any) => {
        const currentPop = metro.populations?.[String(displayYear)]
        // Skip if population data is missing
        if (currentPop == null || typeof currentPop !== 'number') {
          return null
        }
        const previousPop = previousYear ? (metro.populations?.[String(previousYear)] ?? null) : null
        const growthRate = previousPop != null && previousPop > 0 ? ((currentPop - previousPop) / previousPop * 100) : 0
        const absoluteChange = previousPop != null ? (currentPop - previousPop) : 0

        // Format population with commas
        const formattedPop = currentPop.toLocaleString('en-US')

        // Show growth if we have previous data to compare with
        const showGrowth = previousPop !== null && previousPop !== currentPop && previousPop > 0
        const triangle = growthRate > 0 ? '▲' : growthRate < 0 ? '▼' : '='

        // Format: "+50,000 (+5%▲)" or "-30,000 (-3%▼)"
        const formattedChange = Math.abs(absoluteChange).toLocaleString('en-US')
        const changeText = showGrowth
          ? `${growthRate >= 0 ? '+' : '-'}${formattedChange} (${growthRate >= 0 ? '+' : ''}${Math.abs(growthRate).toFixed(0)}%${triangle})`
          : ''

        const isGrowing = growthRate > 0
        const isDecline = growthRate < 0

        // Format percentage for tooltip display (just percentage, no absolute change)
        const percentageText = previousPop != null && previousPop > 0
          ? `(${growthRate >= 0 ? '+' : ''}${Math.abs(growthRate).toFixed(0)}%)`
          : ''

        // Validate coordinates
        if (typeof metro.lon !== 'number' || typeof metro.lat !== 'number' || 
            isNaN(metro.lon) || isNaN(metro.lat)) {
          return null
        }

        return {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [metro.lon, metro.lat]
          },
          properties: {
            name: metro.name,
            population: formattedPop,
            change: changeText,
            percentage: percentageText,
            isGrowing,
            isDecline,
            showGrowth,
            displayYear
          }
        }
      })
      .filter((f: any) => f !== null)

    const geojson = {
      type: 'FeatureCollection',
      features
    }

    // Debug logging
    console.log('📊 Megaregion Labels GeoJSON:', {
      featureCount: features.length,
      sampleFeature: features[0],
      sliderYear: year,
      displayYear: displayYear,
      previousYear
    })

    return geojson
  }, [
    isLayerActive("megaregion_timeseries"),
    controls.projectionYear
  ])

  // Sea Level Rise Tile Layer - from backend server
  const seaLevelTileLayer = useMemo(() => {
    if (!isLayerActive("sea_level_rise")) return null

    try {
      // Convert projection year to sea level feet
      const yearToFeet = (year: number): number => {
        if (year <= 2025) return 1
        if (year >= 2100) return 10
        return Math.round(1 + ((year - 2025) / (2100 - 2025)) * 9)
      }
      const feet = yearToFeet(controls.projectionYear)
      const tileUrl = `${backendUrl}/api/tiles/noaa-slr/${feet}/{z}/{x}/{y}.png`
      
      return new TileLayer({
        id: 'sea-level-rise-tiles',
        data: tileUrl,
        minZoom: 0,
        maxZoom: 16,
        tileSize: 256,
        opacity: controls.seaLevelOpacity ?? 0.7,
        getTileData: (tile: any) => {
          const { x, y, z } = tile.index
          const url = tileUrl.replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y))
          return new Promise((resolve, reject) => {
            const image = new Image()
            image.crossOrigin = 'anonymous'
            image.onload = () => resolve(image)
            image.onerror = reject
            image.src = url
          })
        },
        renderSubLayers: (props: any) => {
          const { tile, data } = props
          if (!data) return null
          const { boundingBox } = tile
          const bounds: [number, number, number, number] = [
            boundingBox[0][0], boundingBox[0][1],
            boundingBox[1][0], boundingBox[1][1]
          ]
          return new BitmapLayer({
            id: `${props.id}-bitmap`,
            image: data,
            bounds,
            opacity: props.opacity ?? 1,
          })
        },
        pickable: false,
        onTileError: (error: Error) => {
          console.error('Sea level tile error:', error)
        },
        updateTriggers: {
          data: feet,
          opacity: controls.seaLevelOpacity
        }
      })
    } catch (error) {
      console.error('Error creating sea level rise layer:', error)
      return null
    }
  }, [
    isLayerActive("sea_level_rise"),
    controls.projectionYear,
    controls.seaLevelOpacity
  ])

  // Layer order: first in array renders first (bottom), last renders last (top)
  // Desired order (bottom to top): Relief → Sea Level → Precipitation → Future Temp → Heat Map → Population circles
  // Population labels render via Mapbox symbol layers (after DeckGL) to ensure they appear on top
  
  // Debug layer creation
  const layerStatus = {
    topographicRelief: {
      active: isLayerActive("topographic_relief"),
      hasState: !!layerStates.topographic_relief,
      status: layerStates.topographic_relief?.status,
      hasTileUrl: !!layerStates.topographic_relief?.data?.tile_url,
      layerCreated: !!topographicReliefTileLayer
    },
    seaLevel: {
      active: isLayerActive("sea_level_rise"),
      hasState: !!layerStates.sea_level_rise,
      status: layerStates.sea_level_rise?.status,
      hasTileUrl: !!layerStates.sea_level_rise?.data?.tile_url,
      layerCreated: !!seaLevelTileLayer
    },
    precipitation: {
      active: isLayerActive("precipitation_drought"),
      hasState: !!layerStates.precipitation_drought,
      status: layerStates.precipitation_drought?.status,
      hasFeatures: !!layerStates.precipitation_drought?.data?.features,
      layerCreated: !!precipitationDroughtLayer
    },
    temperature: {
      active: isLayerActive("temperature_projection"),
      hasState: !!layerStates.temperature_projection,
      status: layerStates.temperature_projection?.status,
      hasTileUrl: !!layerStates.temperature_projection?.data?.tile_url,
      layerCreated: !!temperatureProjectionTileLayer
    },
    urbanHeat: {
      active: isLayerActive("urban_heat_island"),
      hasState: !!layerStates.urban_heat_island,
      status: layerStates.urban_heat_island?.status,
      hasTileUrl: !!layerStates.urban_heat_island?.data?.tile_url,
      layerCreated: !!urbanHeatTileLayer
    }
  }
  console.log('🔧 Layer Creation Status:', JSON.stringify(layerStatus, null, 2))

  // Dynamic tooltip based on checkbox selections
  const getTooltip = useCallback(({ object }: any) => {
    // Handle both center dots and population bubbles
    if (!object) return null
    const layerId = object.layer?.id

    console.log('🎯 Tooltip hover:', {
      layerId,
      hasObject: !!object,
      showPop: controls.megaregionShowPopulation,
      showTemp: controls.megaregionShowTemperature
    })

    if (layerId !== 'megaregion-circles' && layerId !== 'megaregion-center-dots') return null

    // Get properties - different structure for center dots vs bubbles
    const props = layerId === 'megaregion-center-dots'
      ? object // ScatterplotLayer data
      : object.properties // GeoJsonLayer properties

    const showPop = controls.megaregionShowPopulation
    const showTemp = controls.megaregionShowTemperature

    // Tooltip container - beige/tan background from Figma
    const tooltipStyle = `
      position: relative;
      padding: 20px;
      background: rgb(229, 223, 218);
      color: #1a1a1a;
      border-radius: 12px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      box-shadow: 0 4px 16px rgba(0,0,0,0.2);
      min-width: 240px;
    `

    // Triangle connector (pointing down to the dot)
    const triangleStyle = `
      position: absolute;
      bottom: -10px;
      left: 50%;
      transform: translateX(-50%);
      width: 0;
      height: 0;
      border-left: 10px solid transparent;
      border-right: 10px solid transparent;
      border-top: 10px solid rgb(229, 223, 218);
    `

    // Get temperature data (mock for now - will be replaced with real data)
    const getTempData = (metroName: string, year: number) => {
      // This will be replaced with actual temperature lookup
      // For now, return mock data that varies by year
      const baselineYear = 2025
      const yearDiff = year - baselineYear
      const tempIncrease = (yearDiff / 70) * 4 // 4°F increase by 2095

      return {
        summer: {
          temp: Math.round(85 + tempIncrease),
          change: Math.round((tempIncrease / 85) * 100)
        },
        winter: {
          temp: Math.round(35 + tempIncrease * 0.8),
          change: Math.round((tempIncrease * 0.8 / 35) * 100)
        }
      }
    }

    // For center dots, we need to look up population data from the year
    let population, populationChange, previousYear
    if (layerId === 'megaregion-center-dots') {
      const year = controls.projectionYear ?? 2050
      const availableYears = [2025, 2035, 2045, 2055, 2065, 2075, 2085, 2095]
      const closestYear = availableYears.reduce((prev: number, curr: number) =>
        Math.abs(curr - year) < Math.abs(prev - year) ? curr : prev
      )
      const displayYear = (year > 2025 && closestYear === 2025) ? 2035 : closestYear
      const displayYearIndex = availableYears.indexOf(displayYear)
      previousYear = displayYearIndex > 0 ? availableYears[displayYearIndex - 1] : null

      population = props.populations?.[String(displayYear)]
      const previousPop = previousYear ? (props.populations?.[String(previousYear)] || 0) : 0
      populationChange = previousYear && previousPop > 0 ? ((population - previousPop) / previousPop * 100) : 0
    } else {
      population = props.population
      populationChange = props.populationChange
      previousYear = props.previousYear
    }

    // Get metro name for temperature lookup
    const metroName = props.name || ''
    const currentYear = controls.projectionYear ?? 2050
    const tempData = getTempData(metroName, currentYear)

    // Build tooltip sections conditionally
    let sections: string[] = []

    // Always show city name at the top
    sections.push(`
      <div style="font-size: 20px; font-weight: 700; color: #1a1a1a; margin-bottom: ${showPop || showTemp ? '18px' : '0'};">
        ${metroName}
      </div>
    `)

    // Add population section if checkbox is checked
    if (showPop) {
      sections.push(`
        <div style="font-size: 11px; font-weight: 600; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.8px; color: #65758B;">Population Change</div>
        <div style="font-size: ${showTemp ? '40px' : '48px'}; font-weight: 700; line-height: 1; margin-bottom: ${showTemp ? '18px' : '0'}; color: ${populationChange > 0 ? '#22c55e' : populationChange < 0 ? '#ef4444' : '#666'};">
          ${previousYear ? `${populationChange > 0 ? '+' : ''}${Math.round(populationChange)}%` : 'N/A'}
        </div>
      `)
    }

    // Add divider if both sections are shown
    if (showPop && showTemp) {
      sections.push(`<div style="height: 1px; background: rgba(0,0,0,0.15); margin: 18px 0;"></div>`)
    }

    // Add temperature section if checkbox is checked
    if (showTemp) {
      sections.push(`
        <div style="font-size: 11px; font-weight: 600; margin-bottom: 14px; text-transform: uppercase; letter-spacing: 0.8px; color: #65758B;">Avg Temperature Change</div>
        <div style="display: flex; flex-direction: column; gap: ${showPop ? '14px' : '16px'};">
          <div>
            <div style="font-size: 11px; font-weight: 500; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px; color: #888;">Summer</div>
            <div style="font-size: ${showPop ? '32px' : '36px'}; font-weight: 700; line-height: 1; color: #1a1a1a;">
              ${tempData.summer.temp}° <span style="font-size: ${showPop ? '18px' : '20px'}; font-weight: 600; color: ${tempData.summer.change > 0 ? '#22c55e' : '#666'};">(+${tempData.summer.change}%)</span>
            </div>
          </div>
          <div>
            <div style="font-size: 11px; font-weight: 500; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px; color: #888;">Winter</div>
            <div style="font-size: ${showPop ? '32px' : '36px'}; font-weight: 700; line-height: 1; color: #1a1a1a;">
              ${tempData.winter.temp}° <span style="font-size: ${showPop ? '18px' : '20px'}; font-weight: 600; color: ${tempData.winter.change > 0 ? '#22c55e' : '#666'};">(+${tempData.winter.change}%)</span>
            </div>
          </div>
        </div>
      `)
    }

    return {
      html: `
        <div style="${tooltipStyle}">
          ${sections.join('')}
          <div style="${triangleStyle}"></div>
        </div>
      `,
      style: { pointerEvents: 'none' }
    }

    return null
  }, [controls.megaregionShowPopulation, controls.megaregionShowTemperature, controls.projectionYear])

  const layers = [
    topographicReliefTileLayer,    // 1. Bottom - Topographic Relief
    seaLevelTileLayer,             // 2. Sea Level Rise
    precipitationDroughtLayer,     // 3. Precipitation & Drought (tiles)
    aquiferBoundaryLayer,          // 4. Aquifer boundary outlines (shown with groundwater)
    groundwaterDepletionLayer,     // 5. Groundwater Depletion (hexagons on aquifers)
    temperatureProjectionTileLayer, // 6. Future Temperature Anomaly
    urbanHeatTileLayer,            // 7. Urban Heat Island (Heat Map)
    urbanExpansionLayer,           // 8. Urban Expansion (if present)
    temperatureHeatmapLayer,       // 9. Temperature Heatmap (if present)
    wetBulbDangerZoneLayer,        // 10. Wet Bulb Temperature Danger Zones
    megaregionCirclesLayer,        // 11. Metro Data Statistics population bubbles (conditional)
    megaregionCenterDotsLayer,     // 12. Metro center dots (always on top for tooltips)
  ].filter(Boolean)

  console.log('🗺️ DeckGL Layers:', {
    total: layers.length,
    layerTypes: layers.map((l: any) => l?.id || 'unknown'),
    seaLevel: !!seaLevelTileLayer,
    topographic: !!topographicReliefTileLayer,
    temperature: !!temperatureProjectionTileLayer,
    precipitation: !!precipitationDroughtLayer,
    urbanHeat: !!urbanHeatTileLayer,
    urbanExpansion: !!urbanExpansionLayer,
    tempHeatmap: !!temperatureHeatmapLayer
  })

  console.log('🔍 Layer States:', {
    topographic: {
      active: isLayerActive("topographic_relief"),
      status: layerStates.topographic_relief?.status,
      hasTileUrl: !!layerStates.topographic_relief?.data?.tile_url,
      tileUrl: layerStates.topographic_relief?.data?.tile_url?.substring(0, 100)
    },
    precipitation: {
      active: isLayerActive("precipitation_drought"),
      status: layerStates.precipitation_drought?.status,
      hasFeatures: !!layerStates.precipitation_drought?.data?.features,
      featureCount: layerStates.precipitation_drought?.data?.features?.length || 0
    },
    temperature: {
      active: isLayerActive("temperature_projection"),
      status: layerStates.temperature_projection?.status,
      hasTileUrl: !!layerStates.temperature_projection?.data?.tile_url,
      tileUrl: layerStates.temperature_projection?.data?.tile_url?.substring(0, 100)
    },
    urbanHeat: {
      active: isLayerActive("urban_heat_island"),
      status: layerStates.urban_heat_island?.status,
      hasTileUrl: !!layerStates.urban_heat_island?.data?.tile_url,
      tileUrl: layerStates.urban_heat_island?.data?.tile_url?.substring(0, 100)
    }
  })

  // Don't render until viewState is valid
  if (!viewState || typeof viewState.latitude !== 'number' || typeof viewState.longitude !== 'number') {
    return <div className={`h-full w-full ${className ?? ""}`}>Loading map...</div>
  }

  return (
    <div ref={containerRef} className={`absolute inset-0 h-full w-full ${className ?? ""}`}>
      {isContainerReady ? (
        <>
          <Map
            key="climate-studio-map" // Stable key prevents remounting on theme/view changes
            ref={mapRef}
            {...viewState}
            onMove={(evt) => onViewStateChange({ viewState: evt.viewState })}
            mapboxAccessToken={MAPBOX_ACCESS_TOKEN}
            mapStyle={mapStyle}
            style={{ width: '100%', height: '100%' }}
            // Performance optimizations
            maxTileCacheSize={100}
            attributionControl={false}
            reuseMaps={true}
          >
            {/* Add style to ensure Marker container is above DeckGL canvas */}
            <style>{`
              /* Force DeckGL canvas below everything */
              .mapboxgl-map canvas[class*="deck"] {
                z-index: 0 !important;
              }
              /* Force Marker container above all canvases */
              .mapboxgl-marker-container {
                z-index: 1000 !important;
                position: relative !important;
              }
              .mapboxgl-marker {
                z-index: 1000 !important;
              }
              /* Hide compass button */
              .mapboxgl-ctrl-compass {
                display: none !important;
              }
            `}</style>
            
            {/* DeckGL overlay - renders in separate canvas */}
            <DeckGLOverlay key={`deck-overlay-${layerRefreshKey}`} layers={layers} getTooltip={getTooltip} />
            
            {/* Metro Data Statistics labels - HTML Markers render on top of all canvas elements */}
            {megaregionLabelsGeoJSON && megaregionLabelsGeoJSON.features && megaregionLabelsGeoJSON.features.map((feature: any, index: number) => {
              const [lng, lat] = feature.geometry.coordinates
              const { name, population, percentage, isGrowing, isDecline, displayYear } = feature.properties

              const showPop = controls.megaregionShowPopulation
              const showTemp = controls.megaregionShowTemperature

              // Get temperature data from real projections
              const getTempData = (metroName: string, year: number, scenario: string) => {
                const tempData = metroTemperatureData as any
                const metro = tempData[metroName]

                console.log('🌡️ Temperature lookup:', { metroName, year, scenario, found: !!metro, availableMetros: Object.keys(tempData).slice(0, 5) })

                if (!metro || !metro.projections || !metro.projections[scenario]) {
                  // Fallback to mock data if metro not found
                  console.warn(`⚠️ Temperature data not found for ${metroName} under scenario ${scenario}`)
                  return {
                    summer: { temp: 85, change: 0 },
                    winter: { temp: 35, change: 0 }
                  }
                }

                // Find closest year in available data
                const availableYears = Object.keys(metro.projections[scenario]).map(Number).sort((a, b) => a - b)
                const closestYear = availableYears.reduce((prev, curr) =>
                  Math.abs(curr - year) < Math.abs(prev - year) ? curr : prev
                )

                const projection = metro.projections[scenario][closestYear]
                const baseline = metro.baseline_1995_2014

                // Calculate changes
                const summerChange = baseline.summer_avg
                  ? Math.round(((projection.summer_avg - baseline.summer_avg) / baseline.summer_avg) * 100)
                  : 0
                const winterChange = baseline.winter_avg
                  ? Math.round(((projection.winter_avg - baseline.winter_avg) / baseline.winter_avg) * 100)
                  : 0

                return {
                  summer: {
                    temp: Math.round(projection.summer_avg || projection.summer_max || 85),
                    change: summerChange
                  },
                  winter: {
                    temp: Math.round(projection.winter_avg || projection.winter_min || 35),
                    change: winterChange
                  }
                }
              }

              const currentYear = controls.projectionYear ?? 2050
              const scenario = controls.projectionScenario || 'ssp585'
              const tempData = getTempData(name || '', currentYear, scenario)

              // Use MetroTooltipBubble component
              return (
                <Marker key={`label-${index}`} longitude={lng} latitude={lat} anchor="center" offset={[0, 0]}>
                  <MetroTooltipBubble
                    metroName={name || 'Unknown'}
                    year={displayYear || currentYear}
                    population={population || '0'}
                    populationChange={percentage || '(+0%)'}
                    populationChangeColor={isGrowing ? '#00a03c' : isDecline ? '#ef4444' : '#666'}
                    summerTemp={`${tempData.summer.temp}°`}
                    summerTempChange={`(+${tempData.summer.change}%)`}
                    winterTemp={`${tempData.winter.temp}°`}
                    winterTempChange={`(+${tempData.winter.change}%)`}
                    visible={true}
                    showPopulation={showPop}
                    showTemperature={showTemp}
                    onClose={() => {}}
                  />
                </Marker>
              )
            })}
          </Map>
        </>
      ) : (
        <div className="h-full w-full flex items-center justify-center text-white bg-gray-900">
          Loading map...
        </div>
      )}
    </div>
  )
}
