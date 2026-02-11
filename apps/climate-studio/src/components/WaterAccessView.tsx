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
import { SelectedFactory, FactoryDetailsPanel } from './panels/FactoryDetailsPanel'
import { SelectedDam, DamDetailsPanel } from './panels/DamDetailsPanel'
import { AIDataCenterDetailPanel, SelectedDataCenter } from './panels/AIDataCenterDetailPanel'
import { SearchAndViewsPanel } from './panels/SearchAndViewsPanel'
import { ClimateProjectionsWidget } from './ClimateProjectionsWidget'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Slider } from './ui/slider'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu'
import { Waves, Droplets, CloudRain, Factory, MapPin, BarChart3, Mountain, TrendingUp, Loader2, GripVertical, X, Layers, ChevronDown, Save, Trash2, Bookmark, MoreHorizontal, Pencil, Zap } from 'lucide-react'
import { useLayer } from '../contexts/LayerContext'
import { shouldShowClimateWidget } from '../config/layerDefinitions'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

// Import aquifer data with projections
import aquifersData from '../data/aquifers.json'
// Import river data - Natural Earth 10m rivers with flow projections by year/scenario
import riversData from '../data/rivers-with-projections.json'
// Import lakes data with water level projections
import lakesData from '../data/lakes.json'
// Import factory data with environmental impact information
import factoriesExpandedData from '../data/factories-expanded.json'
// Import metro temperature data with projections (same as Climate view)
import metroTemperatureData from '../data/metro_temperature_projections.json'
// Import wet bulb projections for high-risk cities
import wetBulbProjectionsData from '../data/wet_bulb_projections.json'
// Import expanded wet bulb projections with more cities
import expandedWetBulbData from '../data/expanded_wet_bulb_projections.json'
// Import megaregion data for Metro Population Change layer
import megaregionData from '../data/megaregion-data.json'
// Removed aqueductsData import - using canal-lines layer only (no dashed lines)
// Import dam infrastructure data
import damsData from '../data/dams.json'
// Import AI data center data
import aiDatacentersData from '../data/ai-datacenters.json'
// Import enhanced water infrastructure (impacted rivers, aqueducts, connections)
import enhancedInfrastructureData from '../data/enhanced-water-infrastructure.json'
// Import metro service areas
// Import water service area cities
import serviceAreasData from '../data/water-service-areas.json'

// Use environment variable or fallback to the token
const MAPBOX_ACCESS_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || 'pk.eyJ1Ijoiam9zaHVhYmJ1dGxlciIsImEiOiJjbWcwNXpyNXUwYTdrMmtva2tiZ2NjcGxhIn0.Fc3d_CloJGiw9-BE4nI_Kw'
mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN

// Backend API base URL
const API_BASE = import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_URL || 'http://localhost:5001'

// Helper: create a StyleImageInterface for Mapbox GL v3 symbol layers
function createIconImage(size: number, draw: (ctx: CanvasRenderingContext2D, s: number) => void): { width: number; height: number; data: Uint8ClampedArray } {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  draw(ctx, size)
  const imageData = ctx.getImageData(0, 0, size, size)
  return { width: size, height: size, data: imageData.data }
}

// Draw SVG path string onto canvas context, scaled from a source viewBox to the canvas size
function drawSvgPath(ctx: CanvasRenderingContext2D, d: string, canvasSize: number, viewBoxSize: number) {
  const scale = canvasSize / viewBoxSize
  ctx.save()
  ctx.scale(scale, scale)
  ctx.fillStyle = '#ffffff'
  ctx.fill(new Path2D(d))
  ctx.restore()
}

// Dam icon path from Figma (viewBox 24x24) — white block/dam structure
const DAM_PATH = 'M5.7 14.4706H12V18H5.7V14.4706ZM5 10.2353H9.2V13.7647H5V10.2353ZM9.9 10.2353H14.1V13.7647H9.9V10.2353ZM14.8 10.2353H19V13.7647H14.8V10.2353ZM12.7 14.4706H18.3V18H12.7V14.4706ZM5.7 6H11.3V9.52941H5.7V6ZM12 6H18.3V9.52941H12V6Z'

// Factory icon path from Figma (viewBox 24x24) — white factory silhouette
const FACTORY_PATH = 'M6.66667 15V16.3333H9.33333V15H6.66667ZM6.66667 12.3333V13.6667H13.3333V12.3333H6.66667ZM10.6667 15V16.3333H13.3333V15H10.6667ZM14.6667 12.3333V13.6667H17.3333V12.3333H14.6667ZM14.6667 15V16.3333H17.3333V15H14.6667ZM5.33333 17.6667V8.33333L8.66667 11V8.33333L12 11V8.33333L15.3333 11L16 4.33333H18L18.6667 11V17.6667H5.33333Z'

function drawDamIcon(ctx: CanvasRenderingContext2D, s: number) {
  drawSvgPath(ctx, DAM_PATH, s, 24)
}

function drawFactoryIcon(ctx: CanvasRenderingContext2D, s: number) {
  drawSvgPath(ctx, FACTORY_PATH, s, 24)
}

// Lightning bolt / zap icon path (viewBox 24x24) — white ⚡ electricity symbol
const ZAP_PATH = 'M13 2L3 14h9l-1 8 10-12h-9l1-8z'

function drawZapIcon(ctx: CanvasRenderingContext2D, s: number) {
  drawSvgPath(ctx, ZAP_PATH, s, 24)
}

// Combine all metro cities with wet bulb data from expanded 30-city dataset
const metroHumidityData = {
  type: "FeatureCollection",
  name: "Metro Temperature & Wet Bulb Statistics",
  features: [
    // Use the expanded wet bulb data (30 cities with accurate projections)
    ...Object.entries(expandedWetBulbData as any).map(([cityName, cityData]: [string, any]) => ({
      type: "Feature",
      properties: {
        city: cityData.name,
        lat: cityData.lat,
        lng: cityData.lon,
        population: cityData.population_2024,
        metro_population: cityData.metro_population_2024,
        // Use actual wet bulb projection data
        humidity_projections: cityData.projections
      },
      geometry: {
        type: "Point",
        coordinates: [cityData.lon, cityData.lat]
      }
    }))
  ]
}

console.log('📊 Metro Humidity Data:', {
  totalCities: metroHumidityData.features.length,
  wetBulbCities: Object.keys(expandedWetBulbData).length,
  cities: metroHumidityData.features.map(f => f.properties.city)
})

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

// Helper: Use extent radius from wet bulb projection data
function wetBulbDangerToRadius(extentRadiusKm: number): number {
  // Use the extent_radius_km from the wet bulb projections data
  // This represents how far the wet bulb danger zone extends
  return extentRadiusKm
}

// Helper: Determine circle color based on wet bulb danger intensity
function getWetBulbDangerColor(wetBulbEvents: number, humidTemp: number): string {
  // Wet bulb events + temperature create dangerous conditions
  // More events = more dangerous (red)
  // Fewer events = safer (yellow/orange) - still visible!

  // Calculate danger score: wet bulb events are the primary factor
  const dangerScore = (wetBulbEvents / 50) * 0.7 + ((humidTemp - 100) / 50) * 0.3

  // Use bold, highly visible colors even for low danger
  if (dangerScore < 0.15) return '#fbbf24' // Bold amber - low risk but VISIBLE
  if (dangerScore < 0.30) return '#fb923c' // Bold orange - moderate-low
  if (dangerScore < 0.45) return '#f97316' // Strong orange - moderate
  if (dangerScore < 0.60) return '#ea580c' // Dark orange - high
  if (dangerScore < 0.75) return '#ef4444' // Red - very high
  if (dangerScore < 0.90) return '#dc2626' // Dark red - extreme
  return '#991b1b' // Very dark red - catastrophic
}

// Helper: Calculate circle radius based on population (from Metro Population Change)
function populationToRadius(population: number): number {
  const scaleFactor = 0.015
  const baseRadius = Math.sqrt(population) * scaleFactor
  return Math.max(baseRadius, 30) // Minimum 30km radius for visibility
}

