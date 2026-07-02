import wetBulbJson from '../data/expanded_wet_bulb_projections.json'
import aquifersData from '../data/aquifers.json'
import { findAquiferAt } from './metroAquiferData'
import type { ScatterPoint } from '../components/dashboard/DashboardScatterChart'

/** Decades covered by the wet-bulb dataset (narrower than PROJECTION_YEARS). */
const WET_BULB_DECADES = [2025, 2035, 2045, 2055, 2065, 2075]

export function nearestWetBulbDecade(target: number): number {
  return WET_BULB_DECADES.reduce((best, y) =>
    Math.abs(y - target) < Math.abs(best - target) ? y : best
  )
}

function normalizeLabel(s: string): string {
  return s.toLowerCase().split(',')[0].trim()
}

interface WetBulbProjectionRow {
  avg_summer_humidity?: number
  wet_bulb_events?: number
  days_over_95F?: number
}

interface WetBulbMetro {
  name?: string
  projections?: Record<string, WetBulbProjectionRow>
}

/**
 * All metros at one decade: heat (days >95°F) vs summer humidity, dot size =
 * projected dangerous wet-bulb events. The danger corner is top-right.
 */
export function buildWetBulbScatterPoints(
  highlights: Array<{ metroKey: string; metroName: string }>,
  projectionYear: number
): { points: ScatterPoint[]; decade: number } {
  const decade = nearestWetBulbDecade(projectionYear)
  const highlightNorms = new Set(
    highlights.flatMap(h => [normalizeLabel(h.metroKey), normalizeLabel(h.metroName)])
  )

  const points = Object.entries(wetBulbJson as Record<string, WetBulbMetro>).flatMap(
    ([key, metro]) => {
      const row = metro?.projections?.[String(decade)]
      if (row?.days_over_95F == null || row?.avg_summer_humidity == null) return []
      const events = row.wet_bulb_events ?? 0
      const highlight =
        highlightNorms.has(normalizeLabel(key)) ||
        highlightNorms.has(normalizeLabel(metro.name ?? key))
      return [
        {
          id: key,
          label: key,
          x: row.days_over_95F,
          y: row.avg_summer_humidity,
          r: 4 + events * 1.5,
          highlight,
          detail: [
            `${row.days_over_95F} days over 95°F`,
            `${row.avg_summer_humidity}% avg summer humidity`,
            `${events} dangerous wet-bulb event${events === 1 ? '' : 's'}/yr`,
          ],
        } satisfies ScatterPoint,
      ]
    }
  )

  return { points, decade }
}

function shortAquiferName(name: string): string {
  return name.replace(/\s*\(.*\)$/, '').replace(/\s+Aquifer( System)?$/i, '')
}

function formatTrillionGal(v: number): string {
  return v >= 100 ? Math.round(v).toLocaleString() : v >= 10 ? v.toFixed(0) : v.toFixed(1)
}

/**
 * All principal aquifers: 2025 storage (log scale) vs projected share of that
 * storage lost by 2100. Highlights the aquifer(s) under the selected cities.
 */
export function buildAquiferDepletionScatterPoints(
  highlights: Array<{ lat: number; lon: number }>
): ScatterPoint[] {
  const highlightNames = new Set(
    highlights
      .map(h => findAquiferAt(h.lat, h.lon)?.name)
      .filter((n): n is string => Boolean(n))
  )

  const seen = new Set<string>()
  const points: ScatterPoint[] = []

  for (const feature of (aquifersData as GeoJSON.FeatureCollection).features) {
    const props = feature.properties as {
      name?: string
      volume_gallons_2025?: number
      projections?: Record<string, number>
    } | null
    const name = props?.name
    if (!name || seen.has(name)) continue
    seen.add(name)

    const v2025 = props.volume_gallons_2025 ?? props.projections?.['2025']
    const v2100 = props.projections?.['2100']
    if (!v2025 || v2100 == null) continue

    const trillionGal = v2025 / 1e12
    const depletionPct = Math.round((1 - v2100 / v2025) * 1000) / 10
    points.push({
      id: name,
      label: shortAquiferName(name),
      x: trillionGal,
      y: depletionPct,
      highlight: highlightNames.has(name),
      detail: [
        name,
        `${formatTrillionGal(trillionGal)}T gallons stored in 2025`,
        `${depletionPct}% projected lost by 2100`,
      ],
    })
  }

  // Direct-label the worst three so the chart reads without hovering
  ;[...points]
    .sort((a, b) => b.y - a.y)
    .slice(0, 3)
    .forEach(p => {
      if (!p.highlight) p.labeled = true
    })

  return points
}
