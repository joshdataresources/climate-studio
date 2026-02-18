// Comprehensive layer definitions with icons, sources, and rendering config
import React from 'react'
import {
  Factory,
  Thermometer,
  BarChart3,
  Flame,
  Waves,
  Dam as DamIcon,
  Building2,
  Droplets,
  CloudRain,
  Wind,
  TrendingUp,
  Mountain,
  Zap
} from 'lucide-react'
import { FactoryLayersPanel } from '../components/panels/FactoryLayersPanel'
import { ClimateLayerControlsPanel } from '../components/panels/ClimateLayerControlsPanel'

export interface LayerDefinition {
  id: string
  name: string
  description?: string
  type: 'geojson' | 'raster' | 'vector' | 'climate'
  category: 'infrastructure' | 'climate' | 'water' | 'environment'
  icon: any // Lucide icon component
  sourceUrl: string
  sourceAttribution: string
  enabled: boolean
  visible: boolean
  opacity: number
  availableInViews: string[] // Empty array = available in all views

  // Rendering configuration
  hasMapVisualization: boolean // Does this layer render on the map?
  requiresClimateWidget: boolean // Does this layer need the Climate Projections widget?
  requiresDeckGL?: boolean // Does this layer require DeckGL (not regular Mapbox)?

  // Right panel component for layer-specific controls
  rightPanelComponent?: React.ComponentType<any>

  // For future implementation
  dataSource?: string // Path to data file or API endpoint
  renderConfig?: {
    layerType?: 'circle' | 'fill' | 'line' | 'heatmap' | 'symbol'
    paint?: any
    layout?: any
  }
}

