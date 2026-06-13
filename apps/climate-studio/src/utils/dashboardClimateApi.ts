import { getBackendBaseUrl } from '../config/backend'
import { PROJECTION_YEARS } from './metroChartData'
import { scenarioToSsp, sspToRcp, type SspScenario } from './scenarioMapping'

export interface DashboardEarthEngineSnapshot {
  tempAnomalyF: number | null
  projectedTempF: number | null
  wetBulbF: number | null
  isRealData: boolean
}

export interface DashboardPrecipitationSnapshot {
  precipitationMm: number | null
  droughtIndex: number | null
  soilMoisture: number | null
  isRealData: boolean
}

export interface PrecipitationChartBundle {
  data: Array<{ year: number; [key: string]: number | string }>
  series: Array<{ key: string; label: string; color: string }>
}

const PAD_DEG = 0.12

function boundsAround(lat: number, lon: number) {
  return {
    north: lat + PAD_DEG,
    south: lat - PAD_DEG,
    east: lon + PAD_DEG,
    west: lon - PAD_DEG,
  }
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function featureCentroid(feature: GeoJSON.Feature): { lat: number; lon: number } | null {
  const geom = feature.geometry
  if (!geom || geom.type !== 'Polygon') return null
  const ring = geom.coordinates[0]
  if (!ring?.length) return null
  let latSum = 0
  let lonSum = 0
  const n = ring.length - 1
  if (n <= 0) return null
  for (let i = 0; i < n; i++) {
    lonSum += ring[i][0]
    latSum += ring[i][1]
  }
  return { lat: latSum / n, lon: lonSum / n }
}

function nearestFeature(
  features: GeoJSON.Feature[],
  lat: number,
  lon: number
): GeoJSON.Feature | null {
  let best: GeoJSON.Feature | null = null
  let bestDist = Infinity
  for (const f of features) {
    const c = featureCentroid(f)
    if (!c) continue
    const d = haversineKm(lat, lon, c.lat, c.lon)
    if (d < bestDist) {
      bestDist = d
      best = f
    }
  }
  return best
}

async function fetchJson(url: string, signal?: AbortSignal) {
  const response = await fetch(url, {
    signal,
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) {
    throw new Error(`Climate API ${response.status}`)
  }
  return response.json()
}

export async function fetchDashboardEarthEngineSnapshot(
  lat: number,
  lon: number,
  projectionYear: number,
  scenario: SspScenario,
  signal?: AbortSignal
): Promise<DashboardEarthEngineSnapshot> {
  const base = getBackendBaseUrl()
  const { north, south, east, west } = boundsAround(lat, lon)
  const rcp = sspToRcp(scenario)
  const ssp = scenario

  const params = new URLSearchParams({
    north: String(north),
    south: String(south),
    east: String(east),
    west: String(west),
    year: String(projectionYear),
    scenario: rcp,
    resolution: '5',
  })

  const wetBulbParams = new URLSearchParams({
    north: String(north),
    south: String(south),
    east: String(east),
    west: String(west),
    year: String(projectionYear),
    scenario: ssp,
    resolution: '4',
  })

  const [tempPayload, wetPayload] = await Promise.allSettled([
    fetchJson(`${base}/api/climate/temperature-projection?${params}`, signal),
    fetchJson(`${base}/api/climate/wet-bulb-temperature?${wetBulbParams}`, signal),
  ])

  let tempAnomalyF: number | null = null
  let projectedTempF: number | null = null
  let wetBulbF: number | null = null

  if (tempPayload.status === 'fulfilled') {
    const features: GeoJSON.Feature[] =
      tempPayload.value?.data?.features ?? tempPayload.value?.features ?? []
    const nearest = nearestFeature(features, lat, lon)
    const props = nearest?.properties as Record<string, number> | undefined
    if (props) {
      tempAnomalyF =
        props.tempAnomalyF ?? (props.temp_anomaly_f as number | undefined) ?? null
      if (props.projected != null) {
        projectedTempF = Math.round((props.projected * 9) / 5 + 32)
      } else if (props.projectedTempF != null) {
        projectedTempF = props.projectedTempF
      }
    }
  }

  if (wetPayload.status === 'fulfilled') {
    const features: GeoJSON.Feature[] =
      wetPayload.value?.data?.features ?? wetPayload.value?.features ?? []
    const nearest = nearestFeature(features, lat, lon)
    const props = nearest?.properties as Record<string, number> | undefined
    if (props) {
      wetBulbF = props.wet_bulb_f ?? props.wetBulbF ?? null
    }
  }

  const isRealData = tempAnomalyF != null || wetBulbF != null

  return { tempAnomalyF, projectedTempF, wetBulbF, isRealData }
}

export async function fetchDashboardPrecipitationSnapshot(
  lat: number,
  lon: number,
  projectionYear: number,
  scenario: SspScenario,
  signal?: AbortSignal
): Promise<DashboardPrecipitationSnapshot> {
  const base = getBackendBaseUrl()
  const { north, south, east, west } = boundsAround(lat, lon)
  const rcp = sspToRcp(scenario)

  const params = new URLSearchParams({
    north: String(north),
    south: String(south),
    east: String(east),
    west: String(west),
    year: String(projectionYear),
    scenario: rcp,
    metric: 'precipitation',
    resolution: '5',
  })

  const payload = await fetchJson(`${base}/api/climate/precipitation-drought?${params}`, signal)
  const features: GeoJSON.Feature[] = payload?.data?.features ?? []
  const nearest = nearestFeature(features, lat, lon)
  const props = nearest?.properties as Record<string, number> | undefined

  const precipitationMm = props?.precipitation ?? props?.value ?? null
  const droughtIndex = props?.droughtIndex ?? null
  const soilMoisture = props?.soilMoisture ?? null

  return {
    precipitationMm,
    droughtIndex,
    soilMoisture,
    isRealData: precipitationMm != null,
  }
}

const METRO_CHART_COLORS = [
  '#ef4444',
  '#3b82f6',
  '#22c55e',
  '#f97316',
  '#8b5cf6',
  '#06b6d4',
  '#eab308',
  '#ec4899',
] as const

function metroSeriesKey(metroKey: string): string {
  return metroKey.replace(/[^a-zA-Z0-9_]/g, '_')
}

export function buildPrecipitationChartsFromTrajectories(
  trajectories: Array<{
    metroKey: string
    metroName: string
    points: Array<{
      year: number
      precipitationMm: number | null
      droughtIndex: number | null
      soilMoisture: number | null
    }>
  }>
): {
  precipitation: PrecipitationChartBundle
  drought: PrecipitationChartBundle
  soilMoisture: PrecipitationChartBundle
} {
  const empty: PrecipitationChartBundle = { data: [], series: [] }
  const valid = trajectories.filter(t => t.points.some(p => p.precipitationMm != null))
  if (!valid.length) {
    return { precipitation: empty, drought: empty, soilMoisture: empty }
  }

  const years = [...PROJECTION_YEARS]

  const series = valid.map((t, index) => ({
    key: metroSeriesKey(t.metroKey),
    label: t.metroName,
    color: METRO_CHART_COLORS[index % METRO_CHART_COLORS.length],
  }))

  function build(valueKey: 'precipitationMm' | 'droughtIndex' | 'soilMoisture'): PrecipitationChartBundle {
    const data = years.map(year => {
      const row: { year: number; [key: string]: number | string } = { year }
      for (const t of valid) {
        const point = t.points.find(p => p.year === year)
        const value = point?.[valueKey]
        if (value != null) row[metroSeriesKey(t.metroKey)] = value
      }
      return row
    })
    return { data, series }
  }

  return {
    precipitation: build('precipitationMm'),
    drought: build('droughtIndex'),
    soilMoisture: build('soilMoisture'),
  }
}

/** RCP scenario string for ClimateContext from dashboard SSP selection. */
export function dashboardScenarioToRcp(scenario: SspScenario): string {
  return sspToRcp(scenario)
}

export function climateContextScenarioToSsp(scenario: string): SspScenario {
  return scenarioToSsp(scenario)
}
