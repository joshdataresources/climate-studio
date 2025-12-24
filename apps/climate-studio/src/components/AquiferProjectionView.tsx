import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { useTheme } from '../contexts/ThemeContext'
import aquiferProjectionsData from '../data/aquifer-projections.json'

// Use environment variable or fallback to the token from DeckGLMap
const MAPBOX_ACCESS_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || 'pk.eyJ1Ijoiam9zaHVhYmJ1dGxlciIsImEiOiJjbWcwNXpyNXUwYTdrMmtva2tiZ2NjcGxhIn0.Fc3d_CloJGiw9-BE4nI_Kw'
mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN

// Default view for US
const DEFAULT_VIEW = {
  center: [-98, 39] as [number, number], // Center of US
  zoom: 4 // Zoomed out to show entire US
}

// Aquifer capacity categories
type AquiferCapacity = 'healthy' | 'moderate' | 'stressed' | 'critical'

interface AquiferFeature extends GeoJSON.Feature {
  properties: {
    name: string
    state?: string
    volume_data?: {
      current_vol_gallons?: number | string
      depletion_rate_yr?: number | string
      projections?: {
        [key: string]: string
      }
      status?: string
    }
  }
}

interface AquiferProjectionViewProps {
  aquiferData?: GeoJSON.FeatureCollection
}

// Calculate depletion percentage based on year and aquifer data
function calculateDepletionPercentage(
  aquifer: AquiferFeature,
  year: number
): number {
  const volumeData = aquifer.properties.volume_data
  if (!volumeData) return 0

  // For aquifers with numeric data, calculate based on depletion rate
  if (
    typeof volumeData.current_vol_gallons === 'number' &&
    typeof volumeData.depletion_rate_yr === 'number'
  ) {
    const yearsFrom2024 = year - 2024
    const totalDepletion = volumeData.depletion_rate_yr * yearsFrom2024
    const currentVol = volumeData.current_vol_gallons
    const depletionPercent = Math.min(100, Math.max(0, (totalDepletion / currentVol) * 100))
    return depletionPercent
  }

  // For aquifers with status or projections, estimate based on year
  const status = volumeData.status?.toLowerCase() || ''
  
  // Map status to depletion percentage
  if (status.includes('stable')) {
    return Math.min(25, (year - 2024) * 0.5) // Very slow depletion
  }
  if (status.includes('declining') || status.includes('stressed')) {
    return Math.min(75, 25 + (year - 2024) * 1.5) // Moderate to high depletion
  }
  if (status.includes('critical')) {
    return Math.min(100, 50 + (year - 2024) * 2) // High depletion
  }

  // Default: moderate depletion
  return Math.min(50, (year - 2024) * 1)
}

// Get color based on depletion percentage (green to red gradient)
function getDepletionColor(depletionPercent: number): string {
  // Green (0%) -> Yellow (50%) -> Orange (75%) -> Red (100%)
  if (depletionPercent < 25) {
    // Green to light green
    const t = depletionPercent / 25
    const r = Math.round(34 + (144 - 34) * t) // 34 -> 144
    const g = Math.round(197 + (238 - 197) * t) // 197 -> 238
    const b = Math.round(94 + (144 - 94) * t) // 94 -> 144
    return `rgb(${r}, ${g}, ${b})`
  } else if (depletionPercent < 50) {
    // Light green to yellow
    const t = (depletionPercent - 25) / 25
    const r = Math.round(144 + (251 - 144) * t) // 144 -> 251
    const g = Math.round(238 + (191 - 238) * t) // 238 -> 191
    const b = Math.round(144 + (36 - 144) * t) // 144 -> 36
    return `rgb(${r}, ${g}, ${b})`
  } else if (depletionPercent < 75) {
    // Yellow to orange
    const t = (depletionPercent - 50) / 25
    const r = Math.round(251 + (251 - 251) * t) // 251 -> 251
    const g = Math.round(191 + (146 - 191) * t) // 191 -> 146
    const b = Math.round(36 + (60 - 36) * t) // 36 -> 60
    return `rgb(${r}, ${g}, ${b})`
  } else {
    // Orange to red
    const t = (depletionPercent - 75) / 25
    const r = Math.round(251 + (239 - 251) * t) // 251 -> 239
    const g = Math.round(146 + (68 - 146) * t) // 146 -> 68
    const b = Math.round(60 + (68 - 60) * t) // 60 -> 68
    return `rgb(${r}, ${g}, ${b})`
  }
}

