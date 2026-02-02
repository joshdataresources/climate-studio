import React, { useCallback, useMemo, useRef, useState } from "react"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { LayerControlsPanel, LayerPanel } from "../layer-panel"
import { LayerPalette } from "../LayerPalette"
import { useClimateLayerData } from "../../hooks/useClimateLayerData"
import { LatLngBoundsLiteral } from "../../types/geography"
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
import { climateLayers } from "@climate-studio/core/config"
import { useClimate } from "@climate-studio/core"

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

const DEFAULT_VIEWPORT: ViewportState = {
  center: { lat: 37.5, lng: -112.05 }, // Southwest US: centered to show NV, UT, western CO, AZ
  zoom: 5.5,
}

const DEFAULT_SAVED_VIEW: SavedView = {
  id: 'south-west',
  name: 'South West',
  viewport: DEFAULT_VIEWPORT,
  activeLayerIds: ['topographic_relief'],
  controls: {}
}

interface ClimateStudioPanelsProps {
  mapBounds: LatLngBoundsLiteral | null
  viewport: ViewportState
  onViewportChange: (viewport: ViewportState) => void
}

export function ClimateStudioPanels({ mapBounds, viewport, onViewportChange }: ClimateStudioPanelsProps) {
  const { activeLayerIds } = useClimate()
  const [searchTerm, setSearchTerm] = useState("")
  const [searchResults, setSearchResults] = useState<GeoSearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const searchControllerRef = useRef<AbortController | null>(null)
  const [savedViews, setSavedViews] = useState<SavedView[]>([DEFAULT_SAVED_VIEW])
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [newViewName, setNewViewName] = useState("")
  const [editingViewId, setEditingViewId] = useState<string | null>(null)
  const [editingViewName, setEditingViewName] = useState("")

  const { layers: layerStates } = useClimateLayerData(mapBounds)

  const executeSearch = useCallback(
    async (term: string) => {
      const query = term.trim()
      if (!query) {
        setSearchResults([])
        return
      }

      try {
        if (searchControllerRef.current) {
          searchControllerRef.current.abort()
        }

        const controller = new AbortController()
        searchControllerRef.current = controller
        setIsSearching(true)

        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(query)}`,
          {
            headers: { "Accept": "application/json" },
            signal: controller.signal,
          }
        )

        if (!response.ok) throw new Error(`Geocoding failed with status ${response.status}`)
        const results: GeoSearchResult[] = await response.json()
        setSearchResults(results)
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          console.error("Geocoding error:", error)
        }
      } finally {
        setIsSearching(false)
      }
    },
    []
  )

  const handleSearchSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      executeSearch(searchTerm)
    },
    [executeSearch, searchTerm]
  )

  const moveToResult = useCallback((result: GeoSearchResult) => {
    const lat = parseFloat(result.lat)
    const lng = parseFloat(result.lon)
    const bbox = result.boundingbox

    const newZoom = bbox
      ? Math.min(12, Math.max(4, Math.round(13 - Math.log2(Math.max(
          Math.abs(parseFloat(bbox[0]) - parseFloat(bbox[1])),
          Math.abs(parseFloat(bbox[2]) - parseFloat(bbox[3]))
        ) + 1e-6))))
      : 10

    onViewportChange({
      center: { lat, lng },
      zoom: newZoom,
    })
    setSearchResults([])
  }, [onViewportChange])

  const loadSavedView = useCallback((view: SavedView) => {
    onViewportChange(view.viewport)
  }, [onViewportChange])

  const saveCurrentView = useCallback(() => {
    if (!newViewName.trim()) return

    const newView: SavedView = {
      id: `view-${Date.now()}`,
      name: newViewName.trim(),
      viewport: viewport,
      activeLayerIds: activeLayerIds,
      controls: {}
    }

    setSavedViews(prev => [...prev, newView])
    setNewViewName("")
    setShowSaveDialog(false)
    localStorage.setItem('climate-saved-views', JSON.stringify([...savedViews, newView]))
  }, [newViewName, viewport, activeLayerIds, savedViews])

  const deleteSavedView = useCallback((viewId: string) => {
    setSavedViews(prev => {
      const updated = prev.filter(v => v.id !== viewId)
      localStorage.setItem('climate-saved-views', JSON.stringify(updated))
      return updated
    })
  }, [])

  const editSavedView = useCallback((viewId: string) => {
    const view = savedViews.find(v => v.id === viewId)
    if (view) {
      setEditingViewId(viewId)
      setEditingViewName(view.name)
    }
  }, [savedViews])

  const saveEditedViewName = useCallback(() => {
    if (!editingViewId || !editingViewName.trim()) return
    const updated = savedViews.map(v =>
      v.id === editingViewId ? { ...v, name: editingViewName.trim() } : v
    )
    setSavedViews(updated)
    localStorage.setItem('climate-saved-views', JSON.stringify(updated))
    setEditingViewId(null)
    setEditingViewName("")
  }, [editingViewId, editingViewName, savedViews])

  const cancelEdit = useCallback(() => {
    setEditingViewId(null)
    setEditingViewName("")
  }, [])

  React.useEffect(() => {
    const stored = localStorage.getItem('climate-saved-views')
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        if (parsed && parsed.length > 0) {
          setSavedViews(parsed)
          if (parsed[0]) {
            onViewportChange(parsed[0].viewport)
          }
        }
      } catch (e) {
        console.error('Failed to parse saved views', e)
      }
    }
  }, [onViewportChange])

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    setSavedViews((items) => {
      const oldIndex = items.findIndex((item) => item.id === active.id)
      const newIndex = items.findIndex((item) => item.id === over.id)
      if (oldIndex === -1 || newIndex === -1) return items
      const reordered = arrayMove(items, oldIndex, newIndex)
      localStorage.setItem('climate-saved-views', JSON.stringify(reordered))
      return reordered
    })
  }, [])

  // SortableViewItem component (simplified - you may want to extract this)
  const SortableViewItem = ({ view }: { view: SavedView }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: view.id })
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
          <Button size="sm" className="h-8 w-8 p-0 bg-blue-500 hover:bg-blue-600" onClick={saveEditedViewName}>
            <Save className="h-3.5 w-3.5 text-white" />
          </Button>
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={cancelEdit}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </li>
      )
    }

    return (
      <li ref={setNodeRef} style={style} className="flex items-center gap-1">
        <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-2 touch-none">
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
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => editSavedView(view.id)}>
              <Pencil className="h-4 w-4 mr-2" />
              Edit Name
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => deleteSavedView(view.id)} className="text-destructive focus:text-destructive">
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </li>
    )
  }

  return (
    <>
      {/* Search and Views Panel */}
      <div className="widget-container">
        <form className="flex gap-2" onSubmit={handleSearchSubmit}>
          <div className="relative flex-1">
            <Input
              value={searchTerm}
              onChange={event => setSearchTerm(event.target.value)}
              placeholder="Search for a city, state, or country"
              className="pr-10 bg-[rgba(40,40,40,0.8)] border-[rgba(63,63,63,1)]"
            />
            <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          </div>
          <Button type="submit" variant="secondary" disabled={isSearching} className="bg-[rgba(40,40,40,0.8)] border border-[rgba(63,63,63,1)] hover:bg-white/10">
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
            <Button size="sm" variant="text" className="h-6 px-2 text-xs" onClick={() => setShowSaveDialog(true)}>
              <Save className="h-3 w-3 mr-1" />
              New View
            </Button>
          </div>

          {savedViews.length === 0 && !showSaveDialog ? (
            <p className="text-xs text-muted-foreground py-4">
              You have no saved views. Click "New View" to save your first view.
            </p>
          ) : (
            <div className="rounded-md border border-[rgba(63,63,63,1)] bg-[rgba(40,40,40,0.6)] p-2">
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={savedViews.map(v => v.id)} strategy={verticalListSortingStrategy}>
                  <ul className="space-y-1">
                    {savedViews.map(view => (
                      <SortableViewItem key={view.id} view={view} />
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
                        <Button size="sm" className="h-8 w-8 p-0 bg-blue-500 hover:bg-blue-600" onClick={saveCurrentView}>
                          <Save className="h-3.5 w-3.5 text-white" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => { setShowSaveDialog(false); setNewViewName("") }}>
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

      {/* Layer Palette */}
      <LayerPalette />
    </>
  )
}






