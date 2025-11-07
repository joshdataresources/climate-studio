/**
 * HempsteadResilienceApp.tsx
 * Focused resilience viewer for Town of Hempstead South Shore
 * - Sea level rise layer only
 * - View locked to South Shore area
 * - Highlights intervention zones and existing projects
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react'
import Map, { Marker, NavigationControl, GeolocateControl, ScaleControl, Source, Layer } from 'react-map-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { Button } from './ui/button'
import { AlertTriangle, CheckCircle2, Info, ChevronLeft, ChevronRight, MapPin } from 'lucide-react'

const MAPBOX_TOKEN = 'pk.eyJ1Ijoiam9zaHVhYmJ1dGxlciIsImEiOiJjbWcwNXpyNXUwYTdrMmtva2tiZ2NjcGxhIn0.Fc3d_CloJGiw9-BE4nI_Kw'

// South Shore bounding box (Rockville Centre to Massapequa)
const SOUTH_SHORE_BOUNDS = {
  north: 40.70,
  south: 40.58,
  east: -73.45,
  west: -73.75,
  zoom: 11
}

const DEFAULT_VIEWPORT = {
  center: { lat: 40.64, lng: -73.60 }, // Center of South Shore
  zoom: 11.5
}

interface InterventionZone {
  id: string
  name: string
  lat: number
  lng: number
  needIndex: number
  riskLevel: 'high' | 'medium' | 'low'
  description: string
  recommendedAction: string
}

// Top intervention zones from our analysis
const INTERVENTION_ZONES: InterventionZone[] = [
  {
    id: 'zone-1',
    name: 'Point Lookout Coastal Barrier',
    lat: 40.5930,
    lng: -73.5812,
    needIndex: 0.999,
    riskLevel: 'high',
    description: 'Barrier island with elevation 0-3m, extreme SLR exposure',
    recommendedAction: 'Living shoreline + marsh restoration'
  },
  {
    id: 'zone-2',
    name: 'Baldwin Back-Bay Area',
    lat: 40.6565,
    lng: -73.6093,
    needIndex: 0.892,
    riskLevel: 'high',
    description: 'Tidal flooding from Middle Bay, elevation 1-5m',
    recommendedAction: 'Road elevation + drainage upgrades + tidal check valves'
  },
  {
    id: 'zone-3',
    name: 'Hempstead Bay Wetlands',
    lat: 40.6000,
    lng: -73.6500,
    needIndex: 0.863,
    riskLevel: 'high',
    description: 'Degrading marsh areas, critical natural buffer',
    recommendedAction: 'Thin-layer sediment deposition + living shoreline'
  },
  {
    id: 'zone-4',
    name: 'Freeport Waterfront',
    lat: 40.6576,
    lng: -73.5832,
    needIndex: 0.785,
    riskLevel: 'high',
    description: 'Tidal flooding, commercial district at risk',
    recommendedAction: 'Drainage improvements + green infrastructure'
  },
  {
    id: 'zone-5',
    name: 'Merrick Drainage Basin',
    lat: 40.6629,
    lng: -73.5513,
    needIndex: 0.672,
    riskLevel: 'medium',
    description: 'Moderate tidal flooding risk',
    recommendedAction: 'Stormwater management + bioswales'
  }
]

export function HempsteadResilienceApp() {
  const [viewState, setViewState] = useState({
    longitude: DEFAULT_VIEWPORT.center.lng,
    latitude: DEFAULT_VIEWPORT.center.lat,
    zoom: DEFAULT_VIEWPORT.zoom,
    pitch: 0,
    bearing: 0
  })
  const [selectedZone, setSelectedZone] = useState<InterventionZone | null>(null)
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false)
  const [seaLevelFeet, setSeaLevelFeet] = useState(3) // 2050 projection
  const [showRiskZones, setShowRiskZones] = useState(true)
  const [showProjects, setShowProjects] = useState(true)
  const [resilienceProjectsData, setResilienceProjectsData] = useState<any>(null)
  const [resilienceNeedsData, setResilienceNeedsData] = useState<any>(null)
  const [hoveredProject, setHoveredProject] = useState<any>(null)
  const [cursorPosition, setCursorPosition] = useState<{ x: number; y: number } | null>(null)

  // Load GeoJSON data
  useEffect(() => {
    // Load the polygon version with realistic shapes from OSM
    fetch('/data/resilience_projects_polygons.geojson')
      .then(res => res.json())
      .then(data => setResilienceProjectsData(data))
      .catch(err => console.error('Error loading projects:', err))

    fetch('/data/resilience_needs.geojson')
      .then(res => res.json())
      .then(data => setResilienceNeedsData(data))
      .catch(err => console.error('Error loading needs:', err))
  }, [])

  // Filter risk zones data to only high and medium risk
  const highMediumRiskZones = useMemo(() => {
    if (!resilienceNeedsData) return null
    return {
      ...resilienceNeedsData,
      features: resilienceNeedsData.features.filter(
        (f: any) => f.properties.risk_category === 'High' || f.properties.risk_category === 'Medium'
      )
    }
  }, [resilienceNeedsData])

  // The project data now comes with realistic polygons from OSM
  const projectPolygons = resilienceProjectsData

  // Update view state when zone is selected
  useEffect(() => {
    if (selectedZone) {
      setViewState(prev => ({
        ...prev,
        longitude: selectedZone.lng,
        latitude: selectedZone.lat,
        zoom: 13.5
      }))
    }
  }, [selectedZone])

  const handleZoneClick = useCallback((zone: InterventionZone) => {
    setSelectedZone(zone)
  }, [])

  const getRiskColor = (level: 'high' | 'medium' | 'low') => {
    switch (level) {
      case 'high':
        return 'bg-red-100 border-red-300 text-red-800'
      case 'medium':
        return 'bg-orange-100 border-orange-300 text-orange-800'
      case 'low':
        return 'bg-green-100 border-green-300 text-green-800'
    }
  }

  const getRiskIcon = (level: 'high' | 'medium' | 'low') => {
    switch (level) {
      case 'high':
        return <AlertTriangle className="h-4 w-4 text-red-600" />
      case 'medium':
        return <Info className="h-4 w-4 text-orange-600" />
      case 'low':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />
    }
  }

  return (
    <div className="relative h-screen bg-background text-foreground">
      {/* Main Map with Sea Level Rise */}
      <Map
        {...viewState}
        onMove={(evt) => setViewState(evt.viewState)}
        onMouseMove={(evt) => {
          setCursorPosition({ x: evt.point.x, y: evt.point.y })
        }}
        mapboxAccessToken={MAPBOX_TOKEN}
        mapStyle="mapbox://styles/mapbox/dark-v11"
        style={{ width: '100%', height: '100%' }}
        terrain={{ source: 'mapbox-dem', exaggeration: 1.5 }}
        interactiveLayerIds={['project-polygons']}
        onMouseEnter={(evt) => {
          if (evt.features && evt.features.length > 0) {
            setHoveredProject(evt.features[0].properties)
          }
        }}
        onMouseLeave={() => {
          setHoveredProject(null)
        }}
      >
        {/* Topographic Terrain with Dramatic Shadows */}
        <Source
          id="mapbox-dem"
          type="raster-dem"
          url="mapbox://mapbox.mapbox-terrain-dem-v1"
          tileSize={512}
          maxzoom={14}
        />
        <Source
          id="hillshade"
          type="raster-dem"
          url="mapbox://mapbox.mapbox-terrain-dem-v1"
          tileSize={512}
        >
          <Layer
            id="hillshade-layer"
            type="hillshade"
            paint={{
              'hillshade-exaggeration': 0.8,
              'hillshade-shadow-color': '#000000',
              'hillshade-accent-color': '#ffffff',
              'hillshade-illumination-direction': 315,
              'hillshade-illumination-anchor': 'viewport'
            }}
            beforeId="sea-level-rise-layer"
          />
        </Source>

        {/* Sea Level Rise Layer - Always Active */}
        <Source
          id="sea-level-rise"
          type="raster"
          tiles={[`http://localhost:5001/api/tiles/noaa-slr/${seaLevelFeet}/{z}/{x}/{y}.png`]}
          tileSize={256}
        >
          <Layer
            id="sea-level-rise-layer"
            type="raster"
            paint={{
              'raster-opacity': 0.7
            }}
          />
        </Source>

        {/* South Shore Focus Area Polygon */}
        <Source
          id="focus-area"
          type="geojson"
          data={{
            type: 'Feature',
            geometry: {
              type: 'Polygon',
              coordinates: [[
                [SOUTH_SHORE_BOUNDS.west, SOUTH_SHORE_BOUNDS.north],
                [SOUTH_SHORE_BOUNDS.east, SOUTH_SHORE_BOUNDS.north],
                [SOUTH_SHORE_BOUNDS.east, SOUTH_SHORE_BOUNDS.south],
                [SOUTH_SHORE_BOUNDS.west, SOUTH_SHORE_BOUNDS.south],
                [SOUTH_SHORE_BOUNDS.west, SOUTH_SHORE_BOUNDS.north]
              ]]
            }
          }}
        >
          <Layer
            id="focus-area-outline"
            type="line"
            paint={{
              'line-color': '#3b82f6',
              'line-width': 3,
              'line-dasharray': [2, 2]
            }}
          />
          <Layer
            id="focus-area-fill"
            type="fill"
            paint={{
              'fill-color': '#3b82f6',
              'fill-opacity': 0.05
            }}
          />
        </Source>

        {/* High & Medium Risk Zones - Pin Points (146 + 132 = 278 zones) */}
        {showRiskZones && highMediumRiskZones && (
          <Source
            id="risk-zones"
            type="geojson"
            data={highMediumRiskZones}
          >
            <Layer
              id="risk-zone-points"
              type="circle"
              paint={{
                'circle-radius': 4,
                'circle-color': [
                  'match',
                  ['get', 'risk_category'],
                  'High', '#ef4444',
                  'Medium', '#f97316',
                  '#94a3b8'
                ],
                'circle-opacity': 0.8,
                'circle-stroke-width': 1,
                'circle-stroke-color': '#ffffff',
                'circle-stroke-opacity': 0.5
              }}
            />
          </Source>
        )}

        {/* Existing Projects - Block Polygons (19 projects) */}
        {showProjects && projectPolygons && (
          <Source
            id="projects"
            type="geojson"
            data={projectPolygons}
          >
            {/* Project block polygons */}
            <Layer
              id="project-polygons"
              type="fill"
              paint={{
                'fill-color': '#3b82f6',
                'fill-opacity': [
                  'case',
                  ['boolean', ['feature-state', 'hover'], false],
                  0.4,
                  0.2
                ]
              }}
            />
            {/* Project block outlines */}
            <Layer
              id="project-outlines"
              type="line"
              paint={{
                'line-color': '#2563eb',
                'line-width': 2,
                'line-opacity': 0.8
              }}
            />
          </Source>
        )}

        {/* Intervention Zone Coverage Areas - 30% Opacity */}
        <Source
          id="intervention-coverage"
          type="geojson"
          data={{
            type: 'FeatureCollection',
            features: INTERVENTION_ZONES.map(zone => ({
              type: 'Feature',
              properties: {
                id: zone.id,
                name: zone.name,
                riskLevel: zone.riskLevel
              },
              geometry: {
                type: 'Point',
                coordinates: [zone.lng, zone.lat]
              }
            }))
          }}
        >
          <Layer
            id="intervention-coverage-circles"
            type="circle"
            paint={{
              'circle-radius': [
                'interpolate',
                ['linear'],
                ['zoom'],
                10, 50,
                15, 200
              ],
              'circle-color': [
                'match',
                ['get', 'riskLevel'],
                'high', '#ef4444',
                'medium', '#f97316',
                'low', '#22c55e',
                '#3b82f6'
              ],
              'circle-opacity': 0.3,
              'circle-stroke-width': 2,
              'circle-stroke-color': [
                'match',
                ['get', 'riskLevel'],
                'high', '#b91c1c',
                'medium', '#c2410c',
                'low', '#15803d',
                '#1d4ed8'
              ],
              'circle-stroke-opacity': 0.5
            }}
          />
        </Source>

        {/* Intervention Zone Markers */}
        {INTERVENTION_ZONES.map((zone) => (
          <Marker
            key={zone.id}
            longitude={zone.lng}
            latitude={zone.lat}
            onClick={() => handleZoneClick(zone)}
          >
            <div
              className={`
                w-6 h-6 rounded-full border-2 cursor-pointer transition-all
                ${selectedZone?.id === zone.id ? 'scale-150' : 'scale-100'}
                ${zone.riskLevel === 'high' ? 'bg-red-500 border-red-700' :
                  zone.riskLevel === 'medium' ? 'bg-orange-500 border-orange-700' :
                  'bg-green-500 border-green-700'}
              `}
              title={zone.name}
            />
          </Marker>
        ))}

        {/* Always Visible Map Controls */}
        <NavigationControl position="top-right" showCompass={true} showZoom={true} />
        <GeolocateControl position="top-right" />
        <ScaleControl position="bottom-right" />
      </Map>

      {/* Project Hover Tooltip */}
      {hoveredProject && cursorPosition && (
        <div
          className="absolute z-[2000] pointer-events-none bg-card/95 backdrop-blur-lg border border-border rounded-lg shadow-xl p-3 max-w-sm"
          style={{
            left: cursorPosition.x + 15,
            top: cursorPosition.y + 15
          }}
        >
          <h3 className="font-semibold text-sm mb-1">{hoveredProject.name}</h3>
          <div className="space-y-1 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Type:</span>
              <span className="font-medium">{hoveredProject.type}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Location:</span>
              <span>{hoveredProject.location}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Status:</span>
              <span className="text-green-600 dark:text-green-400 font-medium">{hoveredProject.status}</span>
            </div>
            <p className="text-muted-foreground mt-2 pt-2 border-t border-border">
              {hoveredProject.description}
            </p>
            {hoveredProject.funding && (
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                {hoveredProject.funding}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-[900] bg-gradient-to-b from-black/60 to-transparent p-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold text-white mb-1">
            Town of Hempstead Coastal Resilience
          </h1>
          <p className="text-white/80 text-sm">
            South Shore Flooding Intervention Analysis • Rockville Centre → Massapequa
          </p>
        </div>
      </div>

      {/* Intervention Zones Panel */}
      <aside
        className={`
          absolute left-0 top-16 bottom-0 z-[1000]
          bg-card/95 backdrop-blur-lg border-r border-border
          transition-all duration-300
          ${isPanelCollapsed ? 'w-12' : 'w-96'}
        `}
      >
        {/* Collapse Toggle */}
        <button
          onClick={() => setIsPanelCollapsed(!isPanelCollapsed)}
          className="absolute -right-3 top-1/2 transform -translate-y-1/2 z-10
                     bg-card border border-border rounded-full p-1.5
                     hover:bg-accent transition-colors"
        >
          {isPanelCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>

        {!isPanelCollapsed && (
          <div className="h-full flex flex-col p-4">
            {/* Controls */}
            <div className="mb-6 space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Sea Level Rise: {seaLevelFeet}ft ({seaLevelFeet === 1 ? '2030' : seaLevelFeet === 3 ? '2050' : seaLevelFeet === 6 ? '2080' : '~2040'})
                </label>
                <input
                  type="range"
                  min="1"
                  max="6"
                  value={seaLevelFeet}
                  onChange={(e) => setSeaLevelFeet(Number(e.target.value))}
                  className="w-full"
                />
              </div>

              {/* Toggle Layers */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="show-risk-zones"
                    checked={showRiskZones}
                    onChange={(e) => setShowRiskZones(e.target.checked)}
                    className="rounded"
                  />
                  <label htmlFor="show-risk-zones" className="text-sm">
                    Show Risk Zone Points (278)
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="show-projects"
                    checked={showProjects}
                    onChange={(e) => setShowProjects(e.target.checked)}
                    className="rounded"
                  />
                  <label htmlFor="show-projects" className="text-sm">
                    Show Project Areas (19)
                  </label>
                </div>
              </div>
            </div>

            {/* Intervention Zones List */}
            <div className="flex-1 overflow-y-auto">
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                Priority Intervention Zones
              </h2>

              <div className="space-y-3">
                {INTERVENTION_ZONES.map((zone) => (
                  <button
                    key={zone.id}
                    onClick={() => handleZoneClick(zone)}
                    className={`
                      w-full text-left p-3 rounded-lg border transition-all
                      ${selectedZone?.id === zone.id
                        ? 'bg-accent border-primary shadow-md ring-2 ring-primary/20'
                        : 'border-border hover:border-primary/50 hover:bg-accent/50'
                      }
                    `}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        {getRiskIcon(zone.riskLevel)}
                        <span className="font-medium text-sm">{zone.name}</span>
                      </div>
                      <span className={`
                        text-xs px-2 py-0.5 rounded-full border
                        ${getRiskColor(zone.riskLevel)}
                      `}>
                        {zone.riskLevel.toUpperCase()}
                      </span>
                    </div>

                    {/* Show details in accordion when selected */}
                    {selectedZone?.id === zone.id && (
                      <div className="mt-3 pt-3 border-t border-border space-y-3 animate-in slide-in-from-top-2">
                        <div>
                          <h4 className="text-xs font-semibold mb-1 text-foreground">Description</h4>
                          <p className="text-xs text-muted-foreground">
                            {zone.description}
                          </p>
                        </div>
                        <div>
                          <h4 className="text-xs font-semibold mb-1 text-foreground">Recommended Action</h4>
                          <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                            {zone.recommendedAction}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 text-xs pt-2 border-t border-border">
                          <span className="font-mono font-semibold text-foreground">
                            Need Index: {zone.needIndex.toFixed(3)}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Show minimal info when not selected */}
                    {selectedZone?.id !== zone.id && (
                      <div className="mt-2 flex items-center gap-2 text-xs">
                        <span className="font-mono font-semibold">
                          Need Index: {zone.needIndex.toFixed(3)}
                        </span>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Stats Footer */}
            <div className="mt-4 pt-4 border-t border-border">
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div>
                  <div className="font-semibold text-red-600">146</div>
                  <div className="text-muted-foreground">High Risk</div>
                </div>
                <div>
                  <div className="font-semibold text-orange-600">132</div>
                  <div className="text-muted-foreground">Medium Risk</div>
                </div>
                <div>
                  <div className="font-semibold text-green-600">19</div>
                  <div className="text-muted-foreground">Projects</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* Selected Zone Details & Legend - Same Width */}
      {selectedZone && !isPanelCollapsed && (
        <div className="absolute bottom-6 left-[25rem] w-96 z-[1000]
                        bg-card/95 backdrop-blur-lg border border-border
                        rounded-lg p-4 shadow-lg">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              {getRiskIcon(selectedZone.riskLevel)}
              <div>
                <h3 className="font-semibold text-lg">{selectedZone.name}</h3>
                <p className="text-sm text-muted-foreground">
                  Need Index: {selectedZone.needIndex.toFixed(3)} • {selectedZone.riskLevel.toUpperCase()} RISK
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedZone(null)}
            >
              ×
            </Button>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <h4 className="text-sm font-medium mb-1">Description</h4>
              <p className="text-sm text-muted-foreground">
                {selectedZone.description}
              </p>
            </div>
            <div>
              <h4 className="text-sm font-medium mb-1">Recommended Action</h4>
              <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">
                {selectedZone.recommendedAction}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Legend - Same Width as Detail Panel */}
      <div className={`
        absolute z-[1000]
        bg-card/95 backdrop-blur-lg border border-border
        rounded-lg p-4 text-xs w-96
        ${selectedZone && !isPanelCollapsed ? 'bottom-6 left-[25rem]' : 'bottom-6 right-6'}
      `}
      style={{ display: selectedZone && !isPanelCollapsed ? 'none' : 'block' }}
      >
        <h4 className="font-semibold mb-3 text-sm">Risk Levels</h4>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <span>High Risk (Need Index ≥ 0.7)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-orange-500"></div>
            <span>Medium Risk (0.4 - 0.7)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span>Low Risk (&lt; 0.4)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500 border-2 border-white"></div>
            <span>Existing Project</span>
          </div>
        </div>
      </div>
    </div>
  )
}
