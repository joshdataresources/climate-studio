/**
 * AI Data Center Layer Setup for Climate Suite
 *
 * Adds AI data center locations with ⚡ electricity symbols to the map.
 * Uses circle markers with lightning bolt text overlay for reliable rendering.
 */

import type { Map as MapboxMap } from 'mapbox-gl'

export interface DataCenterFeature {
  type: 'Feature'
  geometry: {
    type: 'Point'
    coordinates: [number, number]
  }
  properties: {
    id: string
    name: string
    company: string
    city: string
    state: string
    purpose: string
    status: string
    power_capacity_mw: number
    grid_strain: string
    investment_usd: number
    gpu_count: number
  }
}

/**
 * Setup AI data center layer on the Mapbox map
 */
export function setupDataCenterLayer(
  map: MapboxMap,
  datacentersData: any,
  onDataCenterClick: (datacenter: any) => void
) {
  // Convert data to GeoJSON
  const geojson = {
    type: 'FeatureCollection' as const,
    features: datacentersData.datacenters.map((dc: any) => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: [dc.location.coordinates.lon, dc.location.coordinates.lat]
      },
      properties: {
        id: dc.id,
        name: dc.name,
        company: dc.company,
        city: dc.location.city,
        state: dc.location.state,
        purpose: dc.purpose,
        status: dc.status,
        power_capacity_mw: dc.power_capacity_mw,
        grid_strain: dc.environmental_impact?.grid_strain || 'moderate',
        investment_usd: dc.investment_usd,
        gpu_count: dc.gpu_count
      }
    }))
  }

  console.log('⚡ Setting up AI data center layer with', geojson.features.length, 'data centers')

  // Add data source
  if (map.getSource('ai-datacenters')) {
    (map.getSource('ai-datacenters') as any).setData(geojson)
    return // Layers already exist, just update data
  }

  map.addSource('ai-datacenters', {
    type: 'geojson',
    data: geojson,
    generateId: true
  })

  // Layer 1: Outer glow ring — color by grid strain, sized by power capacity
  map.addLayer({
    id: 'datacenter-glow',
    type: 'circle',
    source: 'ai-datacenters',
    paint: {
      'circle-radius': [
        'interpolate',
        ['linear'],
        ['get', 'power_capacity_mw'],
        100, 18,
        500, 26,
        1000, 34,
        1500, 42
      ],
      'circle-color': [
        'match',
        ['get', 'grid_strain'],
        'critical', '#ef4444',
        'high', '#f97316',
        'moderate', '#eab308',
        'low', '#22c55e',
        '#eab308'
      ],
      'circle-opacity': [
        'case',
        ['boolean', ['feature-state', 'hover'], false],
        0.45,
        0.2
      ],
      'circle-blur': 0.7
    }
  })

  // Layer 2: Solid dark circle background for the ⚡ icon
  map.addLayer({
    id: 'datacenter-circle',
    type: 'circle',
    source: 'ai-datacenters',
    paint: {
      'circle-radius': [
        'interpolate',
        ['linear'],
        ['zoom'],
        3, 8,
        6, 12,
        10, 16,
        14, 20
      ],
      'circle-color': '#1a1a2e',
      'circle-stroke-width': [
        'case',
        ['boolean', ['feature-state', 'selected'], false],
        3,
        ['boolean', ['feature-state', 'hover'], false],
        2.5,
        2
      ],
      'circle-stroke-color': [
        'match',
        ['get', 'grid_strain'],
        'critical', '#ef4444',
        'high', '#f97316',
        'moderate', '#eab308',
        'low', '#22c55e',
        '#eab308'
      ],
      'circle-opacity': 0.95
    }
  })

  // Layer 3: ⚡ lightning bolt symbol on top of the circle
  map.addLayer({
    id: 'datacenter-zap',
    type: 'symbol',
    source: 'ai-datacenters',
    layout: {
      'text-field': '⚡',
      'text-size': [
        'interpolate',
        ['linear'],
        ['zoom'],
        3, 12,
        6, 16,
        10, 20,
        14, 24
      ],
      'text-allow-overlap': true,
      'text-ignore-placement': true,
      'text-anchor': 'center',
      'text-offset': [0, 0]
    },
    paint: {
      'text-opacity': 1
    }
  })

  // Layer 4: Company name labels below the marker
  map.addLayer({
    id: 'datacenter-labels',
    type: 'symbol',
    source: 'ai-datacenters',
    layout: {
      'text-field': [
        'concat',
        ['get', 'company'],
        ' · ',
        ['to-string', ['get', 'power_capacity_mw']],
        'MW'
      ],
      'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
      'text-size': [
        'interpolate',
        ['linear'],
        ['zoom'],
        3, 9,
        8, 11,
        12, 13
      ],
      'text-offset': [0, 2.2],
      'text-anchor': 'top',
      'text-max-width': 14,
      'text-optional': true
    },
    paint: {
      'text-color': '#fbbf24',
      'text-halo-color': '#000000',
      'text-halo-width': 1.5,
      'text-halo-blur': 1
    }
  })

  console.log('✅ AI Data Center layers added: datacenter-glow, datacenter-circle, datacenter-zap, datacenter-labels')

  // ── Click handler ──
  let hoveredDCId: string | number | null = null

  // Handle clicks on circle layer (most reliable click target)
  map.on('click', 'datacenter-circle', (e) => {
    if (!e.features || e.features.length === 0) return

    const feature = e.features[0]
    const dcId = feature.properties?.id
    const featureId = feature.id

    if (featureId === undefined) return

    // Clear previous selection
    try {
      map.removeFeatureState({ source: 'ai-datacenters' })
    } catch (err) {
      console.warn('Could not clear datacenter feature states:', err)
    }

    // Set new selection
    map.setFeatureState(
      { source: 'ai-datacenters', id: featureId },
      { selected: true }
    )
    map.triggerRepaint()

    // Find full datacenter data and call callback
    const fullDC = datacentersData.datacenters.find((dc: any) => dc.id === dcId)
    if (fullDC) {
      console.log('⚡ Data center selected:', fullDC.name)
      onDataCenterClick(fullDC)
    }
  })

  // ── Hover effects ──
  map.on('mouseenter', 'datacenter-circle', (e) => {
    map.getCanvas().style.cursor = 'pointer'
    if (e.features && e.features.length > 0) {
      const featureId = e.features[0].id
      if (featureId !== undefined && featureId !== hoveredDCId) {
        if (hoveredDCId !== null) {
          map.setFeatureState(
            { source: 'ai-datacenters', id: hoveredDCId },
            { hover: false }
          )
        }
        hoveredDCId = featureId
        map.setFeatureState(
          { source: 'ai-datacenters', id: featureId },
          { hover: true }
        )
      }
    }
  })

  map.on('mouseleave', 'datacenter-circle', () => {
    map.getCanvas().style.cursor = ''
    if (hoveredDCId !== null) {
      map.setFeatureState(
        { source: 'ai-datacenters', id: hoveredDCId },
        { hover: false }
      )
      hoveredDCId = null
    }
  })

  // Clear selection when clicking elsewhere on the map
  map.on('click', (e) => {
    const features = map.queryRenderedFeatures(e.point, {
      layers: ['datacenter-circle', 'datacenter-glow']
    })
    if (features.length === 0) {
      try {
        map.removeFeatureState({ source: 'ai-datacenters' })
      } catch (err) {
        console.warn('Could not clear datacenter feature states:', err)
      }
      map.triggerRepaint()
    }
  })

  console.log('✅ AI Data Center layer setup complete!')
}
