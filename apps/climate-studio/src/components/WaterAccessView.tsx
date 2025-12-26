import { useEffect, useRef, useState, useCallback } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { useMap } from '../contexts/MapContext'
import { useTheme } from '../contexts/ThemeContext'
import { GroundwaterDetailsPanel, SelectedAquifer } from './panels/GroundwaterDetailsPanel'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Slider } from './ui/slider'
import { Search, Loader2, MapPin, Save, Bookmark, GripVertical, MoreHorizontal, Trash2, Pencil } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'
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

// Import aquifer data with projections
import aquifersData from '../data/aquifers.json'

// Use environment variable or fallback to the token
const MAPBOX_ACCESS_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || 'pk.eyJ1Ijoiam9zaHVhYmJ1dGxlciIsImEiOiJjbWcwNXpyNXUwYTdrMmtva2tiZ2NjcGxhIn0.Fc3d_CloJGiw9-BE4nI_Kw'
mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN

// Backend API base URL - use relative URL to go through Vite proxy
const API_BASE = import.meta.env.VITE_API_URL || ''

// Helper to get volume for a specific year from projections
function getVolumeForYear(projections: Record<string, number> | undefined, year: number): number | null {
  if (!projections) return null
  
  // Available projection years in the data
  const availableYears = Object.keys(projections).map(Number).sort((a, b) => a - b)
  
  // If exact year exists, return it
  if (projections[year.toString()]) {
    return projections[year.toString()]
  }
  
  // Otherwise interpolate between nearest years
  let lowerYear = availableYears[0]
  let upperYear = availableYears[availableYears.length - 1]
  
  for (let i = 0; i < availableYears.length - 1; i++) {
    if (availableYears[i] <= year && availableYears[i + 1] >= year) {
      lowerYear = availableYears[i]
      upperYear = availableYears[i + 1]
      break
    }
  }
  
  // Clamp to available range
  if (year <= lowerYear) return projections[lowerYear.toString()]
  if (year >= upperYear) return projections[upperYear.toString()]
  
  // Linear interpolation
  const lowerVol = projections[lowerYear.toString()]
  const upperVol = projections[upperYear.toString()]
  const ratio = (year - lowerYear) / (upperYear - lowerYear)
  
  return lowerVol + (upperVol - lowerVol) * ratio
}

// Get depletion color based on percentage of 2025 baseline volume
// Green (Stable): ≥ 98% of 2025 levels
// Blue (Moderate): 90% - 98%
// Orange (Stressed): 75% - 90%
// Red (Critical): < 75%
function getDepletionColor(properties: any, projectionYear: number = 2025): string {
  const baseline = properties?.volume_gallons_2025 || properties?.projections?.['2025']
  const projections = properties?.projections
  
  if (!baseline || !projections) {
    return '#6366f1' // Default purple for unknown
  }
  
  const currentVolume = getVolumeForYear(projections, projectionYear)
  if (currentVolume === null) {
    return '#6366f1' // Default purple for unknown
  }
  
  const percentageOfBaseline = (currentVolume / baseline) * 100
  
  if (percentageOfBaseline >= 98) {
    return '#22c55e' // Green - Stable
  }
  if (percentageOfBaseline >= 90) {
    return '#3b82f6' // Blue - Moderate
  }
  if (percentageOfBaseline >= 75) {
    return '#f97316' // Orange - Stressed
  }
  
  return '#ef4444' // Red - Critical
}

// Get depletion status label and severity
function getDepletionStatus(properties: any, projectionYear: number): { label: string; severity: string; percentage: number } {
  const baseline = properties?.volume_gallons_2025 || properties?.projections?.['2025']
  const projections = properties?.projections
  
  if (!baseline || !projections) {
    return { label: 'Unknown', severity: 'unknown', percentage: 100 }
  }
  
  const currentVolume = getVolumeForYear(projections, projectionYear)
  if (currentVolume === null) {
    return { label: 'Unknown', severity: 'unknown', percentage: 100 }
  }
  
  const percentage = (currentVolume / baseline) * 100
  
  if (percentage >= 98) {
    return { label: 'Stable', severity: 'stable', percentage }
  }
  if (percentage >= 90) {
    return { label: 'Moderate', severity: 'moderate', percentage }
  }
  if (percentage >= 75) {
    return { label: 'Stressed', severity: 'stressed', percentage }
  }
  
  return { label: 'Critical', severity: 'critical', percentage }
}

