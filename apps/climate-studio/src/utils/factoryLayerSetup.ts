/**
 * Factory Layer Setup for Climate Suite
 *
 * This file contains the code to add factory locations with environmental impact data
 * to your WaterAccessView map. Follow the integration instructions below.
 *
 * INTEGRATION INSTRUCTIONS:
 * -------------------------
 *
 * 1. Import the necessary types and factory data at the top of WaterAccessView.tsx:
 *    ```typescript
 *    import { SelectedFactory } from './panels/FactoryDetailsPanel'
 *    import factoriesData from '../data/factories.json'
 *    ```
 *
 * 2. Add state for selected factory (alongside selectedAquifer state around line 530):
 *    ```typescript
 *    const [selectedFactory, setSelectedFactory] = useState<SelectedFactory | null>(null)
 *    const [selectedFactoryId, setSelectedFactoryId] = useState<string | null>(null)
 *    ```
 *
 * 3. Add the factory layer setup inside the map load callback (after aquifer layer setup).
 *    Copy the `setupFactoryLayer` function below and call it after aquifer setup.
 *
 * 4. Add the FactoryDetailsPanel to the render (alongside GroundwaterDetailsPanel around line 3940):
 *    ```typescript
 *    {selectedFactory && (
 *      <div className="absolute bottom-4 right-4 z-[1000] pointer-events-auto" style={{ width: '640px' }}>
 *        <FactoryDetailsPanel
 *          selectedFactory={selectedFactory}
 *          onClose={() => setSelectedFactory(null)}
 *        />
 *      </div>
 *    )}
 *    ```
 */

import type { Map as MapboxMap } from 'mapbox-gl'

export interface FactoryFeature {
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
    type: string
    investment?: number
    employees?: number
    yearEstablished?: number
    facilities?: string
    waterUsage?: {
      annual_acre_feet?: number
      daily_gallons?: number
      recycling_rate?: number
      target_recycling_rate?: number
      description?: string
    }
    environmental?: {
      stress_type?: string
      severity?: 'critical' | 'stressed' | 'moderate' | 'stable'
      drought_duration?: number
      aquifer_status?: string
      aquifer_name?: string
      aquifer_depletion?: string
      air_quality?: string
      air_quality_rank?: number
      air_pollutants?: string[]
      chemical_waste?: boolean
      health_impact?: string
      environmental_justice?: boolean
      impact_description?: string
    }
  }
}

/**
 * Setup factory layer on the Mapbox map
 * Call this function inside your map 'load' event handler, after aquifer setup
 */
