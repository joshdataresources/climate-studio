"use client"

import React, { useCallback, useMemo, useRef, useState, useEffect } from "react"
import { LayerControlsPanel, LayerPanel } from "./layer-panel"
import { MapboxGlobe } from "./MapboxGlobe"
import { DeckGLMap } from "./DeckGLMap"
import { EarthEngineStatus } from "./EarthEngineStatus"
import { BackendHealthIndicator } from "./BackendHealthIndicator"
import { MetroUnifiedPopup } from "./MetroUnifiedPopup"
import { SearchAndViewsPanel } from "./panels/SearchAndViewsPanel"
import { ClimateProjectionsWidget } from "./ClimateProjectionsWidget"
import { climateLayers } from "@climate-studio/core/config"
import type { ClimateControl } from "@climate-studio/core/config"
import { useClimate } from "@climate-studio/core"
import { useClimateLayerData } from "../hooks/useClimateLayerData"
import { useMap } from "../contexts/MapContext"
import { useTheme } from "../contexts/ThemeContext"
import { useSidebar } from "../contexts/SidebarContext"
import { useLayer } from "../contexts/LayerContext"
import { shouldShowClimateWidget } from "../config/layerDefinitions"
import { LatLngBoundsLiteral } from "../types/geography"
import { ChevronLeft, ChevronRight } from "lucide-react"

