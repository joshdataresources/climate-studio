// Factories View - Manufacturing facilities with environmental risk analysis
import { useEffect, useRef, useState, useCallback } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { useTheme } from '../contexts/ThemeContext'
import { useSidebar } from '../contexts/SidebarContext'
import { useLayer } from '../contexts/LayerContext'
import { useMap } from '../contexts/MapContext'
import { FactoryDetailPanel, SelectedFactory } from './panels/FactoryDetailPanel'
import { AIDataCenterDetailPanel, SelectedDataCenter } from './panels/AIDataCenterDetailPanel'
import { LayerControlsPanel } from './panels/LayerControlsPanel'
import { LayerLibraryPanel } from './panels/LayerLibraryPanel'
import { SearchAndViewsPanel } from './panels/SearchAndViewsPanel'
import { ClimateProjectionsWidget } from './ClimateProjectionsWidget'
import { shouldShowClimateWidget } from '../config/layerDefinitions'
import { useLayerOrchestrator } from '../hooks/useLayerOrchestrator'
import { setupDataCenterLayer } from '../utils/dataCenterLayerSetup'

// Import expanded factory data
import factoriesExpandedData from '../data/factories-expanded.json'
// Import AI data centers data
import aiDatacentersData from '../data/ai-datacenters.json'

// Use environment variable or fallback to the token
const MAPBOX_ACCESS_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || 'pk.eyJ1Ijoiam9zaHVhYmJ1dGxlciIsImEiOiJjbWcwNXpyNXUwYTdrMmtva2tiZ2NjcGxhIn0.Fc3d_CloJGiw9-BE4nI_Kw'
mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN

