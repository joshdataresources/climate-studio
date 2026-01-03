"use client"

import React, { useCallback, useMemo, useRef, useState, useEffect } from "react"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { LayerControlsPanel, LayerPanel } from "./layer-panel"
import { MapboxGlobe } from "./MapboxGlobe"
import { DeckGLMap } from "./DeckGLMap"
import { EarthEngineStatus } from "./EarthEngineStatus"
import { BackendHealthIndicator } from "./BackendHealthIndicator"
import { climateLayers } from "@climate-studio/core/config"
import type { ClimateControl } from "@climate-studio/core/config"
import { useClimate } from "@climate-studio/core"
import { useClimateLayerData } from "../hooks/useClimateLayerData"
import { useMap } from "../contexts/MapContext"
import { LatLngBoundsLiteral } from "../types/geography"
import { Loader2, MapPin, Search, Save, Bookmark, GripVertical, MoreHorizontal, Trash2, Pencil } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface GeoSearchResult {
  display_name: string
  lat: string
  lon: string
  boundingbox?: [string, string, string, string]
}

interface ViewportState {
  center: { lat: number; lng: number }
  zoom: number
}

interface SavedView {
  id: string
  name: string
  viewport: ViewportState
  activeLayerIds: string[]
  controls: any
}

interface SortableViewItemProps {
  view: SavedView
  hasViewChanged: (view: SavedView) => boolean
  loadSavedView: (view: SavedView) => void
  updateSavedView: (id: string) => void
  deleteSavedView: (id: string) => void
  editSavedView: (id: string) => void
  editingViewId: string | null
  editingViewName: string
  setEditingViewName: (name: string) => void
  saveEditedViewName: () => void
  cancelEdit: () => void
}

function SortableViewItem({ view, hasViewChanged, loadSavedView, updateSavedView, deleteSavedView, editSavedView, editingViewId, editingViewName, setEditingViewName, saveEditedViewName, cancelEdit }: SortableViewItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: view.id })

  const isEditing = editingViewId === view.id

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  if (isEditing) {
    return (
      <li ref={setNodeRef} className="flex items-center gap-2 p-2 rounded-md border border-border/60 bg-background/50">
        <Input
          value={editingViewName}
          onChange={e => setEditingViewName(e.target.value)}
          placeholder="Enter view name..."
          className="h-8 text-sm flex-1 border-none bg-transparent px-2"
          onKeyDown={e => {
            if (e.key === 'Enter') saveEditedViewName()
            if (e.key === 'Escape') cancelEdit()
          }}
          autoFocus
        />
        <Button
          size="sm"
          className="h-8 w-8 p-0 bg-blue-500 hover:bg-blue-600"
          onClick={saveEditedViewName}
          title="Save name"
        >
          <Save className="h-3.5 w-3.5 text-white" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 w-8 p-0"
          onClick={cancelEdit}
          title="Cancel"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </li>
    )
  }

  return (
    <li ref={setNodeRef} style={style} className="flex items-center gap-1">
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing p-2 touch-none"
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>
      <button
        onClick={() => loadSavedView(view)}
        className="flex flex-1 items-center gap-2 rounded-md border-0 h-9 px-4 py-2 text-left text-sm hover:bg-white/5"
      >
        <Bookmark className="h-4 w-4 text-blue-500 flex-shrink-0" />
        <span className="flex-1 truncate">{view.name}</span>
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => editSavedView(view.id)}>
            <Pencil className="h-4 w-4 mr-2" />
            Edit Name
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => deleteSavedView(view.id)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  )
}

