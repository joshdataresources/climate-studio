"use client"

import { useEffect, useMemo } from "react"
import { Source, Layer } from "react-map-gl"
import megaregionData from "../data/megaregion-data.json"

interface Metro {
  name: string
  lat: number
  lon: number
  climate_risk: string
  region: string
  megaregion: string
  populations: Record<string, number>
}

interface MegaregionData {
  metros: Metro[]
}

interface MegaregionLayerProps {
  year: number
  opacity: number
  visible: boolean
}

// Helper: Calculate circle radius based on population
// Population density determines visual size
function populationToRadius(population: number): number {
  // Use square root scale for proportional area representation
  // This makes size differences much more visible
  const scaleFactor = 0.015 // Adjust this to control overall size
  const baseRadius = Math.sqrt(population) * scaleFactor
  return Math.max(baseRadius, 30) // Minimum 30km radius for visibility
}

// Helper: Determine circle color based on population size and growth
// INVERTED: Decline = RED (alarming), Growth = BLUE
function getGrowthColor(currentPop: number, previousPop: number): string {
  if (!previousPop || previousPop === 0) return '#888888' // Gray for no data

  const growthRate = (currentPop - previousPop) / previousPop

  // Show color even for very small changes (> 0.1% change)
  if (Math.abs(growthRate) < 0.001) return '#888888' // Gray only if essentially no change

  // Color based on growth rate with more granular steps
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

  // Very fast growth
  return '#3b82f6' // Very fast growth - blue
}

// Helper: Create circle polygon from center point
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

export function MegaregionLayer({ year, opacity, visible }: MegaregionLayerProps) {
  const data = megaregionData as MegaregionData

  console.log(`🔵 MegaregionLayer render: year=${year}, visible=${visible}, opacity=${opacity}`)

  // Find closest year in data (2025, 2035, 2045, 2055, 2065, 2075, 2085, 2095)
  const availableYears = [2025, 2035, 2045, 2055, 2065, 2075, 2085, 2095]
  const closestYear = availableYears.reduce((prev, curr) =>
    Math.abs(curr - year) < Math.abs(prev - year) ? curr : prev
  )

  console.log(`  📅 Input year: ${year} → Closest data year: ${closestYear}`)

  // Get previous year for growth calculation
  const yearIndex = availableYears.indexOf(closestYear)
  const previousYear = yearIndex > 0 ? availableYears[yearIndex - 1] : null

  // Generate GeoJSON features for all metros at current year
  const geojson = useMemo(() => {
    if (!visible) {
      console.log('🔴 Megaregion layer not visible')
      return null
    }

    console.log(`🟢 Generating megaregion circles for year ${closestYear}`)

    const features = data.metros.map(metro => {
      const population = metro.populations[closestYear.toString()] || 0
      const previousPop = previousYear ? (metro.populations[previousYear.toString()] || 0) : population

      const radiusKm = populationToRadius(population)
      const color = getGrowthColor(population, previousPop)
      const growthRate = previousPop ? ((population - previousPop) / previousPop * 100).toFixed(1) : '0'

      console.log(`  ${metro.name}: pop=${population.toLocaleString()}, radius=${radiusKm.toFixed(1)}km, color=${color}, growth=${growthRate}%`)

      return {
        type: 'Feature' as const,
        properties: {
          name: metro.name,
          population,
          year: closestYear,
          climate_risk: metro.climate_risk,
          megaregion: metro.megaregion,
          color,
          radius: radiusKm,
          growthRate: parseFloat(growthRate),
          previousPop: previousPop
        },
        geometry: {
          type: 'Polygon' as const,
          coordinates: [createCircle(metro.lon, metro.lat, radiusKm)]
        }
      }
    })

    console.log(`✅ Generated ${features.length} megaregion features`)

    return {
      type: 'FeatureCollection' as const,
      features
    }
  }, [data.metros, year, closestYear, previousYear, visible])

  // Generate label features for center labels
  const labelFeatures = useMemo(() => {
    if (!visible || !geojson) return null

    const labels = data.metros.map(metro => {
      const population = metro.populations[closestYear.toString()] || 0
      const previousPop = previousYear ? (metro.populations[previousYear.toString()] || 0) : population
      const growthRate = previousPop ? ((population - previousPop) / previousPop * 100) : 0

      // Format population with commas
      const formattedPop = population.toLocaleString('en-US')

      // Create triangle indicator
      const triangle = growthRate > 0 ? '▲' : growthRate < 0 ? '▼' : '='
      const growthText = `${growthRate >= 0 ? '+' : ''}${Math.abs(growthRate).toFixed(0)}%${triangle}`

      return {
        type: 'Feature' as const,
        properties: {
          name: metro.name,
          population: formattedPop,
          growthRate: growthRate.toFixed(1),
          growthText: growthText,
          isGrowing: growthRate > 0,
          isDecline: growthRate < 0
        },
        geometry: {
          type: 'Point' as const,
          coordinates: [metro.lon, metro.lat]
        }
      }
    })

    return {
      type: 'FeatureCollection' as const,
      features: labels
    }
  }, [data.metros, closestYear, previousYear, visible, geojson])

  if (!visible || !geojson) return null

  return (
    <>
      {/* Circle fill layer */}
      <Source
        id="megaregion-circles"
        type="geojson"
        data={geojson}
      >
        <Layer
          id="megaregion-circles-fill"
          type="fill"
          paint={{
            'fill-color': ['get', 'color'],
            'fill-opacity': opacity * 0.8 // Base opacity multiplied by control
          }}
        />
      </Source>

      {/* Circle outline layer */}
      <Source
        id="megaregion-circles-outline"
        type="geojson"
        data={geojson}
      >
        <Layer
          id="megaregion-circles-stroke"
          type="line"
          paint={{
            'line-color': ['get', 'color'],
            'line-width': 2,
            'line-opacity': opacity
          }}
        />
      </Source>

      {/* Metro center labels with population */}
      {labelFeatures && (
        <Source
          id="megaregion-labels"
          type="geojson"
          data={labelFeatures}
        >
          <Layer
            id="megaregion-population-text"
            type="symbol"
            layout={{
              'text-field': ['get', 'population'],
              'text-size': 16,
              'text-anchor': 'center',
              'text-offset': [0, -0.5],
              'text-allow-overlap': false,
              'text-ignore-placement': false
            }}
            paint={{
              'text-color': '#ffffff',
              'text-halo-color': '#000000',
              'text-halo-width': 2,
              'text-opacity': opacity
            }}
          />
          <Layer
            id="megaregion-growth-text"
            type="symbol"
            layout={{
              'text-field': ['get', 'growthText'],
              'text-size': 14,
              'text-anchor': 'center',
              'text-offset': [0, 0.5],
              'text-allow-overlap': false,
              'text-ignore-placement': false
            }}
            paint={{
              'text-color': [
                'case',
                ['get', 'isGrowing'],
                '#10b981', // Green for growth
                ['get', 'isDecline'],
                '#ef4444', // Red for decline
                '#888888'  // Gray for no change
              ],
              'text-halo-color': '#000000',
              'text-halo-width': 2,
              'text-opacity': opacity
            }}
          />
        </Source>
      )}
    </>
  )
}
