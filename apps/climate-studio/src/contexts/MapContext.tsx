import React, { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react'

interface ViewportState {
  center: { lat: number; lng: number }
  zoom: number
}

interface GeoSearchResult {
  display_name: string
  lat: string
  lon: string
  boundingbox?: [string, string, string, string]
}

interface SavedView {
  id: string
  name: string
  viewport: ViewportState
  activeLayerIds: string[]
  controls: any
}

const DEFAULT_VIEWPORT: ViewportState = {
  center: { lat: 38.9072, lng: -77.0369 }, // Washington DC - East Coast
  zoom: 6.0,
}

const DEFAULT_SAVED_VIEW: SavedView = {
  id: 'dc-east-coast',
  name: 'East Coast',
  viewport: DEFAULT_VIEWPORT,
  activeLayerIds: ['topographic_relief'],
  controls: {}
}

export interface MapContextValue {
  // Viewport state - shared across views
  viewport: ViewportState
  setViewport: (viewport: ViewportState) => void
  
  // Search state - persists when switching views
  searchTerm: string
  setSearchTerm: (term: string) => void
  searchResults: GeoSearchResult[]
  setSearchResults: (results: GeoSearchResult[]) => void
  isSearching: boolean
  setIsSearching: (searching: boolean) => void
  
  // Search actions
  executeSearch: (term: string) => Promise<void>
  moveToResult: (result: GeoSearchResult) => void
  
  // Saved views
  savedViews: SavedView[]
  setSavedViews: (views: SavedView[]) => void
  loadSavedView: (view: SavedView) => void
  saveCurrentView: (name: string, activeLayerIds: string[], controls: any) => void
  deleteSavedView: (viewId: string) => void
  updateSavedViewName: (viewId: string, name: string) => void
}

export const MapContext = createContext<MapContextValue | undefined>(undefined)

interface MapProviderProps {
  children: ReactNode
}

export function MapProvider({ children }: MapProviderProps) {
  const [viewport, setViewportInternal] = useState<ViewportState>(DEFAULT_VIEWPORT)
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState<GeoSearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [savedViews, setSavedViewsInternal] = useState<SavedView[]>(() => {
    try {
      const stored = localStorage.getItem('climate-saved-views')
      if (stored) {
        const parsed = JSON.parse(stored)
        if (parsed && parsed.length > 0) return parsed
      }
    } catch (e) {
      console.error('Failed to load saved views:', e)
    }
    return [DEFAULT_SAVED_VIEW]
  })
  
  const searchControllerRef = useRef<AbortController | null>(null)

  const setViewport = useCallback((newViewport: ViewportState) => {
    setViewportInternal(newViewport)
  }, [])

  const setSavedViews = useCallback((views: SavedView[]) => {
    setSavedViewsInternal(views)
    try {
      localStorage.setItem('climate-saved-views', JSON.stringify(views))
    } catch (e) {
      console.error('Failed to save views:', e)
    }
  }, [])

  const executeSearch = useCallback(async (term: string) => {
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

      if (!response.ok) {
        throw new Error(`Geocoding failed with status ${response.status}`)
      }

      const results: GeoSearchResult[] = await response.json()
      setSearchResults(results)
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        console.error("Geocoding error:", error)
      }
    } finally {
      setIsSearching(false)
    }
  }, [])

  const moveToResult = useCallback((result: GeoSearchResult) => {
    const lat = parseFloat(result.lat)
    const lng = parseFloat(result.lon)
    const bbox = result.boundingbox

    const newZoom = bbox
      ? Math.min(
          12,
          Math.max(
            4,
            Math.round(
              13 -
                Math.log2(
                  Math.max(
                    Math.abs(parseFloat(bbox[0]) - parseFloat(bbox[1])),
                    Math.abs(parseFloat(bbox[2]) - parseFloat(bbox[3]))
                  ) + 1e-6
                )
            )
          )
        )
      : 10

    setViewport({
      center: { lat, lng },
      zoom: newZoom,
    })
    setSearchResults([])
  }, [setViewport])

  const loadSavedView = useCallback((view: SavedView) => {
    setViewport(view.viewport)
  }, [setViewport])

  const saveCurrentView = useCallback((name: string, activeLayerIds: string[], controls: any) => {
    if (!name.trim()) return

    const newView: SavedView = {
      id: `view-${Date.now()}`,
      name: name.trim(),
      viewport: viewport,
      activeLayerIds,
      controls
    }

    const updatedViews = [...savedViews, newView]
    setSavedViews(updatedViews)
  }, [viewport, savedViews, setSavedViews])

  const deleteSavedView = useCallback((viewId: string) => {
    const updated = savedViews.filter(v => v.id !== viewId)
    setSavedViews(updated)
  }, [savedViews, setSavedViews])

  const updateSavedViewName = useCallback((viewId: string, name: string) => {
    const updated = savedViews.map(v =>
      v.id === viewId ? { ...v, name: name.trim() } : v
    )
    setSavedViews(updated)
  }, [savedViews, setSavedViews])

  // Load first saved view on mount
  React.useEffect(() => {
    if (savedViews.length > 0) {
      setViewportInternal(savedViews[0].viewport)
    }
  }, []) // Only run once

  const value: MapContextValue = {
    viewport,
    setViewport,
    searchTerm,
    setSearchTerm,
    searchResults,
    setSearchResults,
    isSearching,
    setIsSearching,
    executeSearch,
    moveToResult,
    savedViews,
    setSavedViews,
    loadSavedView,
    saveCurrentView,
    deleteSavedView,
    updateSavedViewName,
  }

  return (
    <MapContext.Provider value={value}>
      {children}
    </MapContext.Provider>
  )
}

export function useMap(): MapContextValue {
  const context = useContext(MapContext)
  if (!context) {
    throw new Error('useMap must be used within a MapProvider')
  }
  return context
}







