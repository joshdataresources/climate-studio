import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import './water-access.css'

console.log('Water access script loaded')
console.log('mapboxgl:', mapboxgl)
console.log('Map container:', document.getElementById('map'))

mapboxgl.accessToken = 'pk.eyJ1Ijoiam9zaC1idXRsZXIiLCJhIjoiY2x4MWY4bzVxMGw1MDJsczhkMzUwZ2I4dCJ9.OI5agPaD6UzeHa_9z-E-8Q'

// Aquifer zones with capacity degradation over time
const aquiferZones = [
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

function calculateCapacity(zone: typeof aquiferZones[0], year: number): number {
  const yearsSince2024 = year - 2024
  const currentCapacity = zone.baseCapacity - (zone.degradationRate * yearsSince2024)
  return Math.max(5, Math.min(100, currentCapacity))
}

function updateAquiferLayers(map: mapboxgl.Map, year: number) {
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

  const geojsonData: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: features
  }

  const source = map.getSource('aquifers') as mapboxgl.GeoJSONSource
  if (source) {
    source.setData(geojsonData)
  }
}

// Initialize map
console.log('Creating map...')
const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/dark-v11',
  center: [-73.5, 40.8],
  zoom: 9
})

console.log('Map created:', map)
map.addControl(new mapboxgl.NavigationControl(), 'top-right')

map.on('load', () => {
  // Add aquifer source
  map.addSource('aquifers', {
    type: 'geojson',
    data: {
      type: 'FeatureCollection',
      features: []
    }
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

  // Initialize with 2024 data
  updateAquiferLayers(map, 2024)

  // Add popup on click
  map.on('click', 'aquifer-fill', (e) => {
    if (!e.features || e.features.length === 0) return
    const properties = e.features[0].properties
    if (!properties) return

    new mapboxgl.Popup()
      .setLngLat(e.lngLat)
      .setHTML(`
        <strong>${properties.name}</strong><br>
        Capacity: ${properties.capacity}%
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
})

// Year slider control
const yearSlider = document.getElementById('yearSlider') as HTMLInputElement
const yearDisplay = document.getElementById('yearDisplay') as HTMLDivElement

if (yearSlider && yearDisplay) {
  yearSlider.addEventListener('input', (e) => {
    const year = parseInt((e.target as HTMLInputElement).value)
    yearDisplay.textContent = year.toString()
    updateAquiferLayers(map, year)
  })
}
