// Water Access View - Groundwater, Rivers, Lakes, Metro Humidity
import { useEffect, useRef, useState, useCallback } from 'react'
import { createRoot, Root } from 'react-dom/client'
import { Link } from 'react-router-dom'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { useMap } from '../contexts/MapContext'
import { useTheme } from '../contexts/ThemeContext'
import { useSidebar } from '../contexts/SidebarContext'
import { MetroHumidityBubble } from './MetroHumidityBubble'
import { useClimate } from '@climate-studio/core'
import { climateLayers } from '@climate-studio/core/config'
import { useClimateLayerData } from '../hooks/useClimateLayerData'
import { GroundwaterDetailsPanel, SelectedAquifer } from './panels/GroundwaterDetailsPanel'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Slider } from './ui/slider'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Search, Loader2, MapPin, Save, Bookmark, GripVertical, MoreHorizontal, Trash2, Pencil, Waves, Droplets, CloudRain } from 'lucide-react'
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
// Import river data - Natural Earth 10m rivers with accurate geometry
import riversData from '../data/rivers-with-depletion.json'
// Import lakes data with water level projections
import lakesData from '../data/lakes.json'
// Import metro humidity data with projections
import metroHumidityData from '../data/metroHumidity.json'
// Import megaregion data for Metro Data Statistics layer
import megaregionData from '../data/megaregion-data.json'
// Removed aqueductsData import - using canal-lines layer only (no dashed lines)
// Import dam infrastructure data
import damsData from '../data/dams.json'
// Import enhanced water infrastructure (impacted rivers, aqueducts, connections)
import enhancedInfrastructureData from '../data/enhanced-water-infrastructure.json'
// Import water service area cities
import serviceAreasData from '../data/water-service-areas.json'

// Use environment variable or fallback to the token
const MAPBOX_ACCESS_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || 'pk.eyJ1Ijoiam9zaHVhYmJ1dGxlciIsImEiOiJjbWcwNXpyNXUwYTdrMmtva2tiZ2NjcGxhIn0.Fc3d_CloJGiw9-BE4nI_Kw'
mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN

// Backend API base URL
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'

// Helper: Create circle polygon from center point (for Metro Humidity circles)
function createCircle(lng: number, lat: number, radiusKm: number, points: number = 64): number[][] {
  const coords: number[][] = []
  const earthRadiusKm = 6371

  for (let i = 0; i <= points; i++) {
    const angle = (i / points) * 2 * Math.PI

    // Convert km to degrees (rough approximation)
    const latOffset = (radiusKm / earthRadiusKm) * (180 / Math.PI)
    const lngOffset = (radiusKm / earthRadiusKm) * (180 / Math.PI) / Math.cos(lat * Math.PI / 180)

    const newLat = lat + latOffset * Math.cos(angle)
    const newLng = lng + lngOffset * Math.sin(angle)

    coords.push([newLng, newLat])
  }

  return coords
}

// Helper: Calculate circle radius based on peak humidity (larger humidity = larger circle)
function humidityToRadius(peakHumidity: number): number {
  const scaleFactor = 0.3 // Adjust this to control overall size
  const baseRadius = peakHumidity * scaleFactor
  return Math.max(baseRadius, 20) // Minimum 20km radius for visibility
}

// Helper: Determine circle color based on humidity/temperature metrics
function getHumidityColor(peakHumidity: number, humidTemp: number): string {
  // Use a combination of humidity and temperature
  // Higher humidity + higher temp = more dangerous (red)
  // Lower values = safer (blue/green)
  
  const dangerScore = (peakHumidity / 100) * 0.5 + (humidTemp / 150) * 0.5
  
  if (dangerScore < 0.3) return '#3b82f6' // Blue - low risk
  if (dangerScore < 0.4) return '#06b6d4' // Cyan - moderate-low
  if (dangerScore < 0.5) return '#10b981' // Green - moderate
  if (dangerScore < 0.6) return '#eab308' // Yellow - moderate-high
  if (dangerScore < 0.7) return '#f97316' // Orange - high
  if (dangerScore < 0.8) return '#ef4444' // Red - very high
  return '#dc2626' // Dark red - extreme
}

// Helper: Calculate circle radius based on population (from Metro Data Statistics)
function populationToRadius(population: number): number {
  const scaleFactor = 0.015
  const baseRadius = Math.sqrt(population) * scaleFactor
  return Math.max(baseRadius, 30) // Minimum 30km radius for visibility
}

// Helper: Determine circle color based on population growth (from Metro Data Statistics)
function getGrowthColor(currentPop: number, previousPop: number): string {
  if (!previousPop || previousPop === 0) return '#888888' // Gray for no data

  const growthRate = (currentPop - previousPop) / previousPop

  if (Math.abs(growthRate) < 0.001) return '#888888' // Gray only if essentially no change

  // Declining metros (warm colors: dark red → orange) - ALARMING
  if (growthRate < -0.05) return '#dc2626' // Strong decline - dark red
  if (growthRate < -0.02) return '#ef4444' // Moderate decline - red
  if (growthRate < 0) return '#f97316' // Slight decline - orange

  // Slow growth (yellow → green)
  if (growthRate < 0.03) return '#f59e0b' // Very slow growth - amber
  if (growthRate < 0.06) return '#eab308' // Slow growth - yellow
  if (growthRate < 0.09) return '#84cc16' // Moderate-slow growth - lime

  // Faster growth (cool colors: green → blue) - POSITIVE
  if (growthRate < 0.12) return '#10b981' // Moderate growth - emerald
  if (growthRate < 0.15) return '#06b6d4' // Moderate-fast growth - cyan
  if (growthRate < 0.18) return '#0ea5e9' // Fast growth - sky blue

  return '#3b82f6' // Very fast growth - blue
}

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

// Get GRACE depletion color based on cm/year trend
// Matches GRACE hexagon color scheme: red=depletion, green=stable/recharge
function getGRACEDepletionColor(trendCmPerYear: number): string {
  if (trendCmPerYear <= -3) return '#8b0000'   // Dark red - severe depletion
  if (trendCmPerYear <= -2) return '#dc143c'   // Crimson - high depletion
  if (trendCmPerYear <= -1) return '#ff6347'   // Tomato - moderate depletion
  if (trendCmPerYear <= -0.5) return '#ffa500' // Orange - mild depletion
  if (trendCmPerYear <= 0.5) return '#90ee90'  // Light green - stable
  if (trendCmPerYear <= 1) return '#32cd32'    // Lime green - recharge
  return '#228b22'                             // Forest green - strong recharge
}

// Get river flow depletion color based on percentage of 2025 baseline
function getRiverDepletionColor(properties: any, projectionYear: number = 2025): string {
  const baseline = properties?.baseline_flow_cfs_2025 || properties?.flow_projections?.['2025']
  const projections = properties?.flow_projections

  if (!baseline || !projections) {
    return '#6366f1' // Default purple for unknown
  }

  const currentFlow = getVolumeForYear(projections, projectionYear)
  if (currentFlow === null) {
    return '#6366f1' // Default purple for unknown
  }

  const percentageOfBaseline = (currentFlow / baseline) * 100

  if (percentageOfBaseline >= 95) {
    return '#22c55e' // Green - Stable
  }
  if (percentageOfBaseline >= 80) {
    return '#3b82f6' // Blue - Moderate decline
  }
  if (percentageOfBaseline >= 60) {
    return '#f97316' // Orange - Significant decline
  }

  return '#ef4444' // Red - Severe decline
}