// Loading state component
function LoadingOverlay({ message }: { message: string }) {
  return (
    <div style={{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      color: 'white',
      flexDirection: 'column',
      gap: 16
    }}>
      <div style={{
        width: 40,
        height: 40,
        border: '3px solid rgba(255, 255, 255, 0.3)',
        borderTopColor: '#3b82f6',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite'
      }} />
      <div style={{ fontSize: 14 }}>{message}</div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

// SortableViewItem component for saved views
interface SavedView {
  id: string
  name: string
  viewport: { center: { lat: number; lng: number }; zoom: number }
  activeLayerIds: string[]
  controls: any
}

interface SortableViewItemProps {
  view: SavedView
  loadSavedView: (view: SavedView) => void
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
  loadSavedView, 
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

export default function WaterAccessView() {
  const mapContainer = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const isMountedRef = useRef(true)
  const selectedFeatureIdRef = useRef<string | number | null>(null) // Ref to track selection in event handlers
  const aquiferDataRef = useRef<GeoJSON.FeatureCollection | null>(null) // Ref to persist aquifer data across style changes
  const [mapLoaded, setMapLoaded] = useState(false)
  const [aquiferData, setAquiferData] = useState<GeoJSON.FeatureCollection | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [aquiferCount, setAquiferCount] = useState(0)
  const [projectionYear, setProjectionYear] = useState(2025)
  const [selectedAquifer, setSelectedAquifer] = useState<SelectedAquifer | null>(null)
  const [selectedFeatureId, setSelectedFeatureId] = useState<string | number | null>(null)

  // Use theme context for map style
  const { theme } = useTheme()

  // Use shared map context for search and viewport
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
    saveCurrentView,
    deleteSavedView: deleteSavedViewFromContext,
    updateSavedViewName,
  } = useMap()
  
  // Determine map style based on theme
  const mapStyle = theme === 'light' 
    ? 'mapbox://styles/mapbox/light-v11' 
    : 'mapbox://styles/mapbox/dark-v11'

  // Local state for editing views
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [newViewName, setNewViewName] = useState('')
  const [editingViewId, setEditingViewId] = useState<string | null>(null)
  const [editingViewName, setEditingViewName] = useState('')

  // Keep ref in sync with state for use in event handlers (avoids stale closure)
  useEffect(() => {
    selectedFeatureIdRef.current = selectedFeatureId
  }, [selectedFeatureId])

  // Merge aquifer data with projection-based colors
  const enhanceAquiferData = useCallback((baseData: GeoJSON.FeatureCollection): GeoJSON.FeatureCollection => {
    // Create a lookup map from local aquifer data with projections
    const aquiferLookup = new Map<string, any>()
    const localFeaturesMap = new Map<string, any>()
    
    aquifersData.features.forEach((feature: any) => {
      const name = feature.properties?.name
      if (name) {
        aquiferLookup.set(name.toLowerCase(), feature.properties)
        localFeaturesMap.set(name.toLowerCase(), feature)
      }
    })

    // Track which local aquifers have been matched
    const matchedLocalAquifers = new Set<string>()

    // Start with API features, enhanced with local data
    const enhancedFeatures = (baseData?.features || []).map((feature: any, index: number) => {
      const name = feature.properties?.displayName || 
                   feature.properties?.AQ_NAME || 
                   feature.properties?.NAME || 
                   feature.properties?.name || ''
      
      // Try to find matching aquifer data with projections
      const localAquiferData = aquiferLookup.get(name.toLowerCase())
      
      if (localAquiferData) {
        matchedLocalAquifers.add(name.toLowerCase())
      }
      
      // Merge properties - prefer local data with projections
      const mergedProperties = {
        ...feature.properties,
        ...(localAquiferData || {}),
        name: name || localAquiferData?.name || 'Unknown Aquifer'
      }
      
      // Calculate fill color based on percentage of 2025 baseline
      const fillColor = getDepletionColor(mergedProperties, projectionYear)
      
      // Get current volume for the selected year
      const currentVolume = localAquiferData?.projections 
        ? getVolumeForYear(localAquiferData.projections, projectionYear)
        : null
      
      // Get depletion status
      const depletionStatus = getDepletionStatus(mergedProperties, projectionYear)
      
      return {
        ...feature,
        id: feature.id || `aquifer-${index}`,
        properties: {
          ...mergedProperties,
          fillColor,
          currentVolume,
          depletionStatus: depletionStatus.label,
          depletionSeverity: depletionStatus.severity,
          depletionPercentage: depletionStatus.percentage
        }
      }
    })

    // Add local aquifers that weren't in the API response
    let localIndex = enhancedFeatures.length
    localFeaturesMap.forEach((localFeature, nameLower) => {
      if (!matchedLocalAquifers.has(nameLower) && localFeature.geometry) {
        const properties = localFeature.properties
        const fillColor = getDepletionColor(properties, projectionYear)
        const currentVolume = properties?.projections 
          ? getVolumeForYear(properties.projections, projectionYear)
          : null
        const depletionStatus = getDepletionStatus(properties, projectionYear)
        
        enhancedFeatures.push({
          type: 'Feature',
          id: `local-aquifer-${localIndex}`,
          geometry: localFeature.geometry,
          properties: {
            ...properties,
            fillColor,
            currentVolume,
            depletionStatus: depletionStatus.label,
            depletionSeverity: depletionStatus.severity,
            depletionPercentage: depletionStatus.percentage
          }
        })
        localIndex++
      }
    })

    return {
      type: 'FeatureCollection',
      features: enhancedFeatures
    }
  }, [projectionYear])

  // Fetch aquifer data for visible map bounds
  const fetchAquiferData = useCallback(async (bounds?: { north: number; south: number; east: number; west: number }) => {
    setLoading(true)
    setError(null)
    
    let url = `${API_BASE}/api/usgs/aquifers`
    const params = new URLSearchParams()
    
    if (bounds) {
      params.append('north', bounds.north.toString())
      params.append('south', bounds.south.toString())
      params.append('east', bounds.east.toString())
      params.append('west', bounds.west.toString())
    } else {
      // Default to US-wide bounds if none provided
      params.append('north', '50')
      params.append('south', '24')
      params.append('east', '-66')
      params.append('west', '-125')
    }
    
    url += `?${params.toString()}`

    try {
      // Add timeout to prevent infinite loading
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout
      
      try {
        const response = await fetch(url, {
          signal: controller.signal
        })
        
        clearTimeout(timeoutId)
        
        if (!response.ok) {
          throw new Error(`Failed to fetch aquifer data: ${response.statusText}`)
        }

        const result = await response.json()

      if (result.success && result.data) {
        const aquifers = result.data
        
        if (!aquifers || !aquifers.features) {
          setLoading(false)
          return
        }

        // Enhance with projection data and colors
        const enhancedAquifers = enhanceAquiferData(aquifers)
        
          setAquiferData(prevData => {
            if (!prevData) {
              setAquiferCount(enhancedAquifers.features.length)
              return enhancedAquifers
            }
            
          // Merge with existing data
            const existingMap = new Map()
            prevData.features.forEach((f: any) => {
              const key = f.id || JSON.stringify(f.geometry?.coordinates?.[0]?.[0])
              if (key) existingMap.set(key, f)
            })
            
            enhancedAquifers.features.forEach((f: any) => {
              const key = f.id || JSON.stringify(f.geometry?.coordinates?.[0]?.[0])
              if (key && !existingMap.has(key)) {
                existingMap.set(key, f)
              }
            })
            
            const merged = {
              type: 'FeatureCollection' as const,
              features: Array.from(existingMap.values())
            }
            
            setAquiferCount(merged.features.length)
            return merged
          })
      }
      } catch (fetchErr) {
        clearTimeout(timeoutId)
        throw fetchErr
      }
    } catch (err) {
      console.error('Error fetching aquifer data:', err)
      if (err instanceof Error && err.name === 'AbortError') {
        setError('Request timed out. The backend may not be running. Please check that the backend server is started.')
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load aquifer data. Please check that the backend server is running.')
      }
    } finally {
      setLoading(false)
    }
  }, [enhanceAquiferData])

  // Helper function to set up map layers
  const setupMapLayers = useCallback((map: mapboxgl.Map, force = false) => {
    // Skip style check when force is true (called from style.load handler)
    if (!force) {
      try {
        if (!map.isStyleLoaded()) {
          console.log('Map style not loaded yet, waiting...')
          return false
        }
      } catch (e) {
        console.log('Error checking style loaded:', e)
        return false
      }
    }
    
    try {
      // Remove existing layers and source if force is true (for style changes)
      // This is necessary because setStyle() removes all custom layers
      if (force) {
        console.log('🔧 Force re-creating aquifer layers after style change...')
      }

      // Always try to add source (it won't exist after style change)
      if (!map.getSource('aquifers')) {
        console.log('📦 Adding aquifers source...')
        map.addSource('aquifers', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
          generateId: true
        })
      }

      // Find a good insertion point - try to place before labels but after water/land
      // Common Mapbox layer IDs to try: 'waterway-label', 'place-labels', 'poi-label', 'road-label'
      let beforeId: string | undefined = undefined
      const labelLayerIds = ['waterway-label', 'place-labels', 'poi-label', 'road-label', 'water-label', 'settlement-label']
      for (const layerId of labelLayerIds) {
        if (map.getLayer(layerId)) {
          beforeId = layerId
          break
        }
      }
      
      // If no label layer found, try to insert before any layer with 'label' in the name
      if (!beforeId) {
        const style = map.getStyle()
        if (style && style.layers) {
          const labelLayer = style.layers.find((layer: any) => 
            layer.id && (layer.id.includes('label') || layer.id.includes('Label'))
          )
          if (labelLayer) {
            beforeId = labelLayer.id
          }
        }
      }

      // Add fill layer for aquifers
      if (!map.getLayer('aquifer-fill')) {
        console.log('🎨 Adding aquifer-fill layer...', beforeId ? `(before ${beforeId})` : '(at top)')
        map.addLayer({
          id: 'aquifer-fill',
          type: 'fill',
          source: 'aquifers',
          paint: {
            'fill-color': ['coalesce', ['get', 'fillColor'], '#6366f1'],
            'fill-opacity': [
              'case',
              ['==', ['feature-state', 'selected'], true],
              0.8,  // Selected: higher opacity
              0.6   // Not selected: increased from 0.5 for better visibility
            ],
            'fill-outline-color': [
              'case',
              ['==', ['feature-state', 'selected'], true],
              '#ffffff',
              'rgba(0, 0, 0, 0.2)'  // Subtle outline for visibility
            ]
          }
        }, beforeId)
      }

      // Add outline layer for selected state
      if (!map.getLayer('aquifer-outline')) {
        console.log('🎨 Adding aquifer-outline layer...', beforeId ? `(before ${beforeId})` : '(at top)')
        map.addLayer({
          id: 'aquifer-outline',
          type: 'line',
          source: 'aquifers',
          paint: {
            'line-color': [
              'case',
              ['==', ['feature-state', 'selected'], true],
              '#ffffff',  // Selected: white outline
              'transparent' // Not selected: no outline
            ],
            'line-width': [
              'case',
              ['==', ['feature-state', 'selected'], true],
              3,  // Selected: 3px outline
              0   // Not selected: no outline
            ]
          }
        }, beforeId)
      }

      // Add hover outline
      if (!map.getLayer('aquifer-hover')) {
        console.log('🎨 Adding aquifer-hover layer...', beforeId ? `(before ${beforeId})` : '(at top)')
        map.addLayer({
          id: 'aquifer-hover',
          type: 'line',
          source: 'aquifers',
          paint: {
            'line-color': [
              'case',
              ['boolean', ['feature-state', 'hover'], false],
              'rgba(255, 255, 255, 0.5)',
              'transparent'
            ],
            'line-width': [
              'case',
              ['boolean', ['feature-state', 'hover'], false],
              2,
              0
            ]
          }
        }, beforeId)
      }

      console.log('✅ All aquifer layers set up successfully')

      if (isMountedRef.current && !force) {
        setMapLoaded(true)
      }
      return true
    } catch (error) {
      console.error('❌ Error setting up map layers:', error)
      return false
    }
  }, [])

  // Initialize map
  useEffect(() => {
    isMountedRef.current = true
    
    if (!mapContainer.current) return
    
    if (mapRef.current) {
      // Map already exists, just update viewport
      try {
        mapRef.current.setCenter([viewport.center.lng, viewport.center.lat])
        mapRef.current.setZoom(viewport.zoom)
        } catch (e) {
        // Map might be in bad state
          }
          return
    }

    const container = mapContainer.current
    const rect = container.getBoundingClientRect()
    
    if (rect.width === 0 || rect.height === 0) {
      const timer = setTimeout(() => {
        // Retry
      }, 100)
      return () => clearTimeout(timer)
    }

    let map: mapboxgl.Map
    try {
      map = new mapboxgl.Map({
        container: mapContainer.current,
        style: mapStyle,
        center: [viewport.center.lng, viewport.center.lat],
        zoom: viewport.zoom,
        maxBounds: [
          [-130, 20], // Southwest coordinates (west of CA, south of TX)
          [-60, 55]   // Northeast coordinates (east of ME, north of US-Canada border)
        ],
        minZoom: 3,
      })
    } catch (error) {
      console.error('Failed to create Mapbox map:', error)
      return
    }

    map.addControl(new mapboxgl.NavigationControl(), 'top-right')

    // Handle window resize to ensure map fills container
    const handleResize = () => {
      if (map && !map._removed) {
        map.resize()
      }
    }
    window.addEventListener('resize', handleResize)

    // Also use ResizeObserver for container-specific resizes
    const resizeObserver = new ResizeObserver(() => {
      if (map && !map._removed) {
        map.resize()
      }
    })
    if (mapContainer.current) {
      resizeObserver.observe(mapContainer.current)
    }

    let moveTimeout: NodeJS.Timeout | null = null
    let hoveredFeatureId: string | number | null = null
    
    map.on('load', () => {
      setupMapLayers(map)
      
      const bounds = map.getBounds()
      const ne = bounds.getNorthEast()
      const sw = bounds.getSouthWest()
      const padding = 5.0
      fetchAquiferData({
        north: ne.lat + padding,
        south: sw.lat - padding,
        east: ne.lng + padding,
        west: sw.lng - padding
      })
    })
    
    map.on('moveend', () => {
      if (moveTimeout) clearTimeout(moveTimeout)
      moveTimeout = setTimeout(() => {
        if (!mapRef.current || mapRef.current !== map) return
        
        const bounds = map.getBounds()
        const ne = bounds.getNorthEast()
        const sw = bounds.getSouthWest()
        const padding = 2.0
        
        fetchAquiferData({
          north: ne.lat + padding,
          south: sw.lat - padding,
          east: ne.lng + padding,
          west: sw.lng - padding
        })
        
        // Update shared viewport state
        setViewport({
          center: { lat: map.getCenter().lat, lng: map.getCenter().lng },
          zoom: map.getZoom()
        })
      }, 500)
    })

    map.on('error', (e: any) => {
      console.error('Mapbox error:', e)
      if (e.error?.status === 401 || e.error?.message?.includes('401')) {
        setError('Mapbox access token is invalid or expired.')
      }
    })

    // Click handler for aquifer selection
    map.on('click', 'aquifer-fill', (e) => {
      // Stop event propagation to prevent the general map click handler from firing
      e.originalEvent?.stopPropagation()
      
      if (!e.features || e.features.length === 0) return
      
      const feature = e.features[0]
      const properties = feature.properties
      if (!properties) return

      const featureId = feature.id
      if (featureId === undefined) return

      // Use ref to get current selection (avoids stale closure)
      const currentSelectedId = selectedFeatureIdRef.current

      // If clicking the same aquifer, deselect it
      if (currentSelectedId === featureId) {
        // Clear ALL feature states from the source to ensure clean deselection
        try {
          map.removeFeatureState({ source: 'aquifers' })
        } catch (err) {
          console.warn('Could not clear feature states:', err)
        }
        map.triggerRepaint()
        setSelectedFeatureId(null)
        setSelectedAquifer(null)
        return
      }

      // Clear ALL feature states from the source (ensures only one selected at a time)
      try {
        map.removeFeatureState({ source: 'aquifers' })
      } catch (err) {
        console.warn('Could not clear feature states:', err)
      }

      // Set new selection
      map.setFeatureState(
        { source: 'aquifers', id: featureId },
        { selected: true }
      )
      map.triggerRepaint()
      setSelectedFeatureId(featureId)

      // Parse projections if it's a string (GeoJSON properties get stringified)
      let projections = properties.projections
      if (typeof projections === 'string') {
        try {
          projections = JSON.parse(projections)
        } catch (parseErr) {
          projections = undefined
        }
      }

      // Set selected aquifer for details panel with new data structure
      setSelectedAquifer({
        name: properties.name || properties.displayName || properties.AQ_NAME || 'Unknown Aquifer',
        state: properties.state,
        region: properties.region,
        rock_type: properties.rock_type || properties.ROCK_TYPE,
        recharge_rate: properties.recharge_rate,
        consumption_factor: properties.consumption_factor,
        volume_gallons_2025: properties.volume_gallons_2025,
        projections: projections,
        currentVolume: properties.currentVolume,
        depletionStatus: properties.depletionStatus,
        depletionSeverity: properties.depletionSeverity,
        depletionPercentage: properties.depletionPercentage
      })
    })

    // Click elsewhere to deselect - only fires when NOT clicking on an aquifer
    map.on('click', (e) => {
      // Check if click was on an aquifer layer
      const features = map.queryRenderedFeatures(e.point, { layers: ['aquifer-fill'] })
      
      // Only deselect if clicking outside of any aquifer
      if (features.length === 0) {
        // Clear ALL feature states from the source
        try {
          map.removeFeatureState({ source: 'aquifers' })
        } catch (err) {
          console.warn('Could not clear feature states:', err)
        }
        map.triggerRepaint()
        setSelectedFeatureId(null)
        setSelectedAquifer(null)
      }
    })

    // Hover effects
    map.on('mouseenter', 'aquifer-fill', (e) => {
      map.getCanvas().style.cursor = 'pointer'
      if (e.features && e.features.length > 0) {
        const featureId = e.features[0].id
        if (featureId !== undefined && featureId !== hoveredFeatureId) {
          if (hoveredFeatureId !== null) {
            map.setFeatureState(
              { source: 'aquifers', id: hoveredFeatureId },
              { hover: false }
            )
          }
          hoveredFeatureId = featureId
          map.setFeatureState(
            { source: 'aquifers', id: featureId },
            { hover: true }
          )
        }
      }
    })
    
    map.on('mouseleave', 'aquifer-fill', () => {
      map.getCanvas().style.cursor = ''
      if (hoveredFeatureId !== null) {
        map.setFeatureState(
          { source: 'aquifers', id: hoveredFeatureId },
          { hover: false }
        )
        hoveredFeatureId = null
      }
    })

    mapRef.current = map

    return () => {
      if (moveTimeout) clearTimeout(moveTimeout)
      isMountedRef.current = false
      
      // Clean up resize handlers
      window.removeEventListener('resize', handleResize)
      resizeObserver.disconnect()
      
      if (mapRef.current === map) {
        if (!mapContainer.current) {
          try {
            mapRef.current.remove()
          } catch (e) {
            // Ignore
          }
          mapRef.current = null
        }
      }
    }
  }, []) // Only run once on mount

  // Sync viewport changes from context to map
  useEffect(() => {
    if (mapRef.current && mapLoaded) {
      const map = mapRef.current
      const currentCenter = map.getCenter()
      const currentZoom = map.getZoom()
      
      // Only update if significantly different to avoid infinite loops
      if (
        Math.abs(currentCenter.lat - viewport.center.lat) > 0.001 ||
        Math.abs(currentCenter.lng - viewport.center.lng) > 0.001 ||
        Math.abs(currentZoom - viewport.zoom) > 0.1
      ) {
        map.flyTo({
          center: [viewport.center.lng, viewport.center.lat],
          zoom: viewport.zoom,
          duration: 1000
        })
      }
    }
  }, [viewport, mapLoaded])

  // Keep ref in sync with aquifer data
  useEffect(() => {
    aquiferDataRef.current = aquiferData
  }, [aquiferData])

  // Track previous map style to detect changes
  const prevMapStyleRef = useRef(mapStyle)

  // Update map style when theme changes
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return
    
    // Skip if style hasn't actually changed
    if (prevMapStyleRef.current === mapStyle) return
    prevMapStyleRef.current = mapStyle

    const map = mapRef.current
    
    // Store current viewport
    const center = map.getCenter()
    const zoom = map.getZoom()
    const pitch = map.getPitch()
    const bearing = map.getBearing()
    
    // Store current aquifer data from ref
    const currentAquiferData = aquiferDataRef.current
    
    console.log('🎨 WaterAccessView: Changing map style to:', mapStyle)
    console.log('📦 Current aquifer data:', currentAquiferData ? `${currentAquiferData.features.length} features` : 'none')

    // Change the style
    map.setStyle(mapStyle)

    // Function to restore everything after style loads with retry logic
    const restoreLayersAndData = (retryCount = 0) => {
      const maxRetries = 5
      
      try {
        // Check if map is ready
        if (!map.isStyleLoaded()) {
          if (retryCount < maxRetries) {
            console.log(`⏳ Style not fully loaded, retrying (${retryCount + 1}/${maxRetries})...`)
            setTimeout(() => restoreLayersAndData(retryCount + 1), 200)
          }
          return
        }

        // Restore viewport
        map.setCenter(center)
        map.setZoom(zoom)
        map.setPitch(pitch)
        map.setBearing(bearing)
        
        console.log('🔧 Setting up aquifer layers...')

        // Force re-setup the layers
        const layersReady = setupMapLayers(map, true)
        console.log('✅ Layers setup result:', layersReady)
        
        if (currentAquiferData && currentAquiferData.features && currentAquiferData.features.length > 0) {
          // Try to add data with retry
          const addData = (dataRetry = 0) => {
            try {
              const source = map.getSource('aquifers') as mapboxgl.GeoJSONSource
              if (source) {
                const enhancedData = enhanceAquiferData(currentAquiferData)
                source.setData(enhancedData)
                map.triggerRepaint()
                console.log('✅ Aquifer data restored:', enhancedData.features.length, 'features')
              } else if (dataRetry < 5) {
                console.log(`⏳ Source not ready, retrying data add (${dataRetry + 1}/5)...`)
                setTimeout(() => addData(dataRetry + 1), 100)
              } else {
                console.warn('⚠️ Could not find aquifer source after retries')
              }
            } catch (error) {
              console.error('❌ Error adding aquifer data:', error)
              if (dataRetry < 5) {
                setTimeout(() => addData(dataRetry + 1), 100)
              }
            }
          }
          
          setTimeout(() => addData(), 150)
        }
      } catch (error) {
        console.error('❌ Error in restoreLayersAndData:', error)
        if (retryCount < maxRetries) {
          setTimeout(() => restoreLayersAndData(retryCount + 1), 200)
        }
      }
    }

    // Listen for style.load event
    const onStyleLoad = () => {
      console.log('🎨 WaterAccessView: New style loaded')
      // Small delay to ensure style is fully settled
      setTimeout(() => restoreLayersAndData(), 100)
    }
    
    map.once('style.load', onStyleLoad)
    
    // Cleanup
    return () => {
      map.off('style.load', onStyleLoad)
    }
  }, [mapStyle, mapLoaded, setupMapLayers, enhanceAquiferData])

  // Update map data when aquifer data or projection year changes
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return

    const map = mapRef.current

    if (aquiferData && aquiferData.features && aquiferData.features.length > 0) {
      // Re-enhance data with current projection year
      const enhancedData = enhanceAquiferData(aquiferData)
      
      const source = map.getSource('aquifers') as mapboxgl.GeoJSONSource
      if (source) {
        try {
          // Clear all feature states before updating data to prevent stale selections
          map.removeFeatureState({ source: 'aquifers' })
          source.setData(enhancedData)
          
          console.log('✅ Updated aquifer source with', enhancedData.features.length, 'features')
          if (enhancedData.features.length > 0) {
            console.log('📍 Sample feature:', {
              id: enhancedData.features[0].id,
              name: enhancedData.features[0].properties?.name,
              fillColor: enhancedData.features[0].properties?.fillColor,
              hasGeometry: !!enhancedData.features[0].geometry
            })
          }
          
          // Re-apply selection if there was one (after data update, feature IDs might change)
          // For now, just clear selection when data updates
          setSelectedFeatureId(null)
          setSelectedAquifer(null)
          
          map.triggerRepaint()
        } catch (error) {
          console.error('❌ Error updating aquifer source:', error)
        }
      } else {
        console.warn('⚠️ Aquifer source not found when trying to update data')
      }
    }
  }, [aquiferData, mapLoaded, projectionYear, enhanceAquiferData])

  // Search form handler
  const handleSearchSubmit = useCallback((e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    executeSearch(searchTerm)
  }, [executeSearch, searchTerm])

  // Saved views handlers
  const loadSavedView = useCallback((view: SavedView) => {
    loadSavedViewFromContext(view)
  }, [loadSavedViewFromContext])

  const handleSaveCurrentView = useCallback(() => {
    if (!newViewName.trim()) return
    saveCurrentView(newViewName, [], {})
    setNewViewName('')
    setShowSaveDialog(false)
  }, [newViewName, saveCurrentView])

  const deleteSavedView = useCallback((viewId: string) => {
    deleteSavedViewFromContext(viewId)
  }, [deleteSavedViewFromContext])

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
    setEditingViewName('')
  }, [editingViewId, editingViewName, updateSavedViewName])

  const cancelEdit = useCallback(() => {
    setEditingViewId(null)
    setEditingViewName('')
  }, [])

  // DnD sensors
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

  // Close details panel
  const closeDetailsPanel = useCallback(() => {
    if (mapRef.current) {
      // Clear ALL feature states from the source
      try {
        mapRef.current.removeFeatureState({ source: 'aquifers' })
      } catch (e) {
        console.warn('Could not clear feature states:', e)
      }
      mapRef.current.triggerRepaint()
    }
    setSelectedFeatureId(null)
    setSelectedAquifer(null)
  }, [])

  return (
    <div style={{ 
      width: '100%', 
      height: '100%', 
      minHeight: '100vh',
      position: 'relative', 
      background: '#1a1a2e',
      overflow: 'hidden'
    }}>
      <div 
        ref={mapContainer} 
        style={{ 
          width: '100%', 
          height: '100%',
          minHeight: '100vh',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0
        }} 
      />

      {loading && <LoadingOverlay message="Loading aquifer data from USGS..." />}
      
      {/* Error overlay for map issues */}
      {error && error.includes('Mapbox') && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'rgba(239, 68, 68, 0.95)',
          color: 'white',
          padding: '24px 32px',
          borderRadius: '12px',
          zIndex: 1001,
          maxWidth: '500px',
          textAlign: 'center',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)'
        }}>
          <h3 style={{ margin: '0 0 12px', fontSize: '18px', fontWeight: 600 }}>Map Loading Error</h3>
          <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.5 }}>{error}</p>
        </div>
      )}

      {/* Left Sidebar - Search & Views */}
      <aside className="absolute left-4 top-4 z-[1000] flex h-[calc(100%-32px)] w-[360px] flex-col pointer-events-none">
        <div className="flex-1 overflow-y-auto space-y-4 pointer-events-auto">
          <div className="widget-container">
            <form className="flex gap-2" onSubmit={handleSearchSubmit}>
              <div className="relative flex-1">
                <Input
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
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
                  No saved views. Click "New View" to save.
                </p>
              ) : (
                <div className="rounded-md border border-[var(--cs-border-default)] bg-[var(--cs-surface-elevated)] p-2">
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
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
                            loadSavedView={loadSavedView}
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
                                if (e.key === 'Enter') handleSaveCurrentView()
                                if (e.key === 'Escape') {
                                  setShowSaveDialog(false)
                                  setNewViewName('')
                                }
                              }}
                              autoFocus
                            />
                            <Button
                              size="sm"
                              className="h-8 w-8 p-0 bg-blue-500 hover:bg-blue-600"
                              onClick={handleSaveCurrentView}
                            >
                              <Save className="h-3.5 w-3.5 text-white" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0"
                              onClick={() => {
                                setShowSaveDialog(false)
                                setNewViewName('')
                              }}
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
        </div>
      </aside>

      {/* Right Sidebar - Projection Year & Details */}
      <div className="absolute top-4 right-4 z-[1000] w-80 space-y-4 pointer-events-auto">
        {/* Groundwater Projection Year Selector */}
        <div className="widget-container">
        <div style={{ marginBottom: 24 }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: 16
          }}>
            <h3 className="text-sm font-medium text-foreground">
              Groundwater Projection Year
            </h3>
            <span style={{ 
              fontSize: 18, 
              fontWeight: 700,
              color: '#3b82f6'
            }}>
              {projectionYear}
            </span>
          </div>

          {/* Slider */}
          <div className="space-y-2">
            <Slider
              value={[projectionYear]}
              min={2025}
              max={2125}
              step={1}
              onValueChange={(value) => setProjectionYear(value[0])}
            />
          </div>

          {/* Gradient Legend */}
          <div className="space-y-1 mt-3">
            <div className="h-3 w-full rounded-full" style={{
              background: 'linear-gradient(to right, #22c55e 0%, #3b82f6 33%, #f97316 66%, #ef4444 100%)'
            }} />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>2025</span>
              <span>2050</span>
              <span>2075</span>
              <span>2100</span>
              <span>2125</span>
            </div>
          </div>
        </div>

          {/* Aquifer Capacity Legend */}
        <div>
          <h3 className="text-sm font-medium text-foreground mb-3">
            Depletion Severity
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
                { color: '#22c55e', label: 'Stable / Healthy' },
                { color: '#3b82f6', label: 'Moderate / Recovering' },
                { color: '#f59e0b', label: 'Stressed / Declining' },
                { color: '#ef4444', label: 'Critical / Depleting' },
                { color: '#6366f1', label: 'Unknown' }
            ].map(({ color, label }) => (
              <div key={label} style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 10
              }}>
                <div style={{ 
                  width: 16, 
                  height: 16, 
                  background: color, 
                  borderRadius: 3,
                  flexShrink: 0
                }} />
                <span className="text-xs text-foreground/80">
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>
        </div>

        {/* Groundwater Details Panel - Only shows when aquifer is selected */}
        {selectedAquifer && (
          <GroundwaterDetailsPanel
            selectedAquifer={selectedAquifer}
            projectionYear={projectionYear}
            onClose={closeDetailsPanel}
          />
        )}
      </div>
    </div>
  )
}