export function setupFactoryLayer(
  map: MapboxMap,
  factoriesGeoJSON: any,
  onFactoryClick: (factory: FactoryFeature['properties']) => void
) {
  // Flatten nested environmental.severity to top-level for Mapbox access
  const flattenedData = {
    ...factoriesGeoJSON,
    features: factoriesGeoJSON.features.map((feature: any) => ({
      ...feature,
      properties: {
        ...feature.properties,
        severity: feature.properties.environmental?.severity || 'moderate'
      }
    }))
  }

  console.log('🏭 Setting up factory layer with', flattenedData.features.length, 'factories')
  console.log('🏭 First factory:', flattenedData.features[0]?.properties?.name, 'severity:', flattenedData.features[0]?.properties?.severity)

  // Add factory data source
  map.addSource('factories', {
    type: 'geojson',
    data: flattenedData,
    generateId: true, // Generate IDs for feature state
  })

  console.log('✅ Factory source added to map')

  // Add factory points layer with color based on severity
  console.log('🎨 Adding factory-points layer...')
  map.addLayer({
    id: 'factory-points',
    type: 'circle',
    source: 'factories',
    paint: {
      'circle-radius': [
        'interpolate',
        ['linear'],
        ['zoom'],
        5, 4,
        10, 8,
        15, 12
      ],
      'circle-color': [
        'match',
        ['get', 'severity'],
        'critical', '#ef4444',
        'stressed', '#f97316',
        'moderate', '#3b82f6',
        'stable', '#22c55e',
        '#6b7280' // default gray
      ],
      'circle-stroke-width': [
        'case',
        ['boolean', ['feature-state', 'selected'], false],
        3,
        ['boolean', ['feature-state', 'hover'], false],
        2,
        1
      ],
      'circle-stroke-color': '#ffffff',
      'circle-opacity': [
        'case',
        ['boolean', ['feature-state', 'selected'], false],
        1,
        ['boolean', ['feature-state', 'hover'], false],
        0.9,
        0.8
      ]
    }
  })
  console.log('✅ Factory-points layer added')

  // Add factory labels layer
  console.log('🎨 Adding factory-labels layer...')
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
      'text-optional': true
    },
    paint: {
      'text-color': '#ffffff',
      'text-halo-color': '#000000',
      'text-halo-width': 1,
      'text-halo-blur': 1
    }
  })
  console.log('✅ Factory-labels layer added')

  // Click handler for factories
  console.log('🖱️ Setting up factory click handlers...')
  let hoveredFactoryId: string | number | null = null

  map.on('click', 'factory-points', (e) => {
    if (!e.features || e.features.length === 0) return

    const feature = e.features[0]
    const properties = feature.properties as FactoryFeature['properties']
    const featureId = feature.id

    if (featureId === undefined) return

    // Clear previous selection
    try {
      map.removeFeatureState({ source: 'factories' })
    } catch (err) {
      console.warn('Could not clear factory feature states:', err)
    }

    // Set new selection
    map.setFeatureState(
      { source: 'factories', id: featureId },
      { selected: true }
    )
    map.triggerRepaint()

    // Parse nested objects if they're stringified
    const parseIfNeeded = (value: any) => {
      if (typeof value === 'string') {
        try {
          return JSON.parse(value)
        } catch {
          return value
        }
      }
      return value
    }

    // Call the callback with parsed properties
    onFactoryClick({
      ...properties,
      waterUsage: parseIfNeeded(properties.waterUsage),
      environmental: parseIfNeeded(properties.environmental)
    })
  })

  // Hover effects
  map.on('mouseenter', 'factory-points', (e) => {
    map.getCanvas().style.cursor = 'pointer'
    if (e.features && e.features.length > 0) {
      const featureId = e.features[0].id
      if (featureId !== undefined && featureId !== hoveredFactoryId) {
        if (hoveredFactoryId !== null) {
          map.setFeatureState(
            { source: 'factories', id: hoveredFactoryId },
            { hover: false }
          )
        }
        hoveredFactoryId = featureId
        map.setFeatureState(
          { source: 'factories', id: featureId },
          { hover: true }
        )
      }
    }
  })

  map.on('mouseleave', 'factory-points', () => {
    map.getCanvas().style.cursor = ''
    if (hoveredFactoryId !== null) {
      map.setFeatureState(
        { source: 'factories', id: hoveredFactoryId },
        { hover: false }
      )
      hoveredFactoryId = null
    }
  })

  // Clear selection when clicking elsewhere
  map.on('click', (e) => {
    const features = map.queryRenderedFeatures(e.point, { layers: ['factory-points'] })
    if (features.length === 0) {
      try {
        map.removeFeatureState({ source: 'factories' })
      } catch (err) {
        console.warn('Could not clear factory feature states:', err)
      }
      map.triggerRepaint()
    }
  })

  console.log('✅ Factory layer setup complete! Layers: factory-points, factory-labels')
  console.log('🎯 Factories should now be visible on the map in Texas and Phoenix areas')
}

/**
 * Example integration in WaterAccessView.tsx:
 *
 * ```typescript
 * // Inside map.on('load', () => { ... })
 *
 * // After aquifer setup, add factory layer
 * setupFactoryLayer(
 *   map,
 *   factoriesData,
 *   (factoryProperties) => {
 *     setSelectedFactory({
 *       name: factoryProperties.name,
 *       company: factoryProperties.company,
 *       city: factoryProperties.city,
 *       state: factoryProperties.state,
 *       type: factoryProperties.type,
 *       investment: factoryProperties.investment,
 *       employees: factoryProperties.employees,
 *       yearEstablished: factoryProperties.yearEstablished,
 *       facilities: factoryProperties.facilities,
 *       waterUsage: factoryProperties.waterUsage,
 *       environmental: factoryProperties.environmental
 *     })
 *   }
 * )
 * ```
 */