// Calculate river depletion percentage
function getRiverDepletionPercentage(properties: any, projectionYear: number): number {
  const baseline = properties?.baseline_flow_cfs_2025 || properties?.flow_projections?.['2025']
  const projections = properties?.flow_projections

  if (!baseline || !projections) return 0

  const currentFlow = getVolumeForYear(projections, projectionYear)
  if (currentFlow === null) return 0

  const depletionPercent = ((baseline - currentFlow) / baseline) * 100
  return Math.round(depletionPercent * 10) / 10 // Round to 1 decimal
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

export default function WaterAccessView() {
  const mapContainer = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const isMountedRef = useRef(true)
  const selectedFeatureIdRef = useRef<string | number | null>(null) // Ref to track selection in event handlers
  const aquiferDataRef = useRef<GeoJSON.FeatureCollection | null>(null) // Ref to persist aquifer data across style changes
  const metroMarkersRef = useRef<Array<{ marker: mapboxgl.Marker; root: Root }>>([]) // Store metro humidity markers and React roots
  const [, forceUpdate] = useState(0) // Force re-render when map moves to update marker positions
  const [metroHoverInfo, setMetroHoverInfo] = useState<{
    x: number
    y: number
    cityName?: string
    humidityData?: {
      peak_humidity: number
      wet_bulb_events: number
      humid_temp: number
      days_over_100: number
    }
  } | null>(null)
  const [megaregionHoverInfo, setMegaregionHoverInfo] = useState<{
    x: number
    y: number
    metroName?: string
    metroPopulation?: number
    metroYear?: number
  } | null>(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [aquiferData, setAquiferData] = useState<GeoJSON.FeatureCollection | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [aquiferCount, setAquiferCount] = useState(0)
  const [projectionYear, setProjectionYear] = useState(2025)
  const [selectedAquifer, setSelectedAquifer] = useState<SelectedAquifer | null>(null)
  const [selectedFeatureId, setSelectedFeatureId] = useState<string | number | null>(null)
  const [selectedMetroCity, setSelectedMetroCity] = useState<string | null>(null)

  // Use theme context for map style
  const { theme } = useTheme()

  // Use sidebar context for hiding/showing panels
  const { panelsCollapsed } = useSidebar()

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

  // Water access layer toggles
  const [showRiversLayer, setShowRiversLayer] = useState(true)
  const [showCanalsLayer, setShowCanalsLayer] = useState(true)
  const [showAquifersLayer, setShowAquifersLayer] = useState(false) // Default OFF
  const [showDamsLayer, setShowDamsLayer] = useState(true) // Default ON
  const [showServiceAreasLayer, setShowServiceAreasLayer] = useState(true) // Default ON
  const [showMetroHumidityLayer, setShowMetroHumidityLayer] = useState(true) // Default ON
  const [showGroundwaterLayer, setShowGroundwaterLayer] = useState(true) // Default ON
  const [showHumidityWetBulb, setShowHumidityWetBulb] = useState(true)
  const [showTempHumidity, setShowTempHumidity] = useState(true)
  const [showMetroDataStatistics, setShowMetroDataStatistics] = useState(true) // Test: Metro Data Statistics layer

  // Climate context for precipitation & drought layer
  const { toggleLayer, isLayerActive, controls, setDroughtMetric, setDroughtOpacity } = useClimate()
  const precipitationDroughtLayer = climateLayers.find(l => l.id === 'precipitation_drought')
  const isPrecipitationDroughtActive = isLayerActive('precipitation_drought')
  const [aquiferOpacity, setAquiferOpacity] = useState(0.25)
  
  // Get map bounds for layer data fetching
  const [mapBounds, setMapBounds] = useState<{ north: number; south: number; east: number; west: number; zoom?: number } | null>(null)
  const { layers: layerStates } = useClimateLayerData(mapBounds)
  const precipitationDroughtData = layerStates.precipitation_drought?.data
  const precipitationDroughtStatus = layerStates.precipitation_drought?.status

  // Keep ref in sync with state for use in event handlers (avoids stale closure)
  useEffect(() => {
    selectedFeatureIdRef.current = selectedFeatureId
  }, [selectedFeatureId])

  // GRACE tile layer state
  const [graceTileUrl, setGraceTileUrl] = useState<string | null>(null)
  const [showGRACELayer, setShowGRACELayer] = useState(true)
  const [graceOpacity, setGraceOpacity] = useState(0.5) // Default 50% opacity

  // Fetch GRACE tile URL on mount
  useEffect(() => {
    const fetchGRACETileUrl = async () => {
      try {
        const apiUrl = import.meta.env.VITE_CLIMATE_API_URL || 'http://localhost:5001'
        const response = await fetch(`${apiUrl}/api/climate/groundwater/tiles`)

        if (response.ok) {
          const data = await response.json()
          if (data.tile_url) {
            setGraceTileUrl(data.tile_url)
            console.log('✅ GRACE tile URL fetched:', data.metadata)
          }
        }
      } catch (err) {
        console.warn('⚠️ Failed to fetch GRACE tile URL:', err)
      }
    }

    fetchGRACETileUrl()
  }, [])

  // Merge aquifer data with projection-based colors (GRACE shown via tiles)
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

      // Use projection-based color
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

      // Using solid fill for aquifers - no pattern loading needed

      // LAYER ORDER (bottom to top): Groundwater -> Rivers -> Metro Humidity -> Precipitation
      // Rivers should be on top of aquifers so they're visible

      // First, add groundwater aquifers (BOTTOM LAYER)
      if (!map.getLayer('aquifer-fill')) {
        console.log('🎨 Adding aquifer-fill layer (BOTTOM)...')
        map.addLayer({
          id: 'aquifer-fill',
          type: 'fill',
          source: 'aquifers',
          paint: {
            // Use solid fill color based on fillColor property
            'fill-color': ['coalesce', ['get', 'fillColor'], '#6366f1'],
            'fill-opacity': [
              'case',
              ['==', ['feature-state', 'selected'], true],
              0.8,  // Selected: higher opacity
              0.3   // Not selected: base opacity (controlled by slider)
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
        console.log('🎨 Adding aquifer-outline layer (BOTTOM)...')
        map.addLayer({
          id: 'aquifer-outline',
          type: 'line',
          source: 'aquifers',
          paint: {
            'line-color': [
              'case',
              ['==', ['feature-state', 'selected'], true],
              '#3b82f6',  // Selected: blue outline
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
        console.log('🎨 Adding aquifer-hover layer (BOTTOM)...')
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

      console.log('✅ All aquifer layers set up successfully (BOTTOM)')

      // Now add rivers on top of aquifers (MIDDLE LAYER)
      // Separate natural rivers from canals/aqueducts
      const naturalRivers: GeoJSON.FeatureCollection = {
        type: 'FeatureCollection',
        features: (riversData as any).features
      }

      // Extract canal/aqueduct features from enhanced infrastructure data
      const canals: GeoJSON.FeatureCollection = {
        type: 'FeatureCollection',
        features: (enhancedInfrastructureData as any).features.filter((f: any) =>
          f.properties?.infrastructure_type === 'aqueduct'
        )
      }

      // Add natural rivers source and layers (BOTTOM LAYER)
      if (!map.getSource('rivers')) {
        console.log('📦 Adding rivers source...')
        map.addSource('rivers', {
          type: 'geojson',
          data: naturalRivers
        })
      }

      // Add river line layer (blue with darker border for casing)
      // Use Natural Earth scalerank: 0-2=major, 3-4=medium, 5+=minor
      if (!map.getLayer('river-lines-casing')) {
        console.log('🎨 Adding river-lines-casing layer (MIDDLE - on top of aquifers)...')
        map.addLayer({
          id: 'river-lines-casing',
          type: 'line',
          source: 'rivers',
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-color': [
              'match',
              ['get', 'flow_status'],
              'dry', '#991b1b',          // Dark red for dry rivers
              'seasonal', '#c2410c',     // Dark orange for seasonal
              'reduced', '#ca8a04',      // Dark yellow for reduced
              '#1e3a8a'                  // Dark blue for natural (default)
            ],
            'line-width': [
              'interpolate',
              ['linear'],
              ['get', 'scalerank'],
              0, 6,    // Major rivers (Mississippi, Missouri): 6px
              2, 5,    // Large rivers (Mackenzie, St. Lawrence): 5px
              4, 3.5,  // Medium rivers (Arkansas, Snake): 3.5px
              6, 2.5,  // Small rivers: 2.5px
              9, 1.5   // Minor rivers: 1.5px
            ],
            'line-opacity': 0.6
          }
        }, beforeId)
      }

      if (!map.getLayer('river-lines')) {
        console.log('🎨 Adding river-lines layer (MIDDLE - on top of aquifers)...')
        map.addLayer({
          id: 'river-lines',
          type: 'line',
          source: 'rivers',
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-color': [
              'match',
              ['get', 'flow_status'],
              'dry', '#dc2626',          // Red - completely dry rivers
              'seasonal', '#f59e0b',     // Orange - seasonal/ephemeral flow
              'reduced', '#fbbf24',      // Yellow - reduced flow
              '#3b82f6'                  // Blue - natural flow (default)
            ],
            'line-width': [
              'interpolate',
              ['linear'],
              ['get', 'scalerank'],
              0, 4,    // Major rivers: 4px
              2, 3,    // Large rivers: 3px
              4, 2,    // Medium rivers: 2px
              6, 1.5,  // Small rivers: 1.5px
              9, 1     // Minor rivers: 1px
            ],
            'line-opacity': 0.85
          }
        }, beforeId)
      }

      // Add canals/aqueducts source and layers (distinct styling)
      if (!map.getSource('canals')) {
        console.log('📦 Adding canals source...')
        map.addSource('canals', {
          type: 'geojson',
          data: canals
        })
      }

      if (!map.getLayer('canal-lines-casing')) {
        console.log('🎨 Adding canal-lines-casing layer (BOTTOM)...')
        map.addLayer({
          id: 'canal-lines-casing',
          type: 'line',
          source: 'canals',
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-color': '#0891b2', // Dark cyan for casing
            'line-width': 5,
            'line-opacity': 0.9
          }
        }, beforeId)
      }

      if (!map.getLayer('canal-lines')) {
        console.log('🎨 Adding canal-lines layer (BOTTOM)...')
        map.addLayer({
          id: 'canal-lines',
          type: 'line',
          source: 'canals',
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-color': '#06b6d4', // Cyan for canals (professional engineered waterways)
            'line-width': 3,
            'line-opacity': 0.9
          }
        }, beforeId)
      }

      // Removed OSM aqueducts layer (dashed lines) - using canals layer only

      // Add major dams layer
      if (!map.getSource('dams')) {
        console.log('📦 Adding dams source...')
        map.addSource('dams', {
          type: 'geojson',
          data: damsData as any
        })
      }

      if (!map.getLayer('dams-circles')) {
        console.log('🎨 Adding dams layer...')
        map.addLayer({
          id: 'dams-circles',
          type: 'circle',
          source: 'dams',
          paint: {
            'circle-radius': [
              'interpolate',
              ['linear'],
              ['zoom'],
              4, 4,
              8, 8,
              12, 12
            ],
            'circle-color': [
              'match',
              ['get', 'downstream_impact'],
              'extreme', '#7f1d1d',    // Very dark red - extreme impact
              'severe', '#dc2626',     // Red - severe impact
              'moderate', '#f59e0b',   // Orange - moderate impact
              '#3b82f6'                // Blue - low impact
            ],
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff',
            'circle-opacity': 0.9
          }
        }, beforeId)
      }

      if (!map.getLayer('dams-labels')) {
        console.log('🎨 Adding dams labels layer...')
        map.addLayer({
          id: 'dams-labels',
          type: 'symbol',
          source: 'dams',
          layout: {
            'text-field': ['get', 'name'],
            'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
            'text-size': 11,
            'text-offset': [0, 1.5],
            'text-anchor': 'top'
          },
          paint: {
            'text-color': '#1e293b',
            'text-halo-color': '#ffffff',
            'text-halo-width': 1.5
          },
          minzoom: 6
        })
      }

      // Add water service areas (cities served by infrastructure)
      if (!map.getSource('service-areas')) {
        console.log('📦 Adding service-areas source...')
        map.addSource('service-areas', {
          type: 'geojson',
          data: serviceAreasData as any
        })
      }

      if (!map.getLayer('service-areas-circles')) {
        console.log('🎨 Adding service-areas layer...')
        map.addLayer({
          id: 'service-areas-circles',
          type: 'circle',
          source: 'service-areas',
          paint: {
            'circle-radius': [
              'interpolate',
              ['linear'],
              ['get', 'population'],
              50000, 4,
              500000, 8,
              2000000, 12,
              4000000, 16
            ],
            'circle-color': [
              'match',
              ['get', 'dependency'],
              'extreme', '#dc2626',    // Red - extreme dependency
              'high', '#f59e0b',       // Orange - high dependency
              'moderate', '#fbbf24',   // Yellow - moderate
              '#3b82f6'                // Blue - low dependency
            ],
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff',
            'circle-opacity': 0.7
          }
        }, beforeId)
      }

      if (!map.getLayer('service-areas-labels')) {
        console.log('🎨 Adding service-areas labels layer...')
        map.addLayer({
          id: 'service-areas-labels',
          type: 'symbol',
          source: 'service-areas',
          layout: {
            'text-field': ['get', 'city'],
            'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
            'text-size': 10,
            'text-offset': [0, 1.2],
            'text-anchor': 'top'
          },
          paint: {
            'text-color': '#374151',
            'text-halo-color': '#ffffff',
            'text-halo-width': 1
          },
          minzoom: 5
        })
      }

      // Add city markers for river and canal-supplied cities
      if (!map.getSource('river-cities')) {
        console.log('📦 Adding river-cities source...')
        const cityPoints: GeoJSON.FeatureCollection = {
          type: 'FeatureCollection',
          features: []
        }

        // Extract all cities from both rivers and canals data
        const allWaterways = [...naturalRivers.features, ...canals.features]
        allWaterways.forEach((waterway: any) => {
          if (waterway.properties?.cities_supplied) {
            waterway.properties.cities_supplied.forEach((city: any) => {
              cityPoints.features.push({
                type: 'Feature',
                geometry: {
                  type: 'Point',
                  coordinates: [city.lng, city.lat]
                },
                properties: {
                  name: city.name,
                  dependency: city.dependency,
                  waterwayName: waterway.properties.name
                }
              })
            })
          }
        })

        map.addSource('river-cities', {
          type: 'geojson',
          data: cityPoints
        })
      }

      // Add city marker layer
      if (!map.getLayer('river-city-markers')) {
        console.log('🎨 Adding river-city-markers layer (BOTTOM)...')
        map.addLayer({
          id: 'river-city-markers',
          type: 'circle',
          source: 'river-cities',
          paint: {
            'circle-radius': 6,
            'circle-color': '#3b82f6',
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff'
          }
        }, beforeId)
      }

      // Add city labels
      if (!map.getLayer('river-city-labels')) {
        console.log('🎨 Adding river-city-labels layer (BOTTOM)...')
        map.addLayer({
          id: 'river-city-labels',
          type: 'symbol',
          source: 'river-cities',
          layout: {
            'text-field': ['get', 'name'],
            'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
            'text-size': 11,
            'text-offset': [0, 1.2],
            'text-anchor': 'top'
          },
          paint: {
            'text-color': '#ffffff',
            'text-halo-color': '#000000',
            'text-halo-width': 1
          }
        })
      }

      // Add lakes source and layers
      if (!map.getSource('lakes')) {
        console.log('📦 Adding lakes source...')
        map.addSource('lakes', {
          type: 'geojson',
          data: lakesData as any
        })
      }

      // Add lake fill layer (blue with transparency) - hidden by default, only rivers are shown
      if (!map.getLayer('lake-fill')) {
        console.log('🎨 Adding lake-fill layer (BOTTOM)...')
        map.addLayer({
          id: 'lake-fill',
          type: 'fill',
          source: 'lakes',
          layout: {
            visibility: 'none' // Hidden - only rivers are shown
          },
          paint: {
            'fill-color': '#3b82f6', // Blue
            'fill-opacity': 0.4
          }
        }, beforeId)
      }

      // Add lake outline layer (dark blue border) - hidden by default, only rivers are shown
      if (!map.getLayer('lake-outline')) {
        console.log('🎨 Adding lake-outline layer (BOTTOM)...')
        map.addLayer({
          id: 'lake-outline',
          type: 'line',
          source: 'lakes',
          layout: {
            visibility: 'none' // Hidden - only rivers are shown
          },
          paint: {
            'line-color': '#1e3a8a', // Dark blue
            'line-width': 2,
            'line-opacity': 0.9
          }
        }, beforeId)
      }

      // Add metro humidity circles (like Metro Data Statistics)
      // Generate GeoJSON with polygon circles based on current projection year
      const generateMetroHumidityCircles = () => {
        const features = (metroHumidityData as any).features.map((feature: any) => {
          const cityName = feature.properties.city
          const lat = feature.properties.lat
          const lng = feature.properties.lng
          
          // Get humidity data for current year
          const getHumidityDataForYear = (projections: any, year: number) => {
            const yearStr = year.toString()
            if (projections[yearStr]) {
              return projections[yearStr]
            }

            const years = Object.keys(projections).map(Number).sort((a, b) => a - b)
            let lowerYear = years[0]
            let upperYear = years[years.length - 1]

            for (let i = 0; i < years.length - 1; i++) {
              if (years[i] <= year && years[i + 1] >= year) {
                lowerYear = years[i]
                upperYear = years[i + 1]
                break
              }
            }

            if (year <= lowerYear) return projections[lowerYear.toString()]
            if (year >= upperYear) return projections[upperYear.toString()]

            const ratio = (year - lowerYear) / (upperYear - lowerYear)
            const lower = projections[lowerYear.toString()]
            const upper = projections[upperYear.toString()]

            return {
              peak_humidity: Math.round(lower.peak_humidity + (upper.peak_humidity - lower.peak_humidity) * ratio),
              wet_bulb_events: Math.round(lower.wet_bulb_events + (upper.wet_bulb_events - lower.wet_bulb_events) * ratio),
              humid_temp: Math.round(lower.humid_temp + (upper.humid_temp - lower.humid_temp) * ratio),
              days_over_100: Math.round(lower.days_over_100 + (upper.days_over_100 - lower.days_over_100) * ratio)
            }
          }

          const humidityData = getHumidityDataForYear(feature.properties.humidity_projections, projectionYear)
          const radiusKm = humidityToRadius(humidityData.peak_humidity)
          const color = getHumidityColor(humidityData.peak_humidity, humidityData.humid_temp)

          return {
            type: 'Feature' as const,
            properties: {
              city: cityName,
              lat: lat,
              lng: lng,
              peak_humidity: humidityData.peak_humidity,
              wet_bulb_events: humidityData.wet_bulb_events,
              humid_temp: humidityData.humid_temp,
              days_over_100: humidityData.days_over_100,
              color: color,
              radius: radiusKm
            },
            geometry: {
              type: 'Polygon' as const,
              coordinates: [createCircle(lng, lat, radiusKm)]
            }
          }
        })

        return {
          type: 'FeatureCollection' as const,
          features
        }
      }

      // Always create/update the source (circles are always constructed, visibility is controlled separately)
      if (!map.getSource('metro-humidity-circles')) {
        console.log('📦 Adding metro-humidity-circles source...')
        map.addSource('metro-humidity-circles', {
          type: 'geojson',
          data: generateMetroHumidityCircles()
        })
      } else {
        // Update source data when year changes (circles are always constructed)
        const source = map.getSource('metro-humidity-circles') as mapboxgl.GeoJSONSource
        source.setData(generateMetroHumidityCircles())
      }

      // Add metro humidity circle fill layer (always visible when layer is active, like Metro Data Statistics)
      if (!map.getLayer('metro-humidity-circles-fill')) {
        console.log('🎨 Adding metro-humidity-circles-fill layer...')
        map.addLayer({
          id: 'metro-humidity-circles-fill',
          type: 'fill',
          source: 'metro-humidity-circles',
          layout: {
            visibility: showMetroHumidityLayer ? 'visible' : 'none'
          },
          paint: {
            'fill-color': ['get', 'color'],
            'fill-opacity': 0.6
          }
        }, beforeId)
        }

      // Add metro humidity circle outline layer (always visible when layer is active)
      if (!map.getLayer('metro-humidity-circles-stroke')) {
        console.log('🎨 Adding metro-humidity-circles-stroke layer...')
        map.addLayer({
          id: 'metro-humidity-circles-stroke',
          type: 'line',
          source: 'metro-humidity-circles',
          layout: {
            visibility: showMetroHumidityLayer ? 'visible' : 'none'
          },
          paint: {
            'line-color': ['get', 'color'],
            'line-width': 2,
            'line-opacity': 0.8
          }
        }, beforeId)
        }

      // Add metro city labels (point features for labels)
      if (!map.getSource('metro-humidity-labels')) {
        const labelFeatures = (metroHumidityData as any).features.map((feature: any) => ({
          type: 'Feature' as const,
          properties: {
            city: feature.properties.city
          },
          geometry: {
            type: 'Point' as const,
            coordinates: [feature.properties.lng, feature.properties.lat]
          }
        }))

        map.addSource('metro-humidity-labels', {
          type: 'geojson',
          data: {
            type: 'FeatureCollection' as const,
            features: labelFeatures
          }
        })
      }

      if (!map.getLayer('metro-humidity-labels')) {
        console.log('🎨 Adding metro-humidity-labels layer...')
        map.addLayer({
          id: 'metro-humidity-labels',
          type: 'symbol',
          source: 'metro-humidity-labels',
          layout: {
            'text-field': ['get', 'city'],
            'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
            'text-size': 12,
            'text-anchor': 'center',
            'text-allow-overlap': false,
            'text-ignore-placement': false,
            visibility: showMetroHumidityLayer ? 'visible' : 'none'
          },
          paint: {
            'text-color': theme === 'light' ? '#1e293b' : '#ffffff',
            'text-halo-color': theme === 'light' ? 'rgba(255, 255, 255, 0.8)' : '#000000',
            'text-halo-width': 2
          }
        })
        }

      console.log('✅ All river layers set up successfully (MIDDLE - on top of aquifers)')

      // Precipitation & Drought layer will be added dynamically when data is available (TOP LAYER)
      // See useEffect below that handles precipitation_drought layer
      // It will be inserted after aquifers using 'aquifer-hover' as beforeId

      if (isMountedRef.current && !force) {
        setMapLoaded(true)
      }
      return true
    } catch (error) {
      console.error('❌ Error setting up map layers:', error)
      return false
    }
  }, [showMetroHumidityLayer, showMetroDataStatistics, projectionYear, theme])

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
        
        // Update map bounds for layer data fetching
        setMapBounds({
          north: ne.lat + padding,
          south: sw.lat - padding,
          east: ne.lng + padding,
          west: sw.lng - padding,
          zoom: map.getZoom()
        })
        
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
    
    // Set initial bounds after map loads
    map.once('load', () => {
      const initialBounds = map.getBounds()
      const ne = initialBounds.getNorthEast()
      const sw = initialBounds.getSouthWest()
      setMapBounds({
        north: ne.lat,
        south: sw.lat,
        east: ne.lng,
        west: sw.lng,
        zoom: map.getZoom()
      })
    })

    map.on('error', (e: any) => {
      console.error('Mapbox error:', e)
      if (e.error?.status === 401 || e.error?.message?.includes('401')) {
        setError('Mapbox access token is invalid or expired.')
      }
    })

    // Click handler for aquifer selection

    // Helper function to get humidity data for a year with interpolation
    const getHumidityDataForYear = (projections: any, year: number) => {
      const yearStr = year.toString()
      if (projections[yearStr]) {
        return projections[yearStr]
      }

      // Interpolate between years
      const years = Object.keys(projections).map(Number).sort((a, b) => a - b)
      let lowerYear = years[0]
      let upperYear = years[years.length - 1]

      for (let i = 0; i < years.length - 1; i++) {
        if (years[i] <= year && years[i + 1] >= year) {
          lowerYear = years[i]
          upperYear = years[i + 1]
          break
        }
      }

      if (year <= lowerYear) return projections[lowerYear.toString()]
      if (year >= upperYear) return projections[upperYear.toString()]

      const ratio = (year - lowerYear) / (upperYear - lowerYear)
      const lower = projections[lowerYear.toString()]
      const upper = projections[upperYear.toString()]

      return {
        peak_humidity: Math.round(lower.peak_humidity + (upper.peak_humidity - lower.peak_humidity) * ratio),
        wet_bulb_events: Math.round(lower.wet_bulb_events + (upper.wet_bulb_events - lower.wet_bulb_events) * ratio),
        humid_temp: Math.round(lower.humid_temp + (upper.humid_temp - lower.humid_temp) * ratio),
        days_over_100: Math.round(lower.days_over_100 + (upper.days_over_100 - lower.days_over_100) * ratio)
      }
    }

    // Helper function to create popup HTML
    const createMetroPopupHTML = (cityName: string, year: number) => {
      const cityFeature = (metroHumidityData as any).features.find((f: any) => f.properties.city === cityName)
      if (!cityFeature) return ''

      const humidityData = getHumidityDataForYear(cityFeature.properties.humidity_projections, year)

      return `
        <div style="
          background: rgba(255, 255, 255, 0.5);
          backdrop-filter: blur(2px);
          border-radius: 8px;
          padding: 4px;
          min-width: 260px;
          font-family: Inter, sans-serif;
        ">
          <!-- Header -->
          <div style="padding: 4px 8px; margin-bottom: 4px;">
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <p style="
                font-size: 10px;
                font-weight: 700;
                text-transform: uppercase;
                color: #101728;
                margin: 0;
              ">${cityName.toUpperCase()}</p>
              <p style="
                font-size: 10px;
                font-weight: 600;
                color: #101728;
                margin: 0;
              ">${year}</p>
            </div>
          </div>

          ${showHumidityWetBulb ? `
          <!-- Humidity & Wet Bulb Events -->
          <div style="margin-bottom: 4px; border-radius: 4px; overflow: hidden;">
            <div style="
              background: rgba(255, 255, 255, 0.35);
              padding: 4px 8px;
              border-radius: 4px;
            ">
              <p style="
                font-size: 10px;
                font-weight: 600;
                color: #697487;
                margin: 0;
              ">Humidity & Wet Bulb Events</p>
            </div>
            <div style="display: flex;">
              <div style="flex: 1; padding: 4px 8px;">
                <p style="
                  font-size: 9px;
                  font-weight: 500;
                  color: #101728;
                  margin: 0 0 2px 0;
                ">Peak Humidity</p>
                <p style="
                  font-size: 12px;
                  font-weight: 700;
                  color: #101728;
                  margin: 0;
                ">${humidityData.peak_humidity}%</p>
              </div>
              <div style="flex: 1; padding: 4px 8px;">
                <p style="
                  font-size: 9px;
                  font-weight: 500;
                  color: #101728;
                  margin: 0 0 2px 0;
                "># Wet Bulbs</p>
                <p style="
                  font-size: 12px;
                  font-weight: 700;
                  color: #101728;
                  margin: 0;
                  text-align: center;
                ">${humidityData.wet_bulb_events}</p>
              </div>
            </div>
          </div>
          ` : ''}

          ${showTempHumidity ? `
          <!-- Temperature & Humidity -->
          <div style="border-radius: 4px; overflow: hidden;">
            <div style="
              background: rgba(255, 255, 255, 0.35);
              padding: 4px 8px;
              border-radius: 4px;
            ">
              <p style="
                font-size: 10px;
                font-weight: 600;
                color: #697487;
                margin: 0;
              ">Temperature & Humidity</p>
            </div>
            <div style="display: flex;">
              <div style="flex: 1; padding: 4px 8px;">
                <p style="
                  font-size: 9px;
                  font-weight: 500;
                  color: #101728;
                  margin: 0 0 2px 0;
                ">Humid Temp.</p>
                <p style="
                  font-size: 12px;
                  font-weight: 700;
                  color: #101728;
                  margin: 0;
                ">${humidityData.humid_temp}°</p>
              </div>
              <div style="flex: 1; padding: 4px 8px;">
                <p style="
                  font-size: 9px;
                  font-weight: 500;
                  color: #101728;
                  margin: 0 0 2px 0;
                "><span style="font-weight: 500;">100</span><span style="font-weight: 700;">°+ </span>Days</p>
                <p style="
                  font-size: 12px;
                  font-weight: 700;
                  color: #101728;
                  margin: 0;
                  text-align: center;
                ">${humidityData.days_over_100}</p>
              </div>
            </div>
          </div>
          ` : ''}
        </div>
      `
    }

    // Metro humidity handlers are now set up in a separate useEffect below

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

      // If clicking the same aquifer, clear visual selection but keep panel open
      if (currentSelectedId === featureId) {
        // Clear ALL feature states from the source to ensure clean deselection
        try {
          map.removeFeatureState({ source: 'aquifers' })
        } catch (err) {
          console.warn('Could not clear feature states:', err)
        }
        map.triggerRepaint()
        setSelectedFeatureId(null)
        // Don't clear selectedAquifer - panel only closes via close button
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

    // Click elsewhere to clear feature states (but don't close panel - only close button closes it)
    map.on('click', (e) => {
      // Check if click was on an aquifer layer
      const features = map.queryRenderedFeatures(e.point, { layers: ['aquifer-fill'] })
      
      // Only clear feature states if clicking outside of any aquifer (but keep panel open)
      if (features.length === 0) {
        // Clear ALL feature states from the source (visual deselection)
        try {
          map.removeFeatureState({ source: 'aquifers' })
        } catch (err) {
          console.warn('Could not clear feature states:', err)
        }
        map.triggerRepaint()
        setSelectedFeatureId(null)
        // Don't clear selectedAquifer - panel only closes via close button
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

  // Toggle river layers visibility
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return

    const map = mapRef.current
    const visibility = showRiversLayer ? 'visible' : 'none'

    const riverLayerIds = ['river-lines-casing', 'river-lines', 'river-city-markers', 'river-city-labels']

    riverLayerIds.forEach(layerId => {
      if (map.getLayer(layerId)) {
        map.setLayoutProperty(layerId, 'visibility', visibility)
      }
    })
  }, [showRiversLayer, mapLoaded])

  // Toggle canals/aqueducts layer visibility
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return

    const map = mapRef.current
    const visibility = showCanalsLayer ? 'visible' : 'none'

    const canalLayerIds = ['canal-lines-casing', 'canal-lines']

    canalLayerIds.forEach(layerId => {
      if (map.getLayer(layerId)) {
        map.setLayoutProperty(layerId, 'visibility', visibility)
      }
    })
  }, [showCanalsLayer, mapLoaded])

  // Toggle aquifer layers visibility
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return

    const map = mapRef.current
    const visibility = showAquifersLayer ? 'visible' : 'none'

    const aquiferLayerIds = ['aquifer-fill', 'aquifer-outline', 'aquifer-hover']

    aquiferLayerIds.forEach(layerId => {
      if (map.getLayer(layerId)) {
        map.setLayoutProperty(layerId, 'visibility', visibility)
      }
    })
  }, [showAquifersLayer, mapLoaded])

  // Toggle dams layer visibility
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return

    const map = mapRef.current
    const visibility = showDamsLayer ? 'visible' : 'none'

    const damLayerIds = ['dams-circles', 'dams-labels']

    damLayerIds.forEach(layerId => {
      if (map.getLayer(layerId)) {
        map.setLayoutProperty(layerId, 'visibility', visibility)
      }
    })
  }, [showDamsLayer, mapLoaded])

  // Toggle service areas layer visibility
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return

    const map = mapRef.current
    const visibility = showServiceAreasLayer ? 'visible' : 'none'

    const serviceAreaLayerIds = ['service-areas-circles', 'service-areas-labels']

    serviceAreaLayerIds.forEach(layerId => {
      if (map.getLayer(layerId)) {
        map.setLayoutProperty(layerId, 'visibility', visibility)
      }
    })
  }, [showServiceAreasLayer, mapLoaded])

  // Manage GRACE groundwater tile layer
  useEffect(() => {
    if (!mapRef.current || !mapLoaded || !graceTileUrl) return

    const map = mapRef.current

    // Add GRACE raster source and layer if enabled
    if (showGRACELayer) {
      if (!map.getSource('grace-tiles')) {
        console.log('🌍 Adding GRACE tile source...')
        map.addSource('grace-tiles', {
          type: 'raster',
          tiles: [graceTileUrl],
          tileSize: 256
        })
      }

      if (!map.getLayer('grace-layer')) {
        console.log('🎨 Adding GRACE raster layer...')
        // Add GRACE as bottommost layer (below precipitation/aquifers/rivers but above metro markers)
        // Target order from bottom to top: Metro → Rivers → Aquifers → Precipitation → GRACE → Labels
        // Insert before precipitation layer to make GRACE the bottom-most data layer
        let beforeId: string | undefined = 'precipitation-drought-fill'

        // If precipitation doesn't exist, try other layers
        if (!map.getLayer(beforeId)) {
          const dataLayerIds = ['aquifer-fill', 'aquifer-borders', 'waterway', 'water']
          for (const layerId of dataLayerIds) {
            if (map.getLayer(layerId)) {
              beforeId = layerId
              break
            }
          }
        }

        map.addLayer({
          id: 'grace-layer',
          type: 'raster',
          source: 'grace-tiles',
          paint: {
            'raster-opacity': graceOpacity
          }
        }, beforeId)
        console.log(`✅ GRACE layer added with opacity ${graceOpacity} before ${beforeId || 'top'}`)
      } else {
        // Update opacity and make visible
        map.setPaintProperty('grace-layer', 'raster-opacity', graceOpacity)
        map.setLayoutProperty('grace-layer', 'visibility', 'visible')
      }
    } else {
      // Hide the layer if it exists
      if (map.getLayer('grace-layer')) {
        map.setLayoutProperty('grace-layer', 'visibility', 'none')
      }
    }

    return () => {
      // Cleanup on unmount
      // Check if map still exists and hasn't been removed
      if (!map || map._removed) return

      try {
        if (map.getLayer('grace-layer')) {
          map.removeLayer('grace-layer')
        }
        if (map.getSource('grace-tiles')) {
          map.removeSource('grace-tiles')
        }
      } catch (error) {
        // Map may have been removed during cleanup
        console.log('Map already removed during GRACE layer cleanup')
      }
    }
  }, [showGRACELayer, graceTileUrl, mapLoaded, graceOpacity])

  // Toggle metro humidity layers visibility - Hide old circle layers since we use React markers now
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return
    console.log('🔵 Metro Humidity useEffect running', { showMetroHumidityLayer, mapLoaded })

    const map = mapRef.current

    // Hide the old circle and label layers - we use React markers instead
    const metroLayerIds = ['metro-humidity-circles-fill', 'metro-humidity-circles-stroke', 'metro-humidity-labels']

    metroLayerIds.forEach(layerId => {
      if (map.getLayer(layerId)) {
        console.log(`🎨 Hiding old layer ${layerId} (using React markers instead)`)
        map.setLayoutProperty(layerId, 'visibility', 'none')
      }
    })

    // No hover handlers needed - React markers handle their own hover behavior
  }, [showMetroHumidityLayer, mapLoaded])

  // Update metro humidity circles when projection year changes - DISABLED (using React markers instead)
  // This useEffect is kept for reference but no longer active since we use React markers
  /*
  useEffect(() => {
    if (!mapRef.current || !mapLoaded || !showMetroHumidityLayer) return

    const map = mapRef.current
    if (!map.getSource('metro-humidity-circles')) return

    // Regenerate circles with new year data
    const generateMetroHumidityCircles = () => {
      const features = (metroHumidityData as any).features.map((feature: any) => {
        const cityName = feature.properties.city
        const lat = feature.properties.lat
        const lng = feature.properties.lng
        
        const getHumidityDataForYear = (projections: any, year: number) => {
          const yearStr = year.toString()
          if (projections[yearStr]) {
            return projections[yearStr]
          }

          const years = Object.keys(projections).map(Number).sort((a, b) => a - b)
          let lowerYear = years[0]
          let upperYear = years[years.length - 1]

          for (let i = 0; i < years.length - 1; i++) {
            if (years[i] <= year && years[i + 1] >= year) {
              lowerYear = years[i]
              upperYear = years[i + 1]
              break
            }
          }

          if (year <= lowerYear) return projections[lowerYear.toString()]
          if (year >= upperYear) return projections[upperYear.toString()]

          const ratio = (year - lowerYear) / (upperYear - lowerYear)
          const lower = projections[lowerYear.toString()]
          const upper = projections[upperYear.toString()]

          return {
            peak_humidity: Math.round(lower.peak_humidity + (upper.peak_humidity - lower.peak_humidity) * ratio),
            wet_bulb_events: Math.round(lower.wet_bulb_events + (upper.wet_bulb_events - lower.wet_bulb_events) * ratio),
            humid_temp: Math.round(lower.humid_temp + (upper.humid_temp - lower.humid_temp) * ratio),
            days_over_100: Math.round(lower.days_over_100 + (upper.days_over_100 - lower.days_over_100) * ratio)
          }
        }

        const humidityData = getHumidityDataForYear(feature.properties.humidity_projections, projectionYear)
        const radiusKm = humidityToRadius(humidityData.peak_humidity)
        const color = getHumidityColor(humidityData.peak_humidity, humidityData.humid_temp)

        return {
          type: 'Feature' as const,
          properties: {
            city: cityName,
            lat: lat,
            lng: lng,
            peak_humidity: humidityData.peak_humidity,
            wet_bulb_events: humidityData.wet_bulb_events,
            humid_temp: humidityData.humid_temp,
            days_over_100: humidityData.days_over_100,
            color: color,
            radius: radiusKm
          },
          geometry: {
            type: 'Polygon' as const,
            coordinates: [createCircle(lng, lat, radiusKm)]
          }
        }
      })

      return {
        type: 'FeatureCollection' as const,
        features
      }
    }

    const source = map.getSource('metro-humidity-circles') as mapboxgl.GeoJSONSource
    source.setData(generateMetroHumidityCircles())
  }, [projectionYear, mapLoaded, showMetroHumidityLayer])
  */

  // Update marker positions on map move/zoom (for React overlay markers)
  useEffect(() => {
    if (!mapRef.current || !mapLoaded || !showMetroHumidityLayer) return
    const map = mapRef.current

    const handleMapMove = () => {
      forceUpdate(prev => prev + 1)
    }

    map.on('move', handleMapMove)
    map.on('zoom', handleMapMove)

    return () => {
      map.off('move', handleMapMove)
      map.off('zoom', handleMapMove)
    }
  }, [mapLoaded, showMetroHumidityLayer])

  // Metro Humidity React Markers - Create and manage tooltip bubbles (DISABLED - using React overlay instead)
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return
    const map = mapRef.current

    console.log('🎯 Metro Humidity Markers useEffect (DISABLED)', { showMetroHumidityLayer, projectionYear })

    // Clean up existing markers
    metroMarkersRef.current.forEach(({ marker, root }) => {
      root.unmount()
      marker.remove()
    })
    metroMarkersRef.current = []

    // If layer is not visible, don't create markers
    if (!showMetroHumidityLayer) {
      console.log('⏭️ Metro Humidity layer not visible, skipping marker creation')
      return
    }

    // Helper function to get humidity data for a specific year (with interpolation)
    const getHumidityDataForYear = (projections: any, year: number) => {
      const yearStr = year.toString()
      if (projections[yearStr]) {
        return projections[yearStr]
      }

      const years = Object.keys(projections).map(Number).sort((a, b) => a - b)
      let lowerYear = years[0]
      let upperYear = years[years.length - 1]

      for (let i = 0; i < years.length - 1; i++) {
        if (years[i] <= year && years[i + 1] >= year) {
          lowerYear = years[i]
          upperYear = years[i + 1]
          break
        }
      }

      if (year <= lowerYear) return projections[lowerYear.toString()]
      if (year >= upperYear) return projections[upperYear.toString()]

      const ratio = (year - lowerYear) / (upperYear - lowerYear)
      const lower = projections[lowerYear.toString()]
      const upper = projections[upperYear.toString()]

      return {
        peak_humidity: Math.round(lower.peak_humidity + (upper.peak_humidity - lower.peak_humidity) * ratio),
        wet_bulb_events: Math.round(lower.wet_bulb_events + (upper.wet_bulb_events - lower.wet_bulb_events) * ratio),
        humid_temp: Math.round(lower.humid_temp + (upper.humid_temp - lower.humid_temp) * ratio),
        days_over_100: Math.round(lower.days_over_100 + (upper.days_over_100 - lower.days_over_100) * ratio)
      }
    }

    // Create markers for each metro city
    ;(metroHumidityData as any).features.forEach((feature: any) => {
      const { city, lat, lng, humidity_projections } = feature.properties
      const humidityData = getHumidityDataForYear(humidity_projections, projectionYear)

      // Create marker element
      const el = document.createElement('div')
      el.style.width = '0px'
      el.style.height = '0px'

      // Create React root and render MetroHumidityBubble
      const root = createRoot(el)
      root.render(
        <MetroHumidityBubble
          metroName={city}
          year={projectionYear}
          peakHumidity={`${humidityData.peak_humidity}%`}
          wetBulbEvents={`${humidityData.wet_bulb_events}`}
          humidTemp={`${humidityData.humid_temp}°`}
          daysOver100={`${humidityData.days_over_100}`}
          visible={true}
          showHumidityWetBulb={showHumidityWetBulb}
          showTempHumidity={showTempHumidity}
          onClose={() => {}}
        />
      )

      // Create Mapbox marker
      const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
        .setLngLat([lng, lat])
        .addTo(map)

      metroMarkersRef.current.push({ marker, root })
    })

    console.log(`✅ Created ${metroMarkersRef.current.length} metro humidity markers`)

    // Cleanup function
    return () => {
      metroMarkersRef.current.forEach(({ marker, root }) => {
        root.unmount()
        marker.remove()
      })
      metroMarkersRef.current = []
    }
  }, [showMetroHumidityLayer, projectionYear, showHumidityWetBulb, showTempHumidity, mapLoaded, theme])

  // Handle Precipitation & Drought layer rendering
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return

    const map = mapRef.current
    const sourceId = 'precipitation-drought'
    const layerId = 'precipitation-drought-layer'

    // Check if layer should be visible
    if (isPrecipitationDroughtActive && precipitationDroughtData && typeof precipitationDroughtData === 'object' && 'tile_url' in precipitationDroughtData) {
      const tileUrl = precipitationDroughtData.tile_url

      // Add or update source
      if (!map.getSource(sourceId)) {
        console.log('📦 Adding precipitation-drought source...')
        map.addSource(sourceId, {
          type: 'raster',
          tiles: [tileUrl],
          tileSize: 256
        })
      } else {
        // Update source if tile URL changed
        const source = map.getSource(sourceId) as any
        if (source && source.tiles && source.tiles[0] !== tileUrl) {
          source.setTiles([tileUrl])
        }
      }

      // Add layer if it doesn't exist
      if (!map.getLayer(layerId)) {
        console.log('🎨 Adding precipitation-drought layer (TOP)...')
        // Insert after aquifers (TOP LAYER) - use aquifer-hover as reference
        // This ensures: Rivers (bottom) -> Aquifers (middle) -> Precipitation (top)
        const afterAquiferId = map.getLayer('aquifer-hover') ? 'aquifer-hover' : 
                               map.getLayer('aquifer-outline') ? 'aquifer-outline' :
                               map.getLayer('aquifer-fill') ? 'aquifer-fill' : undefined
        
        // Find insertion point - before labels but after aquifers
        let beforeId: string | undefined = undefined
        if (afterAquiferId) {
          // Insert after the last aquifer layer
          const style = map.getStyle()
          if (style && style.layers) {
            const aquiferIndex = style.layers.findIndex((l: any) => l.id === afterAquiferId)
            if (aquiferIndex >= 0 && aquiferIndex < style.layers.length - 1) {
              // Find next layer after aquifers
              for (let i = aquiferIndex + 1; i < style.layers.length; i++) {
                const nextLayer = style.layers[i]
                if (nextLayer.id && !nextLayer.id.includes('aquifer')) {
                  beforeId = nextLayer.id
                  break
                }
              }
            }
          }
        }
        
        // Fallback to label layers if no better position found
        if (!beforeId) {
          const labelLayerIds = ['waterway-label', 'place-labels', 'poi-label', 'road-label', 'water-label', 'settlement-label']
          for (const id of labelLayerIds) {
            if (map.getLayer(id)) {
              beforeId = id
              break
            }
          }
        }

        map.addLayer({
          id: layerId,
          type: 'raster',
          source: sourceId,
          paint: {
            'raster-opacity': controls.droughtOpacity || 0.6
          }
        }, beforeId)
      } else {
        // Update opacity if layer exists
        map.setPaintProperty(layerId, 'raster-opacity', controls.droughtOpacity || 0.6)
      }
    } else {
      // Remove layer and source if not active or no data
      if (map.getLayer(layerId)) {
        map.removeLayer(layerId)
      }
      if (map.getSource(sourceId)) {
        map.removeSource(sourceId)
      }
    }
  }, [isPrecipitationDroughtActive, precipitationDroughtData, mapLoaded, controls.droughtOpacity])

  // Update aquifer opacity (solid fill)
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return

    const map = mapRef.current

    if (map.getLayer('aquifer-fill')) {
      // Update fill opacity for solid fill
      // Selected aquifers use higher opacity (0.8) via feature-state
      // Non-selected aquifers use the slider-controlled opacity
      map.setPaintProperty('aquifer-fill', 'fill-opacity', [
        'case',
        ['==', ['feature-state', 'selected'], true],
        0.8,  // Selected: higher opacity
        aquiferOpacity  // Not selected: use slider value
      ])
    }
  }, [aquiferOpacity, mapLoaded])


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
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: '#1a1a2e',
      overflow: 'hidden',
      margin: 0,
      padding: 0
    }}>
      <div 
        ref={mapContainer} 
        style={{ 
          width: '100%', 
          height: '100%',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          margin: 0,
          padding: 0,
          border: 'none',
          outline: 'none'
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
      {!panelsCollapsed && (
        <aside className="absolute left-[92px] top-4 z-[1000] flex h-[calc(100%-32px)] w-[360px] flex-col pointer-events-none">
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
                <div className="rounded-md bg-[var(--cs-surface-elevated)] p-2">
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

          {/* Water Access Layers Panel */}
          <div className="widget-container">
            <h3 className="text-sm font-semibold mb-3">Water Access Layers</h3>
            <div className="space-y-3">
              {/* Metro Temperature & Humidity Layer */}
              <label
                className={`flex cursor-pointer gap-3 rounded-lg p-3 transition-colors ${
                  showMetroHumidityLayer
                    ? "border border-blue-500/60 bg-blue-500/10"
                    : ""
                }`}
                style={!showMetroHumidityLayer ? {
                  backgroundColor: theme === 'light' ? 'rgba(255, 255, 255, 1)' : 'rgba(0, 0, 0, 0.2)'
                } : undefined}
              >
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 flex-shrink-0 accent-blue-500"
                  checked={showMetroHumidityLayer}
                  onChange={() => setShowMetroHumidityLayer(!showMetroHumidityLayer)}
                />
                <div className="space-y-1 flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-sm font-medium">Metro Temperature & Humidity</h4>
                    <span className="text-muted-foreground flex-shrink-0 flex items-center justify-center" style={{ width: '20px', height: '20px', minWidth: '20px', display: 'flex' }}>
                      <MapPin className="h-4 w-4" />
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground/80 truncate">
                    Source: <span className="font-medium text-foreground">NOAA / NASA</span>
                  </p>
                </div>
              </label>


              {/* Rivers Layer */}
              <label
                className={`flex cursor-pointer gap-3 rounded-lg p-3 transition-colors ${
                  showRiversLayer
                    ? "border border-blue-500/60 bg-blue-500/10"
                    : ""
                }`}
                style={!showRiversLayer ? {
                  backgroundColor: theme === 'light' ? 'rgba(255, 255, 255, 1)' : 'rgba(0, 0, 0, 0.2)'
                } : undefined}
              >
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 flex-shrink-0 accent-blue-500"
                  checked={showRiversLayer}
                  onChange={() => setShowRiversLayer(!showRiversLayer)}
                />
                <div className="space-y-1 flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-sm font-medium">River Flow Status</h4>
                    <span className="text-muted-foreground flex-shrink-0 flex items-center justify-center" style={{ width: '20px', height: '20px', minWidth: '20px', display: 'flex' }}>
                      <Waves className="h-4 w-4" />
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground/80 truncate">
                    Source: <span className="font-medium text-foreground">Natural Earth / USGS</span>
                  </p>
                </div>
              </label>

              {/* Canals & Aqueducts Layer */}
              <label
                className={`flex cursor-pointer gap-3 rounded-lg p-3 transition-colors ${
                  showCanalsLayer
                    ? "border border-blue-500/60 bg-blue-500/10"
                    : ""
                }`}
                style={!showCanalsLayer ? {
                  backgroundColor: theme === 'light' ? 'rgba(255, 255, 255, 1)' : 'rgba(0, 0, 0, 0.2)'
                } : undefined}
              >
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 flex-shrink-0 accent-blue-500"
                  checked={showCanalsLayer}
                  onChange={() => setShowCanalsLayer(!showCanalsLayer)}
                />
                <div className="space-y-1 flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-sm font-medium">Canals & Aqueducts</h4>
                    <span className="text-muted-foreground flex-shrink-0 flex items-center justify-center" style={{ width: '20px', height: '20px', minWidth: '20px', display: 'flex' }}>
                      <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M2 12h20M2 8h20M2 16h20" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground/80 truncate">
                    Source: <span className="font-medium text-foreground">USBR / MWD</span>
                  </p>
                </div>
              </label>

              {/* Major Dams Layer */}
              <label
                className={`flex cursor-pointer gap-3 rounded-lg p-3 transition-colors ${
                  showDamsLayer
                    ? "border border-blue-500/60 bg-blue-500/10"
                    : ""
                }`}
                style={!showDamsLayer ? {
                  backgroundColor: theme === 'light' ? 'rgba(255, 255, 255, 1)' : 'rgba(0, 0, 0, 0.2)'
                } : undefined}
              >
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 flex-shrink-0 accent-blue-500"
                  checked={showDamsLayer}
                  onChange={() => setShowDamsLayer(!showDamsLayer)}
                />
                <div className="space-y-1 flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-sm font-medium">Major Dams</h4>
                    <span className="text-muted-foreground flex-shrink-0 flex items-center justify-center" style={{ width: '20px', height: '20px', minWidth: '20px', display: 'flex' }}>
                      <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M2 22h20v-2H2v2zm2-18v12h16V4H4zm2 10V6h12v8H6z"/>
                      </svg>
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground/80 truncate">
                    Source: <span className="font-medium text-foreground">USGS / USBR</span>
                  </p>
                </div>
              </label>

              {/* Metro Service Areas Layer */}
              <label
                className={`flex cursor-pointer gap-3 rounded-lg p-3 transition-colors ${
                  showServiceAreasLayer
                    ? "border border-blue-500/60 bg-blue-500/10"
                    : ""
                }`}
                style={!showServiceAreasLayer ? {
                  backgroundColor: theme === 'light' ? 'rgba(255, 255, 255, 1)' : 'rgba(0, 0, 0, 0.2)'
                } : undefined}
              >
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 flex-shrink-0 accent-blue-500"
                  checked={showServiceAreasLayer}
                  onChange={() => setShowServiceAreasLayer(!showServiceAreasLayer)}
                />
                <div className="space-y-1 flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-sm font-medium">Metro Service Areas</h4>
                    <span className="text-muted-foreground flex-shrink-0 flex items-center justify-center" style={{ width: '20px', height: '20px', minWidth: '20px', display: 'flex' }}>
                      <MapPin className="h-4 w-4" />
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground/80 truncate">
                    Source: <span className="font-medium text-foreground">Municipal Water Agencies</span>
                  </p>
                </div>
              </label>

              {/* Groundwater Layer */}
              <label
                className={`flex cursor-pointer gap-3 rounded-lg p-3 transition-colors ${
                  showGroundwaterLayer
                    ? "border border-blue-500/60 bg-blue-500/10"
                    : ""
                }`}
                style={!showGroundwaterLayer ? {
                  backgroundColor: theme === 'light' ? 'rgba(255, 255, 255, 1)' : 'rgba(0, 0, 0, 0.2)'
                } : undefined}
              >
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 flex-shrink-0 accent-blue-500"
                  checked={showGroundwaterLayer}
                  onChange={() => setShowGroundwaterLayer(!showGroundwaterLayer)}
                />
                <div className="space-y-1 flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-sm font-medium">Groundwater</h4>
                    <span className="text-muted-foreground flex-shrink-0 flex items-center justify-center" style={{ width: '20px', height: '20px', minWidth: '20px', display: 'flex' }}>
                      <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/>
                      </svg>
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground/80 truncate">
                    Source: <span className="font-medium text-foreground">NASA GRACE / USGS</span>
                  </p>
                </div>
              </label>

              {/* Precipitation & Drought Layer */}
              {precipitationDroughtLayer && (
                <label
                  className={`flex cursor-pointer gap-3 rounded-lg p-3 transition-colors ${
                    isPrecipitationDroughtActive
                      ? "border border-blue-500/60 bg-blue-500/10"
                      : ""
                  }`}
                  style={!isPrecipitationDroughtActive ? {
                    backgroundColor: theme === 'light' ? 'rgba(255, 255, 255, 1)' : 'rgba(0, 0, 0, 0.2)'
                  } : undefined}
                >
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 flex-shrink-0 accent-blue-500"
                    checked={isPrecipitationDroughtActive}
                    onChange={() => toggleLayer('precipitation_drought')}
                  />
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-sm font-medium">{precipitationDroughtLayer.title}</h4>
                      <span className="text-muted-foreground flex-shrink-0 flex items-center justify-center" style={{ width: '20px', height: '20px', minWidth: '20px', display: 'flex' }}>
                        <CloudRain className="h-4 w-4" />
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground/80 truncate">
                      Source: <span className="font-medium text-foreground">{precipitationDroughtLayer.source.name}</span>
                    </p>
                  </div>
                </label>
              )}

            </div>
          </div>
        </div>
      </aside>
      )}

      {/* Right Sidebar - Projection Year & Details */}
      {!panelsCollapsed && (
        <div className="absolute top-4 right-4 z-[1000] w-80 space-y-4 pointer-events-auto">
        {/* Projection Year Widget */}
        <div className="widget-container">
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16
          }}>
            <h3 className="text-sm font-medium text-foreground">
              Projection Year
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

        {/* Rivers Flow Status Widget - Shows when Rivers layer is active */}
        {showRiversLayer && (
          <div className="widget-container">
            <h3 className="text-sm font-semibold mb-3">River Flow Status</h3>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <div className="w-5 h-1 rounded" style={{ backgroundColor: '#dc2626' }}></div>
                <span className="text-[11px] text-foreground/70">Dry - Complete diversion</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-5 h-1 rounded" style={{ backgroundColor: '#f59e0b' }}></div>
                <span className="text-[11px] text-foreground/70">Seasonal - Wet season only</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-5 h-1 rounded" style={{ backgroundColor: '#fbbf24' }}></div>
                <span className="text-[11px] text-foreground/70">Reduced - 50%+ reduction</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-5 h-1 rounded" style={{ backgroundColor: '#3b82f6' }}></div>
                <span className="text-[11px] text-foreground/70">Natural - Unimpacted flow</span>
              </div>
            </div>
          </div>
        )}

        {/* Metro Humidity Controls - Shows when layer is active */}
        {showMetroHumidityLayer && (
          <div className="widget-container">
            <h3 className="text-sm font-semibold mb-3">Metro Humidity</h3>

            <div className="space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-blue-500"
                  checked={showHumidityWetBulb}
                  onChange={() => setShowHumidityWetBulb(!showHumidityWetBulb)}
                />
                <span className="text-sm text-foreground">Humidity & Wet Bulbs</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-blue-500"
                  checked={showTempHumidity}
                  onChange={() => setShowTempHumidity(!showTempHumidity)}
                />
                <span className="text-sm text-foreground">Temperature & Humidity</span>
              </label>
            </div>
          </div>
        )}

        {/* Groundwater Widget - Shows when groundwater layer is active */}
        {showGroundwaterLayer && (
          <div className="widget-container">
            <h3 className="text-sm font-semibold mb-3">Groundwater</h3>

            {/* Water Depletion Areas (GRACE) Section */}
            <div className="space-y-3 mb-4">
              <label className={`flex items-center gap-2 cursor-pointer p-3 rounded-lg ${
                showGRACELayer 
                  ? 'border-[1px] border-blue-500 bg-blue-500/5' 
                  : 'border-0 bg-white'
              }`}>
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-blue-500"
                  checked={showGRACELayer}
                  onChange={() => setShowGRACELayer(!showGRACELayer)}
                />
                <span className="text-sm font-medium text-foreground">Water Depletion Areas</span>
              </label>

              {showGRACELayer && (
                <div className="ml-1 space-y-2">
                  <div className="text-[11px] font-medium text-foreground/70 mb-1">Transparency</div>
                  <Slider
                    min={0}
                    max={1}
                    step={0.05}
                    value={[graceOpacity]}
                    onValueChange={(value) => setGraceOpacity(value[0])}
                    className="mb-2"
                  />

                  {/* GRACE Legend */}
                  <div className="mt-4 space-y-1.5">
                    <div className="text-xs font-medium text-foreground mb-2">Change vs. 2004-2009 Baseline</div>
                    <div className="h-3 w-full rounded" style={{
                      background: 'linear-gradient(to right, #b2182b 0%, #ef8a62 20%, #fddbc7 40%, #f7f7f7 50%, #d1e5f0 60%, #67a9cf 80%, #2166ac 100%)'
                    }} />
                    <div className="flex justify-between text-[9px] text-muted-foreground">
                      <span>-20 cm</span>
                      <span>Depletion</span>
                      <span>0</span>
                      <span>Recharge</span>
                      <span>+20 cm</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Aquifers Section */}
            <div className="space-y-3">
              <label className="flex items-center gap-2 cursor-pointer p-3 rounded-lg border-[1px] border-blue-500 bg-blue-500/5">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-blue-500"
                  checked={showAquifersLayer}
                  onChange={() => setShowAquifersLayer(!showAquifersLayer)}
                />
                <span className="text-sm font-medium text-foreground">Aquifers</span>
              </label>

              {showAquifersLayer && (
                <div className="ml-1 space-y-2">
                  <div className="text-[11px] font-medium text-foreground/70 mb-1">Transparency</div>
                  <Slider
                    min={0}
                    max={1}
                    step={0.05}
                    value={[aquiferOpacity]}
                    onValueChange={(value) => setAquiferOpacity(value[0])}
                    className="mb-2"
                  />

                  {/* Aquifer Health Legend */}
                  <div className="mt-4 space-y-1.5">
                    <div className="h-3 w-full rounded" style={{
                      background: 'linear-gradient(to right, #22c55e 0%, #3b82f6 25%, #94a3b8 50%, #f97316 75%, #ef4444 100%)'
                    }} />
                    <div className="flex justify-between text-[9px] text-muted-foreground">
                      <span>Healthy</span>
                      <span>Mending</span>
                      <span>Stressed</span>
                      <span>Depleting</span>
                      <span>Unknown</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Precipitation & Drought Controls - Only shows when layer is active */}
        {isPrecipitationDroughtActive && (
          <div className="widget-container">
            <h3 className="text-sm font-semibold mb-3">Precipitation & Drought</h3>
            
            {/* Status Indicator */}
            {precipitationDroughtStatus === 'loading' && (
              <div className="space-y-2 rounded-md border border-blue-500/30 bg-blue-500/10 p-3 mb-3">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                  <p className="text-xs text-foreground">Loading precipitation/drought data...</p>
                </div>
              </div>
            )}
            
            {precipitationDroughtStatus === 'success' && (
              <div className="space-y-2 rounded-md border border-green-500/30 bg-green-500/10 p-2 mb-3">
                <div className="flex items-center gap-2">
                  <div className="rounded-full bg-green-500 p-0.5">
                    <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-xs text-foreground">
                    {precipitationDroughtData?.metadata?.isRealData
                      ? '✓ Real CHIRPS data (Earth Engine)'
                      : '⚠ Data unavailable (Earth Engine error)'}
                  </p>
                </div>
              </div>
            )}

            {/* Metric Type Selector */}
            <div className="space-y-2 mb-4">
              <label className="text-xs font-semibold text-muted-foreground">Metric Type</label>
              <Select 
                value={controls.droughtMetric} 
                onValueChange={(value) => setDroughtMetric(value as 'precipitation' | 'drought_index' | 'soil_moisture')}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose metric" />
                </SelectTrigger>
                <SelectContent className="z-[9999]">
                  <SelectItem value="precipitation">Precipitation</SelectItem>
                  <SelectItem value="drought_index">Drought Index</SelectItem>
                  <SelectItem value="soil_moisture">Soil Moisture</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Opacity Slider */}
            <div className="space-y-2 mb-4">
              <div className="flex items-center justify-between">
                <label className="text-xs text-muted-foreground">Layer Opacity</label>
                <span className="text-xs font-medium">{Math.round(controls.droughtOpacity * 100)}%</span>
              </div>
              <Slider
                value={[Math.round(controls.droughtOpacity * 100)]}
                min={10}
                max={100}
                step={5}
                onValueChange={(value) => setDroughtOpacity(value[0] / 100)}
              />
            </div>

            {/* Legend based on selected metric */}
            <div className="space-y-1 mt-3">
              {controls.droughtMetric === 'precipitation' && (
                <>
                  <div className="h-3 w-full rounded-full" style={{
                    background: 'linear-gradient(90deg, #F5ED53 0%, #F5F3CE 50%, #6B9AF3 75%, #2357D2 100%)'
                  }} />
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>0</span>
                    <span>2</span>
                    <span>4</span>
                    <span>6</span>
                    <span>8</span>
                    <span>10 mm/day</span>
                  </div>
                </>
              )}
              {controls.droughtMetric === 'drought_index' && (
                <>
                  <div className="h-3 w-full rounded-full" style={{
                    background: 'linear-gradient(to right, #dc2626 0%, #f59e0b 16.67%, #fef08a 33.33%, #ffffff 50%, #90caf9 66.67%, #42a5f5 83.33%, #1e88e5 100%)'
                  }} />
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>0</span>
                    <span>1</span>
                    <span>2</span>
                    <span>3</span>
                    <span>4</span>
                    <span>5</span>
                    <span>6+</span>
                  </div>
                </>
              )}
              {controls.droughtMetric === 'soil_moisture' && (
                <>
                  <div className="h-3 w-full rounded-full bg-gradient-to-r from-[#8b4513] via-[#daa520] via-[#f0e68c] via-[#adff2f] via-[#7cfc00] to-[#32cd32]" />
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>0</span>
                    <span>2</span>
                    <span>4</span>
                    <span>6</span>
                    <span>8</span>
                    <span>10 mm</span>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Metro Humidity Widget - Shows when layer is active */}
        {showMetroHumidityLayer && selectedMetroCity && (() => {
          const cityFeature = (metroHumidityData as any).features.find((f: any) => f.properties.city === selectedMetroCity)
          if (!cityFeature) return null

          const humidityData = cityFeature.properties.humidity_projections[projectionYear.toString()] ||
                             cityFeature.properties.humidity_projections['2025']
          if (!humidityData) return null

          return (
            <div className="widget-container" style={{
              backdropFilter: 'blur(2px)',
              backgroundColor: 'rgba(255, 255, 255, 0.5)'
            }}>
              {/* Header */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                padding: '4px 8px',
                marginBottom: 4
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <p className="text-xs font-bold uppercase text-foreground">
                    {selectedMetroCity.toUpperCase()}
                  </p>
                  <p className="text-xs font-semibold text-foreground">
                    {projectionYear}
                  </p>
                </div>
              </div>

              {/* Humidity & Wet Bulb Events Section */}
              {showHumidityWetBulb && (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  borderRadius: 4,
                  overflow: 'hidden',
                  marginBottom: 4
                }}>
                  <div style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.35)',
                    padding: '4px 8px',
                    borderRadius: 4
                  }}>
                    <p className="text-xs font-semibold text-muted-foreground">
                      Humidity & Wet Bulb Events
                    </p>
                  </div>
                  <div style={{ display: 'flex' }}>
                    <div style={{ flex: 1, padding: '4px 8px' }}>
                      <p className="text-[9px] font-medium text-foreground" style={{ minWidth: 'max-content' }}>
                        Peak Humidity
                      </p>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        <p className="text-xs font-bold text-foreground">
                          {humidityData.peak_humidity}%
                        </p>
                      </div>
                    </div>
                    <div style={{ flex: 1, padding: '4px 8px' }}>
                      <p className="text-[9px] font-medium text-foreground" style={{ minWidth: 'max-content' }}>
                        # Wet Bulbs
                      </p>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center', justifyContent: 'center' }}>
                        <p className="text-xs font-bold text-foreground">
                          {humidityData.wet_bulb_events}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Temperature & Humidity Section */}
              {showTempHumidity && (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  borderRadius: 4,
                  overflow: 'hidden'
                }}>
                  <div style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.35)',
                    padding: '4px 8px',
                    borderRadius: 4
                  }}>
                    <p className="text-xs font-semibold text-muted-foreground">
                      Temperature & Humidity
                    </p>
                  </div>
                  <div style={{ display: 'flex' }}>
                    <div style={{ flex: 1, padding: '4px 8px' }}>
                      <p className="text-[9px] font-medium text-foreground" style={{ minWidth: 'max-content' }}>
                        Humid Temp.
                      </p>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        <p className="text-xs font-bold text-foreground">
                          {humidityData.humid_temp}°
                        </p>
                      </div>
                    </div>
                    <div style={{ flex: 1, padding: '4px 8px' }}>
                      <p className="text-[9px] font-medium text-foreground" style={{ minWidth: 'max-content' }}>
                        <span className="font-medium">100</span>
                        <span className="font-bold">°+ </span>
                        Days
                      </p>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center', justifyContent: 'center' }}>
                        <p className="text-xs font-bold text-foreground">
                          {humidityData.days_over_100}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })()}

      </div>
      )}

      {/* Groundwater Details Panel - Bottom Center */}
      {selectedAquifer && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000] pointer-events-auto" style={{ width: '640px' }}>
          <GroundwaterDetailsPanel
            selectedAquifer={selectedAquifer}
            projectionYear={projectionYear}
            onClose={closeDetailsPanel}
          />
        </div>
      )}

      {/* Metro Humidity Tooltip (like Metro Data Statistics) */}
      {metroHoverInfo && metroHoverInfo.cityName && metroHoverInfo.humidityData && (
        <div
          className="absolute z-10 pointer-events-none bg-white rounded-lg shadow-lg border border-gray-200"
          style={{
            left: metroHoverInfo.x + 10,
            top: metroHoverInfo.y + 10,
            width: '200px',
            fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            overflow: 'hidden'
          }}
        >
          {/* Header: City and Year */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '4px 8px',
            fontSize: '10px',
            lineHeight: 'normal',
            color: '#101728',
            borderBottom: '1px solid rgba(0, 0, 0, 0.05)'
          }}>
            <span style={{ fontWeight: 700, textTransform: 'uppercase' }}>
              {metroHoverInfo.cityName.toUpperCase()}
            </span>
            <span style={{ fontWeight: 600 }}>{projectionYear}</span>
          </div>

          {showHumidityWetBulb && (
            <>
              {/* Section 1: Humidity & Wet Bulb Events */}
              <div style={{
                padding: '4px 8px',
                fontSize: '10px',
                fontWeight: 600,
                color: '#65758B',
                lineHeight: 'normal',
                borderBottom: '1px solid rgba(0, 0, 0, 0.05)'
              }}>
                Humidity & Wet Bulb Events
              </div>
              <div style={{ padding: '4px 8px', marginBottom: '4px' }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  fontSize: '12px',
                  lineHeight: 'normal'
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{
                      fontSize: '9px',
                      fontWeight: 500,
                      color: '#101728',
                      marginBottom: '2px',
                      lineHeight: 'normal'
                    }}>
                      Peak Humidity
                    </span>
                    <span style={{ fontWeight: 700, color: '#101728' }}>
                      {metroHoverInfo.humidityData.peak_humidity}%
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                    <span style={{
                      fontSize: '9px',
                      fontWeight: 500,
                      color: '#101728',
                      marginBottom: '2px',
                      lineHeight: 'normal'
                    }}>
                      # Wet Bulbs
                    </span>
                    <span style={{ fontWeight: 500, color: '#697487' }}>
                      {metroHoverInfo.humidityData.wet_bulb_events}
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}

          {showTempHumidity && (
            <>
              {/* Section 2: Temperature & Humidity */}
              <div style={{
                padding: '4px 8px',
                fontSize: '10px',
                fontWeight: 600,
                color: '#65758B',
                lineHeight: 'normal',
                borderBottom: '1px solid rgba(0, 0, 0, 0.05)'
              }}>
                Temperature & Humidity
              </div>
              <div style={{ display: 'flex', gap: 0, padding: '4px 8px' }}>
                <div style={{ flex: 1, padding: '4px 8px' }}>
                  <div style={{
                    fontSize: '9px',
                    fontWeight: 500,
                    color: '#101728',
                    marginBottom: '2px',
                    lineHeight: 'normal'
                  }}>
                    Humid Temp.
                  </div>
                  <div style={{
                    display: 'flex',
                    gap: '4px',
                    alignItems: 'center',
                    fontSize: '12px',
                    lineHeight: 'normal'
                  }}>
                    <span style={{ fontWeight: 700, color: '#101728' }}>
                      {metroHoverInfo.humidityData.humid_temp}°
                    </span>
                  </div>
                </div>
                <div style={{ flex: 1, padding: '4px 8px' }}>
                  <div style={{
                    fontSize: '9px',
                    fontWeight: 500,
                    color: '#101728',
                    marginBottom: '2px',
                    lineHeight: 'normal'
                  }}>
                    100°+ Days
                  </div>
                  <div style={{
                    display: 'flex',
                    gap: '4px',
                    alignItems: 'center',
                    fontSize: '12px',
                    lineHeight: 'normal'
                  }}>
                    <span style={{ fontWeight: 700, color: '#101728' }}>
                      {metroHoverInfo.humidityData.days_over_100}
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Metro Data Statistics Tooltip (TEST - from Climate screen) */}
      {megaregionHoverInfo && megaregionHoverInfo.metroName && megaregionHoverInfo.metroPopulation && (
        <div
          className="absolute z-10 pointer-events-none bg-card/95 backdrop-blur-lg border border-border/60 rounded-lg shadow-lg px-2.5 py-1.5 text-xs"
          style={{
            left: megaregionHoverInfo.x + 10,
            top: megaregionHoverInfo.y + 10
          }}
        >
          {/* Megaregion metro info */}
          <div>
            <div className="font-semibold text-foreground mb-1">
              {megaregionHoverInfo.metroName}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-blue-500">🏙️</span>
              <span className="font-medium">
                {megaregionHoverInfo.metroPopulation.toLocaleString()} people
              </span>
            </div>
            <div className="text-[10px] opacity-70 mt-0.5">
              {megaregionHoverInfo.metroYear} projection
            </div>
          </div>
        </div>
      )}

      {/* Metro Humidity React Overlay - Render MetroHumidityBubble components using map projection */}
      {showMetroHumidityLayer && mapRef.current && mapLoaded && (
        <>
          {(metroHumidityData as any).features.map((feature: any, index: number) => {
            const { city, lat, lng, humidity_projections } = feature.properties

            // Helper function to get humidity data for year with interpolation
            const getHumidityDataForYear = (projections: any, year: number) => {
              const yearStr = year.toString()
              if (projections[yearStr]) return projections[yearStr]

              const years = Object.keys(projections).map(Number).sort((a, b) => a - b)
              let lowerYear = years[0]
              let upperYear = years[years.length - 1]

              for (let i = 0; i < years.length - 1; i++) {
                if (years[i] <= year && years[i + 1] >= year) {
                  lowerYear = years[i]
                  upperYear = years[i + 1]
                  break
                }
              }

              if (year <= lowerYear) return projections[lowerYear.toString()]
              if (year >= upperYear) return projections[upperYear.toString()]

              const ratio = (year - lowerYear) / (upperYear - lowerYear)
              const lower = projections[lowerYear.toString()]
              const upper = projections[upperYear.toString()]

              return {
                peak_humidity: Math.round(lower.peak_humidity + (upper.peak_humidity - lower.peak_humidity) * ratio),
                wet_bulb_events: Math.round(lower.wet_bulb_events + (upper.wet_bulb_events - lower.wet_bulb_events) * ratio),
                humid_temp: Math.round(lower.humid_temp + (upper.humid_temp - lower.humid_temp) * ratio),
                days_over_100: Math.round(lower.days_over_100 + (upper.days_over_100 - lower.days_over_100) * ratio)
              }
            }

            const humidityData = getHumidityDataForYear(humidity_projections, projectionYear)

            // Convert lat/lng to screen coordinates
            const point = mapRef.current!.project([lng, lat])

            return (
              <div
                key={`metro-humidity-${index}`}
                style={{
                  position: 'absolute',
                  left: `${point.x}px`,
                  top: `${point.y}px`,
                  transform: 'translate(-50%, -50%)',
                  pointerEvents: 'auto',
                  zIndex: 100
                }}
              >
                <MetroHumidityBubble
                  metroName={city}
                  year={projectionYear}
                  peakHumidity={`${humidityData.peak_humidity}%`}
                  wetBulbEvents={`${humidityData.wet_bulb_events}`}
                  humidTemp={`${humidityData.humid_temp}°`}
                  daysOver100={`${humidityData.days_over_100}`}
                  visible={true}
                  showHumidityWetBulb={showHumidityWetBulb}
                  showTempHumidity={showTempHumidity}
                  onClose={() => {}}
                />
              </div>
            )
          })}
        </>
      )}

    </div>
  )
}
