"use client"

import React, { useCallback, useState } from "react"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { useMap } from "../../contexts/MapContext"
import { useTheme } from "../../contexts/ThemeContext"
import { useClimate } from "@climate-studio/core"
import { buildShareUrl, copyToClipboard } from "../../utils/shareableView"
import type { ClimateControlsState } from "@climate-studio/core"
import { Loader2, MapPin, Search, Save, Bookmark, GripVertical, MoreHorizontal, Trash2, Pencil, Link2, Check, RefreshCw } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu"
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

interface ViewportState {
  center: { lat: number; lng: number }
  zoom: number
}

interface SavedView {
  id: string
  name: string
  viewport: ViewportState
  activeLayerIds: string[]
  controls: Partial<ClimateControlsState>
}

interface GeoSearchResult {
  display_name: string
  lat: string
  lon: string
  boundingbox?: [string, string, string, string]
}

interface SortableViewItemProps {
  view: SavedView
  hasViewChanged: (view: SavedView) => boolean
  loadSavedView: (view: SavedView) => void
  shareSavedView: (view: SavedView) => void
  sharedViewId: string | null
  updateSavedView: (id: string) => void
  deleteSavedView: (id: string) => void
  editSavedView: (id: string) => void
  editingViewId: string | null
  editingViewName: string
  setEditingViewName: (name: string) => void
  saveEditedViewName: () => void
  cancelEdit: () => void
}

function SortableViewItem({
  view,
  hasViewChanged,
  loadSavedView,
  shareSavedView,
  sharedViewId,
  updateSavedView,
  deleteSavedView,
  editSavedView,
  editingViewId,
  editingViewName,
  setEditingViewName,
  saveEditedViewName,
  cancelEdit
}: SortableViewItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: view.id })

  const isEditing = editingViewId === view.id
  // Drives both the unsaved-changes dot and whether "Update to current view" is live.
  const changed = hasViewChanged(view)

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  if (isEditing) {
    return (
      <li ref={setNodeRef} className="feature-card flex items-center gap-2">
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
    <li ref={setNodeRef} style={style} className="feature-card flex items-center gap-2">
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing p-0 touch-none flex items-center justify-center"
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>
      <button
        onClick={() => loadSavedView(view)}
        className="flex flex-1 items-center gap-2 rounded-md border-0 h-auto p-0 text-left text-xs bg-transparent hover:bg-transparent"
      >
        <Bookmark className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <div className="flex-1 min-w-0 flex flex-col gap-1">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-[13px] font-semibold text-[var(--cs-text-primary)]">{view.name}</h4>
            {changed && (
              <span
                className="h-1.5 w-1.5 rounded-full bg-[#5a7cec] flex-shrink-0"
                title="The map no longer matches this view — use Update to current view"
              />
            )}
          </div>
        </div>
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 bg-transparent hover:bg-transparent"
          >
            <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={() => updateSavedView(view.id)}
            disabled={!changed}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            {changed ? "Update to current view" : "Up to date"}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => editSavedView(view.id)}>
            <Pencil className="h-4 w-4 mr-2" />
            Edit Name
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => shareSavedView(view)}>
            {sharedViewId === view.id ? (
              <>
                <Check className="h-4 w-4 mr-2 text-green-500" />
                Link copied
              </>
            ) : (
              <>
                <Link2 className="h-4 w-4 mr-2" />
                Copy link
              </>
            )}
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

export interface SearchAndViewsPanelProps {
  viewType: 'climate' | 'waterAccess' | 'factories'
  searchPlaceholder?: string
  // Optional overrides for what a saved view captures. Left undefined (the normal
  // case) the map context snapshots the live layers and climate controls itself.
  activeLayerIds?: string[]
  controls?: Partial<ClimateControlsState>
  // Optional custom search handler for views with special search logic (like factories)
  onCustomSearch?: (term: string) => void
  customSearchResults?: Array<{
    id: string
    display_name: string
    location?: { lat: number; lon: number }
  }>
  // Optional custom click handler for custom search results
  onCustomResultClick?: (result: { id: string; display_name: string; location?: { lat: number; lon: number } }) => void
  // Optional extra element to render inline with the search form (e.g. collapse chevron)
  searchExtra?: React.ReactNode
}