export function GISAnalysisApp() {
  const { theme } = useTheme()
  const { activeLayerIds, controls, setActiveLayerIds } = useClimate()
  const {
    viewport,
    setViewport,
  } = useMap()
  const { panelsCollapsed } = useSidebar()
  const { getEnabledLayersForView } = useLayer()

  const [mapBounds, setMapBounds] = useState<LatLngBoundsLiteral | null>(null)
  const [selectedMetro, setSelectedMetro] = useState<string | null>(null)

  const { layers: layerStates } = useClimateLayerData(mapBounds)

  const hasLayerControls = useMemo(
    () =>
      climateLayers
        .filter(layer => activeLayerIds.includes(layer.id))
        .some(layer => layer.controls.length > 0),
    [activeLayerIds]
  )

  const activeLayers = useMemo(
    () => climateLayers.filter(layer => activeLayerIds.includes(layer.id)),
    [activeLayerIds]
  )

  type ControlSnapshot = { control: ClimateControl; label: string; value: string }

  const formatControlSnapshot = useCallback(
    (control: ClimateControl, layerId?: string) => {
      switch (control) {
        case "scenario":
          return { label: "Scenario", value: controls.scenario.toUpperCase() }
        case "projectionYear": {
          return {
            label: "Projection Year",
            value: `${controls.projectionYear}`
          }
        }
        case "temperatureMode": {
          return null  // Hide temperature mode from scenario snapshot (duplicative)
        }
        case "seaLevelFeet":
          return { label: "Sea Level Rise", value: `${controls.seaLevelFeet} ft` }
        case "analysisDate": {
          const parsed = new Date(controls.analysisDate)
          const formatted = Number.isNaN(parsed.getTime())
            ? controls.analysisDate
            : parsed.toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })
          return { label: "Last captured", value: formatted }
        }
        case "displayStyle": {
          const label = controls.displayStyle === "confidence" ? "Confidence Extent" : "Depth Grid"
          return { label: "Display Style", value: label }
        }
        case "droughtMetric": {
          const metricLabels = {
            precipitation: "Precipitation",
            drought_index: "Drought Index",
            soil_moisture: "Soil Moisture"
          }
          return {
            label: "Drought Metric",
            value: metricLabels[controls.droughtMetric]
          }
        }
        // Hide opacity controls and other settings
        case "seaLevelOpacity":
        case "projectionOpacity":
        case "urbanHeatOpacity":
        case "reliefOpacity":
        case "droughtOpacity":
        case "resolution":
        case "urbanHeatSeason":
        case "urbanHeatColorScheme":
        case "reliefStyle":
          return null
        default:
          return null
      }
    },
    [controls]
  )

  // Calculate suggested sea level rise based on temperature projection
  const getSuggestedSeaLevelRise = useCallback(() => {
    const yearsSince2025 = controls.projectionYear - 2025
    let tempChange = 0

    // Estimate based on scenario
    if (controls.scenario === 'rcp26' || controls.scenario === 'ssp126') {
      tempChange = (yearsSince2025 / 75) * 2.0 // ~2°C by 2100
    } else if (controls.scenario === 'rcp45' || controls.scenario === 'ssp245') {
      tempChange = (yearsSince2025 / 75) * 3.2 // ~3.2°C by 2100
    } else if (controls.scenario === 'rcp85' || controls.scenario === 'ssp585') {
      tempChange = (yearsSince2025 / 75) * 4.8 // ~4.8°C by 2100
    }

    // Estimate sea level rise (roughly 20cm per 1°C warming)
    const estimatedSeaLevelFt = Math.round((tempChange * 0.2 * 3.28084) * 10) / 10 // meters to feet

    return {
      tempChange: tempChange.toFixed(1),
      seaLevelFt: estimatedSeaLevelFt.toFixed(1)
    }
  }, [controls.projectionYear, controls.scenario])

  // Calculate average temperature in current viewport
  const getViewportAverageTemp = useCallback(() => {
    // Only calculate if zoomed in to 9.0 or closer
    if (viewport.zoom < 9.0) {
      return null
    }

    const tempData = layerStates.temperature_projection?.data
    if (!tempData || !tempData.features || tempData.features.length === 0) {
      return null
    }

    // Get temperature values from features
    const temps: number[] = []
    tempData.features.forEach((feature: any) => {
      const temp = controls.temperatureMode === 'actual'
        ? feature.properties?.projected
        : feature.properties?.tempAnomaly

      if (temp !== undefined && temp !== null) {
        temps.push(temp)
      }
    })

    if (temps.length === 0) {
      return null
    }

    const avgTemp = temps.reduce((sum, t) => sum + t, 0) / temps.length
    return avgTemp.toFixed(1)
  }, [viewport.zoom, layerStates.temperature_projection?.data, controls.temperatureMode])

  const handleBoundsChange = useCallback((bounds: LatLngBoundsLiteral) => {
    setMapBounds(prev => ({ ...bounds, zoom: viewport.zoom }))
  }, [viewport.zoom])

  const handleViewportChange = useCallback((nextViewport: { center: { lat: number; lng: number }; zoom: number }) => {
    setViewport(nextViewport)
    // Update bounds with new zoom level
    setMapBounds(prev => prev ? { ...prev, zoom: nextViewport.zoom } : null)
  }, [setViewport])

  // Removed auto-geolocation to always use default East Coast view
  // Users can search for their location if needed
  React.useEffect(() => {
    // No-op: keeping viewport at default East Coast view
  }, [])

  // Check if Climate Projections widget should be shown
  const enabledLayers = getEnabledLayersForView('climate')
  const enabledLayerIds = enabledLayers.map(l => l.id)
  const showClimateWidget = shouldShowClimateWidget(enabledLayerIds)

  return (
    <div className="relative h-full w-full text-foreground">
      {/* Earth Engine Status Indicator */}
      <EarthEngineStatus />

      {/* Backend Health Indicator */}
      <BackendHealthIndicator />

      <main className="absolute inset-0 h-full w-full">
        {/* Climate Projections Widget - Top Right */}
        {showClimateWidget && !panelsCollapsed && (
          <div className="absolute top-4 right-4 z-[1100] w-80 pointer-events-auto transition-all duration-300 animate-in fade-in slide-in-from-right-10">
            <ClimateProjectionsWidget />
          </div>
        )}

        {/* Layer Controls Panel - Below Climate Widget if both visible */}
        {hasLayerControls && !panelsCollapsed && (
          <div className={`absolute right-4 z-[1100] w-80 pointer-events-auto space-y-4 transition-all duration-300 animate-in fade-in slide-in-from-right-10 ${showClimateWidget ? 'top-[340px]' : 'top-4'}`}>
            <LayerControlsPanel layerStates={layerStates} />
          </div>
        )}
        <DeckGLMap
          center={viewport.center}
          zoom={viewport.zoom}
          onViewportChange={handleViewportChange}
          onMapBoundsChange={handleBoundsChange}
          onMetroClick={setSelectedMetro}
          layerStates={layerStates}
          className="absolute inset-0"
        />

        {/* Metro Unified Popup */}
        {selectedMetro && (
          <MetroUnifiedPopup
            metroName={selectedMetro}
            visible={!!selectedMetro}
            onClose={() => setSelectedMetro(null)}
          />
        )}
      </main>

      {!panelsCollapsed && (
      <aside className="absolute left-[92px] top-4 z-[1000] w-[360px] pointer-events-none transition-all duration-300 animate-in fade-in slide-in-from-left-10">
        <div className="space-y-4 pointer-events-auto">
          <SearchAndViewsPanel
            viewType="climate"
            searchPlaceholder="Search for a city, state, or country"
            activeLayerIds={activeLayerIds}
            controls={controls}
          />

          <section className="widget-container widget-container-no-padding">
            <LayerPanel layerStates={layerStates} />
          </section>

        </div>
      </aside>
      )}

    </div>
  )
}
