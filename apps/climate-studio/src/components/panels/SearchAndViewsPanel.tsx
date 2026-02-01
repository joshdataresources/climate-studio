"use client"

import React, { useCallback, useState } from "react"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { useMap } from "../../contexts/MapContext"
import { useTheme } from "../../contexts/ThemeContext"
import { Loader2, MapPin, Search, Save, Bookmark, GripVertical, MoreHorizontal, Trash2, Pencil } from "lucide-react"
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
  controls: any
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
        className="flex flex-1 items-center gap-2 rounded-md border-0 h-9 px-4 py-2 text-left text-sm hover:bg-blue-500/10"
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

export interface SearchAndViewsPanelProps {
  viewType: 'climate' | 'waterAccess' | 'factories'
  searchPlaceholder?: string
  activeLayerIds?: string[]
  controls?: any
  // Optional custom search handler for views with special search logic (like factories)
  onCustomSearch?: (term: string) => void
  customSearchResults?: Array<{
    id: string
    display_name: string
    location?: { lat: number; lon: number }
  }>
  // Optional custom click handler for custom search results
  onCustomResultClick?: (result: { id: string; display_name: string; location?: { lat: number; lon: number } }) => void
}

export function SearchAndViewsPanel({
  viewType,
  searchPlaceholder = "Search for a city, state, or country",
  activeLayerIds = [],
  controls = {},
  onCustomSearch,
  customSearchResults,
  onCustomResultClick,
}: SearchAndViewsPanelProps) {
  const { theme } = useTheme()
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
    deleteSavedView: deleteSavedViewFromContext,
    updateSavedViewName,
  } = useMap()

  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [newViewName, setNewViewName] = useState("")
  const [editingViewId, setEditingViewId] = useState<string | null>(null)
  const [editingViewName, setEditingViewName] = useState("")

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
      <form className="flex gap-2" onSubmit={handleSearchSubmit}>
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
            className="rounded-md p-2"
            style={{ backgroundColor: theme === 'light' ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.2)' }}
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
  )
}
