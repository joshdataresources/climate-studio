import wetBulbJson from '../data/expanded_wet_bulb_projections.json'
import { aquiferFeatureAt, getAquiferStoragePercentAt } from './metroAquiferData'
import { PROJECTION_YEARS, metroChartColor } from './metroChartData'
import type { ScatterPoint } from '../components/dashboard/DashboardScatterChart'

export interface BubbleChartSeries {
  key: string
  label: string
  color: string
}

interface WetBulbProjectionRow {
  avg_summer_humidity?: number
  wet_bulb_events?: number
  days_over_95F?: number
  summer_wet_bulb_F?: number
  peak_wet_bulb_F?: number
}

interface WetBulbMetro {
  name?: string
  projections?: Record<string, WetBulbProjectionRow>
}

function normalizeLabel(s: string): string {
  return s.toLowerCase().split(',')[0].trim()
}

function findWetBulbEntry(metroKey: string, metroName: string): WetBulbMetro | null {
  const records = wetBulbJson as Record<string, WetBulbMetro>
  if (records[metroKey]) return records[metroKey]
  const targets = [normalizeLabel(metroKey), normalizeLabel(metroName)]
  for (const [key, record] of Object.entries(records)) {
    if (targets.includes(normalizeLabel(key))) return record
    if (record.name && targets.includes(normalizeLabel(record.name))) return record
  }
  return null
}

/**
 * Per selected city, by decade: peak summer wet-bulb temperature (°F) when
 * the dataset has it (see backfill_wetbulb_temps.py), else relative humidity.
 * Bubble size = dangerous wet-bulb events/yr. (The dataset's extent_radius_km
 * is a fabricated display value — events are the real measure.)
 */
export function buildWetBulbBubbleChart(
  locations: Array<{ metroKey: string; metroName: string }>,
  accentColor: string
): { points: ScatterPoint[]; series: BubbleChartSeries[]; metric: 'wetbulb' | 'humidity' } {
  const points: ScatterPoint[] = []
  const series: BubbleChartSeries[] = []

  const entries = locations
    .map((loc, index) => ({ loc, index, record: findWetBulbEntry(loc.metroKey, loc.metroName) }))
    .filter(e => e.record?.projections)

  // One axis: only plot wet-bulb °F when every selected metro has it
  const useTemp =
    entries.length > 0 &&
    entries.every(({ record }) =>
      Object.values(record!.projections!).some(row => typeof row?.peak_wet_bulb_F === 'number')
    )

  for (const { loc, index, record } of entries) {
    const color = locations.length === 1 ? accentColor : metroChartColor(index)
    let added = false

    for (const [yearKey, row] of Object.entries(record!.projections!)) {
      const year = Number(yearKey)
      const y = useTemp ? row?.peak_wet_bulb_F : row?.avg_summer_humidity
      if (!Number.isFinite(year) || y == null) continue
      const events = row.wet_bulb_events ?? 0
      points.push({
        id: `${loc.metroKey}-${year}`,
        label: loc.metroName,
        x: year,
        y,
        r: 4 + events * 2.5,
        color,
        detail: useTemp
          ? [
              `${yearKey} · ${row.peak_wet_bulb_F}°F peak wet-bulb (p95)`,
              ...(row.summer_wet_bulb_F != null
                ? [`${row.summer_wet_bulb_F}°F avg summer wet-bulb`]
                : []),
              `${events} day${events === 1 ? '' : 's'}/yr over the 88°F danger line`,
              'Wet-bulb = heat + humidity combined; ~95°F exceeds human cooling',
            ]
          : [
              `${yearKey} · ${row.avg_summer_humidity}% avg summer relative humidity`,
              `${events} dangerous wet-bulb event${events === 1 ? '' : 's'}/yr`,
              ...(row.days_over_95F != null ? [`${row.days_over_95F} days over 95°F`] : []),
              'RH is temperature-relative — cooler cities can read higher than muggier ones',
            ],
      })
      added = true
    }

    if (added) {
      series.push({ key: loc.metroKey, label: loc.metroName, color })
    }
  }

  return { points, series, metric: useTemp ? 'wetbulb' : 'humidity' }
}

function formatTrillionGal(v: number): string {
  return v >= 100 ? Math.round(v).toLocaleString() : v >= 10 ? v.toFixed(0) : v.toFixed(1)
}

/**
 * Per selected city: share of the local aquifer's 2025 storage lost by each
 * decade. Bubble AREA is proportional to the volume still stored that year,
 * so bubbles start big at the bottom (full) and shrink as depletion climbs.
 */
export function buildAquiferDepletionBubbleChart(
  locations: Array<{ metroKey: string; metroName: string; lat: number; lon: number }>,
  accentColor: string
): { points: ScatterPoint[]; series: BubbleChartSeries[] } {
  const points: ScatterPoint[] = []
  const series: BubbleChartSeries[] = []

  const withAquifer = locations.map(loc => {
    const feature = aquiferFeatureAt(loc.lat, loc.lon)
    const props = feature?.properties as {
      name?: string
      volume_gallons_2025?: number
      projections?: Record<string, number>
    } | null
    const baselineVolume = props?.volume_gallons_2025 ?? props?.projections?.['2025'] ?? 0
    return { loc, name: props?.name, baselineVolume }
  })
  const maxVolume = Math.max(...withAquifer.map(e => e.baselineVolume), 1)

  withAquifer.forEach(({ loc, name, baselineVolume }, index) => {
    if (!name || !baselineVolume) return

    const color = locations.length === 1 ? accentColor : metroChartColor(index)
    let added = false

    for (const year of PROJECTION_YEARS) {
      const storage = getAquiferStoragePercentAt(loc.lat, loc.lon, year)
      if (!storage) continue
      const lostPct = Math.round((100 - storage.remainingPct) * 10) / 10
      const volumeYear = (baselineVolume * storage.remainingPct) / 100
      points.push({
        id: `${loc.metroKey}-${year}`,
        label: locations.length === 1 ? storage.name : loc.metroName,
        x: year,
        y: lostPct,
        r: 3 + 11 * Math.sqrt(volumeYear / maxVolume),
        color,
        detail: [
          storage.name,
          `${year} · ${lostPct}% of 2025 storage lost`,
          `${formatTrillionGal(volumeYear / 1e12)}T gallons remaining`,
        ],
      })
      added = true
    }

    if (added) {
      series.push({
        key: loc.metroKey,
        label: locations.length === 1 ? name : loc.metroName,
        color,
      })
    }
  })

  return { points, series }
}
