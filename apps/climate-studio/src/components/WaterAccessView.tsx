import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

mapboxgl.accessToken = 'pk.eyJ1Ijoiam9zaC1idXRsZXIiLCJhIjoiY2x4MWY4bzVxMGw1MDJsczhkMzUwZ2I4dCJ9.OI5agPaD6UzeHa_9z-E-8Q'

interface AquiferZone {
  name: string
  coords: [number, number][]
  baseCapacity: number
  degradationRate: number
}

const aquiferZones: AquiferZone[] = [
  {
    name: 'Lloyd Aquifer - North',
    coords: [[-73.8, 40.85], [-73.4, 40.85], [-73.4, 41.0], [-73.8, 41.0], [-73.8, 40.85]],
    baseCapacity: 85,
    degradationRate: 0.4
  },
  {
    name: 'Lloyd Aquifer - Central',
    coords: [[-73.7, 40.7], [-73.3, 40.7], [-73.3, 40.85], [-73.7, 40.85], [-73.7, 40.7]],
    baseCapacity: 72,
    degradationRate: 0.6
  },
  {
    name: 'Magothy Aquifer - East',
    coords: [[-73.3, 40.6], [-73.0, 40.6], [-73.0, 40.9], [-73.3, 40.9], [-73.3, 40.6]],
    baseCapacity: 55,
    degradationRate: 0.8
  },
  {
    name: 'Magothy Aquifer - West',
    coords: [[-73.9, 40.6], [-73.6, 40.6], [-73.6, 40.8], [-73.9, 40.8], [-73.9, 40.6]],
    baseCapacity: 45,
    degradationRate: 1.0
  }
]

function getCapacityColor(capacity: number): string {
  if (capacity >= 75) return '#4CAF50' // Healthy - green
  if (capacity >= 50) return '#FFC107' // Moderate - yellow
  if (capacity >= 25) return '#FF9800' // Stressed - orange
  return '#F44336' // Critical - red
}

function calculateCapacity(zone: AquiferZone, year: number): number {
  const yearsSince2024 = year - 2024
  const currentCapacity = zone.baseCapacity - (zone.degradationRate * yearsSince2024)
  return Math.max(5, Math.min(100, currentCapacity))
}

function buildGeoJSON(year: number): GeoJSON.FeatureCollection {
  const features = aquiferZones.map(zone => {
    const capacity = calculateCapacity(zone, year)
    return {
      type: 'Feature' as const,
      geometry: {
        type: 'Polygon' as const,
        coordinates: [zone.coords]
      },
      properties: {
        name: zone.name,
        capacity: capacity.toFixed(1),
        color: getCapacityColor(capacity)
      }
    }
  })

  return {
    type: 'FeatureCollection',
    features
  }
}

const legendItems = [
  { color: '#4CAF50', label: 'Healthy (75-100%)' },
  { color: '#FFC107', label: 'Moderate (50-75%)' },
  { color: '#FF9800', label: 'Stressed (25-50%)' },
  { color: '#F44336', label: 'Critical (<25%)' }
]

export default function WaterAccessView() {
  const mapContainer = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const [year, setYear] = useState(2024)
  const [mapLoaded, setMapLoaded] = useState(false)

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [-73.5, 40.8],
      zoom: 9,
    })

    map.addControl(new mapboxgl.NavigationControl(), 'top-right')

    map.on('load', () => {
      // Add aquifer source
      map.addSource('aquifers', {
        type: 'geojson',
        data: buildGeoJSON(2024)
      })

      // Add fill layer
      map.addLayer({
        id: 'aquifer-fill',
        type: 'fill',
        source: 'aquifers',
        paint: {
          'fill-color': ['get', 'color'],
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
          'line-width': 2,
          'line-opacity': 0.8
        }
      })

      setMapLoaded(true)
    })

    // Add popup on click
    map.on('click', 'aquifer-fill', (e) => {
      if (!e.features || e.features.length === 0) return
      const properties = e.features[0].properties
      if (!properties) return

      new mapboxgl.Popup()
        .setLngLat(e.lngLat)
        .setHTML(`
          <div style="font-family: system-ui, sans-serif;">
            <strong style="font-size: 14px;">${properties.name}</strong><br/>
            <span style="color: ${properties.color}; font-weight: 600;">
              Capacity: ${properties.capacity}%
            </span>
          </div>
        `)
        .addTo(map)
    })

    // Change cursor on hover
    map.on('mouseenter', 'aquifer-fill', () => {
      map.getCanvas().style.cursor = 'pointer'
    })

    map.on('mouseleave', 'aquifer-fill', () => {
      map.getCanvas().style.cursor = ''
    })

    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  // Update layers when year changes
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return

    const source = mapRef.current.getSource('aquifers') as mapboxgl.GeoJSONSource
    if (source) {
      source.setData(buildGeoJSON(year))
    }
  }, [year, mapLoaded])

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: '#1a1a2e' }}>
      <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />

      {/* Control Panel */}
      <div style={{
        position: 'absolute',
        top: 20,
        left: 20,
        background: 'rgba(0, 0, 0, 0.9)',
        backdropFilter: 'blur(10px)',
        padding: 24,
        borderRadius: 16,
        color: 'white',
        width: 300,
        zIndex: 10,
        border: '1px solid rgba(255, 255, 255, 0.1)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)'
      }}>
        <h3 style={{ 
          margin: '0 0 8px', 
          fontSize: 18, 
          fontWeight: 600,
          letterSpacing: '-0.02em'
        }}>
          Groundwater Projections
        </h3>
        <p style={{ 
          margin: '0 0 20px', 
          fontSize: 13, 
          color: 'rgba(255, 255, 255, 0.6)',
          lineHeight: 1.5
        }}>
          Visualizing aquifer capacity degradation across Long Island region
        </p>

        {/* Year Display */}
        <div style={{ 
          fontSize: 48, 
          fontWeight: 700, 
          marginBottom: 8,
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: '-0.03em'
        }}>
          {year}
        </div>

        {/* Slider */}
        <input
          type="range"
          min={2024}
          max={2100}
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          style={{
            width: '100%',
            marginBottom: 8,
            accentColor: '#437EFC',
            height: 6,
            cursor: 'pointer'
          }}
        />

        {/* Year labels */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          fontSize: 11, 
          color: 'rgba(255, 255, 255, 0.5)',
          marginBottom: 24
        }}>
          <span>2024</span>
          <span>2050</span>
          <span>2075</span>
          <span>2100</span>
        </div>

        {/* Legend */}
        <div style={{ 
          fontSize: 12, 
          color: 'rgba(255, 255, 255, 0.6)', 
          marginBottom: 12,
          fontWeight: 500,
          textTransform: 'uppercase',
          letterSpacing: '0.05em'
        }}>
          Aquifer Capacity
        </div>

        {legendItems.map(({ color, label }) => (
          <div key={label} style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 10, 
            marginBottom: 8 
          }}>
            <div style={{ 
              width: 16, 
              height: 16, 
              background: color, 
              borderRadius: 4,
              flexShrink: 0
            }} />
            <span style={{ fontSize: 13 }}>{label}</span>
          </div>
        ))}
      </div>

      {/* Attribution */}
      <div style={{
        position: 'absolute',
        bottom: 20,
        left: 20,
        background: 'rgba(0, 0, 0, 0.7)',
        padding: '8px 12px',
        borderRadius: 6,
        fontSize: 11,
        color: 'rgba(255, 255, 255, 0.6)',
        zIndex: 10
      }}>
        Data: Simulated aquifer projections • Model: Linear degradation
      </div>
    </div>
  )
}

