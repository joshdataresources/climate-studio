import booleanPointInPolygon from '@turf/boolean-point-in-polygon'
import { point } from '@turf/helpers'
import aquifersData from '../data/aquifers.json'
import {
  PROJECTION_YEARS,
  METRO_CHART_COLORS,
  type ChartDataPoint,
} from './metroChartData'

export interface AquiferMatch {
  name: string
  baselineVolume: number
}

function metroSeriesKey(metroKey: string): string {
  return metroKey.replace(/[^a-zA-Z0-9_]/g, '_')
}

function getVolumeForYear(
  projections: Record<string, number>,
  year: number
): number | null {
  const availableYears = Object.keys(projections)
    .map(Number)
    .sort((a, b) => a - b)
  if (!availableYears.length) return null

  if (projections[String(year)] != null) return projections[String(year)]

  let lowerYear = availableYears[0]
  let upperYear = availableYears[availableYears.length - 1]
  for (let i = 0; i < availableYears.length - 1; i++) {
    if (availableYears[i] <= year && availableYears[i + 1] >= year) {
      lowerYear = availableYears[i]
      upperYear = availableYears[i + 1]
      break
    }
  }

  if (year <= lowerYear) return projections[String(lowerYear)]
  if (year >= upperYear) return projections[String(upperYear)]

  const lowerVol = projections[String(lowerYear)]
  const upperVol = projections[String(upperYear)]
  const ratio = (year - lowerYear) / (upperYear - lowerYear)
  return lowerVol + (upperVol - lowerVol) * ratio
}

/** Storage remaining (% of 2025 baseline) for a metro coordinate at a given year. */
export function getAquiferStoragePercentAt(
  lat: number,
  lon: number,
  year: number
): { name: string; remainingPct: number } | null {
  const feature = aquiferFeatureAt(lat, lon)
  if (!feature?.properties) return null

  const props = feature.properties as {
    name?: string
    volume_gallons_2025?: number
    projections?: Record<string, number>
  }
  const baseline = props.volume_gallons_2025 ?? props.projections?.['2025']
  const projections = props.projections
  if (!props.name || !baseline || !projections) return null

  const volume = getVolumeForYear(projections, year)
  if (volume == null) return null

  return {
    name: props.name,
    remainingPct: Math.round((volume / baseline) * 1000) / 10,
  }
}

/** Point-in-polygon lookup against USGS principal aquifer polygons. */
export function findAquiferAt(lat: number, lon: number): AquiferMatch | null {
  const pt = point([lon, lat])

  for (const feature of aquifersData.features) {
    const geom = feature.geometry
    if (!geom) continue

    let inside = false
    if (geom.type === 'Polygon') {
      inside = booleanPointInPolygon(pt, feature as GeoJSON.Feature<GeoJSON.Polygon>)
    } else if (geom.type === 'MultiPolygon') {
      inside = geom.coordinates.some(ring =>
        booleanPointInPolygon(pt, {
          type: 'Feature',
          properties: {},
          geometry: { type: 'Polygon', coordinates: ring },
        })
      )
    }
    if (!inside) continue

    const props = feature.properties as {
      name?: string
      volume_gallons_2025?: number
      projections?: Record<string, number>
    }
    const baseline =
      props.volume_gallons_2025 ?? props.projections?.['2025'] ?? null
    if (!props.name || baseline == null || !props.projections) continue

    return { name: props.name, baselineVolume: baseline }
  }
  return null
}

function aquiferFeatureAt(lat: number, lon: number) {
  const pt = point([lon, lat])
  for (const feature of aquifersData.features) {
    const geom = feature.geometry
    if (!geom) continue
    if (geom.type === 'Polygon' && booleanPointInPolygon(pt, feature as GeoJSON.Feature<GeoJSON.Polygon>)) {
      return feature
    }
    if (geom.type === 'MultiPolygon') {
      const inside = geom.coordinates.some(ring =>
        booleanPointInPolygon(pt, {
          type: 'Feature',
          properties: {},
          geometry: { type: 'Polygon', coordinates: ring },
        })
      )
      if (inside) return feature
    }
  }
  return null
}

export function buildAquiferStorageSeries(lat: number, lon: number): ChartDataPoint[] {
  const feature = aquiferFeatureAt(lat, lon)
  if (!feature?.properties) return []

  const props = feature.properties as {
    volume_gallons_2025?: number
    projections?: Record<string, number>
  }
  const baseline = props.volume_gallons_2025 ?? props.projections?.['2025']
  const projections = props.projections
  if (!baseline || !projections) return []

  return PROJECTION_YEARS.map(year => {
    const volume = getVolumeForYear(projections, year)
    if (volume == null) return null
    const remainingPct = Math.round((volume / baseline) * 1000) / 10
    return { year, remainingPct, baseline: 100 }
  }).filter((row): row is ChartDataPoint => row != null)
}

export function buildMultiCityAquiferStorageSeries(
  locations: Array<{ metroKey: string; metroName: string; lat: number; lon: number }>
): {
  data: ChartDataPoint[]
  series: { key: string; label: string; color: string }[]
  aquiferNames: Record<string, string>
} {
  const perMetro = locations
    .map((loc, index) => {
      const match = findAquiferAt(loc.lat, loc.lon)
      const points = buildAquiferStorageSeries(loc.lat, loc.lon)
      return {
        loc,
        match,
        color: METRO_CHART_COLORS[index % METRO_CHART_COLORS.length],
        points,
      }
    })
    .filter(entry => entry.points.length > 0 && entry.match)

  if (!perMetro.length) {
    return { data: [], series: [], aquiferNames: {} }
  }

  const series = perMetro.map(({ loc, color }) => ({
    key: metroSeriesKey(loc.metroKey),
    label: loc.metroName,
    color,
  }))

  const aquiferNames: Record<string, string> = {}
  for (const { loc, match } of perMetro) {
    if (match) aquiferNames[loc.metroKey] = match.name
  }

  const data = PROJECTION_YEARS.map(year => {
    const row: ChartDataPoint = { year }
    for (const { loc, points } of perMetro) {
      const pointRow = points.find(p => p.year === year)
      if (pointRow?.remainingPct != null) {
        row[metroSeriesKey(loc.metroKey)] = pointRow.remainingPct as number
      }
    }
    return row
  })

  return { data, series, aquiferNames }
}

export const AQUIFER_SOURCE = 'USGS Principal Aquifers · projected storage model'