// Get capacity category from depletion percentage
function getCapacityCategory(depletionPercent: number): AquiferCapacity {
  if (depletionPercent < 25) return 'healthy'
  if (depletionPercent < 50) return 'moderate'
  if (depletionPercent < 75) return 'stressed'
  return 'critical'
}

export default function AquiferProjectionView({ aquiferData: propAquiferData }: AquiferProjectionViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [selectedYear, setSelectedYear] = useState(2024)
  const [selectedAquifer, setSelectedAquifer] = useState<AquiferFeature | null>(null)
  const [aquiferData, setAquiferData] = useState<GeoJSON.FeatureCollection | null>(propAquiferData || null)

  // Use theme context for map style
  const { theme } = useTheme()
  
  // Determine map style based on theme
  const mapStyle = theme === 'light' 
    ? 'mapbox://styles/mapbox/light-v11' 
    : 'mapbox://styles/mapbox/dark-v11'

  // Load aquifer data if not provided
  useEffect(() => {
    if (propAquiferData) {
      setAquiferData(propAquiferData)
    } else if (!aquiferData) {
      // Use imported JSON data
      setAquiferData(aquiferProjectionsData as GeoJSON.FeatureCollection)
    }
  }, [propAquiferData])

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: mapStyle,
      center: DEFAULT_VIEW.center,
      zoom: DEFAULT_VIEW.zoom,
      attributionControl: false
    })

    mapRef.current = map

    map.on('load', () => {
      setMapLoaded(true)
    })

    map.on('error', (e) => {
      console.error('Mapbox error:', e)
    })

    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, []) // Only run once on mount

  // Update map style when theme changes
  useEffect(() => {
    if (mapRef.current && mapLoaded) {
      mapRef.current.setStyle(mapStyle)
    }
  }, [mapStyle, mapLoaded])

  // Update aquifer layer colors based on selected year
  useEffect(() => {
    if (!mapRef.current || !mapLoaded || !aquiferData) return

    const map = mapRef.current

    // Remove existing layers and source if they exist
    if (map.getLayer('aquifer-fill')) {
      map.removeLayer('aquifer-fill')
    }
    if (map.getLayer('aquifer-outline')) {
      map.removeLayer('aquifer-outline')
    }
    if (map.getLayer('aquifer-selected')) {
      map.removeLayer('aquifer-selected')
    }
    if (map.getSource('aquifers')) {
      map.removeSource('aquifers')
    }

    // Calculate colors for each aquifer based on selected year
    const featuresWithColors = aquiferData.features.map((feature) => {
      const aquifer = feature as AquiferFeature
      const depletionPercent = calculateDepletionPercentage(aquifer, selectedYear)
      const color = getDepletionColor(depletionPercent)
      
      return {
        ...feature,
        properties: {
          ...feature.properties,
          _depletionPercent: depletionPercent,
          _color: color,
          _capacity: getCapacityCategory(depletionPercent)
        }
      }
    })

    const dataWithColors: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: featuresWithColors
    }

    // Add source
    map.addSource('aquifers', {
      type: 'geojson',
      data: dataWithColors
    })

    // Add fill layer
    map.addLayer({
      id: 'aquifer-fill',
      type: 'fill',
      source: 'aquifers',
      paint: {
        'fill-color': ['get', '_color'],
        'fill-opacity': 0.6
      }
    })

    // Add outline layer
    map.addLayer({
      id: 'aquifer-outline',
      type: 'line',
      source: 'aquifers',
      paint: {
        'line-color': '#ffffff',
        'line-width': 1,
        'line-opacity': 0.3
      }
    })

    // Add selected layer (initially empty, will be populated on selection)
    map.addSource('aquifer-selected-source', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: []
      }
    })

    map.addLayer({
      id: 'aquifer-selected',
      type: 'line',
      source: 'aquifer-selected-source',
      paint: {
        'line-color': '#ffffff',
        'line-width': 3,
        'line-opacity': 1
      }
    })

    // Add click handler
    map.on('click', 'aquifer-fill', (e) => {
      if (e.features && e.features.length > 0) {
        const feature = e.features[0] as AquiferFeature
        setSelectedAquifer(feature)

        // Update selected layer
        const selectedSource = map.getSource('aquifer-selected-source') as mapboxgl.GeoJSONSource
        if (selectedSource) {
          selectedSource.setData({
            type: 'FeatureCollection',
            features: [feature]
          })
        }
      }
    })

    // Change cursor on hover
    map.on('mouseenter', 'aquifer-fill', () => {
      map.getCanvas().style.cursor = 'pointer'
    })

    map.on('mouseleave', 'aquifer-fill', () => {
      map.getCanvas().style.cursor = ''
    })

    return () => {
      map.off('click', 'aquifer-fill')
      map.off('mouseenter', 'aquifer-fill')
      map.off('mouseleave', 'aquifer-fill')
    }
  }, [mapLoaded, aquiferData, selectedYear])

  // Update selected aquifer highlight when selection changes
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return

    const map = mapRef.current
    const selectedSource = map.getSource('aquifer-selected-source') as mapboxgl.GeoJSONSource

    if (selectedSource) {
      if (selectedAquifer) {
        selectedSource.setData({
          type: 'FeatureCollection',
          features: [selectedAquifer]
        })
      } else {
        selectedSource.setData({
          type: 'FeatureCollection',
          features: []
        })
      }
    }
  }, [selectedAquifer, mapLoaded])

  // Get projection text for selected year
  const getProjectionText = useCallback((aquifer: AquiferFeature, year: number): string => {
    const projections = aquifer.properties.volume_data?.projections
    if (!projections) return 'No projection data available'

    // Find the closest projection key
    const yearKeys = [
      { key: '10_yr_2035', year: 2035 },
      { key: '25_yr_2050', year: 2050 },
      { key: '50_yr_2075', year: 2075 },
      { key: '75_yr_2100', year: 2100 },
      { key: '100_yr_2125', year: 2125 }
    ]

    // Find the appropriate projection
    let selectedKey = yearKeys[0].key
    for (const { key, year: keyYear } of yearKeys) {
      if (year <= keyYear) {
        selectedKey = key
        break
      }
    }
    // If year is beyond all keys, use the last one
    if (year > yearKeys[yearKeys.length - 1].year) {
      selectedKey = yearKeys[yearKeys.length - 1].key
    }

    return projections[selectedKey] || 'No projection data available'
  }, [])

  return (
    <div style={{ height: '100vh', width: '100%', display: 'flex', overflow: 'hidden' }}>
      {/* Left Control Panel */}
      <aside className="widget-container" style={{
        width: '320px',
        height: '100%',
        overflowY: 'auto',
        zIndex: 1000,
        position: 'relative',
        borderRadius: 0,
        borderRight: '1px solid rgba(63, 63, 63, 1)'
      }}>
        <div style={{ padding: '20px' }}>
          {/* Groundwater Projection Year */}
          <div style={{ marginBottom: '32px' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '12px'
            }}>
              <h3 style={{
                margin: 0,
                fontSize: '14px',
                fontWeight: 600,
                color: 'var(--foreground)'
              }}>
                Groundwater Projection Year
              </h3>
              <div style={{
                fontSize: '18px',
                fontWeight: 700,
                color: '#3b82f6'
              }}>
                {selectedYear}
              </div>
            </div>

            {/* Slider */}
            <input
              type="range"
              min="2024"
              max="2100"
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              style={{
                width: '100%',
                height: '8px',
                borderRadius: '4px',
                background: 'linear-gradient(to right, #22c55e 0%, #84cc16 25%, #eab308 50%, #f97316 75%, #dc2626 100%)',
                outline: 'none',
                cursor: 'pointer',
                WebkitAppearance: 'none',
                appearance: 'none'
              }}
            />
            <style>{`
              input[type="range"]::-webkit-slider-thumb {
                -webkit-appearance: none;
                appearance: none;
                width: 20px;
                height: 20px;
                border-radius: 50%;
                background: white;
                border: 2px solid #3b82f6;
                cursor: pointer;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
              }
              input[type="range"]::-moz-range-thumb {
                width: 20px;
                height: 20px;
                border-radius: 50%;
                background: white;
                border: 2px solid #3b82f6;
                cursor: pointer;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
              }
            `}</style>

            {/* Year labels */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: '8px',
              fontSize: '11px',
              color: 'rgba(255, 255, 255, 0.6)'
            }}>
              <span>2024</span>
              <span>2050</span>
              <span>2075</span>
              <span>2100</span>
            </div>
          </div>

          {/* Aquifer Capacity Legend */}
          <div>
            <h3 style={{
              margin: '0 0 16px',
              fontSize: '14px',
              fontWeight: 600,
              color: 'var(--foreground)'
            }}>
              Aquifer Capacity
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[
                { color: '#22c55e', label: 'Healthy (75-100%)', category: 'healthy' as AquiferCapacity },
                { color: '#3b82f6', label: 'Moderate (50-75%)', category: 'moderate' as AquiferCapacity },
                { color: '#f59e0b', label: 'Stressed (25-50%)', category: 'stressed' as AquiferCapacity },
                { color: '#dc2626', label: 'Critical (<25%)', category: 'critical' as AquiferCapacity }
              ].map(({ color, label }) => (
                <div key={label} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}>
                  <div style={{
                    width: '16px',
                    height: '16px',
                    background: color,
                    borderRadius: '2px',
                    flexShrink: 0
                  }} />
                  <span style={{
                    fontSize: '13px',
                    color: 'rgba(255, 255, 255, 0.8)'
                  }}>
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </aside>

      {/* Main Map Area */}
      <main style={{
        flex: 1,
        position: 'relative',
        overflow: 'hidden'
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
            bottom: 0
          }}
        />

        {/* Attribution */}
        <div style={{
          position: 'absolute',
          bottom: '12px',
          left: '12px',
          background: 'rgba(0, 0, 0, 0.7)',
          padding: '6px 10px',
          borderRadius: '4px',
          fontSize: '10px',
          color: 'rgba(255, 255, 255, 0.6)',
          zIndex: 1000
        }}>
          Data: USGS Principal Aquifers - Volume & Projections
        </div>
      </main>

      {/* Right Details Panel */}
      <aside className="widget-container" style={{
        width: '360px',
        height: '100%',
        overflowY: 'auto',
        zIndex: 1000,
        position: 'relative',
        borderRadius: 0,
        borderLeft: '1px solid rgba(63, 63, 63, 1)'
      }}>
        {selectedAquifer ? (
          <div style={{ padding: '20px' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: '20px'
            }}>
              <h2 style={{
                margin: 0,
                fontSize: '18px',
                fontWeight: 700,
                color: 'var(--foreground)',
                flex: 1
              }}>
                {selectedAquifer.properties.name}
              </h2>
              <button
                onClick={() => setSelectedAquifer(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'rgba(255, 255, 255, 0.6)',
                  cursor: 'pointer',
                  fontSize: '20px',
                  padding: '4px',
                  lineHeight: 1
                }}
              >
                ×
              </button>
            </div>

            {selectedAquifer.properties.state && (
              <div style={{
                marginBottom: '20px',
                padding: '12px',
                background: 'rgba(59, 130, 246, 0.1)',
                borderRadius: '8px',
                fontSize: '13px',
                color: 'rgba(255, 255, 255, 0.8)'
              }}>
                <strong>State/Region:</strong> {selectedAquifer.properties.state}
              </div>
            )}

            {selectedAquifer.properties.volume_data && (
              <div style={{ marginBottom: '20px' }}>
                <h3 style={{
                  margin: '0 0 12px',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: 'var(--foreground)'
                }}>
                  Volume Data
                </h3>

                {selectedAquifer.properties.volume_data.current_vol_gallons && (
                  <div style={{
                    marginBottom: '8px',
                    fontSize: '13px',
                    color: 'rgba(255, 255, 255, 0.8)'
                  }}>
                    <strong>Current Volume:</strong>{' '}
                    {typeof selectedAquifer.properties.volume_data.current_vol_gallons === 'number'
                      ? `${(selectedAquifer.properties.volume_data.current_vol_gallons / 1e12).toFixed(2)} Trillion gallons`
                      : selectedAquifer.properties.volume_data.current_vol_gallons}
                  </div>
                )}

                {selectedAquifer.properties.volume_data.depletion_rate_yr && (
                  <div style={{
                    marginBottom: '8px',
                    fontSize: '13px',
                    color: 'rgba(255, 255, 255, 0.8)'
                  }}>
                    <strong>Depletion Rate:</strong>{' '}
                    {typeof selectedAquifer.properties.volume_data.depletion_rate_yr === 'number'
                      ? `${(selectedAquifer.properties.volume_data.depletion_rate_yr / 1e9).toFixed(2)} Billion gallons/year`
                      : selectedAquifer.properties.volume_data.depletion_rate_yr}
                  </div>
                )}

                {selectedAquifer.properties.volume_data.status && (
                  <div style={{
                    marginBottom: '8px',
                    fontSize: '13px',
                    color: 'rgba(255, 255, 255, 0.8)'
                  }}>
                    <strong>Status:</strong> {selectedAquifer.properties.volume_data.status}
                  </div>
                )}
              </div>
            )}

            {selectedAquifer.properties.volume_data?.projections && (
              <div>
                <h3 style={{
                  margin: '0 0 12px',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: 'var(--foreground)'
                }}>
                  Projection for {selectedYear}
                </h3>

                <div style={{
                  padding: '12px',
                  background: 'rgba(40, 40, 40, 0.6)',
                  borderRadius: '8px',
                  fontSize: '13px',
                  color: 'rgba(255, 255, 255, 0.8)',
                  lineHeight: 1.6
                }}>
                  {getProjectionText(selectedAquifer, selectedYear)}
                </div>

                {/* All Projections */}
                <div style={{ marginTop: '20px' }}>
                  <h3 style={{
                    margin: '0 0 12px',
                    fontSize: '14px',
                    fontWeight: 600,
                    color: 'var(--foreground)'
                  }}>
                    All Projections
                  </h3>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {Object.entries(selectedAquifer.properties.volume_data.projections).map(([key, value]) => {
                      const year = key.includes('2035') ? 2035 :
                                   key.includes('2050') ? 2050 :
                                   key.includes('2075') ? 2075 :
                                   key.includes('2100') ? 2100 :
                                   key.includes('2125') ? 2125 : null

                      return (
                        <div key={key} style={{
                          padding: '12px',
                          background: year && year === selectedYear
                            ? 'rgba(59, 130, 246, 0.2)'
                            : 'rgba(40, 40, 40, 0.6)',
                          borderRadius: '8px',
                          border: year && year === selectedYear
                            ? '1px solid #3b82f6'
                            : '1px solid transparent'
                        }}>
                          <div style={{
                            fontSize: '12px',
                            fontWeight: 600,
                            color: '#3b82f6',
                            marginBottom: '6px'
                          }}>
                            {year ? `${year}` : key.replace(/_/g, ' ')}
                          </div>
                          <div style={{
                            fontSize: '12px',
                            color: 'rgba(255, 255, 255, 0.7)',
                            lineHeight: 1.5
                          }}>
                            {value}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div style={{
            padding: '20px',
            textAlign: 'center',
            color: 'rgba(255, 255, 255, 0.5)',
            marginTop: '40px'
          }}>
            <p style={{ fontSize: '14px' }}>
              Click on an aquifer on the map to view details
            </p>
          </div>
        )}
      </aside>
    </div>
  )
}

