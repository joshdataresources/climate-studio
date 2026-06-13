import { useCallback, useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { useClimate } from '@climate-studio/core'
import { useTheme } from '../../contexts/ThemeContext'
import { useMap } from '../../contexts/MapContext'
import { useClimateLayerData } from '../../hooks/useClimateLayerData'
import { resolveClimateTileUrl } from '../../config/backend'
import { destroyMap, isMapUsable, safeGetLayer, safeRemoveLayer, safeRemoveSource } from '../../utils/mapboxHelpers'

const MAPBOX_ACCESS_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN

const TEMP_SOURCE_ID = 'dashboard-temperature-tiles'
const TEMP_LAYER_ID = 'dashboard-temperature-layer'

/** Same bounds as Climate Suite (WaterAccessView). */
const MAP_MAX_BOUNDS: mapboxgl.LngLatBoundsLike = [
  [-130, 20],
  [-60, 55],
]

if (MAPBOX_ACCESS_TOKEN) {
  mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN
}

function findLabelLayerBeforeId(map: mapboxgl.Map): string | undefined {
  const labelLayerIds = [
    'waterway-label',
    'place-labels',
    'poi-label',
    'road-label',
    'settlement-label',
    'settlement-subdivision-label',
  ]
  for (const layerId of labelLayerIds) {
    if (safeGetLayer(map, layerId)) return layerId
  }
  return undefined
}

function syncTemperatureLayer(map: mapboxgl.Map, tileUrl: string, opacity: number) {
  if (!tileUrl || !isMapUsable(map)) return

  if (!map.getSource(TEMP_SOURCE_ID)) {
    map.addSource(TEMP_SOURCE_ID, {
      type: 'raster',
      tiles: [tileUrl],
      tileSize: 256,
    })
  } else {
    const source = map.getSource(TEMP_SOURCE_ID) as mapboxgl.RasterTileSource
    if (source && (source as mapboxgl.RasterTileSource & { tiles?: string[] }).tiles?.[0] !== tileUrl) {
      ;(source as mapboxgl.RasterTileSource & { setTiles: (tiles: string[]) => void }).setTiles([
        tileUrl,
      ])
    }
  }

  const beforeId = findLabelLayerBeforeId(map)

  if (!map.getLayer(TEMP_LAYER_ID)) {
    map.addLayer(
      {
        id: TEMP_LAYER_ID,
        type: 'raster',
        source: TEMP_SOURCE_ID,
        paint: {
          'raster-opacity': opacity,
          'raster-fade-duration': 300,
        },
      },
      beforeId
    )
  } else {
    map.setPaintProperty(TEMP_LAYER_ID, 'raster-opacity', opacity)
    map.setLayoutProperty(TEMP_LAYER_ID, 'visibility', 'visible')
  }
}

function removeTemperatureLayer(map: mapboxgl.Map) {
  safeRemoveLayer(map, TEMP_LAYER_ID)
  safeRemoveSource(map, TEMP_SOURCE_ID)
}

/** Fixed, non-interactive Mapbox basemap behind dashboard cards — mirrors Climate Suite viewport. */
export function DashboardMapBackground() {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const { theme } = useTheme()
  const { viewport } = useMap()
  const { controls, toggleLayer, isLayerActive } = useClimate()
  const { layers: layerStates, refreshLayer } = useClimateLayerData(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const isDark = theme === 'dark'

  const temperatureActive = isLayerActive('temperature_projection')
  const temperatureData = layerStates.temperature_projection?.data as { tile_url?: string } | undefined
  const projectionOpacity = controls.projectionOpacity ?? 0.6

  const applyTemperatureLayer = useCallback(() => {
    const map = mapRef.current
    if (!isMapUsable(map) || !temperatureActive) return

    if (!temperatureData?.tile_url) return

    const tileUrl = resolveClimateTileUrl(temperatureData.tile_url)
    syncTemperatureLayer(map, tileUrl, projectionOpacity)
  }, [temperatureActive, temperatureData, projectionOpacity])

  // Enable temperature anomaly by default on the dashboard background map
  useEffect(() => {
    if (!isLayerActive('temperature_projection')) {
      toggleLayer('temperature_projection')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!MAPBOX_ACCESS_TOKEN || !containerRef.current || mapRef.current) return

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: isDark
        ? 'mapbox://styles/mapbox/dark-v11'
        : 'mapbox://styles/mapbox/light-v11',
      center: [viewport.center.lng, viewport.center.lat],
      zoom: viewport.zoom,
      maxBounds: MAP_MAX_BOUNDS,
      minZoom: 3,
      interactive: false,
      attributionControl: false,
      logoPosition: 'bottom-left',
    })

    mapRef.current = map

    map.on('load', () => {
      setMapLoaded(true)
      map.resize()
    })

    const resizeObserver = new ResizeObserver(() => {
      if (mapRef.current && !mapRef.current._removed) {
        mapRef.current.resize()
      }
    })
    resizeObserver.observe(containerRef.current)

    return () => {
      resizeObserver.disconnect()
      const mapInstance = mapRef.current
      mapRef.current = null
      setMapLoaded(false)
      if (mapInstance) {
        removeTemperatureLayer(mapInstance)
        destroyMap(mapInstance)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keep in sync with Climate Suite map viewport (shared MapContext)
  useEffect(() => {
    const map = mapRef.current
    if (!isMapUsable(map) || !mapLoaded) return

    const currentCenter = map.getCenter()
    const currentZoom = map.getZoom()
    if (
      Math.abs(currentCenter.lat - viewport.center.lat) > 0.001 ||
      Math.abs(currentCenter.lng - viewport.center.lng) > 0.001 ||
      Math.abs(currentZoom - viewport.zoom) > 0.1
    ) {
      map.jumpTo({
        center: [viewport.center.lng, viewport.center.lat],
        zoom: viewport.zoom,
      })
    }
  }, [viewport, mapLoaded])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoaded) return

    const nextStyle = isDark
      ? 'mapbox://styles/mapbox/dark-v11'
      : 'mapbox://styles/mapbox/light-v11'
    const sprite = map.getStyle()?.sprite ?? ''
    const isCurrentlyDark = sprite.includes('dark')
    if (isCurrentlyDark === isDark) return

    map.setStyle(nextStyle)
    map.once('style.load', () => {
      applyTemperatureLayer()
    })
  }, [isDark, mapLoaded, applyTemperatureLayer])

  useEffect(() => {
    const map = mapRef.current
    if (!isMapUsable(map) || !mapLoaded) return

    if (!temperatureActive) {
      safeRemoveLayer(map, TEMP_LAYER_ID)
      return
    }

    if (!temperatureData?.tile_url) {
      const retryTimer = window.setTimeout(() => {
        refreshLayer('temperature_projection')
      }, 5000)
      return () => window.clearTimeout(retryTimer)
    }

    if (map.isStyleLoaded()) {
      applyTemperatureLayer()
    } else {
      map.once('style.load', applyTemperatureLayer)
    }
  }, [
    mapLoaded,
    temperatureActive,
    temperatureData,
    projectionOpacity,
    applyTemperatureLayer,
    refreshLayer,
  ])

  useEffect(() => {
    return () => {
      const mapInstance = mapRef.current
      if (mapInstance) {
        removeTemperatureLayer(mapInstance)
      }
    }
  }, [])

  if (!MAPBOX_ACCESS_TOKEN) return null

  return (
    <div
      ref={containerRef}
      className="dashboard-map-background"
      aria-hidden
    />
  )
}
