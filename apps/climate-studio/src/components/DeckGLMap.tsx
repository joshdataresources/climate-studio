"use client"

import { useEffect, useMemo, useRef, useState, useCallback } from "react"
import { Map, useControl, Source, Layer } from 'react-map-gl'
import { MapboxOverlay } from '@deck.gl/mapbox'
import { GeoJsonLayer, BitmapLayer, TextLayer } from '@deck.gl/layers'
import { HeatmapLayer } from '@deck.gl/aggregation-layers'
import { TileLayer } from '@deck.gl/geo-layers'
import type { MapViewState } from '@deck.gl/core'
import { useClimate } from "@climate-studio/core"
import type { LayerStateMap } from "../hooks/useClimateLayerData"
import { getClimateLayer } from "@climate-studio/core/config"
import megaregionData from "../data/megaregion-data.json"
import 'mapbox-gl/dist/mapbox-gl.css'

function DeckGLOverlay(props: { layers: any[] }) {
  const overlay = useControl<MapboxOverlay>(() => new MapboxOverlay(props))
  overlay.setProps(props)
  return null
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
const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001'

export function DeckGLMap({
  className,
  center,
  zoom,
  onViewportChange,
  onMapBoundsChange,
  layerStates,
}: DeckGLMapProps) {
  const { controls, isLayerActive } = useClimate()

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
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0
  })

  // Measure container size and update on resize
  useEffect(() => {
    if (!containerRef.current) {
      console.log('🔍 DeckGLMap: containerRef not ready')
      return
    }

    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        console.log('🔍 Container dimensions measured:', rect.width, 'x', rect.height)
        setDimensions({ width: rect.width, height: rect.height })
      }
    }

    // Initial measurement
    console.log('🔍 Starting initial dimension measurement')
    updateDimensions()

    // Watch for resize
    const resizeObserver = new ResizeObserver(updateDimensions)
    resizeObserver.observe(containerRef.current)
    console.log('🔍 ResizeObserver attached')

    return () => {
      console.log('🔍 ResizeObserver disconnecting')
      resizeObserver.disconnect()
    }
  }, [])

  // Update viewState when props change
  useEffect(() => {
    setViewState(prev => ({
      ...prev,
      longitude: center.lng,
      latitude: center.lat,
      zoom: zoom,
    }))
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
    if (!mapRef.current) return

    const timer = setTimeout(() => {
      updateBounds()
    }, 100) // Small delay to ensure map is fully initialized

    return () => clearTimeout(timer)
  }, [updateBounds, dimensions])

  const onViewStateChange = ({ viewState: newViewState }: { viewState: MapViewState }) => {
    setViewState(newViewState)
    onViewportChange?.({
      center: { lat: newViewState.latitude, lng: newViewState.longitude },
      zoom: newViewState.zoom,
    })
  }


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

  // Temperature Projection Tile Layer - raster tiles from Earth Engine
  const temperatureProjectionTileLayer = useMemo(() => {
    if (!isLayerActive("temperature_projection")) return null
    const data = layerStates.temperature_projection?.data as any
    if (!data || !data.tile_url) return null

    return new TileLayer({
      id: 'temperature-projection-tiles',
      data: data.tile_url,
      minZoom: 0,
      maxZoom: 19,
      tileSize: 256,
      opacity: controls.projectionOpacity ?? 0.1,
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
        const { boundingBox } = props.tile
        return new BitmapLayer(props, {
          data: null,
          image: props.data,
          bounds: [boundingBox[0][0], boundingBox[0][1], boundingBox[1][0], boundingBox[1][1]],
          visible: true,
          desaturate: 0,
          tintColor: [255, 255, 255]
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
    controls.projectionOpacity
  ])

  // Precipitation & Drought Tile Layer - raster tiles from Earth Engine
  const precipitationDroughtTileLayer = useMemo(() => {
    if (!isLayerActive("precipitation_drought")) return null
    const data = layerStates.precipitation_drought?.data as any
    if (!data || !data.tile_url) return null

    return new TileLayer({
      id: 'precipitation-drought-tiles',
      data: data.tile_url,
      minZoom: 0,
      maxZoom: 19,
      tileSize: 256,
      opacity: controls.droughtOpacity ?? 0.7,
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
        const { boundingBox } = props.tile
        return new BitmapLayer(props, {
          data: null,
          image: props.data,
          bounds: [boundingBox[0][0], boundingBox[0][1], boundingBox[1][0], boundingBox[1][1]],
          visible: true,
          desaturate: 0,
          tintColor: [255, 255, 255]
        })
      },
      pickable: false,
      updateTriggers: {
        opacity: controls.droughtOpacity
      }
    })
  }, [
    isLayerActive("precipitation_drought"),
    layerStates.precipitation_drought,
    controls.droughtOpacity
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
        const { boundingBox } = props.tile
        return new BitmapLayer(props, {
          data: null,
          image: props.data,
          bounds: [boundingBox[0][0], boundingBox[0][1], boundingBox[1][0], boundingBox[1][1]],
          visible: true,
          desaturate: 0,
          tintColor: [255, 255, 255]
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

    const opacityValue = controls.reliefOpacity ?? 0.5
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
        const { boundingBox } = props.tile
        const bounds = [boundingBox[0][0], boundingBox[0][1], boundingBox[1][0], boundingBox[1][1]]
        console.log('🏔️ Rendering topographic sublayer:', {
          index: props.tile.index,
          hasData: !!props.data,
          dataType: typeof props.data,
          isImage: props.data instanceof HTMLImageElement,
          imageWidth: props.data?.width,
          imageHeight: props.data?.height,
          bounds: bounds,
          boundingBox: boundingBox,
          tileOpacity: props.opacity,
          layerOpacity: opacityValue
        })

        const bitmapLayer = new BitmapLayer(props, {
          data: null,
          image: props.data,
          bounds: bounds,
          opacity: opacityValue,
          visible: true,
          desaturate: 0,
          tintColor: [255, 255, 255]
        })

        console.log('🏔️ BitmapLayer created:', {
          id: bitmapLayer.id,
          visible: bitmapLayer.props.visible,
          opacity: bitmapLayer.props.opacity
        })

        return bitmapLayer
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

  // Megaregion Timeseries Layer - GeoJSON polygons from local data
  const megaregionLayer = useMemo(() => {
    console.log('🌐 Megaregion Layer Check:', {
      isActive: isLayerActive("megaregion_timeseries"),
      projectionYear: controls.projectionYear,
      opacity: controls.megaregionOpacity
    })
    if (!isLayerActive("megaregion_timeseries")) return null

    // Helper functions from MegaregionLayer.tsx
    const populationToRadius = (population: number): number => {
      const scaleFactor = 0.015
      const baseRadius = Math.sqrt(population) * scaleFactor
      return Math.max(baseRadius, 30)
    }

    const getGrowthColor = (currentPop: number, previousPop: number): [number, number, number, number] => {
      if (!previousPop || previousPop === 0) return [136, 136, 136, 255]

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

    // Get year from controls
    const year = controls.projectionYear ?? 2050
    const availableYears = [2025, 2035, 2045, 2055, 2065, 2075, 2085, 2095]
    const closestYear = availableYears.reduce((prev, curr) =>
      Math.abs(curr - year) < Math.abs(prev - year) ? curr : prev
    )
    const yearIndex = availableYears.indexOf(closestYear)
    const previousYear = yearIndex > 0 ? availableYears[yearIndex - 1] : null

    // Convert megaregion data to GeoJSON
    const data = megaregionData as any
    const features = data.metros.map((metro: any) => {
      const currentPop = metro.populations[String(closestYear)]
      const previousPop = previousYear ? metro.populations[String(previousYear)] : null
      const radius = populationToRadius(currentPop)
      const color = getGrowthColor(currentPop, previousPop || 0)
      const growthRate = previousPop ? ((currentPop - previousPop) / previousPop * 100) : 0

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
          growthRate: growthRate,
          climate_risk: metro.climate_risk,
          region: metro.region,
          megaregion: metro.megaregion,
          color: color,
          // Label data
          coordinates: [metro.lon, metro.lat]
        }
      }
    })

    const geojson = {
      type: 'FeatureCollection',
      features: features
    }

    console.log('✅ Creating Megaregion GeoJSON Layer:', {
      featureCount: features.length,
      year: closestYear,
      opacity: controls.megaregionOpacity,
      firstFeature: features[0]
    })

    return new GeoJsonLayer({
      id: 'megaregion-layer',
      data: geojson,
      pickable: true,
      stroked: true,
      filled: true,
      getFillColor: (d: any) => d.properties.color,
      getLineColor: [100, 100, 100, 255],
      getLineWidth: 1,
      opacity: controls.megaregionOpacity ?? 0.6
    })
  }, [
    isLayerActive("megaregion_timeseries"),
    controls.projectionYear,
    controls.megaregionOpacity
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

  // Megaregion Circles Layer (DeckGL GeoJsonLayer)
  const megaregionCirclesLayer = useMemo(() => {
    if (!isLayerActive("megaregion_timeseries")) return null

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
    const features = data.metros.map((metro: any) => {
      const currentPop = metro.populations[String(displayYear)]
      // For 2025, previousPop is 0 (no comparison). For all other years, compare to previous decade.
      const previousPop = previousYear ? (metro.populations[String(previousYear)] || 0) : 0
      const radius = populationToRadius(currentPop)
      const colorRGBA = getGrowthColorRGBA(currentPop, previousPop)

      return {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [createCircle(metro.lon, metro.lat, radius)]
        },
        properties: {
          name: metro.name,
          population: currentPop,
          radius: radius,
          fillColor: colorRGBA,
          lineColor: colorRGBA,
          center: [metro.lon, metro.lat]
        }
      }
    })

    const geojson = {
      type: 'FeatureCollection',
      features
    }

    return new GeoJsonLayer({
      id: 'megaregion-circles',
      data: geojson,
      filled: true,
      stroked: true,
      getFillColor: (d: any) => d.properties.fillColor,
      getLineColor: (d: any) => d.properties.lineColor,
      getLineWidth: 2,
      lineWidthUnits: 'pixels',
      opacity: controls.megaregionOpacity * 0.8,
      pickable: true,
      updateTriggers: {
        getFillColor: [closestYear],
        getLineColor: [closestYear],
        opacity: controls.megaregionOpacity
      }
    })
  }, [
    isLayerActive("megaregion_timeseries"),
    controls.projectionYear,
    controls.megaregionOpacity
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
    const features = data.metros.map((metro: any) => {
      const currentPop = metro.populations[String(displayYear)]
      const previousPop = previousYear ? metro.populations[String(previousYear)] : null
      const growthRate = previousPop ? ((currentPop - previousPop) / previousPop * 100) : 0
      const absoluteChange = previousPop ? (currentPop - previousPop) : 0

      // Format population with commas
      const formattedPop = currentPop.toLocaleString('en-US')

      // Show growth if we have previous data to compare with
      const showGrowth = previousPop !== null && previousPop !== currentPop
      const triangle = growthRate > 0 ? '▲' : growthRate < 0 ? '▼' : '='

      // Format: "+50,000 (+5%▲)" or "-30,000 (-3%▼)"
      const formattedChange = Math.abs(absoluteChange).toLocaleString('en-US')
      const changeText = showGrowth
        ? `${growthRate >= 0 ? '+' : '-'}${formattedChange} (${growthRate >= 0 ? '+' : ''}${Math.abs(growthRate).toFixed(0)}%${triangle})`
        : ''

      const isGrowing = growthRate > 0
      const isDecline = growthRate < 0

      return {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [metro.lon, metro.lat]
        },
        properties: {
          population: formattedPop,
          change: changeText,
          isGrowing,
          isDecline,
          showGrowth
        }
      }
    })

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
      return new TileLayer({
        id: 'sea-level-rise-tiles',
        data: `${backendUrl}/api/tiles/noaa-slr/${feet}/{z}/{x}/{y}.png`,
        minZoom: 0,
        maxZoom: 16,
        tileSize: 256,
        opacity: controls.seaLevelOpacity ?? 0.3,
        renderSubLayers: (props: any) => {
          const { boundingBox } = props.tile
          return new BitmapLayer(props, {
            data: null,
            image: props.data,
            bounds: [boundingBox[0][0], boundingBox[0][1], boundingBox[1][0], boundingBox[1][1]],
            visible: true,
            desaturate: 0,
            tintColor: [255, 255, 255]
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
  // Population labels render via Mapbox (after DeckGL) to ensure they appear on top
  const layers = [
    topographicReliefTileLayer,    // 1. Bottom - Topographic Relief
    seaLevelTileLayer,             // 2. Sea Level Rise
    precipitationDroughtTileLayer, // 3. Precipitation & Drought
    temperatureProjectionTileLayer, // 4. Future Temperature Anomaly
    urbanHeatTileLayer,            // 5. Urban Heat Island (Heat Map)
    urbanExpansionLayer,           // 6. Urban Expansion (if present)
    temperatureHeatmapLayer,       // 7. Temperature Heatmap (if present)
    megaregionCirclesLayer,        // 8. Population Migration circles
  ].filter(Boolean)

  console.log('🗺️ DeckGL Layers:', {
    total: layers.length,
    layerTypes: layers.map((l: any) => l?.id || 'unknown'),
    seaLevel: !!seaLevelTileLayer,
    topographic: !!topographicReliefTileLayer,
    temperature: !!temperatureProjectionTileLayer,
    precipitation: !!precipitationDroughtTileLayer,
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
      hasTileUrl: !!layerStates.precipitation_drought?.data?.tile_url,
      tileUrl: layerStates.precipitation_drought?.data?.tile_url?.substring(0, 100)
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
    <div ref={containerRef} className={`h-full w-full ${className ?? ""} relative`}>
      {dimensions.width > 0 && dimensions.height > 0 ? (
        <>
          {console.log('🎨 Rendering Map with DeckGL Overlay, dimensions:', dimensions.width, 'x', dimensions.height)}
          <Map
            ref={mapRef}
            {...viewState}
            onMove={(evt) => {
              setViewState(evt.viewState)
              onViewportChange?.({
                center: { lat: evt.viewState.latitude, lng: evt.viewState.longitude },
                zoom: evt.viewState.zoom
              })
              updateBounds()
            }}
            mapboxAccessToken={MAPBOX_ACCESS_TOKEN}
            mapStyle="mapbox://styles/mapbox/dark-v11"
            style={{ width: dimensions.width, height: dimensions.height }}
          >
            <DeckGLOverlay layers={layers} />
          </Map>

          {/* Population labels in separate overlay on top - pointer-events-none to allow map interaction */}
          {megaregionLabelsGeoJSON && (
            <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 1000 }}>
              <Map
                {...viewState}
                mapboxAccessToken={MAPBOX_ACCESS_TOKEN}
                mapStyle="mapbox://styles/mapbox/empty-v9"
                style={{ width: dimensions.width, height: dimensions.height }}
                interactive={false}
              >
                <Source id="megaregion-labels" type="geojson" data={megaregionLabelsGeoJSON}>
                  <Layer
                    id="megaregion-population-labels"
                    type="symbol"
                    layout={{
                      'text-field': ['get', 'population'],
                      'text-size': 16,
                      'text-anchor': 'center',
                      'text-offset': [0, -0.3],
                      'text-allow-overlap': true,
                      'text-ignore-placement': true
                    }}
                    paint={{
                      'text-color': '#ffffff',
                      'text-halo-color': '#000000',
                      'text-halo-width': 1.5,
                      'text-opacity': 1.0
                    }}
                  />
                  <Layer
                    id="megaregion-change-labels"
                    type="symbol"
                    filter={['==', ['get', 'showGrowth'], true]}
                    layout={{
                      'text-field': ['get', 'change'],
                      'text-size': 12,
                      'text-anchor': 'center',
                      'text-offset': [0, 0.6],
                      'text-allow-overlap': true,
                      'text-ignore-placement': true
                    }}
                    paint={{
                      'text-color': [
                        'case',
                        ['==', ['get', 'isGrowing'], true],
                        '#10b981',
                        ['==', ['get', 'isDecline'], true],
                        '#ef4444',
                        '#888888'
                      ],
                      'text-halo-color': '#000000',
                      'text-halo-width': 1.5,
                      'text-opacity': 1.0
                    }}
                  />
                </Source>
              </Map>
            </div>
          )}
        </>
      ) : (
        <>
          {console.log('⚠️ Not rendering DeckGL - dimensions:', dimensions.width, 'x', dimensions.height)}
          <div className="h-full w-full flex items-center justify-center text-white bg-gray-900">
            Waiting for container dimensions...
          </div>
        </>
      )}
    </div>
  )
}
