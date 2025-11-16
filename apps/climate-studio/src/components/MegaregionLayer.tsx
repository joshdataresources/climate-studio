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
          radius: radiusKm
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
            'fill-opacity': opacity * 0.4 // Base opacity multiplied by control
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
            'line-opacity': opacity * 0.8
          }}
        />
      </Source>

      {/* Metro center points (optional labels) */}
      <Source
        id="megaregion-centers"
        type="geojson"
        data={{
          type: 'FeatureCollection',
          features: data.metros.map(metro => ({
            type: 'Feature' as const,
            properties: {
              name: metro.name,
              population: metro.populations[closestYear.toString()] || 0
            },
            geometry: {
              type: 'Point' as const,
              coordinates: [metro.lon, metro.lat]
            }
          }))
        }}
      >
        <Layer
          id="megaregion-center-dots"
          type="circle"
          paint={{
            'circle-radius': 3,
            'circle-color': '#ffffff',
            'circle-stroke-width': 1,
            'circle-stroke-color': '#000000',
            'circle-opacity': opacity
          }}
        />
      </Source>
    </>
  )
}