// Helper: Determine circle color based on population growth (from Metro Population Change)
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
  // Handle volume_data structure from aquifer-projections.json
  const volumeData = properties?.volume_data
  if (volumeData) {
    const currentVol = volumeData.current_vol_gallons
    const depletionRate = volumeData.depletion_rate_yr

    if (currentVol && depletionRate) {
      // Calculate years from baseline (assume current is ~2025)
      const yearsSince2025 = projectionYear - 2025
      const estimatedVolume = currentVol - (depletionRate * yearsSince2025)
      const percentageOfBaseline = (estimatedVolume / currentVol) * 100

      if (percentageOfBaseline >= 98) return '#22c55e' // Green - Stable
      if (percentageOfBaseline >= 90) return '#3b82f6' // Blue - Moderate
      if (percentageOfBaseline >= 75) return '#f97316' // Orange - Stressed
      return '#ef4444' // Red - Critical
    }
  }

  // Fallback to old structure
  const baseline = properties?.volume_gallons_2025 || properties?.projections?.['2025']
  const projections = properties?.projections

  if (!baseline || !projections) {
    console.warn('⚠️ No baseline/projections for aquifer:', properties?.name)
    return '#6366f1' // Default purple for unknown
  }

  const currentVolume = getVolumeForYear(projections, projectionYear)
  if (currentVolume === null) {
    console.warn('⚠️ getVolumeForYear returned null for year:', projectionYear, 'aquifer:', properties?.name)
    return '#6366f1' // Default purple for unknown
  }

  const percentageOfBaseline = (currentVolume / baseline) * 100

  let color
  if (percentageOfBaseline >= 98) {
    color = '#22c55e' // Green - Stable
  } else if (percentageOfBaseline >= 90) {
    color = '#3b82f6' // Blue - Moderate
  } else if (percentageOfBaseline >= 75) {
    color = '#f97316' // Orange - Stressed
  } else {
    color = '#ef4444' // Red - Critical
  }

  // Debug first aquifer only
  if (properties?.name?.includes('High Plains')) {
    console.log('🎨 High Plains color calc:', {
      year: projectionYear,
      baseline,
      currentVolume,
      percentage: percentageOfBaseline.toFixed(1) + '%',
      color
    })
  }

  return color
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
  // Handle volume_data structure from aquifer-projections.json
  const volumeData = properties?.volume_data
  if (volumeData) {
    const currentVol = volumeData.current_vol_gallons
    const depletionRate = volumeData.depletion_rate_yr

    if (currentVol && depletionRate) {
      const yearsSince2025 = projectionYear - 2025
      const estimatedVolume = currentVol - (depletionRate * yearsSince2025)
      const percentage = (estimatedVolume / currentVol) * 100

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
  }

  // Fallback to old structure
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
    <li ref={setNodeRef} style={style} className="flex gap-3 rounded-lg p-3 transition-colors border border-solid border-white/90 bg-white/25 items-center">
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing p-0 touch-none flex items-center justify-center"
      >
        <GripVertical className="h-5 w-5 text-muted-foreground" />
      </div>
      <button
        onClick={() => loadSavedView(view)}
        className="flex flex-1 items-center gap-3 rounded-md border-0 h-auto p-0 text-left text-sm hover:bg-transparent"
      >
        <Bookmark className="h-5 w-5 text-muted-foreground flex-shrink-0" />
        <div className="flex-1 min-w-0 flex flex-col gap-1">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-semibold">{view.name}</h4>
          </div>
        </div>
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 hover:bg-transparent"
          >
            <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
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
  const manageLayersDropdownRef = useRef<HTMLDivElement>(null)
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
  const [selectedAquifer, setSelectedAquifer] = useState<SelectedAquifer | null>(null)
  const [selectedFeatureId, setSelectedFeatureId] = useState<string | number | null>(null)
  const [selectedMetroCity, setSelectedMetroCity] = useState<string | null>(null)
  // Factory state
  const [selectedFactory, setSelectedFactory] = useState<SelectedFactory | null>(null)
  // Dam state
  const [selectedDam, setSelectedDam] = useState<SelectedDam | null>(null)

  // Feature panel accordion state
  const [collapsedFeatures, setCollapsedFeatures] = useState<Set<string>>(new Set())

  // Use theme context for map style
  const { theme } = useTheme()

  // Use sidebar context for hiding/showing panels
  const { panelsCollapsed } = useSidebar()

  // Use layer context for climate widget
  const { getEnabledLayersForView } = useLayer()

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
  const [showRiversLayer, setShowRiversLayer] = useState(true) // Default ON
  const [showCanalsLayer, setShowCanalsLayer] = useState(true) // Default ON - shows water infrastructure risk
  const [showAquifersLayer, setShowAquifersLayer] = useState(false)
  const [showDamsLayer, setShowDamsLayer] = useState(false)
  const [showMetroHumidityLayer, setShowMetroHumidityLayer] = useState(true) // Default ON
  const [showGroundwaterLayer, setShowGroundwaterLayer] = useState(false)
  const [showFactoriesLayer, setShowFactoriesLayer] = useState(true)
  const [showAIDataCentersLayer, setShowAIDataCentersLayer] = useState(true)
  const [selectedDataCenter, setSelectedDataCenter] = useState<SelectedDataCenter | null>(null)
  const [showSeaLevelRiseLayer, setShowSeaLevelRiseLayer] = useState(false)
  const [seaLevelRiseFeet, setSeaLevelRiseFeet] = useState(3)
  const [showHumidityWetBulb, setShowHumidityWetBulb] = useState(true)
  const [showTempHumidity, setShowTempHumidity] = useState(true)
  const [showAverageTemperatures, setShowAverageTemperatures] = useState(false)
  const [showMetroDataStatistics, setShowMetroDataStatistics] = useState(false)
  const [showTopographicRelief, setShowTopographicRelief] = useState(true) // Default ON at 20% opacity
  const [activeBubbleIndex, setActiveBubbleIndex] = useState<number | null>(null) // Track which bubble is active

  // Climate Suite panel controls
  const [showManageLayersDropdown, setShowManageLayersDropdown] = useState(false)
  const [showSourceInfo, setShowSourceInfo] = useState(true)
  const [selectAllLayers, setSelectAllLayers] = useState(false)

  // Close Manage Layers dropdown when clicking outside
  useEffect(() => {
    if (!showManageLayersDropdown) return
    const handleClickOutside = (e: MouseEvent) => {
      if (manageLayersDropdownRef.current && !manageLayersDropdownRef.current.contains(e.target as Node)) {
        setShowManageLayersDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showManageLayersDropdown])

  // Which layers are IN the widget (visible in the list) - separate from whether they're active
  const [layersInWidget, setLayersInWidget] = useState({
    metroWeather: true,
    metroPopulation: false,
    rivers: true,
    canals: true,
    dams: false,
    seaLevel: false,
    groundwater: false,
    aquifers: false,
    precipitation: false,
    wetBulb: true,
    temperature: true,
    factories: true,
    aiDataCenters: true,
    topographic: true
  })

  // Climate context for precipitation & drought layer
  const { toggleLayer, isLayerActive, controls, setDroughtMetric, setDroughtOpacity, setWetBulbOpacity, setProjectionOpacity, setTemperatureMode } = useClimate()

  // Use projectionYear from climate context (slider) instead of local state
  // This ensures Metro Weather popovers update when the user moves the year slider
  const projectionYear = controls.projectionYear ?? 2050

  const precipitationDroughtLayer = climateLayers.find(l => l.id === 'precipitation_drought')
  const isPrecipitationDroughtActive = isLayerActive('precipitation_drought')
  const wetBulbLayer = climateLayers.find(l => l.id === 'wet_bulb')
  const isWetBulbActive = isLayerActive('wet_bulb')
  const temperatureProjectionLayer = climateLayers.find(l => l.id === 'temperature_projection')
  const [aquiferOpacity, setAquiferOpacity] = useState(0.25)
  const [riverOpacity, setRiverOpacity] = useState(1.0) // Default full opacity for rivers
  const [metroDataOpacity, setMetroDataOpacity] = useState(0.6)
  const [topoReliefIntensity, setTopoReliefIntensity] = useState(0.2) // Default 20% intensity

  // Get map bounds for layer data fetching
  const [mapBounds, setMapBounds] = useState<{ north: number; south: number; east: number; west: number; zoom?: number } | null>(null)
  const { layers: layerStates, refreshLayer } = useClimateLayerData(mapBounds)
  const precipitationDroughtData = layerStates.precipitation_drought?.data
  const precipitationDroughtStatus = layerStates.precipitation_drought?.status
  const wetBulbData = layerStates.wet_bulb?.data
  const wetBulbStatus = layerStates.wet_bulb?.status

  // Keep ref in sync with state for use in event handlers (avoids stale closure)
  useEffect(() => {
    selectedFeatureIdRef.current = selectedFeatureId
  }, [selectedFeatureId])

  // Initialize default climate layers on mount (run only once)
  useEffect(() => {
    // Enable Wet Bulb Temperature and Future Temperature Anomaly by default
    const timer = setTimeout(() => {
      if (!isLayerActive('wet_bulb')) {
        toggleLayer('wet_bulb')
      }
      if (!isLayerActive('temperature_projection')) {
        toggleLayer('temperature_projection')
      }
    }, 100)

    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-disable layers when removed from widget
  useEffect(() => {
    // Metro Weather
    if (!layersInWidget.metroWeather && showMetroHumidityLayer) {
      setShowMetroHumidityLayer(false)
    }
    // Metro Population
    if (!layersInWidget.metroPopulation && showMetroDataStatistics) {
      setShowMetroDataStatistics(false)
    }
    // Rivers
    if (!layersInWidget.rivers && showRiversLayer) {
      setShowRiversLayer(false)
    }
    // Canals
    if (!layersInWidget.canals && showCanalsLayer) {
      setShowCanalsLayer(false)
    }
    // Dams
    if (!layersInWidget.dams && showDamsLayer) {
      setShowDamsLayer(false)
    }
    // Sea Level Rise
    if (!layersInWidget.seaLevel && showSeaLevelRiseLayer) {
      setShowSeaLevelRiseLayer(false)
    }
    // Groundwater
    if (!layersInWidget.groundwater && showGroundwaterLayer) {
      setShowGroundwaterLayer(false)
    }
    // Aquifers
    if (!layersInWidget.aquifers && showAquifersLayer) {
      setShowAquifersLayer(false)
    }
    // Factories
    if (!layersInWidget.factories && showFactoriesLayer) {
      setShowFactoriesLayer(false)
    }
    // AI Data Centers
    if (!layersInWidget.aiDataCenters && showAIDataCentersLayer) {
      setShowAIDataCentersLayer(false)
    }
    // Topographic Relief
    if (!layersInWidget.topographic && showTopographicRelief) {
      setShowTopographicRelief(false)
    }
    // Precipitation & Drought
    if (!layersInWidget.precipitation && isPrecipitationDroughtActive) {
      toggleLayer('precipitation_drought')
    }
    // Wet Bulb Temperature
    if (!layersInWidget.wetBulb && isWetBulbActive) {
      toggleLayer('wet_bulb')
    }
    // Future Temperature Anomaly
    if (!layersInWidget.temperature && isTemperatureProjectionActive) {
      toggleLayer('temperature_projection')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    layersInWidget.metroWeather,
    layersInWidget.metroPopulation,
    layersInWidget.rivers,
    layersInWidget.canals,
    layersInWidget.dams,
    layersInWidget.seaLevel,
    layersInWidget.groundwater,
    layersInWidget.aquifers,
    layersInWidget.factories,
    layersInWidget.aiDataCenters,
    layersInWidget.topographic,
    layersInWidget.precipitation,
    layersInWidget.wetBulb,
    layersInWidget.temperature
  ])

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

  // Get temperature projection data from climate context
  const isTemperatureProjectionActive = isLayerActive('temperature_projection')
  const temperatureProjectionData = layerStates.temperature_projection?.data
  const temperatureProjectionStatus = layerStates.temperature_projection?.status

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
      const fillColor = getDepletionColor(mergedProperties, controls.projectionYear)

      // Get current volume for the selected year
      let currentVolume = null
      if (mergedProperties?.volume_data) {
        const volumeData = mergedProperties.volume_data
        const yearsSince2025 = controls.projectionYear - 2025
        currentVolume = volumeData.current_vol_gallons - (volumeData.depletion_rate_yr * yearsSince2025)
      } else if (localAquiferData?.projections) {
        currentVolume = getVolumeForYear(localAquiferData.projections, controls.projectionYear)
      }

      // Get depletion status
      const depletionStatus = getDepletionStatus(mergedProperties, controls.projectionYear)

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
        const fillColor = getDepletionColor(properties, controls.projectionYear)

        let currentVolume = null
        if (properties?.volume_data) {
          const volumeData = properties.volume_data
          const yearsSince2025 = controls.projectionYear - 2025
          currentVolume = volumeData.current_vol_gallons - (volumeData.depletion_rate_yr * yearsSince2025)
        } else if (properties?.projections) {
          currentVolume = getVolumeForYear(properties.projections, controls.projectionYear)
        }
        const depletionStatus = getDepletionStatus(properties, controls.projectionYear)

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
  }, [controls.projectionYear])

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
      console.log('📂 Falling back to local aquifer data...')

      // Fallback to local static aquifer data when API fails
      try {
        const localAquifers = aquifersData as GeoJSON.FeatureCollection
        if (localAquifers && localAquifers.features && localAquifers.features.length > 0) {
          const enhancedAquifers = enhanceAquiferData(localAquifers)
          setAquiferData(enhancedAquifers)
          setAquiferCount(enhancedAquifers.features.length)
          console.log('✅ Loaded', enhancedAquifers.features.length, 'aquifers from local data')
          setError(null) // Clear error since we have fallback data
        } else {
          // Only show error if fallback also fails
          if (err instanceof Error && err.name === 'AbortError') {
            setError('Request timed out. Using limited local data.')
          } else {
            setError('Failed to load aquifer data from API. Using local data.')
          }
        }
      } catch (fallbackErr) {
        console.error('Fallback to local aquifer data also failed:', fallbackErr)
        if (err instanceof Error && err.name === 'AbortError') {
          setError('Request timed out. The backend may not be running. Please check that the backend server is started.')
        } else {
          setError(err instanceof Error ? err.message : 'Failed to load aquifer data. Please check that the backend server is running.')
        }
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
      // Add initial risk level based on current projection year/scenario
      const initialYear = controls.projectionYear || 2050
      const availableYears = [2025, 2035, 2045, 2055, 2065, 2075, 2085, 2095]
      const closestYear = availableYears.reduce((prev, curr) =>
        Math.abs(curr - initialYear) < Math.abs(prev - initialYear) ? curr : prev
      )

      // Map scenario
      let mappedScenario = 'ssp245'
      if (controls.scenario === 'rcp26') mappedScenario = 'ssp126'
      else if (controls.scenario === 'rcp45') mappedScenario = 'ssp245'
      else if (controls.scenario === 'rcp60') mappedScenario = 'ssp370'
      else if (controls.scenario === 'rcp85') mappedScenario = 'ssp585'

      const canals: GeoJSON.FeatureCollection = {
        type: 'FeatureCollection',
        features: (enhancedInfrastructureData as any).features
          .filter((f: any) => f.properties?.infrastructure_type === 'aqueduct')
          .map((f: any) => {
            const props = f.properties
            let riskLevel = 'low'
            let flowPercentage = 100
            let flowStatus = 'natural'

            // Get flow projections for this canal
            if (props.flow_projections && props.flow_projections[mappedScenario]) {
              const scenarioData = props.flow_projections[mappedScenario]
              flowPercentage = scenarioData.flow_percentage?.[String(closestYear)] || 100
              flowStatus = scenarioData.flow_status?.[String(closestYear)] || 'natural'

              const servesWaterPoor = props.serves_water_poor_cities || props.water_poor_cities_count > 0

              if (flowStatus === 'dry' || flowPercentage < 60) {
                riskLevel = servesWaterPoor ? 'critical' : 'high'
              } else if (flowStatus === 'seasonal' || flowPercentage < 75) {
                riskLevel = servesWaterPoor ? 'high' : 'moderate'
              } else if (flowStatus === 'reduced' || flowPercentage < 90) {
                riskLevel = servesWaterPoor ? 'moderate' : 'low'
              }
            }

            return {
              ...f,
              properties: {
                ...props,
                _risk_level: riskLevel,
                _flow_percentage: flowPercentage,
                _flow_status: flowStatus
              }
            }
          })
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

      // Add canals/aqueducts source and layers (risk-based coloring)
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
            // Casing color based on risk level (darker version)
            'line-color': [
              'match',
              ['get', '_risk_level'],
              'critical', '#7f1d1d',  // Dark red
              'high', '#9a3412',      // Dark orange
              'moderate', '#854d0e',  // Dark yellow
              'low', '#166534',       // Dark green
              '#0e7490'               // Default dark cyan
            ],
            'line-width': 7,
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
            // Solid color based on risk level - updates with year slider
            'line-color': [
              'match',
              ['get', '_risk_level'],
              'critical', '#dc2626',  // Red - critical risk (dry/< 60% flow)
              'high', '#f97316',      // Orange - high risk (60-75% flow)
              'moderate', '#eab308',  // Yellow - moderate risk (75-90% flow)
              'low', '#22c55e',       // Green - low risk (> 90% flow)
              '#06b6d4'               // Default cyan
            ],
            'line-width': 4,
            'line-opacity': 1.0
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
            'circle-radius': 10,
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

      // Dam icon layer — white dam icon centered on each circle
      if (!map.hasImage('dam-icon')) {
        map.addImage('dam-icon', createIconImage(32, drawDamIcon))
      }
      if (!map.getLayer('dams-icons')) {
        map.addLayer({
          id: 'dams-icons',
          type: 'symbol',
          source: 'dams',
          layout: {
            'icon-image': 'dam-icon',
            'icon-size': 0.6,
            'icon-allow-overlap': true
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

      // Dam click handler
      map.on('click', 'dams-circles', (e) => {
        if (!e.features || e.features.length === 0) return
        const props = e.features[0].properties
        if (!props) return

        // Close other detail panels
        setSelectedAquifer(null)
        setSelectedFeatureId(null)
        setSelectedFactory(null)

        setSelectedDam({
          id: props.id || '',
          name: props.name,
          state: props.state || '',
          reservoir: props.reservoir || '',
          river: props.river || '',
          year_completed: props.year_completed || 0,
          height_ft: props.height_ft || 0,
          storage_acre_ft: props.storage_acre_ft || 0,
          capacity_mw: props.capacity_mw || 0,
          serves: props.serves || '',
          downstream_impact: props.downstream_impact || 'moderate',
          impact_description: props.impact_description || '',
          connected_infrastructure: props.connected_infrastructure || '',
          dam_type: props.dam_type || ''
        })
      })

      map.on('mouseenter', 'dams-circles', () => {
        map.getCanvas().style.cursor = 'pointer'
      })
      map.on('mouseleave', 'dams-circles', () => {
        map.getCanvas().style.cursor = ''
      })

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

      // Add metro humidity heat map (organic blob-like visualization)
      // Generate GeoJSON with point features that will be rendered as a heatmap
      const generateMetroHumidityHeatmap = () => {
        // Use all cities from expanded wet bulb data (30 cities with accurate projections)
        const features = (metroHumidityData as any).features
          .map((feature: any) => {
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
                days_over_95F: Math.round((lower.days_over_95F || 0) + ((upper.days_over_95F || 0) - (lower.days_over_95F || 0)) * ratio),
                days_over_100F: Math.round((lower.days_over_100F || 0) + ((upper.days_over_100F || 0) - (lower.days_over_100F || 0)) * ratio),
                estimated_at_risk_population: Math.round((lower.estimated_at_risk_population || 0) + ((upper.estimated_at_risk_population || 0) - (lower.estimated_at_risk_population || 0)) * ratio),
                casualty_rate_percent: Math.round(((lower.casualty_rate_percent || 0) + ((upper.casualty_rate_percent || 0) - (lower.casualty_rate_percent || 0)) * ratio) * 10) / 10,
                extent_radius_km: Math.round((lower.extent_radius_km || 0) + ((upper.extent_radius_km || 0) - (lower.extent_radius_km || 0)) * ratio)
              }
            }

            const humidityData = getHumidityDataForYear(feature.properties.humidity_projections, projectionYear)
            const color = getWetBulbDangerColor(humidityData.wet_bulb_events, humidityData.days_over_95F)

            // Normalize wet bulb events to 0-1 scale for heatmap intensity (max 100 events)
            const intensity = Math.min(humidityData.wet_bulb_events / 100, 1)

            // Debug log for high-risk wet bulb cities
            if (humidityData.wet_bulb_events > 20) {
              console.log(`🔴 Wet Bulb Heatmap (high risk): ${cityName}`, {
                intensity,
                color,
                wet_bulb_events: humidityData.wet_bulb_events,
                days_over_95F: humidityData.days_over_95F,
                extent_radius_km: humidityData.extent_radius_km
              })
            }

            return {
              type: 'Feature' as const,
              properties: {
                city: cityName,
                lat: lat,
                lng: lng,
                peak_humidity: humidityData.peak_humidity,
                wet_bulb_events: humidityData.wet_bulb_events,
                days_over_95F: humidityData.days_over_95F,
                days_over_100F: humidityData.days_over_100F,
                at_risk_population: humidityData.estimated_at_risk_population,
                casualty_rate_percent: humidityData.casualty_rate_percent,
                extent_radius_km: humidityData.extent_radius_km,
                color: color,
                intensity: intensity  // Used for heatmap weight
              },
              geometry: {
                type: 'Point' as const,
                coordinates: [lng, lat]
              }
            }
          })

        return {
          type: 'FeatureCollection' as const,
          features
        }
      }

      // Always create/update the source (heatmap points are always constructed, visibility is controlled separately)
      if (!map.getSource('metro-humidity-heatmap')) {
        console.log('📦 Adding metro-humidity-heatmap source...')
        map.addSource('metro-humidity-heatmap', {
          type: 'geojson',
          data: generateMetroHumidityHeatmap()
        })
      } else {
        // Update source data when year changes (heatmap is always constructed)
        const source = map.getSource('metro-humidity-heatmap') as mapboxgl.GeoJSONSource
        source.setData(generateMetroHumidityHeatmap())
      }

      // Add metro humidity heatmap layer (organic blob-like visualization with gradient fade)
      if (!map.getLayer('metro-humidity-heatmap-layer')) {
        console.log('🎨 Adding metro-humidity-heatmap-layer...')
        map.addLayer({
          id: 'metro-humidity-heatmap-layer',
          type: 'heatmap',
          source: 'metro-humidity-heatmap',
          layout: {
            visibility: showMetroHumidityLayer ? 'visible' : 'none'
          },
          paint: {
            // Increase weight as wet bulb events increase
            'heatmap-weight': [
              'interpolate',
              ['linear'],
              ['get', 'intensity'],
              0, 0,
              1, 1
            ],
            // Increase intensity as zoom level increases
            'heatmap-intensity': [
              'interpolate',
              ['linear'],
              ['zoom'],
              0, 0.8,
              9, 1.2
            ],
            // Color ramp: transparent → yellow → orange → red (matching wet bulb danger colors)
            'heatmap-color': [
              'interpolate',
              ['linear'],
              ['heatmap-density'],
              0, 'rgba(0, 0, 0, 0)',
              0.2, '#fbbf24',  // Amber
              0.4, '#fb923c',  // Bold orange
              0.6, '#f97316',  // Strong orange
              0.8, '#ef4444',  // Red
              1, '#991b1b'     // Dark red
            ],
            // Adjust radius based on zoom level and extent_radius_km
            'heatmap-radius': [
              'interpolate',
              ['linear'],
              ['zoom'],
              0, 20,
              5, 40,
              10, 80,
              15, 120
            ],
            // Fade out heatmap at higher zoom levels to reduce visual clutter
            'heatmap-opacity': [
              'interpolate',
              ['linear'],
              ['zoom'],
              0, 0.8,
              12, 0.6,
              15, 0.3
            ]
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
        days_over_95F: Math.round((lower.days_over_95F || 0) + ((upper.days_over_95F || 0) - (lower.days_over_95F || 0)) * ratio),
        days_over_100F: Math.round((lower.days_over_100F || 0) + ((upper.days_over_100F || 0) - (lower.days_over_100F || 0)) * ratio),
        estimated_at_risk_population: Math.round((lower.estimated_at_risk_population || 0) + ((upper.estimated_at_risk_population || 0) - (lower.estimated_at_risk_population || 0)) * ratio),
        casualty_rate_percent: Math.round(((lower.casualty_rate_percent || 0) + ((upper.casualty_rate_percent || 0) - (lower.casualty_rate_percent || 0)) * ratio) * 10) / 10,
        extent_radius_km: Math.round((lower.extent_radius_km || 0) + ((upper.extent_radius_km || 0) - (lower.extent_radius_km || 0)) * ratio)
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

          <!-- Extreme Heat Days -->
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
              ">Extreme Heat Days</p>
            </div>
            <div style="display: flex;">
              <div style="flex: 1; padding: 4px 8px;">
                <p style="
                  font-size: 9px;
                  font-weight: 500;
                  color: #101728;
                  margin: 0 0 2px 0;
                ">95°F+ Days</p>
                <p style="
                  font-size: 12px;
                  font-weight: 700;
                  color: #101728;
                  margin: 0;
                ">${humidityData.days_over_95F || 0}</p>
              </div>
              <div style="flex: 1; padding: 4px 8px;">
                <p style="
                  font-size: 9px;
                  font-weight: 500;
                  color: #101728;
                  margin: 0 0 2px 0;
                ">100°F+ Days</p>
                <p style="
                  font-size: 12px;
                  font-weight: 700;
                  color: #101728;
                  margin: 0;
                  text-align: center;
                ">${humidityData.days_over_100F || 0}</p>
              </div>
            </div>
          </div>

          <!-- Health Impact Statistics -->
          <div style="border-radius: 4px; overflow: hidden;">
            <div style="
              background: rgba(239, 68, 68, 0.15);
              padding: 4px 8px;
              border-radius: 4px;
            ">
              <p style="
                font-size: 10px;
                font-weight: 600;
                color: #991b1b;
                margin: 0;
              ">Health Impact & Extent</p>
            </div>
            <div style="display: flex; flex-direction: column; gap: 4px; padding: 4px 8px;">
              <div style="display: flex; justify-content: space-between;">
                <p style="font-size: 9px; font-weight: 500; color: #101728; margin: 0;">At-Risk Population:</p>
                <p style="font-size: 10px; font-weight: 700; color: #dc2626; margin: 0;">${(humidityData.estimated_at_risk_population || 0).toLocaleString()}</p>
              </div>
              <div style="display: flex; justify-content: space-between;">
                <p style="font-size: 9px; font-weight: 500; color: #101728; margin: 0;">Casualty Rate:</p>
                <p style="font-size: 10px; font-weight: 700; color: #dc2626; margin: 0;">${humidityData.casualty_rate_percent || 0}%</p>
              </div>
              <div style="display: flex; justify-content: space-between;">
                <p style="font-size: 9px; font-weight: 500; color: #101728; margin: 0;">Danger Zone Radius:</p>
                <p style="font-size: 10px; font-weight: 700; color: #dc2626; margin: 0;">${humidityData.extent_radius_km || 0} km</p>
              </div>
            </div>
          </div>
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

      // Close factory panel when opening aquifer panel
      setSelectedFactory(null)

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
      if (!map || map._removed) return
      try {
        map.off('style.load', onStyleLoad)
      } catch (error) {
        console.log('Map already removed during style.load cleanup')
      }
    }
  }, [mapStyle, mapLoaded, setupMapLayers, enhanceAquiferData])

  // Update map data when aquifer data or projection year changes
  useEffect(() => {
    console.log('🔄 Aquifer update useEffect triggered:', {
      hasMap: !!mapRef.current,
      mapLoaded,
      hasAquiferData: !!aquiferData,
      featureCount: aquiferData?.features?.length,
      projectionYear: controls.projectionYear
    })

    if (!mapRef.current || !mapLoaded) return

    const map = mapRef.current

    if (aquiferData && aquiferData.features && aquiferData.features.length > 0) {
      console.log('🎨 Re-enhancing aquifer data for year:', controls.projectionYear)

      // Re-enhance data with current projection year
      const enhancedData = enhanceAquiferData(aquiferData)

      const source = map.getSource('aquifers') as mapboxgl.GeoJSONSource
      if (source) {
        try {
          // Clear all feature states before updating data to prevent stale selections
          map.removeFeatureState({ source: 'aquifers' })
          source.setData(enhancedData)

          console.log('✅ Updated aquifer source with', enhancedData.features.length, 'features for year', controls.projectionYear)
          if (enhancedData.features.length > 0) {
            console.log('📍 Sample feature:', {
              id: enhancedData.features[0].id,
              name: enhancedData.features[0].properties?.name,
              fillColor: enhancedData.features[0].properties?.fillColor,
              depletionStatus: enhancedData.features[0].properties?.depletionStatus,
              hasGeometry: !!enhancedData.features[0].geometry
            })
          }

          // Keep the aquifer panel open when only the projection year changed
          // The panel recalculates from projections data on its own
          // Only clear the visual feature state highlight (it gets reset by removeFeatureState above)
          setSelectedFeatureId(null)

          map.triggerRepaint()
        } catch (error) {
          console.error('❌ Error updating aquifer source:', error)
        }
      } else {
        console.warn('⚠️ Aquifer source not found when trying to update data')
      }
    }
  }, [aquiferData, mapLoaded, controls.projectionYear, enhanceAquiferData])

  // Toggle river layers visibility and opacity
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return

    const map = mapRef.current
    const visibility = showRiversLayer ? 'visible' : 'none'

    const riverLayerIds = ['river-lines-casing', 'river-lines', 'river-city-markers', 'river-city-labels']

    riverLayerIds.forEach(layerId => {
      if (map.getLayer(layerId)) {
        map.setLayoutProperty(layerId, 'visibility', visibility)
        // Apply opacity to line layers
        if (layerId === 'river-lines' || layerId === 'river-lines-casing') {
          map.setPaintProperty(layerId, 'line-opacity', riverOpacity)
        }
      }
    })
  }, [showRiversLayer, mapLoaded, riverOpacity])

  // Update river flow status based on projection year and scenario
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return

    const map = mapRef.current
    const source = map.getSource('rivers') as mapboxgl.GeoJSONSource
    if (!source) return

    // Map RCP scenarios to SSP scenarios used in our projection data
    let mappedScenario = 'ssp245' // default moderate scenario
    if (controls.scenario === 'rcp26') mappedScenario = 'ssp126'
    else if (controls.scenario === 'rcp45') mappedScenario = 'ssp245'
    else if (controls.scenario === 'rcp60') mappedScenario = 'ssp370'
    else if (controls.scenario === 'rcp85') mappedScenario = 'ssp585'

    // Get the closest available year in our projection data
    const availableYears = [2025, 2035, 2045, 2055, 2065, 2075, 2085, 2095]
    const targetYear = controls.projectionYear || 2050
    const closestYear = availableYears.reduce((prev, curr) =>
      Math.abs(curr - targetYear) < Math.abs(prev - targetYear) ? curr : prev
    )

    console.log(`🌊 Updating river flow status for year ${closestYear}, scenario ${mappedScenario}`)

    // Transform river data with projected flow status for the selected year/scenario
    const updatedRivers = {
      ...riversData,
      features: (riversData as any).features.map((feature: any) => {
        const props = feature.properties
        let newFlowStatus = props.flow_status || 'natural' // Keep original as fallback

        // Check if this river has flow projections
        if (props.flow_projections && props.flow_projections[mappedScenario]) {
          const scenarioData = props.flow_projections[mappedScenario]
          if (scenarioData.flow_status && scenarioData.flow_status[String(closestYear)]) {
            newFlowStatus = scenarioData.flow_status[String(closestYear)]
          }
        }

        return {
          ...feature,
          properties: {
            ...props,
            flow_status: newFlowStatus,
            _projected_year: closestYear,
            _projected_scenario: mappedScenario
          }
        }
      })
    }

    try {
      source.setData(updatedRivers as any)
      console.log(`✅ Updated ${updatedRivers.features.length} rivers for year ${closestYear}`)
    } catch (error) {
      console.error('❌ Error updating river source:', error)
    }
  }, [mapLoaded, controls.projectionYear, controls.scenario])

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

  // Update canal/aqueduct risk colors based on projection year and scenario
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return

    const map = mapRef.current
    const source = map.getSource('canals') as mapboxgl.GeoJSONSource
    if (!source) return

    // Map RCP scenarios to SSP scenarios
    let mappedScenario = 'ssp245'
    if (controls.scenario === 'rcp26') mappedScenario = 'ssp126'
    else if (controls.scenario === 'rcp45') mappedScenario = 'ssp245'
    else if (controls.scenario === 'rcp60') mappedScenario = 'ssp370'
    else if (controls.scenario === 'rcp85') mappedScenario = 'ssp585'

    // Get closest available year
    const availableYears = [2025, 2035, 2045, 2055, 2065, 2075, 2085, 2095]
    const targetYear = controls.projectionYear || 2050
    const closestYear = availableYears.reduce((prev, curr) =>
      Math.abs(curr - targetYear) < Math.abs(prev - targetYear) ? curr : prev
    )

    console.log(`🚰 Updating canal risk for year ${closestYear}, scenario ${mappedScenario}`)

    // Get canal features from enhanced infrastructure data
    const canalFeatures = (enhancedInfrastructureData as any).features.filter((f: any) =>
      f.properties?.infrastructure_type === 'aqueduct'
    )

    // Transform canal data with projected risk level
    const updatedCanals = {
      type: 'FeatureCollection',
      features: canalFeatures.map((feature: any) => {
        const props = feature.properties
        let riskLevel = 'low'
        let flowPercentage = 100
        let flowStatus = 'natural'

        // Get flow projections for this canal's source river
        if (props.flow_projections && props.flow_projections[mappedScenario]) {
          const scenarioData = props.flow_projections[mappedScenario]
          flowPercentage = scenarioData.flow_percentage?.[String(closestYear)] || 100
          flowStatus = scenarioData.flow_status?.[String(closestYear)] || 'natural'

          // Calculate risk level based on flow and whether it serves water-poor cities
          const servesWaterPoor = props.serves_water_poor_cities || props.water_poor_cities_count > 0

          if (flowStatus === 'dry' || flowPercentage < 60) {
            riskLevel = servesWaterPoor ? 'critical' : 'high'
          } else if (flowStatus === 'seasonal' || flowPercentage < 75) {
            riskLevel = servesWaterPoor ? 'high' : 'moderate'
          } else if (flowStatus === 'reduced' || flowPercentage < 90) {
            riskLevel = servesWaterPoor ? 'moderate' : 'low'
          } else {
            riskLevel = 'low'
          }
        }

        return {
          ...feature,
          properties: {
            ...props,
            _risk_level: riskLevel,
            _flow_percentage: flowPercentage,
            _flow_status: flowStatus,
            _projected_year: closestYear,
            _projected_scenario: mappedScenario
          }
        }
      })
    }

    try {
      source.setData(updatedCanals as any)

      // Update canal line colors based on risk level
      if (map.getLayer('canal-lines')) {
        map.setPaintProperty('canal-lines', 'line-color', [
          'match',
          ['get', '_risk_level'],
          'critical', '#dc2626',  // Red - critical risk
          'high', '#f97316',      // Orange - high risk
          'moderate', '#eab308',  // Yellow - moderate risk
          '#22c55e'               // Green - low risk (default)
        ])
        // Remove gradient, use solid color
        map.setPaintProperty('canal-lines', 'line-width', 4)
      }

      if (map.getLayer('canal-lines-casing')) {
        map.setPaintProperty('canal-lines-casing', 'line-color', [
          'match',
          ['get', '_risk_level'],
          'critical', '#991b1b',  // Dark red
          'high', '#c2410c',      // Dark orange
          'moderate', '#a16207',  // Dark yellow
          '#166534'               // Dark green (default)
        ])
        map.setPaintProperty('canal-lines-casing', 'line-width', 6)
      }

      console.log(`✅ Updated ${updatedCanals.features.length} canals for year ${closestYear}`)
    } catch (error) {
      console.error('❌ Error updating canal source:', error)
    }
  }, [mapLoaded, controls.projectionYear, controls.scenario])

  // Toggle aquifer layers visibility (independent layer)
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

    const damLayerIds = ['dams-circles', 'dams-icons', 'dams-labels']

    damLayerIds.forEach(layerId => {
      if (map.getLayer(layerId)) {
        map.setLayoutProperty(layerId, 'visibility', visibility)
      }
    })
  }, [showDamsLayer, mapLoaded])

  // Manage Sea Level Rise layer (raster tiles from NOAA)
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return

    const map = mapRef.current
    const sourceId = 'sea-level-rise-tiles'
    const layerId = 'sea-level-rise-layer'

    if (showSeaLevelRiseLayer) {
      // Construct tile URL using the working NOAA tile endpoint
      const tileUrl = `${API_BASE}/api/tiles/noaa-slr/${seaLevelRiseFeet}/{z}/{x}/{y}.png`

      console.log(`🌊 Adding sea level rise layer: ${seaLevelRiseFeet}ft`)

      // Add or update raster source
      if (!map.getSource(sourceId)) {
        map.addSource(sourceId, {
          type: 'raster',
          tiles: [tileUrl],
          tileSize: 256
        })
      } else {
        // Update source if tile URL changed (when projection year changes)
        const source = map.getSource(sourceId) as any
        if (source && source.tiles && source.tiles[0] !== tileUrl) {
          source.setTiles([tileUrl])
        }
      }

      // Add raster layer if it doesn't exist
      if (!map.getLayer(layerId)) {
        console.log('🎨 Adding sea level rise raster layer...')
        map.addLayer({
          id: layerId,
          type: 'raster',
          source: sourceId,
          paint: {
            'raster-opacity': 0.7
          }
        })
        console.log('✅ Sea level rise layer added successfully')
      } else {
        // Update opacity if layer exists
        map.setPaintProperty(layerId, 'raster-opacity', 0.7)
      }
    } else {
      // Remove layer and source when disabled
      try {
        if (map.getLayer(layerId)) {
          map.removeLayer(layerId)
        }
        if (map.getSource(sourceId)) {
          map.removeSource(sourceId)
        }
      } catch (error) {
        console.log('Map already removed during sea level layer cleanup')
      }
    }
  }, [showSeaLevelRiseLayer, seaLevelRiseFeet, controls.projectionYear, mapLoaded])

  // Manage GRACE groundwater tile layer
  useEffect(() => {
    if (!mapRef.current || !mapLoaded || !graceTileUrl) return

    const map = mapRef.current

    // Add GRACE raster source and layer if enabled (requires both groundwater layer AND GRACE toggle)
    if (showGRACELayer && showGroundwaterLayer) {
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
  }, [showGRACELayer, showGroundwaterLayer, graceTileUrl, mapLoaded, graceOpacity])

  // Add/remove temperature projection layer based on climate context toggle
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return

    const map = mapRef.current
    const data = temperatureProjectionData as any

    // Add temperature raster source and layer if enabled
    if (isTemperatureProjectionActive) {
      // Wait for data to be available
      if (!data || !data.tile_url) {
        console.log('⏳ Waiting for temperature projection data to load...')

        // Backstop: Auto-refresh data if not loaded after 5 seconds
        const retryTimer = setTimeout(() => {
          console.log('🔄 Temperature data not loaded after 5s, triggering background refresh...')
          refreshLayer('temperature_projection')
        }, 5000)

        return () => clearTimeout(retryTimer)
      }

      const tileUrl = data.tile_url

      if (!map.getSource('temperature-tiles')) {
        console.log('🌡️ Adding temperature projection tile source...')
        map.addSource('temperature-tiles', {
          type: 'raster',
          tiles: [tileUrl],
          tileSize: 256
        })
      }

      if (!map.getLayer('temperature-layer')) {
        console.log('🎨 Adding temperature projection raster layer...')
        // Add temperature layer on top of other data layers but below labels
        // Should be above aquifers/rivers but below factories/labels
        let beforeId: string | undefined = 'factory-points'

        // If factory layer doesn't exist, try labels
        if (!map.getLayer(beforeId)) {
          const labelLayerIds = ['waterway-label', 'place-labels', 'poi-label', 'road-label']
          for (const layerId of labelLayerIds) {
            if (map.getLayer(layerId)) {
              beforeId = layerId
              break
            }
          }
        }

        map.addLayer({
          id: 'temperature-layer',
          type: 'raster',
          source: 'temperature-tiles',
          paint: {
            'raster-opacity': controls.projectionOpacity ?? 0.6,
            'raster-fade-duration': 300
          }
        }, beforeId)
        console.log(`✅ Temperature layer added with opacity ${controls.projectionOpacity} before ${beforeId || 'top'}`)
      } else {
        // Update opacity and make visible
        map.setPaintProperty('temperature-layer', 'raster-opacity', controls.projectionOpacity ?? 0.6)
        map.setLayoutProperty('temperature-layer', 'visibility', 'visible')
      }
    } else {
      // Hide the layer if it exists
      if (map.getLayer('temperature-layer')) {
        map.setLayoutProperty('temperature-layer', 'visibility', 'none')
      }
    }

    return () => {
      // Cleanup on unmount
      if (!map || map._removed) return

      try {
        if (map.getLayer('temperature-layer')) {
          map.removeLayer('temperature-layer')
        }
        if (map.getSource('temperature-tiles')) {
          map.removeSource('temperature-tiles')
        }
      } catch (error) {
        console.log('Map already removed during temperature layer cleanup')
      }
    }
  }, [isTemperatureProjectionActive, temperatureProjectionData, mapLoaded, controls.projectionOpacity])

  // Backstop: Monitor temperature projection status and retry on prolonged loading/error
  useEffect(() => {
    if (!isTemperatureProjectionActive) return
    if (temperatureProjectionData && (temperatureProjectionData as any).tile_url) return // Data already loaded

    // Set up retry timer if stuck in loading or error state
    const statusCheckTimer = setTimeout(() => {
      if (temperatureProjectionStatus === 'loading' || temperatureProjectionStatus === 'error') {
        console.log(`🔄 Temperature projection status: ${temperatureProjectionStatus} - forcing refresh after 10s`)
        refreshLayer('temperature_projection')
      }
    }, 10000) // 10 seconds

    return () => clearTimeout(statusCheckTimer)
  }, [isTemperatureProjectionActive, temperatureProjectionStatus, temperatureProjectionData, refreshLayer])

  // Toggle metro humidity heatmap layer visibility - SHOW heatmap for wet bulb visualization!
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return
    console.log('🔵 Metro Humidity Heatmap useEffect running', { showMetroHumidityLayer, mapLoaded })

    const map = mapRef.current

    // Show the heatmap layer for wet bulb danger zone visualization
    if (map.getLayer('metro-humidity-heatmap-layer')) {
      const visibility = showMetroHumidityLayer ? 'visible' : 'none'
      console.log(`🎨 Setting metro-humidity-heatmap-layer visibility to ${visibility}`)
      map.setLayoutProperty('metro-humidity-heatmap-layer', 'visibility', visibility)
    }
  }, [showMetroHumidityLayer, mapLoaded])

  // Manage Wet Bulb Temperature Danger Zone layer - uses local expanded data
  useEffect(() => {
    console.log(`🔄 WET BULB EFFECT TRIGGERED - Year: ${controls.projectionYear}, Active: ${isWetBulbActive}, Loaded: ${mapLoaded}`)

    if (!mapRef.current || !mapLoaded) return

    const map = mapRef.current
    if (!map || map._removed) return // Safety check

    const sourceId = 'wet-bulb-danger-zones'
    const layerId = 'wet-bulb-layer'

    try {
      // Only process and add data when layer is active
      if (isWetBulbActive) {
        // Helper to create circle polygon from center point
        const createCirclePolygon = (lng: number, lat: number, radiusKm: number, numPoints: number = 64): number[][] => {
          const coords: number[][] = []
          const earthRadiusKm = 6371
          for (let i = 0; i <= numPoints; i++) {
            const angle = (i / numPoints) * 2 * Math.PI
            const latOffset = (radiusKm / earthRadiusKm) * (180 / Math.PI)
            const lngOffset = (radiusKm / earthRadiusKm) * (180 / Math.PI) / Math.cos(lat * Math.PI / 180)
            coords.push([lng + lngOffset * Math.cos(angle), lat + latOffset * Math.sin(angle)])
          }
          return coords
        }

        // Helper to interpolate between projection years
        const interpolateProjection = (projections: Record<string, any>, targetYear: number) => {
          if (!projections || Object.keys(projections).length === 0) {
            console.warn('No projections data available')
            return null
          }

          const years = Object.keys(projections).map(Number).sort((a, b) => a - b)
          let lowerYear = years[0]
          let upperYear = years[years.length - 1]

          for (const year of years) {
            if (year <= targetYear) lowerYear = year
            if (year >= targetYear && upperYear === years[years.length - 1]) upperYear = year
          }

          if (lowerYear === upperYear || targetYear <= lowerYear) return projections[lowerYear.toString()]
          if (targetYear >= upperYear) return projections[upperYear.toString()]

          const ratio = (targetYear - lowerYear) / (upperYear - lowerYear)
          const lower = projections[lowerYear.toString()]
          const upper = projections[upperYear.toString()]

          if (!lower || !upper) {
            console.warn(`Missing projection data for years ${lowerYear} or ${upperYear}`)
            return lower || upper || projections[years[0].toString()]
          }

          return {
            avg_summer_humidity: Math.round((lower.avg_summer_humidity || 0) + ((upper.avg_summer_humidity || 0) - (lower.avg_summer_humidity || 0)) * ratio),
            peak_humidity: Math.round((lower.peak_humidity || 0) + ((upper.peak_humidity || 0) - (lower.peak_humidity || 0)) * ratio),
            wet_bulb_events: Math.round((lower.wet_bulb_events || 0) + ((upper.wet_bulb_events || 0) - (lower.wet_bulb_events || 0)) * ratio),
            days_over_95F: Math.round((lower.days_over_95F || 0) + ((upper.days_over_95F || 0) - (lower.days_over_95F || 0)) * ratio),
            days_over_100F: Math.round((lower.days_over_100F || 0) + ((upper.days_over_100F || 0) - (lower.days_over_100F || 0)) * ratio),
            estimated_at_risk_population: Math.round((lower.estimated_at_risk_population || 0) + ((upper.estimated_at_risk_population || 0) - (lower.estimated_at_risk_population || 0)) * ratio),
            casualty_rate_percent: Math.round(((lower.casualty_rate_percent || 0) + ((upper.casualty_rate_percent || 0) - (lower.casualty_rate_percent || 0)) * ratio) * 10) / 10,
            extent_radius_km: Math.round((lower.extent_radius_km || 0) + ((upper.extent_radius_km || 0) - (lower.extent_radius_km || 0)) * ratio)
          }
        }

        // COLOR based on danger level (combines frequency and humidity intensity)
        const getDangerColor = (wetBulbEvents: number, peakHumidity: number): string => {
          const dangerScore = wetBulbEvents * (peakHumidity / 70)
          if (dangerScore < 5) return '#93c5fd'   // Light blue - minimal risk
          if (dangerScore < 15) return '#fde047'  // Yellow - low risk
          if (dangerScore < 30) return '#fbbf24'  // Amber - moderate
          if (dangerScore < 50) return '#fb923c'  // Orange - elevated
          if (dangerScore < 80) return '#ef4444'  // Red - high risk
          return '#991b1b' // Dark red - extreme danger
        }

        // OPACITY based on danger level - faint for low risk, solid for high risk
        const getDangerOpacity = (wetBulbEvents: number, peakHumidity: number): number => {
          const dangerScore = wetBulbEvents * (peakHumidity / 70)
          if (dangerScore < 5) return 0.15
          if (dangerScore < 15) return 0.25
          if (dangerScore < 30) return 0.4
          if (dangerScore < 50) return 0.55
          if (dangerScore < 80) return 0.7
          return 0.85
        }

        // SIZE based on events and population
        const getRadiusFromDanger = (wetBulbEvents: number, metroPop: number): number => {
          let baseRadius = 20
          if (wetBulbEvents <= 3) baseRadius = 25
          else if (wetBulbEvents <= 10) baseRadius = 35
          else if (wetBulbEvents <= 25) baseRadius = 50
          else if (wetBulbEvents <= 50) baseRadius = 70
          else if (wetBulbEvents <= 75) baseRadius = 95
          else baseRadius = 120
          const popFactor = Math.min(1.3, 0.8 + (metroPop / 10000000))
          return Math.round(baseRadius * popFactor)
        }

        // Generate GeoJSON features from expanded wet bulb data
        const wetBulbDataTyped = expandedWetBulbData as Record<string, {
          name: string
          lat: number
          lon: number
          population_2024: number
          metro_population_2024: number
          baseline_humidity: number
          projections: Record<string, any>
        }>

        const features = Object.entries(wetBulbDataTyped)
          .map(([cityKey, cityData]) => {
            const { lat, lon, name, projections, metro_population_2024, baseline_humidity } = cityData
            const projection = interpolateProjection(projections, controls.projectionYear)

            // Skip if no projection data
            if (!projection) return null

            const radiusKm = getRadiusFromDanger(projection.wet_bulb_events, metro_population_2024)
            const color = getDangerColor(projection.wet_bulb_events, projection.peak_humidity)
            const opacity = getDangerOpacity(projection.wet_bulb_events, projection.peak_humidity)

            // Show all cities for debugging
            // if (projection.wet_bulb_events === 0 && controls.projectionYear < 2035) return null

            return {
              type: 'Feature' as const,
              geometry: {
                type: 'Polygon' as const,
                coordinates: [createCirclePolygon(lon, lat, radiusKm)]
              },
              properties: {
                name,
                cityKey,
                wet_bulb_events: projection.wet_bulb_events,
                peak_humidity: projection.peak_humidity,
                avg_summer_humidity: projection.avg_summer_humidity,
                days_over_95F: projection.days_over_95F,
                days_over_100F: projection.days_over_100F,
                at_risk_population: projection.estimated_at_risk_population,
                radius_km: radiusKm,
                metro_population: metro_population_2024,
                baseline_humidity,
                color,
                opacity
              }
            }
          })
          .filter((f): f is NonNullable<typeof f> => f !== null)

        const geojsonData: GeoJSON.FeatureCollection = {
          type: 'FeatureCollection',
          features
        }

        console.log(`🌡️ Wet Bulb Danger Zones: ${features.length} cities for year ${controls.projectionYear}`)
        console.log(`🔍 Wet Bulb Active: ${isWetBulbActive}, Opacity: ${controls.wetBulbOpacity}`)

        // Debug: Show Miami specifically to verify interpolation
        const miamiFeature = features.find(f => f.properties.name === 'Miami, FL')
        if (miamiFeature) {
          console.log(`🔥 MIAMI DEBUG - Year ${controls.projectionYear}:`, {
            events: miamiFeature.properties.wet_bulb_events,
            radius_km: miamiFeature.properties.radius_km,
            peak_humidity: miamiFeature.properties.peak_humidity,
            color: miamiFeature.properties.color
          })
        }

        console.log(`📊 Sample feature:`, features[0])
        console.log(`🗺️ GeoJSON data:`, geojsonData)

        // FORCE REBUILD: Remove existing layer and source to ensure clean update
        if (map.getLayer(layerId)) {
          console.log('🗑️ Removing existing layer for rebuild...')
          map.removeLayer(layerId)
        }
        if (map.getSource(sourceId)) {
          console.log('🗑️ Removing existing source for rebuild...')
          map.removeSource(sourceId)
        }

        // Add fresh source with new data
        console.log(`📦 Adding Wet Bulb source with data for year ${controls.projectionYear}...`)
        map.addSource(sourceId, {
          type: 'geojson',
          data: geojsonData as any
        })

        // Add fresh layer
        console.log('🎨 Adding Wet Bulb danger zones layer...')
        // Insert below labels but above base map
        let beforeId: string | undefined = 'waterway-label'
        if (!map.getLayer(beforeId)) beforeId = undefined
        if (!beforeId && map.getLayer('river-lines-casing')) beforeId = 'river-lines-casing'

        const layerConfig = {
          id: layerId,
          type: 'fill' as const,
          source: sourceId,
          paint: {
            'fill-color': ['get', 'color'],
            // Per-feature opacity multiplied by global slider control
            'fill-opacity': ['*', ['get', 'opacity'], controls.wetBulbOpacity || 0.8]
          }
        }
        console.log('🎨 Adding layer with config:', layerConfig)
        map.addLayer(layerConfig, beforeId)
        console.log(`✅ Wet Bulb layer added before: ${beforeId || 'top'}`)
      } // End of isWetBulbActive check

      // Toggle visibility based on active state
      const visibility = isWetBulbActive ? 'visible' : 'none'
      if (map.getLayer(layerId)) {
        map.setLayoutProperty(layerId, 'visibility', visibility)
        console.log(`👁️ Wet Bulb layer visibility set to: ${visibility}`)
      }
    } catch (error) {
      console.error('❌ Error updating Wet Bulb layer:', error)
    }

  }, [mapLoaded, isWetBulbActive, controls.wetBulbOpacity, controls.projectionYear])

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
      if (!map || map._removed) return
      try {
        map.off('move', handleMapMove)
        map.off('zoom', handleMapMove)
      } catch (error) {
        console.log('Map already removed during move/zoom listener cleanup')
      }
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
        days_over_95F: Math.round((lower.days_over_95F || 0) + ((upper.days_over_95F || 0) - (lower.days_over_95F || 0)) * ratio),
        days_over_100F: Math.round((lower.days_over_100F || 0) + ((upper.days_over_100F || 0) - (lower.days_over_100F || 0)) * ratio),
        estimated_at_risk_population: Math.round((lower.estimated_at_risk_population || 0) + ((upper.estimated_at_risk_population || 0) - (lower.estimated_at_risk_population || 0)) * ratio),
        casualty_rate_percent: Math.round(((lower.casualty_rate_percent || 0) + ((upper.casualty_rate_percent || 0) - (lower.casualty_rate_percent || 0)) * ratio) * 10) / 10,
        extent_radius_km: Math.round((lower.extent_radius_km || 0) + ((upper.extent_radius_km || 0) - (lower.extent_radius_km || 0)) * ratio)
      }
    }

    // Helper to get temperature data for a city and year
    const getTemperatureData = (cityName: string, year: number) => {
      // Find city in temperature data (case-insensitive, handle variations)
      const normalizedCity = cityName.toLowerCase().trim()

      // Try exact match first, then partial match
      const tempCity = Object.values(metroTemperatureData).find((city: any) => {
        const tempCityName = city.name.toLowerCase().trim()

        // Exact match
        if (tempCityName === normalizedCity) return true

        // Handle "City, ST" format - extract just the city name
        const cityBase = normalizedCity.split(',')[0].trim()
        const tempCityBase = tempCityName.split(',')[0].trim()

        // Match on base city name
        if (cityBase === tempCityBase) return true

        // Partial matching as fallback
        if (tempCityName.includes(cityBase) || cityBase.includes(tempCityBase)) return true

        return false
      }) as any

      if (!tempCity?.projections) {
        console.warn(`⚠️ No temperature data found for "${cityName}"`)
        return null
      }

      // Map scenario names: RCP to SSP
      // rcp26 -> ssp126, rcp45 -> ssp245, rcp60 -> ssp370, rcp85 -> ssp585
      let mappedScenario = controls.scenario
      if (controls.scenario === 'rcp26') mappedScenario = 'ssp126'
      else if (controls.scenario === 'rcp45') mappedScenario = 'ssp245'
      else if (controls.scenario === 'rcp60') mappedScenario = 'ssp370'
      else if (controls.scenario === 'rcp85') mappedScenario = 'ssp585'

      // Try the mapped scenario, fall back to ssp245 (moderate) as default
      const scenarioData = tempCity.projections[mappedScenario] || tempCity.projections['ssp245']

      if (!scenarioData) {
        console.warn(`⚠️ No temperature data for "${cityName}" in scenario ${mappedScenario}`)
        return null
      }

      // Find closest decade
      const decades = Object.keys(scenarioData).map(Number).sort((a, b) => a - b)

      if (decades.length === 0) {
        console.warn(`⚠️ No decade data for "${cityName}" in scenario ${mappedScenario}`)
        return null
      }

      const closestDecade = decades.reduce((prev, curr) =>
        Math.abs(curr - year) < Math.abs(prev - year) ? curr : prev
      )

      const decadeData = scenarioData[closestDecade]

      if (!decadeData) {
        console.warn(`⚠️ No data for decade ${closestDecade} for "${cityName}"`)
        return null
      }

      return decadeData
    }

      // Create markers for each metro city
      ; (metroHumidityData as any).features.forEach((feature: any) => {
        const { city, lat, lng, humidity_projections } = feature.properties
        const humidityData = getHumidityDataForYear(humidity_projections, projectionYear)
        const tempData = getTemperatureData(city, projectionYear)

        // Debug: Log temperature data for first city
        if (city === 'Phoenix' || city === 'Phoenix, AZ') {
          console.log('🌡️ Phoenix Temperature Data:', {
            city,
            projectionYear,
            scenario: controls.scenario,
            tempData,
            showAverageTemperatures,
            summerAvg: tempData?.summer_avg ? `${tempData.summer_avg.toFixed(1)}°F` : undefined,
            winterAvg: tempData?.winter_avg ? `${tempData.winter_avg.toFixed(1)}°F` : undefined
          })
        }

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
            humidTemp={`${humidityData.days_over_95F || 0}°`}
            daysOver100={`${humidityData.days_over_100F || 0}`}
            visible={true}
            showHumidityWetBulb={showHumidityWetBulb}
            showTempHumidity={showTempHumidity}
            showAverageTemperatures={showAverageTemperatures}
            summerAvg={tempData?.summer_avg ? `${tempData.summer_avg.toFixed(1)}°F` : undefined}
            winterAvg={tempData?.winter_avg ? `${tempData.winter_avg.toFixed(1)}°F` : undefined}
            onClose={() => { }}
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
  }, [showMetroHumidityLayer, projectionYear, showHumidityWetBulb, showTempHumidity, showAverageTemperatures, mapLoaded, theme, controls.scenario])

  // Factories Layer - Map Visualization
  useEffect(() => {
    if (!mapRef.current || !mapLoaded || !showFactoriesLayer) {
      // Remove factory layers if they exist
      if (mapRef.current && mapLoaded) {
        const map = mapRef.current
        if (map.getLayer('factory-circles')) map.removeLayer('factory-circles')
        if (map.getLayer('factory-icons')) map.removeLayer('factory-icons')
        if (map.getLayer('factory-labels')) map.removeLayer('factory-labels')
        if (map.getSource('factories')) map.removeSource('factories')
      }
      return
    }

    const map = mapRef.current

    // Transform factory data to GeoJSON
    const geojson: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: factoriesExpandedData.factories.map(factory => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [
            factory.location.coordinates.lon,
            factory.location.coordinates.lat
          ]
        },
        properties: {
          id: factory.id,
          name: factory.name,
          company: factory.company,
          risk_score: factory.environmental_risk?.overall_risk_score || 5,
          total_investment: factory.investment?.total || 1000000000,
          status: factory.status,
          type: factory.type
        }
      }))
    }

    // Add source
    if (!map.getSource('factories')) {
      map.addSource('factories', {
        type: 'geojson',
        data: geojson
      })
    }

    // Add circle layer for factories
    if (!map.getLayer('factory-circles')) {
      map.addLayer({
        id: 'factory-circles',
        type: 'circle',
        source: 'factories',
        paint: {
          'circle-radius': 10,
          'circle-color': [
            'interpolate',
            ['linear'],
            ['get', 'risk_score'],
            0, '#10b981',
            3, '#eab308',
            5, '#f97316',
            7, '#ef4444',
            10, '#dc2626'
          ],
          'circle-opacity': 0.8,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
          'circle-stroke-opacity': 0.9
        }
      })

      // Factory icon layer — white factory icon centered on each circle
      if (!map.hasImage('factory-icon')) {
        map.addImage('factory-icon', createIconImage(32, drawFactoryIcon))
      }
      if (!map.getLayer('factory-icons')) {
        map.addLayer({
          id: 'factory-icons',
          type: 'symbol',
          source: 'factories',
          layout: {
            'icon-image': 'factory-icon',
            'icon-size': 0.6,
            'icon-allow-overlap': true
          }
        })
      } else {
        map.setLayoutProperty('factory-icons', 'icon-size', 0.6)
      }

      // Add labels layer with company + name
      if (!map.getLayer('factory-labels')) {
        map.addLayer({
          id: 'factory-labels',
          type: 'symbol',
          source: 'factories',
          layout: {
            'text-field': ['concat', ['get', 'company'], ' — ', ['get', 'name']],
            'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
            'text-size': 11,
            'text-offset': [0, 1.5],
            'text-anchor': 'top',
            'text-max-width': 14
          },
          paint: {
            'text-color': '#ffffff',
            'text-halo-color': 'rgba(0, 0, 0, 0.8)',
            'text-halo-width': 1.5
          },
          minzoom: 5
        })
      }

      // Add click handler for factory details
      map.on('click', 'factory-circles', (e) => {
        if (!e.features || e.features.length === 0) return

        const feature = e.features[0]
        const props = feature.properties

        // Find the full factory data
        const fullFactory = factoriesExpandedData.factories.find(f => f.id === props?.id)
        if (!fullFactory) return

        // Close other detail panels when opening factory panel
        setSelectedAquifer(null)
        setSelectedFeatureId(null)
        setSelectedDam(null)

        setSelectedFactory({
          name: fullFactory.name,
          company: fullFactory.company,
          city: fullFactory.location.city,
          state: fullFactory.location.state,
          type: fullFactory.sector || fullFactory.type,
          investment: fullFactory.investment?.total,
          employees: fullFactory.jobs?.promised || fullFactory.jobs?.actual,
          yearEstablished: fullFactory.timeline?.announced ? new Date(fullFactory.timeline.announced).getFullYear() : undefined,
          facilities: fullFactory.facilities,
          waterUsage: fullFactory.environmental_risk ? {
            daily_gallons: fullFactory.environmental_risk.water_usage_gallons_per_day,
            description: `Water source: ${fullFactory.water_source || 'Unknown'}`
          } : undefined,
          environmental: fullFactory.environmental_risk ? {
            stress_type: `${fullFactory.environmental_risk.water_stress || 'Unknown'} Water Stress`,
            severity: fullFactory.environmental_risk.overall_risk_score >= 8 ? 'critical' :
              fullFactory.environmental_risk.overall_risk_score >= 6 ? 'stressed' :
                fullFactory.environmental_risk.overall_risk_score >= 4 ? 'moderate' : 'stable',
            drought_duration: fullFactory.environmental_risk.drought_risk === 'extreme' ? 5 : undefined,
            impact_description: `Climate Risk Score: ${fullFactory.environmental_risk.overall_risk_score}/10. Heat Risk: ${fullFactory.environmental_risk.heat_risk}, Drought Risk: ${fullFactory.environmental_risk.drought_risk}, Wildfire Risk: ${fullFactory.environmental_risk.wildfire_risk}.`
          } : undefined
        })
      })

      // Change cursor on hover
      map.on('mouseenter', 'factory-circles', () => {
        map.getCanvas().style.cursor = 'pointer'
      })
      map.on('mouseleave', 'factory-circles', () => {
        map.getCanvas().style.cursor = ''
      })
    }

    console.log('✅ Factory layer added successfully')

    return () => {
      if (map.getLayer('factory-circles')) map.removeLayer('factory-circles')
      if (map.getLayer('factory-icons')) map.removeLayer('factory-icons')
      if (map.getLayer('factory-labels')) map.removeLayer('factory-labels')
      if (map.getSource('factories')) map.removeSource('factories')
    }
  }, [mapLoaded, showFactoriesLayer])

  // AI Data Centers Layer - Map Visualization with ⚡ electricity symbols
  useEffect(() => {
    if (!mapRef.current || !mapLoaded || !showAIDataCentersLayer) {
      // Remove data center layers if they exist
      if (mapRef.current && mapLoaded) {
        const map = mapRef.current
        if (map.getLayer('datacenter-labels')) map.removeLayer('datacenter-labels')
        if (map.getLayer('datacenter-zap')) map.removeLayer('datacenter-zap')
        if (map.getLayer('datacenter-circle')) map.removeLayer('datacenter-circle')
        if (map.getLayer('datacenter-glow')) map.removeLayer('datacenter-glow')
        if (map.getSource('ai-datacenters')) map.removeSource('ai-datacenters')
      }
      return
    }

    const map = mapRef.current

    // Transform data center data to GeoJSON
    const geojson: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: aiDatacentersData.datacenters.map((dc: any) => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [dc.location.coordinates.lon, dc.location.coordinates.lat]
        },
        properties: {
          id: dc.id,
          name: dc.name,
          company: dc.company,
          city: dc.location.city,
          state: dc.location.state,
          power_capacity_mw: dc.power_capacity_mw,
          grid_strain: dc.environmental_impact?.grid_strain || 'moderate',
          status: dc.status
        }
      }))
    }

    // Add source
    if (!map.getSource('ai-datacenters')) {
      map.addSource('ai-datacenters', {
        type: 'geojson',
        data: geojson
      })
    }

    // Layer 1: Outer glow — color by grid strain, sized by power
    if (!map.getLayer('datacenter-glow')) {
      map.addLayer({
        id: 'datacenter-glow',
        type: 'circle',
        source: 'ai-datacenters',
        paint: {
          'circle-radius': [
            'interpolate', ['linear'], ['get', 'power_capacity_mw'],
            100, 18, 500, 26, 1000, 34, 1500, 42
          ],
          'circle-color': [
            'match', ['get', 'grid_strain'],
            'critical', '#ef4444', 'high', '#f97316', 'moderate', '#eab308', 'low', '#22c55e',
            '#eab308'
          ],
          'circle-opacity': 0.2,
          'circle-blur': 0.7
        }
      })
    }

    // Layer 2: Dark circle background
    if (!map.getLayer('datacenter-circle')) {
      map.addLayer({
        id: 'datacenter-circle',
        type: 'circle',
        source: 'ai-datacenters',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 8, 6, 11, 10, 14, 14, 18],
          'circle-color': '#1a1a2e',
          'circle-stroke-width': 2.5,
          'circle-stroke-color': [
            'match', ['get', 'grid_strain'],
            'critical', '#ef4444', 'high', '#f97316', 'moderate', '#eab308', 'low', '#22c55e',
            '#eab308'
          ],
          'circle-opacity': 0.95
        }
      })
    }

    // Layer 3: ⚡ icon on each circle
    if (!map.hasImage('zap-icon')) {
      map.addImage('zap-icon', createIconImage(32, drawZapIcon))
    }
    if (!map.getLayer('datacenter-zap')) {
      map.addLayer({
        id: 'datacenter-zap',
        type: 'symbol',
        source: 'ai-datacenters',
        layout: {
          'icon-image': 'zap-icon',
          'icon-size': 0.6,
          'icon-allow-overlap': true,
          'icon-ignore-placement': true
        }
      })
    }

    // Layer 4: Labels
    if (!map.getLayer('datacenter-labels')) {
      map.addLayer({
        id: 'datacenter-labels',
        type: 'symbol',
        source: 'ai-datacenters',
        layout: {
          'text-field': ['concat', ['get', 'company'], ' \u26A1', ['to-string', ['get', 'power_capacity_mw']], 'MW'],
          'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
          'text-size': 11,
          'text-offset': [0, 1.8],
          'text-anchor': 'top',
          'text-max-width': 14
        },
        paint: {
          'text-color': '#fbbf24',
          'text-halo-color': 'rgba(0, 0, 0, 0.85)',
          'text-halo-width': 1.5
        },
        minzoom: 5
      })
    }

    // Click handler — open detail panel
    map.on('click', 'datacenter-circle', (e) => {
      if (!e.features || e.features.length === 0) return
      const props = e.features[0].properties
      const fullDC = aiDatacentersData.datacenters.find((dc: any) => dc.id === props?.id)
      if (!fullDC) return

      // Close other panels
      setSelectedAquifer(null)
      setSelectedFactory(null)
      setSelectedDam(null)

      setSelectedDataCenter({
        id: fullDC.id,
        name: fullDC.name,
        company: fullDC.company,
        location: fullDC.location,
        purpose: fullDC.purpose,
        status: fullDC.status,
        power_capacity_mw: fullDC.power_capacity_mw,
        power_source: fullDC.power_source,
        cooling_type: fullDC.cooling_type,
        gpu_count: fullDC.gpu_count,
        gpu_type: fullDC.gpu_type,
        investment_usd: fullDC.investment_usd,
        campus_acres: fullDC.campus_acres,
        building_sqft: fullDC.building_sqft,
        jobs: fullDC.jobs,
        timeline: fullDC.timeline,
        environmental_impact: fullDC.environmental_impact,
        notes: fullDC.notes
      })
    })

    // Cursor on hover
    map.on('mouseenter', 'datacenter-circle', () => { map.getCanvas().style.cursor = 'pointer' })
    map.on('mouseleave', 'datacenter-circle', () => { map.getCanvas().style.cursor = '' })

    console.log('⚡ AI Data Centers layer added successfully with', geojson.features.length, 'data centers')

    return () => {
      if (map.getLayer('datacenter-labels')) map.removeLayer('datacenter-labels')
      if (map.getLayer('datacenter-zap')) map.removeLayer('datacenter-zap')
      if (map.getLayer('datacenter-circle')) map.removeLayer('datacenter-circle')
      if (map.getLayer('datacenter-glow')) map.removeLayer('datacenter-glow')
      if (map.getSource('ai-datacenters')) map.removeSource('ai-datacenters')
    }
  }, [mapLoaded, showAIDataCentersLayer])

  // Handle Metro Population Change layer rendering
  useEffect(() => {
    if (!mapRef.current || !mapLoaded || !showMetroDataStatistics) return

    const map = mapRef.current

    // Remove existing layers/source if present
    if (map.getLayer('metro-circles')) map.removeLayer('metro-circles')
    if (map.getLayer('metro-labels')) map.removeLayer('metro-labels')
    if (map.getSource('metro-data')) map.removeSource('metro-data')

    const data = megaregionData as { metros: Array<{ name: string; lat: number; lon: number; climate_risk: string; populations: Record<string, number> }> }

    if (!data || !data.metros || data.metros.length === 0) {
      console.log('⚠️ No metro data available')
      return
    }

    // Use 2025 population for current display
    const currentYear = '2025'

    // Create GeoJSON for metro regions
    const geoJson = {
      type: 'FeatureCollection' as const,
      features: data.metros.map((metro) => {
        const currentPop = metro.populations[currentYear] || 0
        const futurePop = metro.populations['2035'] || 0
        const growthRate = currentPop > 0 ? ((futurePop - currentPop) / currentPop) : 0

        return {
          type: 'Feature' as const,
          geometry: {
            type: 'Point' as const,
            coordinates: [metro.lon, metro.lat]
          },
          properties: {
            name: metro.name,
            population: currentPop,
            growth: growthRate,
            climate_risk: metro.climate_risk
          }
        }
      })
    }

    // Add source
    map.addSource('metro-data', {
      type: 'geojson',
      data: geoJson
    })

    // Add circles layer
    map.addLayer({
      id: 'metro-circles',
      type: 'circle',
      source: 'metro-data',
      paint: {
        'circle-radius': [
          'interpolate',
          ['linear'],
          ['get', 'population'],
          1000000, 15,
          5000000, 25,
          10000000, 35,
          20000000, 50
        ],
        'circle-color': [
          'case',
          ['>', ['get', 'growth'], 0.2], '#22c55e',  // High growth (green)
          ['>', ['get', 'growth'], 0.1], '#3b82f6',  // Moderate growth (blue)
          ['>', ['get', 'growth'], 0], '#fbbf24',    // Low growth (yellow)
          '#ef4444'  // Declining (red)
        ],
        'circle-opacity': 0.6,
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff'
      }
    })

    // Add labels layer
    map.addLayer({
      id: 'metro-labels',
      type: 'symbol',
      source: 'metro-data',
      layout: {
        'text-field': ['get', 'name'],
        'text-size': 11,
        'text-offset': [0, 0],
        'text-anchor': 'center'
      },
      paint: {
        'text-color': '#ffffff',
        'text-halo-color': '#000000',
        'text-halo-width': 1
      }
    })

    console.log('✅ Metro Population Change layer added successfully')

    return () => {
      if (map.getLayer('metro-circles')) map.removeLayer('metro-circles')
      if (map.getLayer('metro-labels')) map.removeLayer('metro-labels')
      if (map.getSource('metro-data')) map.removeSource('metro-data')
    }
  }, [mapLoaded, showMetroDataStatistics])

  // Handle Topographic Relief layer rendering
  useEffect(() => {
    if (!mapRef.current || !mapLoaded || !showTopographicRelief) return

    const map = mapRef.current

    // Remove existing layers if present
    if (map.getLayer('hillshade')) map.removeLayer('hillshade')
    if (map.getLayer('contours')) map.removeLayer('contours')
    if (map.getSource('mapbox-dem')) map.removeSource('mapbox-dem')

    // Add DEM source for hillshading
    map.addSource('mapbox-dem', {
      type: 'raster-dem',
      url: 'mapbox://mapbox.terrain-rgb',
      tileSize: 512,
      maxzoom: 14
    })

    // Add hillshade layer
    map.addLayer({
      id: 'hillshade',
      type: 'hillshade',
      source: 'mapbox-dem',
      paint: {
        'hillshade-exaggeration': 0.5,
        'hillshade-shadow-color': '#000000',
        'hillshade-illumination-direction': 315
      }
    })

    console.log('✅ Topographic Relief layer added successfully')

    return () => {
      if (map.getLayer('hillshade')) map.removeLayer('hillshade')
      if (map.getLayer('contours')) map.removeLayer('contours')
      if (map.getSource('mapbox-dem')) map.removeSource('mapbox-dem')
    }
  }, [mapLoaded, showTopographicRelief])

  // Handle Precipitation & Drought layer rendering
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return

    const map = mapRef.current
    const sourceId = 'precipitation-drought'
    const layerId = 'precipitation-drought-layer'

    // Check if layer should be visible
    if (isPrecipitationDroughtActive) {
      // Wait for data to be available
      if (!precipitationDroughtData || typeof precipitationDroughtData !== 'object' || !('tile_url' in precipitationDroughtData)) {
        console.log('⏳ Waiting for precipitation-drought data to load...')

        // Backstop: Auto-refresh data if not loaded after 5 seconds
        const retryTimer = setTimeout(() => {
          console.log('🔄 Precipitation data not loaded after 5s, triggering background refresh...')
          refreshLayer('precipitation_drought')
        }, 5000)

        return () => clearTimeout(retryTimer)
      }

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

  // Backstop: Monitor precipitation drought status and retry on prolonged loading/error
  useEffect(() => {
    if (!isPrecipitationDroughtActive) return
    if (precipitationDroughtData && typeof precipitationDroughtData === 'object' && 'tile_url' in precipitationDroughtData) return // Data already loaded

    // Set up retry timer if stuck in loading or error state
    const statusCheckTimer = setTimeout(() => {
      if (precipitationDroughtStatus === 'loading' || precipitationDroughtStatus === 'error') {
        console.log(`🔄 Precipitation drought status: ${precipitationDroughtStatus} - forcing refresh after 10s`)
        refreshLayer('precipitation_drought')
      }
    }, 10000) // 10 seconds

    return () => clearTimeout(statusCheckTimer)
  }, [isPrecipitationDroughtActive, precipitationDroughtStatus, precipitationDroughtData, refreshLayer])

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

  // Update Metro Population Change opacity
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return
    const map = mapRef.current
    if (map.getLayer('metro-circles')) {
      map.setPaintProperty('metro-circles', 'circle-opacity', metroDataOpacity)
    }
  }, [metroDataOpacity, mapLoaded])

  // Update Topographic Relief intensity
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return
    const map = mapRef.current
    if (map.getLayer('hillshade')) {
      map.setPaintProperty('hillshade', 'hillshade-exaggeration', topoReliefIntensity)
    }
  }, [topoReliefIntensity, mapLoaded])

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
        <aside className="absolute left-[92px] top-4 z-[1000] flex h-[calc(100vh-32px)] w-[352px] flex-col gap-4 pointer-events-none">
          <div className="pointer-events-auto flex-shrink-0">
            <SearchAndViewsPanel
              viewType="waterAccess"
              searchPlaceholder="Search for a city, state, or country"
              activeLayerIds={[]}
              controls={controls}
            />
          </div>

          {/* Water Access Layers Panel */}
          <div className="widget-container flex flex-col flex-1 min-h-0 pointer-events-auto overflow-hidden">
            {/* Header with Manage Layers dropdown */}
            <div className="flex items-center justify-between mb-3 flex-shrink-0">
              <h3 className="text-sm font-semibold">Layers</h3>
              <div className="relative" ref={manageLayersDropdownRef}>
                <button
                  onClick={() => setShowManageLayersDropdown(!showManageLayersDropdown)}
                  className="flex items-center gap-1 text-[#5a7cec] hover:text-[#4a6cd6] transition-colors bg-transparent border-none"
                >
                  <Layers className="h-4 w-4" />
                  <span className="text-[11px] font-semibold">Manage Layers</span>
                  <ChevronDown className="h-4 w-4" />
                </button>
                {/* Manage Layers Dropdown */}
                {showManageLayersDropdown && (
                  <div className="absolute top-full right-0 mt-1 w-56 rounded-lg bg-background border border-border shadow-lg z-50 p-3 space-y-3">
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        className="mt-0.5 h-4 w-4 flex-shrink-0 accent-blue-500"
                        checked={layersInWidget.metroWeather}
                        onChange={() => setLayersInWidget({ ...layersInWidget, metroWeather: !layersInWidget.metroWeather })}
                      />
                      <span className="text-xs font-semibold text-foreground">Metro Weather</span>
                    </label>
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        className="mt-0.5 h-4 w-4 flex-shrink-0 accent-blue-500"
                        checked={layersInWidget.factories}
                        onChange={() => setLayersInWidget({ ...layersInWidget, factories: !layersInWidget.factories })}
                      />
                      <span className="text-xs font-semibold text-foreground">Factories</span>
                    </label>
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        className="mt-0.5 h-4 w-4 flex-shrink-0 accent-blue-500"
                        checked={layersInWidget.aiDataCenters}
                        onChange={() => setLayersInWidget({ ...layersInWidget, aiDataCenters: !layersInWidget.aiDataCenters })}
                      />
                      <span className="text-xs font-semibold text-foreground">AI Data Centers</span>
                    </label>
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        className="mt-0.5 h-4 w-4 flex-shrink-0 accent-blue-500"
                        checked={layersInWidget.metroPopulation}
                        onChange={() => setLayersInWidget({ ...layersInWidget, metroPopulation: !layersInWidget.metroPopulation })}
                      />
                      <span className="text-xs font-semibold text-foreground">Metro Population Change</span>
                    </label>
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        className="mt-0.5 h-4 w-4 flex-shrink-0 accent-blue-500"
                        checked={layersInWidget.rivers}
                        onChange={() => setLayersInWidget({ ...layersInWidget, rivers: !layersInWidget.rivers })}
                      />
                      <span className="text-xs font-semibold text-foreground">River Flow Status</span>
                    </label>
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        className="mt-0.5 h-4 w-4 flex-shrink-0 accent-blue-500"
                        checked={layersInWidget.canals}
                        onChange={() => setLayersInWidget({ ...layersInWidget, canals: !layersInWidget.canals })}
                      />
                      <span className="text-xs font-semibold text-foreground">Canals & Aqueducts</span>
                    </label>
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        className="mt-0.5 h-4 w-4 flex-shrink-0 accent-blue-500"
                        checked={layersInWidget.dams}
                        onChange={() => setLayersInWidget({ ...layersInWidget, dams: !layersInWidget.dams })}
                      />
                      <span className="text-xs font-semibold text-foreground">Major Dams</span>
                    </label>
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        className="mt-0.5 h-4 w-4 flex-shrink-0 accent-blue-500"
                        checked={layersInWidget.seaLevel}
                        onChange={() => setLayersInWidget({ ...layersInWidget, seaLevel: !layersInWidget.seaLevel })}
                      />
                      <span className="text-xs font-semibold text-foreground">Sea Level Rise</span>
                    </label>
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        className="mt-0.5 h-4 w-4 flex-shrink-0 accent-blue-500"
                        checked={layersInWidget.aquifers}
                        onChange={() => setLayersInWidget({ ...layersInWidget, aquifers: !layersInWidget.aquifers })}
                      />
                      <span className="text-xs font-semibold text-foreground">Aquifers</span>
                    </label>
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        className="mt-0.5 h-4 w-4 flex-shrink-0 accent-blue-500"
                        checked={layersInWidget.groundwater}
                        onChange={() => setLayersInWidget({ ...layersInWidget, groundwater: !layersInWidget.groundwater })}
                      />
                      <span className="text-xs font-semibold text-foreground">Historic Groundwater Baseline</span>
                    </label>
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        className="mt-0.5 h-4 w-4 flex-shrink-0 accent-blue-500"
                        checked={layersInWidget.precipitation}
                        onChange={() => setLayersInWidget({ ...layersInWidget, precipitation: !layersInWidget.precipitation })}
                      />
                      <span className="text-xs font-semibold text-foreground">Precipitation & Droughts</span>
                    </label>
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        className="mt-0.5 h-4 w-4 flex-shrink-0 accent-blue-500"
                        checked={layersInWidget.wetBulb}
                        onChange={() => setLayersInWidget({ ...layersInWidget, wetBulb: !layersInWidget.wetBulb })}
                      />
                      <span className="text-xs font-semibold text-foreground">Wet Bulb Temperature</span>
                    </label>
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        className="mt-0.5 h-4 w-4 flex-shrink-0 accent-blue-500"
                        checked={layersInWidget.temperature}
                        onChange={() => setLayersInWidget({ ...layersInWidget, temperature: !layersInWidget.temperature })}
                      />
                      <span className="text-xs font-semibold text-foreground">Future Temperature Anomaly</span>
                    </label>
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        className="mt-0.5 h-4 w-4 flex-shrink-0 accent-blue-500"
                        checked={layersInWidget.topographic}
                        onChange={() => setLayersInWidget({ ...layersInWidget, topographic: !layersInWidget.topographic })}
                      />
                      <span className="text-xs font-semibold text-foreground">Topographic Relief</span>
                    </label>
                  </div>
                )}
              </div>
            </div>

            {/* Layers List with divider */}
            <div className="border-t border-b border-border/100 flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="space-y-2 overflow-y-auto flex-1 py-3 rounded-b-lg">
                {/* Metro Weather Layer */}
                {layersInWidget.metroWeather && (
                  <div className={`flex gap-3 rounded-lg p-3 transition-colors border border-solid cursor-pointer ${showMetroHumidityLayer ? "border-blue-500/60 bg-blue-500/10" : "border-white/90 bg-white/25"}`} onClick={() => setShowMetroHumidityLayer(!showMetroHumidityLayer)}>
                    <MapPin className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
                    <div className="flex-1 min-w-0 flex flex-col gap-1">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-sm font-semibold">Metro Weather</h4>
                      </div>
                      {showSourceInfo && (
                        <p className="text-[11px] text-muted-foreground/80 truncate">
                          Source: <span className="font-medium text-foreground">NOAA / NASA</span>
                        </p>
                      )}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setLayersInWidget({ ...layersInWidget, metroWeather: false })
                      }}
                      className="h-5 w-5 flex-shrink-0 flex items-center justify-center bg-transparent border-none hover:bg-transparent"
                    >
                      <X className="h-5 w-5 text-muted-foreground" />
                    </button>
                  </div>
                )}

                {/* Metro Population Change Layer */}
                {layersInWidget.metroPopulation && (
                  <div className={`flex gap-3 rounded-lg p-3 transition-colors border border-solid cursor-pointer ${showMetroDataStatistics ? "border-blue-500/60 bg-blue-500/10" : "border-white/90 bg-white/25"}`} onClick={() => setShowMetroDataStatistics(!showMetroDataStatistics)}>
                    <BarChart3 className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
                    <div className="flex-1 min-w-0 flex flex-col gap-1">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-sm font-semibold">Metro Population Change</h4>
                      </div>
                      {showSourceInfo && (
                        <p className="text-[11px] text-muted-foreground/80 truncate">
                          Source: <span className="font-medium text-foreground">NOAA Regional Climate Centers</span>
                        </p>
                      )}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setLayersInWidget({ ...layersInWidget, metroPopulation: false })
                      }}
                      className="h-5 w-5 flex-shrink-0 flex items-center justify-center bg-transparent border-none hover:bg-transparent"
                    >
                      <X className="h-5 w-5 text-muted-foreground" />
                    </button>
                  </div>
                )}

                {/* Major Dams Layer */}
                {layersInWidget.dams && (
                  <div className={`flex gap-3 rounded-lg p-3 transition-colors border border-solid cursor-pointer ${showDamsLayer ? "border-blue-500/60 bg-blue-500/10" : "border-white/90 bg-white/25"}`} onClick={() => setShowDamsLayer(!showDamsLayer)}>
                    <svg className="h-5 w-5 flex-shrink-0 text-muted-foreground" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M2 22h20v-2H2v2zm2-18v12h16V4H4zm2 10V6h12v8H6z" />
                    </svg>
                    <div className="flex-1 min-w-0 flex flex-col gap-1">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-sm font-semibold">Major Dams</h4>
                      </div>
                      {showSourceInfo && (
                        <p className="text-[11px] text-muted-foreground/80 truncate">
                          Source: <span className="font-medium text-foreground">USGS / USBR</span>
                        </p>
                      )}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setLayersInWidget({ ...layersInWidget, dams: false })
                      }}
                      className="h-5 w-5 flex-shrink-0 flex items-center justify-center bg-transparent border-none hover:bg-transparent"
                    >
                      <X className="h-5 w-5 text-muted-foreground" />
                    </button>
                  </div>
                )}

                {/* Factories Layer */}
                {layersInWidget.factories && (
                  <div className={`flex gap-3 rounded-lg p-3 transition-colors border border-solid cursor-pointer ${showFactoriesLayer ? "border-blue-500/60 bg-blue-500/10" : "border-white/90 bg-white/25"}`} onClick={() => setShowFactoriesLayer(!showFactoriesLayer)}>
                    <Factory className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
                    <div className="flex-1 min-w-0 flex flex-col gap-1">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-sm font-semibold">Factories</h4>
                      </div>
                      {showSourceInfo && (
                        <p className="text-[11px] text-muted-foreground/80 truncate">
                          Source: <span className="font-medium text-foreground">CHIPS Act, DOE</span>
                        </p>
                      )}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setLayersInWidget({ ...layersInWidget, factories: false })
                      }}
                      className="h-5 w-5 flex-shrink-0 flex items-center justify-center bg-transparent border-none hover:bg-transparent"
                    >
                      <X className="h-5 w-5 text-muted-foreground" />
                    </button>
                  </div>
                )}

                {/* AI Data Centers Layer */}
                {layersInWidget.aiDataCenters && (
                  <div className={`flex gap-3 rounded-lg p-3 transition-colors border border-solid cursor-pointer ${showAIDataCentersLayer ? "border-blue-500/60 bg-blue-500/10" : "border-white/90 bg-white/25"}`} onClick={() => setShowAIDataCentersLayer(!showAIDataCentersLayer)}>
                    <Zap className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
                    <div className="flex-1 min-w-0 flex flex-col gap-1">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-sm font-semibold">AI Data Centers</h4>
                      </div>
                      {showSourceInfo && (
                        <p className="text-[11px] text-muted-foreground/80 truncate">
                          Source: <span className="font-medium text-foreground">Public filings, DOE</span>
                        </p>
                      )}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setLayersInWidget({ ...layersInWidget, aiDataCenters: false })
                      }}
                      className="h-5 w-5 flex-shrink-0 flex items-center justify-center bg-transparent border-none hover:bg-transparent"
                    >
                      <X className="h-5 w-5 text-muted-foreground" />
                    </button>
                  </div>
                )}

                {/* Rivers Layer */}
                {layersInWidget.rivers && (
                  <div className={`flex gap-3 rounded-lg p-3 transition-colors border border-solid cursor-pointer ${showRiversLayer ? "border-blue-500/60 bg-blue-500/10" : "border-white/90 bg-white/25"}`} onClick={() => setShowRiversLayer(!showRiversLayer)}>
                    <Waves className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
                    <div className="flex-1 min-w-0 flex flex-col gap-1">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-sm font-semibold">River Flow Status</h4>
                      </div>
                      {showSourceInfo && (
                        <p className="text-[11px] text-muted-foreground/80 truncate">
                          Source: <span className="font-medium text-foreground">Natural Earth / USGS</span>
                        </p>
                      )}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setLayersInWidget({ ...layersInWidget, rivers: false })
                      }}
                      className="h-5 w-5 flex-shrink-0 flex items-center justify-center bg-transparent border-none hover:bg-transparent"
                    >
                      <X className="h-5 w-5 text-muted-foreground" />
                    </button>
                  </div>
                )}

                {/* Canals & Aqueducts Layer */}
                {layersInWidget.canals && (
                  <div className={`flex gap-3 rounded-lg p-3 transition-colors border border-solid cursor-pointer ${showCanalsLayer ? "border-blue-500/60 bg-blue-500/10" : "border-white/90 bg-white/25"}`} onClick={() => setShowCanalsLayer(!showCanalsLayer)}>
                    <svg className="h-5 w-5 flex-shrink-0 text-muted-foreground" fill="none" viewBox="0 0 24 24">
                      <path d="M2 12h20M2 8h20M2 16h20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                    <div className="flex-1 min-w-0 flex flex-col gap-1">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-sm font-semibold">Canals & Aqueducts</h4>
                      </div>
                      {showSourceInfo && (
                        <p className="text-[11px] text-muted-foreground/80 truncate">
                          Source: <span className="font-medium text-foreground">USBR / MWD</span>
                        </p>
                      )}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setLayersInWidget({ ...layersInWidget, canals: false })
                      }}
                      className="h-5 w-5 flex-shrink-0 flex items-center justify-center bg-transparent border-none hover:bg-transparent"
                    >
                      <X className="h-5 w-5 text-muted-foreground" />
                    </button>
                  </div>
                )}

                {/* Sea Level Rise Layer */}
                {layersInWidget.seaLevel && (
                  <div className={`flex gap-3 rounded-lg p-3 transition-colors border border-solid cursor-pointer ${showSeaLevelRiseLayer ? "border-blue-500/60 bg-blue-500/10" : "border-white/90 bg-white/25"}`} onClick={() => setShowSeaLevelRiseLayer(!showSeaLevelRiseLayer)}>
                    <svg className="h-5 w-5 flex-shrink-0 text-muted-foreground" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M3 10h18v2H3v-2zm0 4h18v2H3v-2zm0 4h18v2H3v-2z" />
                    </svg>
                    <div className="flex-1 min-w-0 flex flex-col gap-1">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-sm font-semibold">Sea Level Rise</h4>
                      </div>
                      {showSourceInfo && (
                        <p className="text-[11px] text-muted-foreground/80 truncate">
                          Source: <span className="font-medium text-foreground">NOAA Sea Level Rise</span>
                        </p>
                      )}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setLayersInWidget({ ...layersInWidget, seaLevel: false })
                      }}
                      className="h-5 w-5 flex-shrink-0 flex items-center justify-center bg-transparent border-none hover:bg-transparent"
                    >
                      <X className="h-5 w-5 text-muted-foreground" />
                    </button>
                  </div>
                )}


                {/* Aquifers Layer */}
                {layersInWidget.aquifers && (
                  <div className={`flex gap-3 rounded-lg p-3 transition-colors border border-solid cursor-pointer ${showAquifersLayer ? "border-blue-500/60 bg-blue-500/10" : "border-white/90 bg-white/25"}`} onClick={() => setShowAquifersLayer(!showAquifersLayer)}>
                    <Droplets className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
                    <div className="flex-1 min-w-0 flex flex-col gap-1">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-sm font-semibold">Aquifers</h4>
                      </div>
                      {showSourceInfo && (
                        <p className="text-[11px] text-muted-foreground/80 truncate">
                          Source: <span className="font-medium text-foreground">USGS</span>
                        </p>
                      )}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setLayersInWidget({ ...layersInWidget, aquifers: false })
                      }}
                      className="h-5 w-5 flex-shrink-0 flex items-center justify-center bg-transparent border-none hover:bg-transparent"
                    >
                      <X className="h-5 w-5 text-muted-foreground" />
                    </button>
                  </div>
                )}

                {/* Groundwater Layer */}
                {layersInWidget.groundwater && (
                  <div className={`flex gap-3 rounded-lg p-3 transition-colors border border-solid cursor-pointer ${showGroundwaterLayer ? "border-blue-500/60 bg-blue-500/10" : "border-white/90 bg-white/25"}`} onClick={() => setShowGroundwaterLayer(!showGroundwaterLayer)}>
                    <TrendingUp className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
                    <div className="flex-1 min-w-0 flex flex-col gap-1">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-sm font-semibold">Historic Groundwater Baseline</h4>
                      </div>
                      {showSourceInfo && (
                        <p className="text-[11px] text-muted-foreground/80 truncate">
                          Source: <span className="font-medium text-foreground">NASA GRACE</span>
                        </p>
                      )}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setLayersInWidget({ ...layersInWidget, groundwater: false })
                      }}
                      className="h-5 w-5 flex-shrink-0 flex items-center justify-center bg-transparent border-none hover:bg-transparent"
                    >
                      <X className="h-5 w-5 text-muted-foreground" />
                    </button>
                  </div>
                )}

                {/* Precipitation & Drought Layer */}
                {layersInWidget.precipitation && (
                  <div className={`flex gap-3 rounded-lg p-3 transition-colors border border-solid cursor-pointer ${isPrecipitationDroughtActive ? "border-blue-500/60 bg-blue-500/10" : "border-white/90 bg-white/25"}`} onClick={() => toggleLayer('precipitation_drought')}>
                    <CloudRain className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
                    <div className="flex-1 min-w-0 flex flex-col gap-1">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-sm font-semibold">{precipitationDroughtLayer?.title}</h4>
                      </div>
                      {showSourceInfo && (
                        <p className="text-[11px] text-muted-foreground/80 truncate">
                          Source: <span className="font-medium text-foreground">{precipitationDroughtLayer?.source.name}</span>
                        </p>
                      )}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setLayersInWidget({ ...layersInWidget, precipitation: false })
                      }}
                      className="h-5 w-5 flex-shrink-0 flex items-center justify-center bg-transparent border-none hover:bg-transparent"
                    >
                      <X className="h-5 w-5 text-muted-foreground" />
                    </button>
                  </div>
                )}

                {/* Wet Bulb Temperature Layer */}
                {layersInWidget.wetBulb && (
                  <div className={`flex gap-3 rounded-lg p-3 transition-colors border border-solid cursor-pointer ${isWetBulbActive ? "border-blue-500/60 bg-blue-500/10" : "border-white/90 bg-white/25"}`} onClick={() => toggleLayer('wet_bulb')}>
                    <Droplets className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
                    <div className="flex-1 min-w-0 flex flex-col gap-1">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-sm font-semibold">{wetBulbLayer?.title}</h4>
                      </div>
                      {showSourceInfo && (
                        <p className="text-[11px] text-muted-foreground/80 truncate">
                          Source: <span className="font-medium text-foreground">{wetBulbLayer?.source.name}</span>
                        </p>
                      )}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setLayersInWidget({ ...layersInWidget, wetBulb: false })
                      }}
                      className="h-5 w-5 flex-shrink-0 flex items-center justify-center bg-transparent border-none hover:bg-transparent"
                    >
                      <X className="h-5 w-5 text-muted-foreground" />
                    </button>
                  </div>
                )}

                {/* Future Temperature Anomaly Layer */}
                {layersInWidget.temperature && (
                  <div className={`flex gap-3 rounded-lg p-3 transition-colors border border-solid cursor-pointer ${isTemperatureProjectionActive ? "border-blue-500/60 bg-blue-500/10" : "border-white/90 bg-white/25"}`} onClick={() => toggleLayer('temperature_projection')}>
                    <CloudRain className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
                    <div className="flex-1 min-w-0 flex flex-col gap-1">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-sm font-semibold">{temperatureProjectionLayer?.title}</h4>
                      </div>
                      {showSourceInfo && (
                        <p className="text-[11px] text-muted-foreground/80 truncate">
                          Source: <span className="font-medium text-foreground">{temperatureProjectionLayer?.source.name}</span>
                        </p>
                      )}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setLayersInWidget({ ...layersInWidget, temperature: false })
                      }}
                      className="h-5 w-5 flex-shrink-0 flex items-center justify-center bg-transparent border-none hover:bg-transparent"
                    >
                      <X className="h-5 w-5 text-muted-foreground" />
                    </button>
                  </div>
                )}

                {/* Topographic Relief Layer */}
                {layersInWidget.topographic && (
                  <div className={`flex gap-3 rounded-lg p-3 transition-colors border border-solid cursor-pointer ${showTopographicRelief ? "border-blue-500/60 bg-blue-500/10" : "border-white/90 bg-white/25"}`} onClick={() => setShowTopographicRelief(!showTopographicRelief)}>
                    <Mountain className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
                    <div className="flex-1 min-w-0 flex flex-col gap-1">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-sm font-semibold">Topographic Relief</h4>
                      </div>
                      {showSourceInfo && (
                        <p className="text-[11px] text-muted-foreground/80 truncate">
                          Source: <span className="font-medium text-foreground">USGS National Elevation Dataset</span>
                        </p>
                      )}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setLayersInWidget({ ...layersInWidget, topographic: false })
                      }}
                      className="h-5 w-5 flex-shrink-0 flex items-center justify-center bg-transparent border-none hover:bg-transparent"
                    >
                      <X className="h-5 w-5 text-muted-foreground" />
                    </button>
                  </div>
                )}

              </div>
            </div>

            {/* Footer with View All/Remove All and Source toggle */}
            <div className="flex items-center justify-between pt-3 flex-shrink-0">
              <button
                className="text-[11px] font-semibold text-[#5a7cec] hover:text-[#4a6cd6] transition-colors bg-transparent border-none"
                onClick={() => {
                  const newValue = !selectAllLayers
                  setSelectAllLayers(newValue)
                  if (newValue) {
                    setLayersInWidget({
                      metroWeather: true,
                      metroPopulation: true,
                      rivers: true,
                      canals: true,
                      dams: true,
                      seaLevel: true,
                      groundwater: true,
                      aquifers: true,
                      precipitation: true,
                      wetBulb: true,
                      temperature: true,
                      factories: true,
                      topographic: true
                    })
                  } else {
                    setLayersInWidget({
                      metroWeather: false,
                      metroPopulation: false,
                      rivers: false,
                      canals: false,
                      dams: false,
                      seaLevel: false,
                      groundwater: false,
                      aquifers: false,
                      precipitation: false,
                      wetBulb: false,
                      temperature: false,
                      factories: false,
                      topographic: false
                    })
                  }
                }}
              >{selectAllLayers ? 'Remove All Layers' : 'View All Layers'}</button>
              <div className="flex items-center gap-1">
                <span className="text-[11px] text-muted-foreground">Sources</span>
                <button
                  onClick={() => setShowSourceInfo(!showSourceInfo)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${showSourceInfo ? 'bg-blue-500' : 'bg-muted'
                    }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${showSourceInfo ? 'translate-x-[18px]' : 'translate-x-[2px]'
                      }`}
                  />
                </button>
              </div>
            </div>
          </div>
        </aside>
      )}

      {/* Right Sidebar - Climate Projections Widget & Layer Controls */}
      {!panelsCollapsed && (() => {
        // Check if Climate Projections widget should be shown
        const enabledLayers = getEnabledLayersForView('waterAccess')
        const enabledLayerIds = enabledLayers.map(l => l.id)
        const showClimateWidget = shouldShowClimateWidget(enabledLayerIds)

        return (
          <div className="absolute top-0 right-0 bottom-0 z-[1000] w-[361px] pointer-events-none flex flex-col" style={{ paddingLeft: '25px', paddingRight: '16px', paddingTop: '16px', paddingBottom: '16px' }}>
            {/* Climate Projections Widget - Fixed at top */}
            <div className="flex-shrink-0 pointer-events-auto mb-4">
              <ClimateProjectionsWidget />
            </div>

            {/* Features Panel - Stretches to fill remaining height, scrolls internally */}
            <div className="widget-container flex flex-col flex-1 min-h-0 overflow-hidden pointer-events-auto" style={{ padding: 0 }}>
              <div className="flex items-center justify-between px-4 pt-4 pb-3 flex-shrink-0">
                <h3 className="text-sm font-semibold">Features</h3>
              </div>
              <div className="border-t border-b border-border/100 flex flex-col flex-1 min-h-0 overflow-hidden">
                <div className="space-y-2 overflow-y-auto flex-1 px-4 py-3">

                  {/* Metro Weather Controls */}
                  {layersInWidget.metroWeather && showMetroHumidityLayer && (
                    <div className="rounded-lg p-3 border border-solid border-white/90 bg-white/25" style={{ boxShadow: '0 0 8px 0 rgba(0,0,0,0.03)' }}>
                      <div
                        className="flex items-center justify-between cursor-pointer mb-2.5"
                        onClick={() => {
                          const newCollapsed = new Set(collapsedFeatures)
                          if (newCollapsed.has('metroWeather')) {
                            newCollapsed.delete('metroWeather')
                          } else {
                            newCollapsed.add('metroWeather')
                          }
                          setCollapsedFeatures(newCollapsed)
                        }}
                      >
                        <h4 className="text-[13px] font-semibold">Metro Weather</h4>
                        <ChevronDown
                          className={`h-4 w-4 transition-transform ${collapsedFeatures.has('metroWeather') ? '-rotate-90' : ''}`}
                        />
                      </div>
                      {!collapsedFeatures.has('metroWeather') && (
                        <>
                          {/* Bubble Data Toggles */}
                          <div className="space-y-3">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                className="h-4 w-4 accent-blue-500"
                                checked={showHumidityWetBulb}
                                onChange={() => setShowHumidityWetBulb(!showHumidityWetBulb)}
                              />
                              <span className="text-[13px] text-foreground">Humidity & Wet Bulb Events</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                className="h-4 w-4 accent-blue-500"
                                checked={showTempHumidity}
                                onChange={() => setShowTempHumidity(!showTempHumidity)}
                              />
                              <span className="text-[13px] text-foreground">Temperature & Humidity</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                className="h-4 w-4 accent-blue-500"
                                checked={showAverageTemperatures}
                                onChange={() => setShowAverageTemperatures(!showAverageTemperatures)}
                              />
                              <span className="text-[13px] text-foreground">Average Temperature</span>
                            </label>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* Metro Population Change */}
                  {layersInWidget.metroPopulation && showMetroDataStatistics && (
                    <div className="rounded-lg p-3 border border-solid border-white/90 bg-white/25" style={{ boxShadow: '0 0 8px 0 rgba(0,0,0,0.03)' }}>
                      <div
                        className="flex items-center justify-between cursor-pointer mb-2.5"
                        onClick={() => {
                          const newCollapsed = new Set(collapsedFeatures)
                          if (newCollapsed.has('metroPopulation')) {
                            newCollapsed.delete('metroPopulation')
                          } else {
                            newCollapsed.add('metroPopulation')
                          }
                          setCollapsedFeatures(newCollapsed)
                        }}
                      >
                        <h4 className="text-[13px] font-semibold">Metro Population Change</h4>
                        <ChevronDown
                          className={`h-4 w-4 transition-transform ${collapsedFeatures.has('metroPopulation') ? '-rotate-90' : ''}`}
                        />
                      </div>
                      {!collapsedFeatures.has('metroPopulation') && (
                        <>
                          {/* Opacity Slider */}
                          <div className="space-y-2 mb-4">
                            <div className="flex items-center justify-between">
                              <label className="text-xs text-muted-foreground">Layer Opacity</label>
                              <span className="text-xs font-medium">{Math.round(metroDataOpacity * 100)}%</span>
                            </div>
                            <Slider
                              value={[Math.round(metroDataOpacity * 100)]}
                              min={10}
                              max={100}
                              step={5}
                              onValueChange={(value) => {
                                setMetroDataOpacity(value[0] / 100)
                              }}
                            />
                          </div>

                          {/* Legend */}
                          <div className="space-y-1.5">
                            <h4 className="text-xs font-semibold text-muted-foreground mb-2">Population Growth</h4>
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#22c55e' }}></div>
                              <span className="text-xs text-foreground">High Growth (20%+)</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#3b82f6' }}></div>
                              <span className="text-xs text-foreground">Moderate Growth (10-20%)</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#fbbf24' }}></div>
                              <span className="text-xs text-foreground">Low Growth (0-10%)</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#ef4444' }}></div>
                              <span className="text-xs text-foreground">Declining</span>
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-2">Circle size represents population</p>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* Factory Filters */}
                  {layersInWidget.factories && showFactoriesLayer && (
                    <div className="rounded-lg p-3 border border-solid border-white/90 bg-white/25" style={{ boxShadow: '0 0 8px 0 rgba(0,0,0,0.03)' }}>
                      <div
                        className="flex items-center justify-between cursor-pointer mb-2.5"
                        onClick={() => {
                          const newCollapsed = new Set(collapsedFeatures)
                          if (newCollapsed.has('factories')) {
                            newCollapsed.delete('factories')
                          } else {
                            newCollapsed.add('factories')
                          }
                          setCollapsedFeatures(newCollapsed)
                        }}
                      >
                        <h4 className="text-[13px] font-semibold">Factory Filters</h4>
                        <ChevronDown
                          className={`h-4 w-4 transition-transform ${collapsedFeatures.has('factories') ? '-rotate-90' : ''}`}
                        />
                      </div>
                      {!collapsedFeatures.has('factories') && (
                        <>
                          {/* Status Filters */}
                          <div className="mb-4">
                            <h4 className="text-xs font-semibold mb-2 text-muted-foreground">Status</h4>
                            <div className="space-y-2">
                              <label className="flex items-center gap-2">
                                <input type="checkbox" className="accent-blue-500" defaultChecked />
                                <span className="text-sm">Operational</span>
                              </label>
                              <label className="flex items-center gap-2">
                                <input type="checkbox" className="accent-blue-500" defaultChecked />
                                <span className="text-sm">Under Construction</span>
                              </label>
                              <label className="flex items-center gap-2">
                                <input type="checkbox" className="accent-blue-500" defaultChecked />
                                <span className="text-sm">Planned</span>
                              </label>
                            </div>
                          </div>

                          {/* Climate Risk Filters */}
                          <div>
                            <h4 className="text-xs font-semibold mb-2 text-muted-foreground">Climate Risk</h4>
                            <div className="space-y-2">
                              <label className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                                <input type="checkbox" className="accent-blue-500" defaultChecked />
                                <span className="text-sm">Low (0-3)</span>
                              </label>
                              <label className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                                <input type="checkbox" className="accent-blue-500" defaultChecked />
                                <span className="text-sm">Medium (4-6)</span>
                              </label>
                              <label className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                                <input type="checkbox" className="accent-blue-500" defaultChecked />
                                <span className="text-sm">High (7-10)</span>
                              </label>
                            </div>
                          </div>
                        </>
                      )}
                    </div>

                  )}

                  {/* Rivers Flow Status */}
                  {layersInWidget.rivers && showRiversLayer && (
                    <div className="rounded-lg p-3 border border-solid border-white/90 bg-white/25" style={{ boxShadow: '0 0 8px 0 rgba(0,0,0,0.03)' }}>
                      <div
                        className="flex items-center justify-between cursor-pointer mb-2.5"
                        onClick={() => {
                          const newCollapsed = new Set(collapsedFeatures)
                          if (newCollapsed.has('rivers')) {
                            newCollapsed.delete('rivers')
                          } else {
                            newCollapsed.add('rivers')
                          }
                          setCollapsedFeatures(newCollapsed)
                        }}
                      >
                        <h4 className="text-[13px] font-semibold">River Flow Status</h4>
                        <ChevronDown
                          className={`h-4 w-4 transition-transform ${collapsedFeatures.has('rivers') ? '-rotate-90' : ''}`}
                        />
                      </div>
                      {!collapsedFeatures.has('rivers') && (
                        <>
                          {/* Opacity Slider */}
                          <div className="space-y-2 mb-4">
                            <div className="flex items-center justify-between">
                              <label className="text-xs text-muted-foreground">River Opacity</label>
                              <span className="text-xs font-medium">{Math.round(riverOpacity * 100)}%</span>
                            </div>
                            <Slider
                              value={[Math.round(riverOpacity * 100)]}
                              min={10}
                              max={100}
                              step={5}
                              onValueChange={(value) => setRiverOpacity(value[0] / 100)}
                            />
                          </div>

                          {/* Legend */}
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
                        </>
                      )}
                    </div>
                  )}

                  {/* Canals & Aqueducts */}
                  {layersInWidget.canals && showCanalsLayer && (
                    <div className="rounded-lg p-3 border border-solid border-white/90 bg-white/25" style={{ boxShadow: '0 0 8px 0 rgba(0,0,0,0.03)' }}>
                      <div
                        className="flex items-center justify-between cursor-pointer mb-2.5"
                        onClick={() => {
                          const newCollapsed = new Set(collapsedFeatures)
                          if (newCollapsed.has('canals')) {
                            newCollapsed.delete('canals')
                          } else {
                            newCollapsed.add('canals')
                          }
                          setCollapsedFeatures(newCollapsed)
                        }}
                      >
                        <h4 className="text-[13px] font-semibold">Canals & Aqueducts</h4>
                        <ChevronDown
                          className={`h-4 w-4 transition-transform ${collapsedFeatures.has('canals') ? '-rotate-90' : ''}`}
                        />
                      </div>
                      {!collapsedFeatures.has('canals') && (
                        <>
                          {/* Description */}
                          <div className="mb-3">
                            <p className="text-xs text-muted-foreground">
                              Major water transport infrastructure including canals, aqueducts, and water conveyance systems
                            </p>
                          </div>
                          {/* Legend */}
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-2">
                              <div className="w-5 h-1 rounded" style={{ backgroundColor: '#dc2626' }}></div>
                              <span className="text-[11px] text-foreground/70">Non-operational / Dry</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-5 h-1 rounded" style={{ backgroundColor: '#f59e0b' }}></div>
                              <span className="text-[11px] text-foreground/70">Limited capacity</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-5 h-1 rounded" style={{ backgroundColor: '#fbbf24' }}></div>
                              <span className="text-[11px] text-foreground/70">Reduced flow</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-5 h-1 rounded" style={{ backgroundColor: '#3b82f6' }}></div>
                              <span className="text-[11px] text-foreground/70">Full capacity / Operational</span>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* Aquifers */}
                  {layersInWidget.aquifers && showAquifersLayer && (
                    <div className="rounded-lg p-3 border border-solid border-white/90 bg-white/25" style={{ boxShadow: '0 0 8px 0 rgba(0,0,0,0.03)' }}>
                      <div
                        className="flex items-center justify-between cursor-pointer mb-2.5"
                        onClick={() => {
                          const newCollapsed = new Set(collapsedFeatures)
                          if (newCollapsed.has('aquifers')) {
                            newCollapsed.delete('aquifers')
                          } else {
                            newCollapsed.add('aquifers')
                          }
                          setCollapsedFeatures(newCollapsed)
                        }}
                      >
                        <h4 className="text-[13px] font-semibold">Aquifers</h4>
                        <ChevronDown
                          className={`h-4 w-4 transition-transform ${collapsedFeatures.has('aquifers') ? '-rotate-90' : ''}`}
                        />
                      </div>
                      {!collapsedFeatures.has('aquifers') && (
                        <>
                          {/* Opacity Slider */}
                          <div className="space-y-2 mb-4">
                            <div className="flex items-center justify-between">
                              <label className="text-xs text-muted-foreground">Layer Opacity</label>
                              <span className="text-xs font-medium">{Math.round(aquiferOpacity * 100)}%</span>
                            </div>
                            <Slider
                              value={[Math.round(aquiferOpacity * 100)]}
                              min={10}
                              max={100}
                              step={5}
                              onValueChange={(value) => {
                                setAquiferOpacity(value[0] / 100)
                              }}
                            />
                          </div>

                          {/* Aquifer Health Legend */}
                          <div className="space-y-1.5">
                            <h4 className="text-xs font-semibold text-muted-foreground mb-2">Aquifer Health Status</h4>
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
                        </>
                      )}
                    </div>
                  )}

                  {/* Groundwater */}
                  {layersInWidget.groundwater && showGroundwaterLayer && (
                    <div className="rounded-lg p-3 border border-solid border-white/90 bg-white/25" style={{ boxShadow: '0 0 8px 0 rgba(0,0,0,0.03)' }}>
                      <div
                        className="flex items-center justify-between cursor-pointer mb-2.5"
                        onClick={() => {
                          const newCollapsed = new Set(collapsedFeatures)
                          if (newCollapsed.has('groundwater')) {
                            newCollapsed.delete('groundwater')
                          } else {
                            newCollapsed.add('groundwater')
                          }
                          setCollapsedFeatures(newCollapsed)
                        }}
                      >
                        <h4 className="text-[13px] font-semibold">Groundwater</h4>
                        <ChevronDown
                          className={`h-4 w-4 transition-transform ${collapsedFeatures.has('groundwater') ? '-rotate-90' : ''}`}
                        />
                      </div>
                      {!collapsedFeatures.has('groundwater') && (
                        <>
                          {/* Transparency Control */}
                          <div className="space-y-2 mb-4">
                            <div className="text-[11px] font-medium text-foreground/70 mb-1">Transparency</div>
                            <Slider
                              min={0}
                              max={1}
                              step={0.05}
                              value={[graceOpacity]}
                              onValueChange={(value) => setGraceOpacity(value[0])}
                              className="mb-2"
                            />
                          </div>

                          {/* GRACE Legend */}
                          <div className="space-y-1.5">
                            <h4 className="text-xs font-semibold text-foreground mb-2">Change vs. 2004-2009 Baseline</h4>
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
                        </>
                      )}
                    </div>
                  )}

                  {/* Historic Groundwater Baseline */}
                  {layersInWidget.groundwater && showGRACELayer && (
                    <div className="rounded-lg p-3 border border-solid border-white/90 bg-white/25" style={{ boxShadow: '0 0 8px 0 rgba(0,0,0,0.03)' }}>
                      <div
                        className="flex items-center justify-between cursor-pointer mb-2.5"
                        onClick={() => {
                          const newCollapsed = new Set(collapsedFeatures)
                          if (newCollapsed.has('graceGroundwater')) {
                            newCollapsed.delete('graceGroundwater')
                          } else {
                            newCollapsed.add('graceGroundwater')
                          }
                          setCollapsedFeatures(newCollapsed)
                        }}
                      >
                        <h4 className="text-[13px] font-semibold">Historic Groundwater Baseline</h4>
                        <ChevronDown
                          className={`h-4 w-4 transition-transform ${collapsedFeatures.has('graceGroundwater') ? '-rotate-90' : ''}`}
                        />
                      </div>
                      {!collapsedFeatures.has('graceGroundwater') && (
                        <>
                          {/* Description */}
                          <div className="mb-4 p-3 rounded-lg bg-blue-50/50 dark:bg-blue-900/10">
                            <p className="text-xs text-muted-foreground">
                              NASA GRACE satellite measurements showing groundwater storage changes (2002-2024)
                            </p>
                          </div>

                          {/* Depletion Status Legend */}
                          <div className="space-y-1.5">
                            <h4 className="text-xs font-semibold text-muted-foreground mb-2">Groundwater Trend</h4>
                            <div className="h-3 w-full rounded" style={{
                              background: 'linear-gradient(to right, #b2182b 0%, #ef8a62 20%, #fddbc7 40%, #f7f7f7 50%, #d1e5f0 60%, #67a9cf 80%, #2166ac 100%)'
                            }} />
                            <div className="flex justify-between text-[9px] text-muted-foreground">
                              <span>-20cm</span>
                              <span>Depletion</span>
                              <span>0</span>
                              <span>Recharge</span>
                              <span>+20cm</span>
                            </div>
                          </div>

                          <div className="mt-3 text-[10px] text-muted-foreground italic">
                            Change vs. 2004-2009 baseline
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* Future Temperature Anomaly */}
                  {layersInWidget.temperature && isTemperatureProjectionActive && (
                    <div className="rounded-lg p-3 border border-solid border-white/90 bg-white/25" style={{ boxShadow: '0 0 8px 0 rgba(0,0,0,0.03)' }}>
                      <div
                        className="flex items-center justify-between cursor-pointer mb-2.5"
                        onClick={() => {
                          const newCollapsed = new Set(collapsedFeatures)
                          if (newCollapsed.has('temperature')) {
                            newCollapsed.delete('temperature')
                          } else {
                            newCollapsed.add('temperature')
                          }
                          setCollapsedFeatures(newCollapsed)
                        }}
                      >
                        <h4 className="text-[13px] font-semibold">Future Temperature Anomaly</h4>
                        <ChevronDown
                          className={`h-4 w-4 transition-transform ${collapsedFeatures.has('temperature') ? '-rotate-90' : ''}`}
                        />
                      </div>
                      {!collapsedFeatures.has('temperature') && (
                        <div className="pt-2">
                          {/* Status Indicator */}
                          {temperatureProjectionStatus === 'loading' && (
                            <div className="space-y-2 rounded-md border border-orange-500/30 bg-orange-500/10 p-3 mb-3">
                              <div className="flex items-center gap-2">
                                <Loader2 className="h-4 w-4 animate-spin text-orange-500" />
                                <p className="text-xs text-foreground">Loading temperature data...</p>
                              </div>
                            </div>
                          )}

                          {temperatureProjectionStatus === 'success' && (
                            <div className="space-y-2 rounded-md border border-green-500/30 bg-green-500/10 p-2 mb-3">
                              <div className="flex items-center gap-2">
                                <div className="h-2 w-2 rounded-full bg-green-500" />
                                <p className="text-xs text-green-600 font-medium">✓ Real NASA climate data (Earth Engine)</p>
                              </div>
                            </div>
                          )}

                          {/* Temperature Mode Toggle */}
                          <div className="space-y-2 mb-4">
                            <h4 className="text-xs font-semibold text-foreground mb-2">Temperature Display</h4>
                            <div className="space-y-2">
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="radio"
                                  name="temperatureMode"
                                  value="anomaly"
                                  checked={controls.temperatureMode === 'anomaly'}
                                  onChange={() => setTemperatureMode('anomaly')}
                                  className="h-4 w-4"
                                />
                                <span className="text-sm text-foreground">Temperature Anomaly (Change)</span>
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="radio"
                                  name="temperatureMode"
                                  value="actual"
                                  checked={controls.temperatureMode === 'actual'}
                                  onChange={() => setTemperatureMode('actual')}
                                  className="h-4 w-4"
                                />
                                <span className="text-sm text-foreground">Actual Temperature</span>
                              </label>
                            </div>
                          </div>

                          {/* Opacity Control */}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <label className="text-xs font-semibold text-foreground">Layer Opacity</label>
                              <span className="text-xs text-muted-foreground">{Math.round((controls.projectionOpacity ?? 0.6) * 100)}%</span>
                            </div>
                            <Slider
                              min={0}
                              max={1}
                              step={0.05}
                              value={[controls.projectionOpacity ?? 0.6]}
                              onValueChange={(value) => setProjectionOpacity(value[0])}
                            />
                          </div>

                          {/* Temperature Legend */}
                          <div className="mt-4 space-y-2">
                            <h4 className="text-xs font-semibold text-foreground">
                              {controls.temperatureMode === 'anomaly' ? 'Temperature Anomaly' : 'Temperature'}
                            </h4>
                            <div className="h-3 w-full rounded" style={{
                              background: 'linear-gradient(to right, #0571b0 0%, #92c5de 25%, #ffffbf 50%, #f4a582 75%, #ca0020 100%)'
                            }} />
                            <div className="flex justify-between text-[9px] text-muted-foreground">
                              <span>0°</span>
                              <span>1°</span>
                              <span>2°</span>
                              <span>3°</span>
                              <span>4°</span>
                              <span>5°</span>
                              <span>6°</span>
                              <span>8°+</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Precipitation & Drought */}
                  {layersInWidget.precipitation && isPrecipitationDroughtActive && (
                    <div className="rounded-lg p-3 border border-solid border-white/90 bg-white/25" style={{ boxShadow: '0 0 8px 0 rgba(0,0,0,0.03)' }}>
                      <div
                        className="flex items-center justify-between cursor-pointer mb-2.5"
                        onClick={() => {
                          const newCollapsed = new Set(collapsedFeatures)
                          if (newCollapsed.has('precipitation')) {
                            newCollapsed.delete('precipitation')
                          } else {
                            newCollapsed.add('precipitation')
                          }
                          setCollapsedFeatures(newCollapsed)
                        }}
                      >
                        <h4 className="text-[13px] font-semibold">Precipitation & Drought</h4>
                        <ChevronDown
                          className={`h-4 w-4 transition-transform ${collapsedFeatures.has('precipitation') ? '-rotate-90' : ''}`}
                        />
                      </div>
                      {!collapsedFeatures.has('precipitation') && (
                        <div className="pt-2">
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
                                <div className="h-2 w-2 rounded-full bg-green-500" />
                                <p className="text-xs text-green-600 font-medium">✓ Real NASA climate data (Earth Engine)</p>
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
                          <div className="space-y-1">
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
                    </div>
                  )}

                  {/* Wet Bulb Temperature */}
                  {layersInWidget.wetBulb && isWetBulbActive && (
                    <div className="rounded-lg p-3 border border-solid border-white/90 bg-white/25" style={{ boxShadow: '0 0 8px 0 rgba(0,0,0,0.03)' }}>
                      <div
                        className="flex items-center justify-between cursor-pointer mb-2.5"
                        onClick={() => {
                          const newCollapsed = new Set(collapsedFeatures)
                          if (newCollapsed.has('wetBulb')) {
                            newCollapsed.delete('wetBulb')
                          } else {
                            newCollapsed.add('wetBulb')
                          }
                          setCollapsedFeatures(newCollapsed)
                        }}
                      >
                        <h4 className="text-[13px] font-semibold">Wet Bulb Temperature</h4>
                        <ChevronDown
                          className={`h-4 w-4 transition-transform ${collapsedFeatures.has('wetBulb') ? '-rotate-90' : ''}`}
                        />
                      </div>
                      {!collapsedFeatures.has('wetBulb') && (
                        <>
                          {/* Opacity Slider */}
                          <div className="space-y-2 mb-4">
                            <div className="flex items-center justify-between">
                              <label className="text-xs text-muted-foreground">Layer Opacity</label>
                              <span className="text-xs font-medium">{Math.round((controls.wetBulbOpacity || 0.6) * 100)}%</span>
                            </div>
                            <Slider
                              value={[Math.round((controls.wetBulbOpacity || 0.6) * 100)]}
                              min={10}
                              max={100}
                              step={5}
                              onValueChange={(value) => setWetBulbOpacity(value[0] / 100)}
                            />
                          </div>

                          {/* Year indicator */}
                          <div className="text-xs text-muted-foreground mb-3">
                            Showing projections for <span className="font-semibold text-foreground">{projectionYear}</span>
                          </div>

                          {/* Legend */}
                          <div className="space-y-3 pt-3 border-t border-border/40">
                            <div>
                              <h4 className="text-xs font-semibold text-muted-foreground mb-2">Danger Level</h4>
                              <p className="text-[10px] text-muted-foreground mb-2">Size, color & opacity increase with danger</p>
                              <div className="space-y-1.5">
                                <div className="flex items-center gap-2">
                                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#93c5fd', opacity: 0.3 }}></div>
                                  <span className="text-[11px] text-foreground">Minimal risk</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="w-4 h-4 rounded-full" style={{ backgroundColor: '#fde047', opacity: 0.5 }}></div>
                                  <span className="text-[11px] text-foreground">Low risk</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="w-5 h-5 rounded-full" style={{ backgroundColor: '#fbbf24', opacity: 0.6 }}></div>
                                  <span className="text-[11px] text-foreground">Moderate risk</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 rounded-full" style={{ backgroundColor: '#fb923c', opacity: 0.7 }}></div>
                                  <span className="text-[11px] text-foreground">Elevated risk</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="w-7 h-7 rounded-full" style={{ backgroundColor: '#ef4444', opacity: 0.8 }}></div>
                                  <span className="text-[11px] text-foreground">High risk</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 rounded-full" style={{ backgroundColor: '#991b1b', opacity: 0.9 }}></div>
                                  <span className="text-[11px] text-foreground">Extreme danger</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* Metro Humidity Widget */}
                  {layersInWidget.metroWeather && showMetroHumidityLayer && selectedMetroCity && (() => {
                    const cityFeature = (metroHumidityData as any).features.find((f: any) => f.properties.city === selectedMetroCity)
                    if (!cityFeature) return null

                    const humidityData = cityFeature.properties.humidity_projections[projectionYear.toString()] ||
                      cityFeature.properties.humidity_projections['2025']
                    if (!humidityData) return null

                    return (
                      <div className="rounded-lg p-3 border border-solid border-white/90 bg-white/25" style={{ boxShadow: '0 0 8px 0 rgba(0,0,0,0.03)' }}>
                        {/* Header */}
                        <div
                          className="flex items-center justify-between cursor-pointer mb-2.5"
                          onClick={() => {
                            const newCollapsed = new Set(collapsedFeatures)
                            if (newCollapsed.has('metroHumidity')) {
                              newCollapsed.delete('metroHumidity')
                            } else {
                              newCollapsed.add('metroHumidity')
                            }
                            setCollapsedFeatures(newCollapsed)
                          }}
                        >
                          <h4 className="text-[13px] font-semibold">Metro Humidity Widget</h4>
                          <ChevronDown
                            className={`h-4 w-4 transition-transform ${collapsedFeatures.has('metroHumidity') ? '-rotate-90' : ''}`}
                          />
                        </div>
                        {!collapsedFeatures.has('metroHumidity') && (
                          <>
                            {/* City and Year Info */}
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

                            {/* Temperature & Humidity Section - REMOVED - fields don't exist in wet bulb data */}
                          </>
                        )}
                      </div>
                    )
                  })()}

                  {/* Topographic Relief */}
                  {layersInWidget.topographic && showTopographicRelief && (
                    <div className="rounded-lg p-3 border border-solid border-white/90 bg-white/25" style={{ boxShadow: '0 0 8px 0 rgba(0,0,0,0.03)' }}>
                      <div
                        className="flex items-center justify-between cursor-pointer mb-2.5"
                        onClick={() => {
                          const newCollapsed = new Set(collapsedFeatures)
                          if (newCollapsed.has('topographic')) {
                            newCollapsed.delete('topographic')
                          } else {
                            newCollapsed.add('topographic')
                          }
                          setCollapsedFeatures(newCollapsed)
                        }}
                      >
                        <h4 className="text-[13px] font-semibold">Topographic Relief</h4>
                        <ChevronDown
                          className={`h-4 w-4 transition-transform ${collapsedFeatures.has('topographic') ? '-rotate-90' : ''}`}
                        />
                      </div>
                      {!collapsedFeatures.has('topographic') && (
                        <>
                          {/* Opacity Slider */}
                          <div className="space-y-2 mb-4">
                            <div className="flex items-center justify-between">
                              <label className="text-xs text-muted-foreground">Hillshade Intensity</label>
                              <span className="text-xs font-medium">{Math.round(topoReliefIntensity * 100)}%</span>
                            </div>
                            <Slider
                              value={[Math.round(topoReliefIntensity * 100)]}
                              min={10}
                              max={100}
                              step={5}
                              onValueChange={(value) => {
                                setTopoReliefIntensity(value[0] / 100)
                              }}
                            />
                          </div>

                          {/* Legend */}
                          <div className="space-y-1.5">
                            <h4 className="text-xs font-semibold text-muted-foreground mb-2">Elevation Relief</h4>
                            <p className="text-xs text-foreground/80">Hillshade visualization showing terrain elevation and slopes</p>
                            <div className="space-y-1 mt-2">
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="text-muted-foreground">Light areas:</span>
                                <span className="text-foreground">High elevation / slopes facing sun</span>
                              </div>
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="text-muted-foreground">Dark areas:</span>
                                <span className="text-foreground">Low elevation / shaded slopes</span>
                              </div>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                </div>{/* end scrollable list */}

                {/* Footer with Collapse/Expand All */}
                <div className="flex items-center justify-between px-4 py-3 flex-shrink-0 border-t border-border/20">
                  <button
                    className="text-[11px] font-semibold text-[#5a7cec] hover:text-[#4a6cd6] transition-colors bg-transparent border-none cursor-pointer"
                    onClick={() => {
                      if (collapsedFeatures.size === 0) {
                        // Collapse all
                        setCollapsedFeatures(new Set([
                          'metroWeather',
                          'metroPopulation',
                          'factories',
                          'rivers',
                          'canals',
                          'aquifers',
                          'groundwater',
                          'graceGroundwater',
                          'temperature',
                          'precipitation',
                          'wetBulb',
                          'metroHumidity',
                          'topographic'
                        ]))
                      } else {
                        // Expand all
                        setCollapsedFeatures(new Set())
                      }
                    }}
                  >
                    {collapsedFeatures.size === 0 ? 'Collapse All Features' : 'Expand All Features'}
                  </button>
                </div>

              </div>{/* end border area */}
            </div>{/* end Features widget-container */}
          </div>
        )
      })()}



      {/* Groundwater Details Panel - Bottom Center */}
      {
        selectedAquifer && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000] pointer-events-auto" style={{ width: '640px' }}>
            <GroundwaterDetailsPanel
              selectedAquifer={selectedAquifer}
              projectionYear={projectionYear}
              onClose={closeDetailsPanel}
            />
          </div>
        )
      }

      {/* Factory Details Panel - Bottom Center */}
      {
        selectedFactory && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000] pointer-events-auto" style={{ width: '640px' }}>
            <FactoryDetailsPanel
              selectedFactory={selectedFactory}
              onClose={() => setSelectedFactory(null)}
            />
          </div>
        )
      }

      {/* AI Data Center Details Panel - Bottom Center */}
      {
        selectedDataCenter && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000] pointer-events-auto" style={{ width: '640px' }}>
            <AIDataCenterDetailPanel
              datacenter={selectedDataCenter}
              onClose={() => setSelectedDataCenter(null)}
            />
          </div>
        )
      }

      {/* Dam Details Panel - Bottom Center */}
      {
        selectedDam && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000] pointer-events-auto" style={{ width: '640px' }}>
            <DamDetailsPanel
              selectedDam={selectedDam}
              onClose={() => setSelectedDam(null)}
            />
          </div>
        )
      }

      {/* Metro Humidity Tooltip (like Metro Population Change) */}
      {
        metroHoverInfo && metroHoverInfo.cityName && metroHoverInfo.humidityData && (
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

            {/* Temperature & Humidity section removed - fields don't exist in data */}
          </div>
        )
      }

      {/* Metro Population Change Tooltip (TEST - from Climate screen) */}
      {
        megaregionHoverInfo && megaregionHoverInfo.metroName && megaregionHoverInfo.metroPopulation && (
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
        )
      }

      {/* Metro Weather React Overlay - Render MetroHumidityBubble components using map projection */}
      {
        showMetroHumidityLayer && mapRef.current && mapLoaded && (
          <div
            onClick={(e) => {
              // Deactivate bubble when clicking on the container (but not on a bubble itself)
              if (e.target === e.currentTarget) {
                setActiveBubbleIndex(null)
              }
            }}
          >
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
                  days_over_95F: Math.round((lower.days_over_95F || 0) + ((upper.days_over_95F || 0) - (lower.days_over_95F || 0)) * ratio),
                  days_over_100F: Math.round((lower.days_over_100F || 0) + ((upper.days_over_100F || 0) - (lower.days_over_100F || 0)) * ratio),
                  estimated_at_risk_population: Math.round((lower.estimated_at_risk_population || 0) + ((upper.estimated_at_risk_population || 0) - (lower.estimated_at_risk_population || 0)) * ratio),
                  casualty_rate_percent: Math.round(((lower.casualty_rate_percent || 0) + ((upper.casualty_rate_percent || 0) - (lower.casualty_rate_percent || 0)) * ratio) * 10) / 10,
                  extent_radius_km: Math.round((lower.extent_radius_km || 0) + ((upper.extent_radius_km || 0) - (lower.extent_radius_km || 0)) * ratio)
                }
              }

              const humidityData = getHumidityDataForYear(humidity_projections, projectionYear)

              // Get temperature data for this city
              const getTempDataForCity = (cityName: string, year: number) => {
                const normalizedCity = cityName.toLowerCase().trim()

                const tempCity = Object.values(metroTemperatureData).find((city: any) => {
                  const tempCityName = city.name.toLowerCase().trim()
                  if (tempCityName === normalizedCity) return true

                  const cityBase = normalizedCity.split(',')[0].trim()
                  const tempCityBase = tempCityName.split(',')[0].trim()
                  if (cityBase === tempCityBase) return true
                  if (tempCityName.includes(cityBase) || cityBase.includes(tempCityBase)) return true

                  return false
                }) as any

                if (!tempCity?.projections) return null

                let mappedScenario = controls.scenario
                if (controls.scenario === 'rcp26') mappedScenario = 'ssp126'
                else if (controls.scenario === 'rcp45') mappedScenario = 'ssp245'
                else if (controls.scenario === 'rcp60') mappedScenario = 'ssp370'
                else if (controls.scenario === 'rcp85') mappedScenario = 'ssp585'

                const scenarioData = tempCity.projections[mappedScenario] || tempCity.projections['ssp245']
                if (!scenarioData) return null

                const decades = Object.keys(scenarioData).map(Number).sort((a, b) => a - b)
                if (decades.length === 0) return null

                const closestDecade = decades.reduce((prev, curr) =>
                  Math.abs(curr - year) < Math.abs(prev - year) ? curr : prev
                )

                return scenarioData[closestDecade]
              }

              const tempData = getTempDataForCity(city, projectionYear)

              // Convert lat/lng to screen coordinates
              const point = mapRef.current!.project([lng, lat])

              const isActive = activeBubbleIndex === index

              return (
                <div
                  key={`metro-humidity-${index}`}
                  style={{
                    position: 'absolute',
                    left: `${point.x}px`,
                    top: `${point.y}px`,
                    transform: 'translate(-50%, -50%)',
                    pointerEvents: 'auto',
                    zIndex: isActive ? 1000 : 100 // Higher z-index when active
                  }}
                >
                  <MetroHumidityBubble
                    metroName={city}
                    year={projectionYear}
                    peakHumidity={`${humidityData.peak_humidity}%`}
                    wetBulbEvents={`${humidityData.wet_bulb_events}`}
                    humidTemp={`${humidityData.days_over_95F || 0}°`}
                    daysOver100={humidityData.days_over_100F ? `${humidityData.days_over_100F}` : 'N/A'}
                    visible={true}
                    showHumidityWetBulb={showHumidityWetBulb}
                    showTempHumidity={showTempHumidity}
                    showAverageTemperatures={showAverageTemperatures}
                    summerAvg={tempData?.summer_avg ? `${tempData.summer_avg.toFixed(1)}°F` : undefined}
                    winterAvg={tempData?.winter_avg ? `${tempData.winter_avg.toFixed(1)}°F` : undefined}
                    onClose={() => { }}
                    isActive={isActive}
                    onClick={() => {
                      // Toggle: if clicking the same bubble, deactivate it; otherwise activate the clicked one
                      setActiveBubbleIndex(isActive ? null : index)
                    }}
                  />
                </div>
              )
            })}
          </div>
        )
      }

    </div >
  )
}