export const layerDefinitions: LayerDefinition[] = [
  // INFRASTRUCTURE LAYERS
  {
    id: 'factories',
    name: 'Factories',
    description: 'US Manufacturing Facilities (2015-2025)',
    type: 'geojson',
    category: 'infrastructure',
    icon: Factory,
    sourceUrl: 'CHIPS Act Database',
    sourceAttribution: 'CHIPS and Science Act, DOE',
    enabled: true,
    visible: true,
    opacity: 1.0,
    availableInViews: [],
    hasMapVisualization: true,
    requiresClimateWidget: false,
    rightPanelComponent: FactoryLayersPanel,
    dataSource: '/data/factories-expanded.json',
    renderConfig: {
      layerType: 'circle',
      paint: {
        'circle-radius': 12,
        'circle-color': [
          'interpolate',
          ['linear'],
          ['get', 'risk_score'],
          0, '#10b981',
          3, '#eab308',
          5, '#f97316',
          7, '#ef4444'
        ],
        'circle-opacity': 0.8,
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff',
        'circle-stroke-opacity': 0.9
      }
    }
  },
  {
    id: 'ai_datacenters',
    name: 'AI Data Centers',
    description: 'AI computing infrastructure & energy impact (2024-2026)',
    type: 'geojson',
    category: 'infrastructure',
    icon: Zap,
    sourceUrl: 'Public filings, DOE',
    sourceAttribution: 'Company announcements, DOE, public filings',
    enabled: true,
    visible: true,
    opacity: 1.0,
    availableInViews: [],
    hasMapVisualization: true,
    requiresClimateWidget: false,
    dataSource: '/data/ai-datacenters.json',
    renderConfig: {
      layerType: 'symbol',
      paint: {
        'icon-opacity': 0.85
      }
    }
  },
  {
    id: 'major_dams',
    name: 'Major Dams',
    description: 'Large dam infrastructure and water storage facilities',
    type: 'geojson',
    category: 'infrastructure',
    icon: DamIcon,
    sourceUrl: 'US Army Corps',
    sourceAttribution: 'U.S. Army Corps of Engineers, National Inventory of Dams',
    enabled: true,
    visible: true,
    opacity: 1.0,
    availableInViews: ['climate_analysis', 'water_access'],
    hasMapVisualization: true,
    requiresClimateWidget: false,
    dataSource: '/data/dams.json'
  },
  {
    id: 'metro_service_areas',
    name: 'Metro Service Areas',
    description: 'Major metropolitan service boundaries',
    type: 'vector',
    category: 'infrastructure',
    icon: Building2,
    sourceUrl: 'US Census Bureau',
    sourceAttribution: 'U.S. Census Bureau, Metropolitan Statistical Areas',
    enabled: false,
    visible: true,
    opacity: 0.5,
    availableInViews: [],
    hasMapVisualization: false, // Not implemented yet
    requiresClimateWidget: false
  },

  // CLIMATE LAYERS
  {
    id: 'metro_temperature_humidity',
    name: 'Metro Temperature & Humidity',
    description: 'Urban temperature and humidity patterns',
    type: 'climate',
    category: 'climate',
    icon: Thermometer,
    sourceUrl: 'NOAA',
    sourceAttribution: 'NOAA National Centers for Environmental Information',
    enabled: false,
    visible: true,
    opacity: 0.7,
    availableInViews: [],
    hasMapVisualization: true,
    requiresClimateWidget: true,
    rightPanelComponent: ClimateLayerControlsPanel,
    dataSource: '/data/metro_temperature_projections.json',
    renderConfig: {
      layerType: 'circle',
      paint: {
        'circle-radius': [
          'interpolate',
          ['linear'],
          ['get', 'temperature'],
          80, 20,
          100, 40,
          120, 60
        ],
        'circle-color': [
          'interpolate',
          ['linear'],
          ['get', 'temperature'],
          80, '#3b82f6',
          95, '#fbbf24',
          110, '#ef4444'
        ],
        'circle-opacity': 0.6,
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff',
        'circle-stroke-opacity': 0.8
      }
    }
  },
  {
    id: 'metro_data_statistics',
    name: 'Metro Data Statistics',
    description: 'Statistical climate data for metro areas',
    type: 'climate',
    category: 'climate',
    icon: BarChart3,
    sourceUrl: 'NOAA',
    sourceAttribution: 'NOAA Regional Climate Centers',
    enabled: false,
    visible: true,
    opacity: 0.7,
    availableInViews: [],
    hasMapVisualization: false, // Data visualization, not map layer
    requiresClimateWidget: false
  },
  {
    id: 'urban_heat_island',
    name: 'Urban Heat Island',
    description: 'Heat island effect in urban areas',
    type: 'climate',
    category: 'climate',
    icon: Flame,
    sourceUrl: 'NASA MODIS',
    sourceAttribution: 'NASA MODIS Land Surface Temperature',
    enabled: false,
    visible: true,
    opacity: 0.7,
    availableInViews: [],
    hasMapVisualization: true,
    requiresClimateWidget: true,
    rightPanelComponent: ClimateLayerControlsPanel,
    renderConfig: {
      layerType: 'heatmap',
      paint: {
        'heatmap-weight': [
          'interpolate',
          ['linear'],
          ['get', 'heat_intensity'],
          0, 0,
          10, 1
        ],
        'heatmap-intensity': [
          'interpolate',
          ['linear'],
          ['zoom'],
          0, 1,
          9, 3
        ],
        'heatmap-color': [
          'interpolate',
          ['linear'],
          ['heatmap-density'],
          0, 'rgba(33,102,172,0)',
          0.2, 'rgb(103,169,207)',
          0.4, 'rgb(209,229,240)',
          0.6, 'rgb(253,219,199)',
          0.8, 'rgb(239,138,98)',
          1, 'rgb(178,24,43)'
        ],
        'heatmap-radius': [
          'interpolate',
          ['linear'],
          ['zoom'],
          0, 2,
          9, 20
        ],
        'heatmap-opacity': 0.7
      }
    }
  },
  {
    id: 'wet_bulb_temperature',
    name: 'Wet Bulb Temperature',
    description: 'Dangerous heat and humidity conditions',
    type: 'climate',
    category: 'climate',
    icon: Wind,
    sourceUrl: 'NOAA',
    sourceAttribution: 'NOAA Climate Prediction Center',
    enabled: false,
    visible: true,
    opacity: 0.7,
    availableInViews: [],
    hasMapVisualization: true,
    requiresClimateWidget: true,
    rightPanelComponent: ClimateLayerControlsPanel,
    renderConfig: {
      layerType: 'circle',
      paint: {
        'circle-radius': [
          'interpolate',
          ['linear'],
          ['get', 'wet_bulb_temp'],
          25, 15,
          30, 30,
          35, 50
        ],
        'circle-color': [
          'interpolate',
          ['linear'],
          ['get', 'wet_bulb_temp'],
          25, '#fbbf24',
          30, '#f97316',
          35, '#ef4444'
        ],
        'circle-opacity': 0.6,
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff',
        'circle-stroke-opacity': 0.7
      }
    }
  },
  {
    id: 'future_temperature_anomaly',
    name: 'Future Temperature Anomaly',
    description: 'Projected temperature changes (Climate view only)',
    type: 'climate',
    category: 'climate',
    icon: TrendingUp,
    sourceUrl: 'NASA Earth Engine',
    sourceAttribution: 'NASA Earth Engine, CMIP6 Climate Models',
    enabled: false,
    visible: true,
    opacity: 0.7,
    availableInViews: [],
    hasMapVisualization: true,
    requiresClimateWidget: true,
    requiresDeckGL: true,
    rightPanelComponent: ClimateLayerControlsPanel,
    renderConfig: {
      layerType: 'fill',
      paint: {
        'fill-color': [
          'interpolate',
          ['linear'],
          ['get', 'temperature_change'],
          0, '#3b82f6',
          2, '#fbbf24',
          4, '#ef4444'
        ],
        'fill-opacity': 0.6
      }
    }
  },
  {
    id: 'precipitation_drought',
    name: 'Precipitation & Drought',
    description: 'Rainfall patterns and drought conditions (Climate view only)',
    type: 'climate',
    category: 'climate',
    icon: CloudRain,
    sourceUrl: 'NOAA Drought Monitor',
    sourceAttribution: 'NOAA National Drought Mitigation Center',
    enabled: false,
    visible: true,
    opacity: 0.7,
    availableInViews: [],
    hasMapVisualization: true,
    requiresClimateWidget: true,
    requiresDeckGL: true,
    rightPanelComponent: ClimateLayerControlsPanel,
    renderConfig: {
      layerType: 'fill',
      paint: {
        'fill-color': [
          'interpolate',
          ['linear'],
          ['get', 'drought_severity'],
          0, '#10b981',
          2, '#fbbf24',
          4, '#f97316',
          5, '#ef4444'
        ],
        'fill-opacity': 0.6
      }
    }
  },

  // WATER LAYERS
  {
    id: 'river_flow_status',
    name: 'River Flow Status',
    description: 'Real-time river flow and water levels',
    type: 'geojson',
    category: 'water',
    icon: Waves,
    sourceUrl: 'USGS',
    sourceAttribution: 'USGS Water Resources',
    enabled: false,
    visible: true,
    opacity: 0.8,
    availableInViews: [],
    hasMapVisualization: false, // Not implemented yet
    requiresClimateWidget: false
  },
  {
    id: 'canals_aqueducts',
    name: 'Canals & Aqueducts',
    description: 'Water transport infrastructure',
    type: 'geojson',
    category: 'water',
    icon: Waves,
    sourceUrl: 'USGS',
    sourceAttribution: 'USGS National Hydrography Dataset',
    enabled: false,
    visible: true,
    opacity: 0.8,
    availableInViews: [],
    hasMapVisualization: false, // Not implemented yet
    requiresClimateWidget: false
  },
  {
    id: 'groundwater',
    name: 'Groundwater',
    description: 'Aquifer levels and groundwater resources (Climate view only)',
    type: 'climate',
    category: 'water',
    icon: Droplets,
    sourceUrl: 'USGS GRACE',
    sourceAttribution: 'USGS, NASA GRACE Groundwater Data',
    enabled: false,
    visible: true,
    opacity: 0.6,
    availableInViews: [],
    hasMapVisualization: true,
    requiresClimateWidget: true,
    requiresDeckGL: true,
    rightPanelComponent: ClimateLayerControlsPanel,
    renderConfig: {
      layerType: 'fill',
      paint: {
        'fill-color': [
          'interpolate',
          ['linear'],
          ['get', 'water_level_change'],
          -50, '#ef4444',
          -25, '#f97316',
          0, '#fbbf24',
          25, '#3b82f6'
        ],
        'fill-opacity': 0.5
      }
    }
  },

  // ENVIRONMENT LAYERS
  {
    id: 'topographic_relief',
    name: 'Topographic Relief',
    description: 'Terrain elevation and topology',
    type: 'raster',
    category: 'environment',
    icon: Mountain,
    sourceUrl: 'USGS',
    sourceAttribution: 'USGS National Elevation Dataset',
    enabled: false,
    visible: true,
    opacity: 0.6,
    availableInViews: [],
    hasMapVisualization: false, // Not implemented yet
    requiresClimateWidget: false
  }
]

// Helper to check if Climate Projections widget should be shown
export function shouldShowClimateWidget(enabledLayerIds: string[]): boolean {
  const climateLayers = layerDefinitions.filter(
    layer => layer.requiresClimateWidget && enabledLayerIds.includes(layer.id)
  )
  return climateLayers.length > 0
}

// Get layer icon by ID
export function getLayerIcon(layerId: string) {
  const layer = layerDefinitions.find(l => l.id === layerId)
  return layer?.icon || Factory
}

// Get layer by ID
export function getLayerById(layerId: string): LayerDefinition | undefined {
  return layerDefinitions.find(l => l.id === layerId)
}
