import React, { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react'
import { useClimate, climateLayers } from '@climate-studio/core'
import type { ClimateControlsState, ClimateLayerId } from '@climate-studio/core'
import { readSharedView } from '../utils/shareableView'

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

/**
 * A saved view is a full snapshot of what the user was looking at, not just where.
 * `controls` carries the climate control state — including the forecast year
 * (`projectionYear`) and emissions `scenario` — so loading a view puts the map back
 * on the same layers, at the same forecast date, as when it was saved.
 */
interface SavedView {
  id: string
  name: string
  viewport: ViewportState
  activeLayerIds: string[]
  controls: Partial<ClimateControlsState>
}

/**
 * Views saved by older builds may predate `activeLayerIds`/`controls`, or may have
 * stored junk in them. Normalise on read so a stale entry can never crash a restore.
 */
const normalizeSavedView = (view: any): SavedView | null => {
  if (!view || typeof view !== 'object') return null
  const center = view.viewport?.center
  if (typeof center?.lat !== 'number' || typeof center?.lng !== 'number') return null

  return {
    id: typeof view.id === 'string' ? view.id : `view-${Date.now()}`,
    name: typeof view.name === 'string' ? view.name : 'Untitled view',
    viewport: {
      center: { lat: center.lat, lng: center.lng },
      zoom: typeof view.viewport?.zoom === 'number' ? view.viewport.zoom : DEFAULT_VIEWPORT.zoom,
    },
    activeLayerIds: Array.isArray(view.activeLayerIds)
      ? view.activeLayerIds.filter((id: unknown) => typeof id === 'string')
      : [],
    controls:
      view.controls && typeof view.controls === 'object' && !Array.isArray(view.controls)
        ? view.controls
        : {},
  }
}

const DEFAULT_VIEWPORT: ViewportState = {
  center: { lat: 37.5, lng: -112.05 }, // Southwest US: centered to show NV, UT, western CO, AZ
  zoom: 5.5,
}

const SAVED_VIEWS_STORAGE_KEY = 'climate-saved-views'

/**
 * Not every layer lives in ClimateContext. ClimateStudioView owns most of its own
 * toggles as local component state (Sea Level Rise, Aquifers, Rivers, Canals, Dams,
 * Metro Weather, Factories, AI Data Centers, Wildfire), and a saved view could
 * neither capture nor restore those — it only ever saw the three that ClimateContext
 * knows about. A view registers this adapter so its own toggles join the snapshot.
 *
 * Ids share one flat namespace with the climate layers, so the stored shape and the
 * ?layers= share link stay exactly as they were.
 */
export interface ViewLayerAdapter {
  getLayerIds: () => string[]
  applyLayerIds: (ids: string[]) => void
}

const CLIMATE_LAYER_IDS = new Set<string>(climateLayers.map(layer => layer.id))

/** Ids ClimateContext owns; the rest belong to whichever view registered an adapter. */
const climateIdsOnly = (ids: string[]): ClimateLayerId[] =>
  ids.filter(id => CLIMATE_LAYER_IDS.has(id)) as ClimateLayerId[]

const DEFAULT_SAVED_VIEW: SavedView = {
  id: 'south-west',
  name: 'South West',
  viewport: DEFAULT_VIEWPORT,
  activeLayerIds: ['topographic_relief'],
  controls: {}
}

/**
 * Saves have always been written to localStorage; they just were never read back,
 * so views did not survive a reload. This is that missing read.
 *
 * An absent key means first run, and seeds the South West default. A key that is
 * present and parses is honoured as-is — including an empty list — so a user who
 * deletes every view does not have the default resurrect on the next load.
 */
const loadStoredViews = (): SavedView[] => {
  try {
    const stored = localStorage.getItem(SAVED_VIEWS_STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      if (Array.isArray(parsed)) {
        return parsed
          .map(normalizeSavedView)
          .filter((view): view is SavedView => view !== null)
      }
    }
  } catch (e) {
    console.warn('Could not restore saved views, starting from the default:', e)
  }
  return [DEFAULT_SAVED_VIEW]
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
  /**
   * Snapshot the current map. `activeLayerIds` and `controls` default to the live
   * climate state — callers only pass them to deliberately override what is captured
   * (e.g. the factories view, which has no climate layers of its own).
   */
  saveCurrentView: (
    name: string,
    activeLayerIds?: string[],
    controls?: Partial<ClimateControlsState>
  ) => void
  /**
   * Re-snapshot an existing view in place, keeping its id, name and list position.
   * Without this, a view saved before layers and controls were captured could never
   * pick them up — the only way to refresh one was to delete it and save it again.
   * Overrides follow the same rule as saveCurrentView: omitted means "use live state".
   */
  updateSavedView: (
    viewId: string,
    activeLayerIds?: string[],
    controls?: Partial<ClimateControlsState>
  ) => void
  deleteSavedView: (viewId: string) => void
  updateSavedViewName: (viewId: string, name: string) => void
  /**
   * Let the mounted view contribute its own layer toggles to saves and restores.
   * Pass null on unmount. Only one view is mounted at a time, so the last
   * registration wins.
   */
  registerViewLayerAdapter: (adapter: ViewLayerAdapter | null) => void
  /**
   * Everything currently on, across both owners. This is what a save records, so
   * it is also what an "is this view still current?" check has to compare against.
   */
  captureLayerIds: () => string[]
}

export const MapContext = createContext<MapContextValue | undefined>(undefined)

interface MapProviderProps {
  children: ReactNode
}

export function MapProvider({ children }: MapProviderProps) {
  // MapProvider is always mounted inside ClimateProvider (see App.tsx), so the live
  // layer selection and climate controls are readable here. Sourcing them from the
  // context rather than from caller props is deliberate: every call site used to pass
  // an empty array, so saved views captured no layers at all.
  const { activeLayerIds: liveLayerIds, controls: liveControls, applyViewState } = useClimate()

  // savedViews is declared before viewport on purpose: the opening viewport is
  // derived from the first saved view, and it has to be right on the very first
  // render. The map is created from `viewport` by a child effect, and child effects
  // run before this provider's own, so seeding the viewport from an effect left the
  // map built at DEFAULT_VIEWPORT and the first moveend wrote that default straight
  // back over the restored position.
  // A ?lat=&lng=&z=&layers=&year= link is how a view travels between browsers, so it
  // outranks the local saved list. Read once per mount, before anything renders.
  const [sharedView] = useState(readSharedView)

  const [savedViews, setSavedViewsInternal] = useState<SavedView[]>(loadStoredViews)
  const [viewport, setViewportInternal] = useState<ViewportState>(
    () => sharedView?.viewport ?? savedViews[0]?.viewport ?? DEFAULT_VIEWPORT
  )
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState<GeoSearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  
  const searchControllerRef = useRef<AbortController | null>(null)

  // Set by whichever view is mounted. Child effects run before this provider's own,
  // so a view has always registered by the time the share-link effect below fires.
  const viewLayerAdapterRef = useRef<ViewLayerAdapter | null>(null)
  const registerViewLayerAdapter = useCallback((adapter: ViewLayerAdapter | null) => {
    viewLayerAdapterRef.current = adapter
  }, [])

  /** Everything on right now: ClimateContext's layers plus the mounted view's own. */
  const captureLayerIds = useCallback(
    () => [...new Set([...liveLayerIds, ...(viewLayerAdapterRef.current?.getLayerIds() ?? [])])],
    [liveLayerIds]
  )

  const setViewport = useCallback((newViewport: ViewportState) => {
    setViewportInternal(newViewport)
  }, [])

  const setSavedViews = useCallback((views: SavedView[]) => {
    setSavedViewsInternal(views)
    try {
      localStorage.setItem(SAVED_VIEWS_STORAGE_KEY, JSON.stringify(views))
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
    const restored = normalizeSavedView(view)
    if (!restored) {
      console.warn('Ignored a saved view with no usable viewport:', view)
      return
    }

    setViewport(restored.viewport)

    // Only hand back layers/controls the view actually recorded. Views saved before
    // this existed carry neither, and should keep behaving as position-only bookmarks
    // rather than wiping the user's current layers on load.
    const recordedLayers = restored.activeLayerIds.length ? restored.activeLayerIds : null

    applyViewState({
      // Climate ids go to ClimateContext; view-owned ids would be meaningless there.
      // An empty result is still applied when the view recorded *something*, so a
      // view with only view-owned layers correctly clears the climate ones.
      activeLayerIds: recordedLayers ? climateIdsOnly(recordedLayers) : undefined,
      controls: Object.keys(restored.controls).length ? restored.controls : undefined,
    })

    // The mounted view switches its own toggles to match — on for ids the view
    // recorded, off for the rest. Skipped entirely for a position-only view.
    if (recordedLayers) viewLayerAdapterRef.current?.applyLayerIds(recordedLayers)
  }, [setViewport, applyViewState])

  const saveCurrentView = useCallback((
    name: string,
    activeLayerIds?: string[],
    controls?: Partial<ClimateControlsState>
  ) => {
    if (!name.trim()) return

    const newView: SavedView = {
      id: `view-${Date.now()}`,
      name: name.trim(),
      viewport: viewport,
      activeLayerIds: activeLayerIds ?? captureLayerIds(),
      // Copy the snapshot: `liveControls` is a memoised object that is replaced on
      // every control change, and we must not hold a reference that keeps mutating.
      controls: { ...(controls ?? liveControls) }
    }

    const updatedViews = [...savedViews, newView]
    setSavedViews(updatedViews)
  }, [viewport, savedViews, setSavedViews, captureLayerIds, liveControls])

  const updateSavedView = useCallback((
    viewId: string,
    activeLayerIds?: string[],
    controls?: Partial<ClimateControlsState>
  ) => {
    const updated = savedViews.map(v =>
      v.id === viewId
        ? {
            ...v,
            viewport: viewport,
            activeLayerIds: activeLayerIds ?? captureLayerIds(),
            // Copied for the same reason as in saveCurrentView: liveControls is a
            // memoised object that is replaced on every control change.
            controls: { ...(controls ?? liveControls) }
          }
        : v
    )
    setSavedViews(updated)
  }, [savedViews, setSavedViews, viewport, captureLayerIds, liveControls])

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

  // The viewport from a share link is applied synchronously above (the map is built
  // from it). Layers and controls have to go through ClimateContext, so they land
  // here on mount. Position-only links leave the current layers untouched.
  React.useEffect(() => {
    if (!sharedView) return
    if (!sharedView.activeLayerIds && !sharedView.controls) return
    applyViewState({
      activeLayerIds: sharedView.activeLayerIds
        ? climateIdsOnly(sharedView.activeLayerIds)
        : undefined,
      controls: sharedView.controls,
    })
    if (sharedView.activeLayerIds) {
      viewLayerAdapterRef.current?.applyLayerIds(sharedView.activeLayerIds)
    }
  }, []) // once, from the URL the page was opened with

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
    updateSavedView,
    deleteSavedView,
    updateSavedViewName,
    registerViewLayerAdapter,
    captureLayerIds,
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