export function GISAnalysisApp() {
  const { activeLayerIds, controls, setActiveLayerIds } = useClimate()
  const {
    viewport,
    setViewport,
    searchTerm,
    setSearchTerm,
    searchResults,
    isSearching,
    executeSearch,
    moveToResult,
    savedViews,
    setSavedViews,
    loadSavedView: loadSavedViewFromContext,
    saveCurrentView: saveCurrentViewToContext,
    deleteSavedView: deleteSavedViewFromContext,
    updateSavedViewName,
  } = useMap()
  
  const [mapBounds, setMapBounds] = useState<LatLngBoundsLiteral | null>(null)
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [newViewName, setNewViewName] = useState("")
  const [editingViewId, setEditingViewId] = useState<string | null>(null)
  const [editingViewName, setEditingViewName] = useState("")

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

  const handleViewportChange = useCallback((nextViewport: ViewportState) => {
    setViewport(nextViewport)
    // Update bounds with new zoom level
    setMapBounds(prev => prev ? { ...prev, zoom: nextViewport.zoom } : null)
  }, [])

  // executeSearch is now provided by the shared MapContext

  const handleSearchSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      executeSearch(searchTerm)
    },
    [executeSearch, searchTerm]
  )

  // moveToResult is now provided by the shared MapContext

  // Use shared context functions with local wrappers for compatibility
  const loadSavedView = useCallback((view: SavedView) => {
    loadSavedViewFromContext(view)
  }, [loadSavedViewFromContext])

  const saveCurrentView = useCallback(() => {
    if (!newViewName.trim()) return
    saveCurrentViewToContext(newViewName, activeLayerIds, controls)
    setNewViewName("")
    setShowSaveDialog(false)
  }, [newViewName, activeLayerIds, controls, saveCurrentViewToContext])

  const deleteSavedView = useCallback((viewId: string) => {
    deleteSavedViewFromContext(viewId)
  }, [deleteSavedViewFromContext])

  const updateSavedView = useCallback((viewId: string) => {
    // For now just update the saved view name since viewport is handled by context
  }, [])

  const hasViewChanged = useCallback((view: SavedView) => {
    return viewport.center.lat !== view.viewport.center.lat ||
           viewport.center.lng !== view.viewport.center.lng ||
           viewport.zoom !== view.viewport.zoom
  }, [viewport])

  const editSavedView = useCallback((viewId: string) => {
    const view = savedViews.find(v => v.id === viewId)
    if (view) {
      setEditingViewId(viewId)
      setEditingViewName(view.name)
    }
  }, [savedViews])

  const saveEditedViewName = useCallback(() => {
    if (!editingViewId || !editingViewName.trim()) return
    updateSavedViewName(editingViewId, editingViewName)
    setEditingViewId(null)
    setEditingViewName("")
  }, [editingViewId, editingViewName, updateSavedViewName])

  const cancelEdit = useCallback(() => {
    setEditingViewId(null)
    setEditingViewName("")
  }, [])

  // Saved views are now loaded from shared MapContext

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event

    if (!over || active.id === over.id) return

    const oldIndex = savedViews.findIndex((item) => item.id === active.id)
    const newIndex = savedViews.findIndex((item) => item.id === over.id)

    if (oldIndex === -1 || newIndex === -1) return

    const reordered = arrayMove(savedViews, oldIndex, newIndex)
    setSavedViews(reordered)
  }, [savedViews, setSavedViews])

  const handleDragStart = useCallback(() => {
    // Cancel any editing when drag starts
    if (editingViewId) {
      setEditingViewId(null)
      setEditingViewName("")
    }
  }, [editingViewId])

  // Removed auto-geolocation to always use default East Coast view
  // Users can search for their location if needed
  React.useEffect(() => {
    // No-op: keeping viewport at default East Coast view
  }, [])

  return (
    <div className="relative h-full w-full text-foreground">
      {/* Earth Engine Status Indicator */}
      <EarthEngineStatus />
      
      {/* Backend Health Indicator */}
      <BackendHealthIndicator />

      <main className="absolute inset-0 h-full w-full">
        {hasLayerControls && (
          <div className="absolute top-4 right-4 z-[1100] w-80 pointer-events-auto space-y-4">
            <LayerControlsPanel layerStates={layerStates} />
          </div>
        )}
        <DeckGLMap
          center={viewport.center}
          zoom={viewport.zoom}
          onViewportChange={handleViewportChange}
          onMapBoundsChange={handleBoundsChange}
          layerStates={layerStates}
          className="absolute inset-0"
        />
      </main>

      <aside className="absolute left-4 top-4 z-[1000] w-[360px] pointer-events-none">
        <div className="space-y-4 pointer-events-auto">
          <div className="widget-container">
            <form className="flex gap-2" onSubmit={handleSearchSubmit}>
              <div className="relative flex-1">
                <Input
                  value={searchTerm}
                  onChange={event => setSearchTerm(event.target.value)}
                  placeholder="Search for a city, state, or country"
                  className="pr-10"
                />
                <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              </div>
              <Button
                type="submit"
                variant="secondary"
                disabled={isSearching}
              >
                {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
              </Button>
            </form>

            {searchResults.length > 0 && (
              <div className="mt-3 space-y-2 border-t border-border/60 pt-3">
                <div className="text-xs font-semibold uppercase text-muted-foreground">Search results</div>
                <ul className="space-y-2">
                  {searchResults.map(result => (
                    <li key={`${result.lat}-${result.lon}`}>
                      <button
                        onClick={() => moveToResult(result)}
                        className="flex w-full items-start gap-2 rounded-md border border-transparent p-2 text-left text-sm hover:border-border hover:bg-background/80"
                      >
                        <MapPin className="mt-0.5 h-4 w-4 text-blue-500" />
                        <span>{result.display_name}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Saved Views Section */}
            <div className="mt-3 space-y-2 border-t border-border/60 pt-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Views</h3>
                <Button
                  size="sm"
                  variant="text"
                  className="h-6 px-2 text-xs"
                  onClick={() => setShowSaveDialog(true)}
                >
                  <Save className="h-3 w-3 mr-1" />
                  New View
                </Button>
              </div>

{savedViews.length === 0 && !showSaveDialog ? (
                <p className="text-xs text-muted-foreground py-4">
                  You have no saved views. Click "New View" to save your first view.
                </p>
              ) : (
                <div 
                  className="rounded-md border border-[var(--cs-border-default)] bg-[var(--cs-surface-elevated)] p-2"
                >
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext
                      items={savedViews.map(v => v.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <ul className="space-y-1">
                      {savedViews.map(view => (
                        <SortableViewItem
                          key={view.id}
                          view={view}
                          hasViewChanged={hasViewChanged}
                          loadSavedView={loadSavedView}
                          updateSavedView={updateSavedView}
                          deleteSavedView={deleteSavedView}
                          editSavedView={editSavedView}
                          editingViewId={editingViewId}
                          editingViewName={editingViewName}
                          setEditingViewName={setEditingViewName}
                          saveEditedViewName={saveEditedViewName}
                          cancelEdit={cancelEdit}
                        />
                      ))}

                      {showSaveDialog && (
                        <li className="flex items-center gap-2 p-2 rounded-md border border-border/60 bg-background/50">
                          <Input
                            value={newViewName}
                            onChange={e => setNewViewName(e.target.value)}
                            placeholder="Enter view name..."
                            className="h-8 text-sm flex-1 border-none bg-transparent px-2"
                            onKeyDown={e => {
                              if (e.key === 'Enter') saveCurrentView()
                              if (e.key === 'Escape') {
                                setShowSaveDialog(false)
                                setNewViewName("")
                              }
                            }}
                            autoFocus
                          />
                          <Button
                            size="sm"
                            className="h-8 w-8 p-0 bg-blue-500 hover:bg-blue-600"
                            onClick={saveCurrentView}
                            title="Save this view"
                          >
                            <Save className="h-3.5 w-3.5 text-white" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            onClick={() => {
                              setShowSaveDialog(false)
                              setNewViewName("")
                            }}
                            title="Cancel"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </li>
                      )}
                    </ul>
                  </SortableContext>
                </DndContext>
                </div>
              )}
            </div>
          </div>

          <section className="widget-container widget-container-no-padding">
            <LayerPanel layerStates={layerStates} />
          </section>

        </div>
      </aside>
    </div>
  )
}