export function SearchAndViewsPanel({
  viewType,
  searchPlaceholder = "Search for a city, state, or country",
  activeLayerIds,
  controls,
  onCustomSearch,
  customSearchResults,
  onCustomResultClick,
  searchExtra,
}: SearchAndViewsPanelProps) {
  const { theme } = useTheme()
  const { controls: liveControls } = useClimate()
  const {
    viewport,
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
    updateSavedView: updateSavedViewInContext,
    deleteSavedView: deleteSavedViewFromContext,
    updateSavedViewName,
    captureLayerIds,
  } = useMap()

  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [newViewName, setNewViewName] = useState("")
  const [editingViewId, setEditingViewId] = useState<string | null>(null)
  const [editingViewName, setEditingViewName] = useState("")
  const [sharedViewId, setSharedViewId] = useState<string | null>(null)

  const handleSearchSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      if (onCustomSearch) {
        onCustomSearch(searchTerm)
      } else {
        executeSearch(searchTerm)
      }
    },
    [executeSearch, searchTerm, onCustomSearch]
  )

  const loadSavedView = useCallback((view: SavedView) => {
    loadSavedViewFromContext(view)
  }, [loadSavedViewFromContext])

  const saveCurrentView = useCallback(() => {
    if (!newViewName.trim()) return
    saveCurrentViewToContext(newViewName, activeLayerIds, controls)
    setNewViewName("")
    setShowSaveDialog(false)
  }, [newViewName, activeLayerIds, controls, saveCurrentViewToContext])

  // localStorage cannot cross a browser profile, so a view travels as a link that
  // carries its position, layers and forecast year in the query string.
  const shareSavedView = useCallback(async (view: SavedView) => {
    const ok = await copyToClipboard(buildShareUrl(view))
    if (!ok) {
      window.prompt('Copy this link to share the view:', buildShareUrl(view))
      return
    }
    setSharedViewId(view.id)
    setTimeout(() => setSharedViewId(current => (current === view.id ? null : current)), 2000)
  }, [])

  const deleteSavedView = useCallback((viewId: string) => {
    deleteSavedViewFromContext(viewId)
  }, [deleteSavedViewFromContext])

  // Re-captures position, layers and forecast date onto an existing view. The same
  // optional overrides the save path takes apply here, so the factories panel keeps
  // updating its views as position-only.
  const updateSavedView = useCallback((viewId: string) => {
    updateSavedViewInContext(viewId, activeLayerIds, controls)
  }, [updateSavedViewInContext, activeLayerIds, controls])

  const hasViewChanged = useCallback((view: SavedView) => {
    // A view that recorded neither layers nor controls predates them being captured,
    // and restores position-only. It counts as out of date even when the map is
    // sitting exactly where it was saved: offering the update is the only way the
    // user can upgrade it short of deleting it and saving again.
    //
    // Gated on this panel actually having climate state to capture. The factories
    // panel overrides both to empty, so its views are position-only by design and
    // an update would be a no-op — they must not sit permanently flagged.
    const recordsNothing =
      !view.activeLayerIds?.length && !Object.keys(view.controls ?? {}).length
    const capturesClimateState =
      (activeLayerIds ?? captureLayerIds()).length > 0 ||
      Object.keys(controls ?? liveControls).length > 0
    if (recordsNothing && capturesClimateState) return true

    const movedMap =
      viewport.center.lat !== view.viewport.center.lat ||
      viewport.center.lng !== view.viewport.center.lng ||
      viewport.zoom !== view.viewport.zoom
    if (movedMap) return true

    // A view now also pins its layers and forecast date, so the "unsaved changes"
    // marker has to account for those. Fields the view never recorded (older saves)
    // are skipped, otherwise every legacy view would read as permanently changed.
    if (view.activeLayerIds?.length) {
      // Against captureLayerIds(), not just ClimateContext's — a view records the
      // mounted view's own toggles too, so comparing to the climate layers alone
      // would report every view as permanently changed.
      const saved = [...view.activeLayerIds].sort().join('|')
      const live = [...(activeLayerIds ?? captureLayerIds())].sort().join('|')
      if (saved !== live) return true
    }

    const savedControls = view.controls ?? {}
    if (savedControls.projectionYear !== undefined &&
        savedControls.projectionYear !== liveControls.projectionYear) return true
    if (savedControls.scenario !== undefined &&
        savedControls.scenario !== liveControls.scenario) return true

    return false
  }, [viewport, captureLayerIds, liveControls, activeLayerIds, controls])

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

  // Use custom search results if provided, otherwise use default
  const displayResults = customSearchResults || searchResults

  return (
    <div className="widget-container">
      {/* Search Form */}
      <div className="flex gap-2 items-center">
        <form className="flex gap-2 flex-1" onSubmit={handleSearchSubmit}>
          <div className="relative flex-1">
            <Input
              value={searchTerm}
              onChange={event => setSearchTerm(event.target.value)}
              placeholder={searchPlaceholder}
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
        {searchExtra}
      </div>

      {/* Search Results */}
      {displayResults.length > 0 && (
        <div className="mt-3 space-y-2 border-t border-border/60 pt-3">
          <div className="text-xs font-semibold uppercase text-muted-foreground">Search results</div>
          <ul className="space-y-2">
            {displayResults.map((result, index) => {
              // Handle both custom and standard search results
              const isCustomResult = 'id' in result
              const key = isCustomResult ? result.id : `${(result as GeoSearchResult).lat}-${(result as GeoSearchResult).lon}`

              return (
                <li key={key}>
                  <button
                    onClick={() => {
                      if (isCustomResult && onCustomResultClick) {
                        onCustomResultClick(result as { id: string; display_name: string; location?: { lat: number; lon: number } })
                      } else if (!isCustomResult) {
                        moveToResult(result as GeoSearchResult)
                      }
                    }}
                    className="flex w-full items-start gap-2 rounded-md border border-transparent p-2 text-left text-sm hover:border-border hover:bg-background/80"
                  >
                    <MapPin className="mt-0.5 h-4 w-4 text-blue-500" />
                    <span>{result.display_name}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {/* Saved Views Section */}
      <div className="mt-4 space-y-2 border-t border-border/60 pt-4">
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
            className="rounded-md"
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
                <ul className="space-y-2">
                  {savedViews.map(view => (
                    <SortableViewItem
                      key={view.id}
                      view={view}
                      hasViewChanged={hasViewChanged}
                      loadSavedView={loadSavedView}
                      shareSavedView={shareSavedView}
                      sharedViewId={sharedViewId}
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
                    <li className="feature-card flex items-center gap-2">
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
  )
}