export default function FactoriesView() {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const { theme } = useTheme()
  const { panelsCollapsed } = useSidebar()
  const { getEnabledLayersForView } = useLayer()
  const { viewport } = useMap()

  const [selectedFactory, setSelectedFactory] = useState<SelectedFactory | null>(null)
  const [selectedDataCenter, setSelectedDataCenter] = useState<SelectedDataCenter | null>(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [filteredFactories, setFilteredFactories] = useState<any[]>([])
  const [showAIDataCenters, setShowAIDataCenters] = useState(true)

  // Initialize LayerOrchestrator for automatic layer sync
  const { activePanels, isLayerRendered } = useLayerOrchestrator({
    map: mapRef.current,
    viewId: 'factories',
    getEnabledLayers: () => getEnabledLayersForView('factories').filter(l => l.id !== 'factories'), // Exclude factories (handled separately)
    onLayerRendered: (layerId) => console.log('✅ Orchestrator rendered layer:', layerId),
    onLayerError: (layerId, error) => console.error('❌ Orchestrator error for', layerId, ':', error)
  })

  // Layer visibility states for factories
  const [showOperational, setShowOperational] = useState(true)
  const [showConstruction, setShowConstruction] = useState(true)
  const [showAnnounced, setShowAnnounced] = useState(true)
  const [showFailed, setShowFailed] = useState(true)

  // Sector filters
  const [showSemiconductor, setShowSemiconductor] = useState(true)
  const [showBattery, setShowBattery] = useState(true)
  const [showEV, setShowEV] = useState(true)
  const [showDataCenter, setShowDataCenter] = useState(true)
  const [showElectronics, setShowElectronics] = useState(true)

  // Risk filters
  const [showLowRisk, setShowLowRisk] = useState(true)
  const [showModerateRisk, setShowModerateRisk] = useState(true)
  const [showHighRisk, setShowHighRisk] = useState(true)
  const [showCriticalRisk, setShowCriticalRisk] = useState(true)

  const isDark = theme === 'dark'

  // Setup factory layers on map - ALWAYS render factories on this view
  const setupFactoryLayers = useCallback((map: mapboxgl.Map) => {
    if (!map || map.getSource('factories')) return

    console.log('🏭 Setting up factory layers with', factoriesExpandedData.factories.length, 'factories...')

    // Convert factories to GeoJSON
    const geojson: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: factoriesExpandedData.factories.map((factory: any) => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [factory.location.coordinates.lon, factory.location.coordinates.lat]
        },
        properties: {
          id: factory.id,
          name: factory.name,
          company: factory.company,
          city: factory.location.city,
          state: factory.location.state,
          status: factory.status,
          sector: factory.sector,
          risk_score: factory.environmental_risk?.overall_risk_score || 5,
          total_investment: factory.investment?.total || 1000000000,
        }
      }))
    }

    console.log('📍 Adding factory source with features:', geojson.features.length)
    console.log('📍 First factory feature:', geojson.features[0])
    console.log('📍 Sample coordinates:', geojson.features.slice(0, 3).map(f => f.geometry.coordinates))

    map.addSource('factories', {
      type: 'geojson',
      data: geojson
    })

    // Add factory circle layer
    map.addLayer({
      id: 'factory-circles',
      type: 'circle',
      source: 'factories',
      paint: {
        'circle-radius': 12,  // Fixed size for now to ensure visibility
        'circle-color': [
          'interpolate',
          ['linear'],
          ['get', 'risk_score'],
          0, '#10b981',  // green-500
          3, '#eab308',  // yellow-500
          5, '#f97316',  // orange-500
          7, '#ef4444'   // red-500
        ],
        'circle-opacity': 0.8,
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff',
        'circle-stroke-opacity': 0.9
      }
    })

    // Add factory labels
    map.addLayer({
      id: 'factory-labels',
      type: 'symbol',
      source: 'factories',
      layout: {
        'text-field': ['get', 'name'],
        'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
        'text-size': 11,
        'text-offset': [0, 1.5],
        'text-anchor': 'top',
        'text-max-width': 12
      },
      paint: {
        'text-color': '#1f2937',
        'text-halo-color': '#ffffff',
        'text-halo-width': 1.5
      }
    })

    console.log('✅ Factory layers and labels added to map')

    // Log layer info for debugging
    setTimeout(() => {
      if (map.getLayer('factory-circles')) {
        console.log('✅ Factory layer exists on map')
        console.log('📊 Layer paint properties:', map.getPaintProperty('factory-circles', 'circle-radius'))
        const source = map.getSource('factories') as mapboxgl.GeoJSONSource
        if (source && source._data) {
          console.log('📊 Source data features:', (source._data as any).features?.length)
        }
      } else {
        console.error('❌ Factory layer NOT found on map!')
      }
    }, 1000)

    // Add click handler
    map.on('click', 'factory-circles', (e) => {
      console.log('🖱️ Factory circle clicked!', e)

      if (!e.features || !e.features[0]) {
        console.warn('⚠️ No features found in click event')
        return
      }

      const feature = e.features[0]
      const factoryId = feature.properties?.id
      console.log('🔍 Looking for factory with ID:', factoryId)

      const fullFactory = factoriesExpandedData.factories.find((f: any) => f.id === factoryId)

      if (fullFactory) {
        console.log('✅ Factory found:', fullFactory.name)
        setSelectedFactory(fullFactory)
        setSelectedDataCenter(null) // Close data center panel if open
      } else {
        console.error('❌ Factory not found in data for ID:', factoryId)
      }
    })

    // Change cursor on hover
    map.on('mouseenter', 'factory-circles', () => {
      map.getCanvas().style.cursor = 'pointer'
    })

    map.on('mouseleave', 'factory-circles', () => {
      map.getCanvas().style.cursor = ''
    })
  }, [])

  // Update map filters based on filter states
  const updateMapFilters = useCallback(() => {
    if (!mapRef.current || !mapLoaded) return
    const map = mapRef.current

    // Build status filter - only apply if at least one is checked
    const statusConditions: any[] = []
    if (showOperational) statusConditions.push(['==', ['get', 'status'], 'operational'])
    if (showConstruction) statusConditions.push(['==', ['get', 'status'], 'under_construction'])
    if (showAnnounced) statusConditions.push(['==', ['get', 'status'], 'announced'])
    if (showFailed) statusConditions.push(['in', ['get', 'status'], ['literal', ['failed', 'FAILED', 'paused', 'PAUSED', 'AT RISK']]])
    const statusFilter = statusConditions.length > 0 ? ['any', ...statusConditions] : true

    // Build sector filter - only apply if at least one is checked
    const sectorConditions: any[] = []
    if (showSemiconductor) sectorConditions.push(['==', ['get', 'sector'], 'semiconductor'])
    if (showBattery) sectorConditions.push(['==', ['get', 'sector'], 'battery'])
    if (showEV) sectorConditions.push(['==', ['get', 'sector'], 'ev'])
    if (showDataCenter) sectorConditions.push(['==', ['get', 'sector'], 'data_center'])
    if (showElectronics) sectorConditions.push(['==', ['get', 'sector'], 'electronics'])
    const sectorFilter = sectorConditions.length > 0 ? ['any', ...sectorConditions] : true

    // Build risk filter - only apply if at least one is checked
    const riskConditions: any[] = []
    if (showLowRisk) riskConditions.push(['<', ['get', 'risk_score'], 3])
    if (showModerateRisk) riskConditions.push(['all', ['>=', ['get', 'risk_score'], 3], ['<', ['get', 'risk_score'], 5]])
    if (showHighRisk) riskConditions.push(['all', ['>=', ['get', 'risk_score'], 5], ['<', ['get', 'risk_score'], 7]])
    if (showCriticalRisk) riskConditions.push(['>=', ['get', 'risk_score'], 7])
    const riskFilter = riskConditions.length > 0 ? ['any', ...riskConditions] : true

    // Combine all filters - only include non-true filters
    const filters: any[] = ['all']
    if (statusFilter !== true) filters.push(statusFilter)
    if (sectorFilter !== true) filters.push(sectorFilter)
    if (riskFilter !== true) filters.push(riskFilter)

    const combinedFilter = filters.length > 1 ? filters : null

    if (map.getLayer('factory-circles')) {
      map.setFilter('factory-circles', combinedFilter)
    }
    if (map.getLayer('factory-labels')) {
      map.setFilter('factory-labels', combinedFilter)
    }

    console.log('🔍 Applied filter:', combinedFilter)
  }, [mapLoaded, showOperational, showConstruction, showAnnounced, showFailed,
    showSemiconductor, showBattery, showEV, showDataCenter, showElectronics,
    showLowRisk, showModerateRisk, showHighRisk, showCriticalRisk])

  // Initialize map ONCE
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return

    console.log('🗺️ Initializing Factories map...')

    const mapStyle = isDark ? 'mapbox://styles/mapbox/dark-v11' : 'mapbox://styles/mapbox/light-v11'

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: mapStyle,
      center: [-98.5795, 39.8283], // Center of USA
      zoom: 4,
      maxBounds: [
        [-130, 20], // Southwest coordinates
        [-60, 55]   // Northeast coordinates
      ],
      minZoom: 3,
    })

    mapRef.current = map

    map.on('load', () => {
      console.log('✅ Map loaded for Factories view')
      setupFactoryLayers(map)

      // Setup AI Data Centers layer
      setupDataCenterLayer(map, aiDatacentersData, (datacenter) => {
        setSelectedDataCenter(datacenter)
        setSelectedFactory(null) // Close factory panel if open
      })

      setMapLoaded(true)
    })

    // Cleanup
    return () => {
      console.log('🧹 Cleaning up Factories map')
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
        setMapLoaded(false)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Update map style when theme changes
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return

    const map = mapRef.current
    const currentStyle = map.getStyle()
    const newStyleUrl = isDark ? 'mapbox://styles/mapbox/dark-v11' : 'mapbox://styles/mapbox/light-v11'

    // Only update if style actually changed
    if (currentStyle?.sprite?.includes(isDark ? 'dark' : 'light')) {
      return
    }

    console.log('🎨 Updating map style to:', isDark ? 'dark' : 'light')
    map.setStyle(newStyleUrl)

    map.once('style.load', () => {
      console.log('🎨 Style loaded, re-adding factory layers...')
      setupFactoryLayers(map)
      updateMapFilters()

      // Re-add AI Data Centers layer after style change
      setupDataCenterLayer(map, aiDatacentersData, (datacenter) => {
        setSelectedDataCenter(datacenter)
        setSelectedFactory(null)
      })
    })
  }, [isDark, mapLoaded, setupFactoryLayers, updateMapFilters])

  // Update filters when any filter state changes
  useEffect(() => {
    updateMapFilters()
  }, [updateMapFilters])

  // Get enabled layers for this view (outside of effect to avoid dependency issues)
  const enabledLayers = getEnabledLayersForView('factories')

  // Handle local factory search - receives term from SearchAndViewsPanel
  const handleFactorySearch = useCallback((searchTerm: string) => {
    if (!searchTerm.trim()) {
      setFilteredFactories([])
      return
    }

    const term = searchTerm.toLowerCase()
    const filtered = factoriesExpandedData.factories.filter((factory: any) =>
      factory.name.toLowerCase().includes(term) ||
      factory.company.toLowerCase().includes(term) ||
      factory.location.city.toLowerCase().includes(term) ||
      factory.location.state.toLowerCase().includes(term)
    )
    setFilteredFactories(filtered)

    // Fly to first result if available
    if (filtered.length > 0 && mapRef.current) {
      const firstFactory = filtered[0]
      mapRef.current.flyTo({
        center: [firstFactory.location.coordinates.lon, firstFactory.location.coordinates.lat],
        zoom: 10,
        duration: 2000
      })
    }
  }, [])

  // Convert filtered factories to custom search result format
  const customSearchResults = filteredFactories.slice(0, 5).map((factory: any) => ({
    id: factory.id,
    display_name: `${factory.name} - ${factory.location.city}, ${factory.location.state}`,
    location: {
      lat: factory.location.coordinates.lat,
      lon: factory.location.coordinates.lon
    }
  }))

  // Check if Climate Projections widget should be shown
  const enabledLayerIds = enabledLayers.map(l => l.id)
  const showClimateWidget = shouldShowClimateWidget(enabledLayerIds)

  return (
    <div className="relative h-full w-full text-foreground">
      {/* Mapbox container - FULL SCREEN */}
      <div ref={mapContainerRef} className="absolute inset-0 w-full h-full" />

      {/* Left Panel - Search and Layer Library */}
      {!panelsCollapsed && (
        <aside className="absolute left-[92px] top-4 z-[1000] w-[352px] pointer-events-none transition-all duration-300 animate-in fade-in slide-in-from-left-10">
          <div className="space-y-4 pointer-events-auto">
            <SearchAndViewsPanel
              viewType="factories"
              searchPlaceholder="Search factories, companies, cities..."
              activeLayerIds={[]}
              controls={{}}
              onCustomSearch={handleFactorySearch}
              customSearchResults={customSearchResults}
              onCustomResultClick={(result) => {
                const factory = filteredFactories.find((f: any) => f.id === result.id)
                if (factory && mapRef.current) {
                  mapRef.current.flyTo({
                    center: [factory.location.coordinates.lon, factory.location.coordinates.lat],
                    zoom: 10,
                    duration: 2000
                  })
                  setSelectedFactory(factory)
                }
              }}
            />

            {/* Layer Library Panel */}
            <LayerLibraryPanel currentViewId="factories" />
          </div>
        </aside>
      )}

      {/* Right Panel - Full height scrollable container matching Water/Climate views */}
      {!panelsCollapsed && (
        <div className="absolute top-4 right-4 z-[1000] w-[336px] h-[calc(100vh-32px)] pointer-events-auto overflow-y-auto">
          <div className="space-y-4 pr-4">
            {/* Climate Projections Widget - Top (conditional) */}
            {showClimateWidget && (
              <ClimateProjectionsWidget />
            )}

            {/* Layer Controls Panel */}
            <LayerControlsPanel
              viewId="factories"
              showOperational={showOperational}
              setShowOperational={setShowOperational}
              showConstruction={showConstruction}
              setShowConstruction={setShowConstruction}
              showAnnounced={showAnnounced}
              setShowAnnounced={setShowAnnounced}
              showFailed={showFailed}
              setShowFailed={setShowFailed}
              showSemiconductor={showSemiconductor}
              setShowSemiconductor={setShowSemiconductor}
              showBattery={showBattery}
              setShowBattery={setShowBattery}
              showEV={showEV}
              setShowEV={setShowEV}
              showDataCenter={showDataCenter}
              setShowDataCenter={setShowDataCenter}
              showElectronics={showElectronics}
              setShowElectronics={setShowElectronics}
              showLowRisk={showLowRisk}
              setShowLowRisk={setShowLowRisk}
              showModerateRisk={showModerateRisk}
              setShowModerateRisk={setShowModerateRisk}
              showHighRisk={showHighRisk}
              setShowHighRisk={setShowHighRisk}
              showCriticalRisk={showCriticalRisk}
              setShowCriticalRisk={setShowCriticalRisk}
            />
          </div>
        </div>
      )}

      {/* Bottom Center - Factory Detail Panel */}
      {selectedFactory && !selectedDataCenter && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000] w-[640px] pointer-events-auto">
          <FactoryDetailPanel
            factory={selectedFactory}
            onClose={() => setSelectedFactory(null)}
          />
        </div>
      )}

      {/* Bottom Center - AI Data Center Detail Panel */}
      {selectedDataCenter && !selectedFactory && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000] w-[640px] pointer-events-auto">
          <AIDataCenterDetailPanel
            datacenter={selectedDataCenter}
            onClose={() => setSelectedDataCenter(null)}
          />
        </div>
      )}
    </div>
  )
}
