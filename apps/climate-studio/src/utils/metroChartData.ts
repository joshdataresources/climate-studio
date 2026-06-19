import riverFlowProjections from '../data/river-flow-projections.json'
import riversData from '../data/rivers.json'
import type { MetroDataBundle, MetroRecord, WetBulbRecord } from './metroResolver'
import { findRiversForMetro } from './riverMetroConnections'
import type { SspScenario } from './scenarioMapping'

export const PROJECTION_YEARS = [2025, 2035, 2045, 2055, 2065, 2075, 2085, 2095] as const
export const YEAR_MIN = PROJECTION_YEARS[0]
export const YEAR_MAX = PROJECTION_YEARS[PROJECTION_YEARS.length - 1]

export interface ProjectionRow {
  annual_avg?: number
  summer_avg?: number
  winter_avg?: number
  days_over_100?: number
  days_over_110?: number
}

export interface TemperatureBaseline {
  avg_annual: number
  summer_avg: number
  winter_avg: number
  days_over_100: number
  days_over_110: number
}

export interface TemperatureStats {
  current: ProjectionRow & {
    annual_avg: number
    summer_avg: number
    winter_avg: number
    days_over_100: number
    days_over_110: number
  }
  baseline: TemperatureBaseline
  decade: number
  tempIncrease: number
  daysOver100Increase: number
}

export interface ChartDataPoint {
  year: number
  [key: string]: number | string
}

export interface MetroChartInput {
  metroKey: string
  metroName: string
  temperature: MetroRecord | null
  wetBulb: WetBulbRecord | null
}

/** Primary palette for multi-metro charts; optimized for visibility and contrast */
export const METRO_CHART_COLORS = [
  '#ef4444', // red
  '#3b82f6', // blue
  '#22c55e', // green
  '#f97316', // orange
  '#8b5cf6', // purple
  '#06b6d4', // cyan
  '#eab308', // yellow
  '#ec4899', // pink
  '#14b8a6', // teal
  '#f43f5e', // rose
  '#84cc16', // lime
  '#6366f1', // indigo
  '#0ea5e9', // sky
  '#d946ef', // fuchsia
  '#64748b', // slate
  '#a855f7', // violet
] as const

/** Distinct stroke color for any metro index (supports all selected cities). */
export function metroChartColor(index: number): string {
  if (index < METRO_CHART_COLORS.length) return METRO_CHART_COLORS[index]
  // Use golden angle for better color distribution
  const hue = Math.round((index * 137.508) % 360)
  // Vary saturation and lightness for better distinction
  const saturation = 55 + ((index % 4) * 10) // 55-85%
  const lightness = 45 + ((index % 3) * 8) // 45-61%
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`
}

function metroSeriesKey(metroKey: string): string {
  return metroKey.replace(/[^a-zA-Z0-9_]/g, '_')
}

function unionProjectionYears(
  metros: MetroChartInput[],
  scenario: SspScenario,
  includeWetBulb = false
): number[] {
  const yearSet = new Set<number>()
  for (const metro of metros) {
    if (includeWetBulb && metro.wetBulb?.projections) {
      wetBulbYears(metro.wetBulb).forEach(y => yearSet.add(y))
    }
    if (metro.temperature) {
      projectionYears(metro.temperature, scenario).forEach(y => yearSet.add(y))
    }
  }
  return [...yearSet].sort((a, b) => a - b)
}

function buildMultiCitySeries(
  metros: MetroChartInput[],
  years: number[],
  getValue: (metro: MetroChartInput, year: number) => number | undefined
): { data: ChartDataPoint[]; series: { key: string; label: string; color: string }[] } {
  console.log('[buildMultiCitySeries] Input metros:', metros.length, metros.map(m => m.metroKey))

  const series = metros.map((metro, index) => {
    const s = {
      key: metroSeriesKey(metro.metroKey),
      label: metro.metroName,
      color: metroChartColor(index),
    }
    console.log(`[buildMultiCitySeries] Series ${index}: key="${s.key}", label="${s.label}", color="${s.color}"`)
    return s
  })

  const data = years.map(year => {
    const row: ChartDataPoint = { year }
    for (const metro of metros) {
      const value = getValue(metro, year)
      const key = metroSeriesKey(metro.metroKey)
      if (value != null) {
        row[key] = value
      }
    }
    return row
  })

  console.log('[buildMultiCitySeries] Output:', {
    seriesCount: series.length,
    dataRows: data.length,
    sampleRow: data[0]
  })

  return { data, series }
}

export function buildMultiCityTemperatureTrajectory(
  metros: MetroChartInput[],
  scenario: SspScenario
): { data: ChartDataPoint[]; series: { key: string; label: string; color: string }[] } {
  const years = unionProjectionYears(metros, scenario)
  const result = buildMultiCitySeries(metros, years, (metro, year) => {
    if (!metro.temperature) return undefined
    return rowAtYear(metro.temperature, scenario, year)?.annual_avg
  })

  console.log('[buildMultiCityTemperatureTrajectory] Built chart:', {
    metroCount: metros.length,
    metroKeys: metros.map(m => m.metroKey),
    seriesCount: result.series.length,
    seriesKeys: result.series.map(s => s.key),
    dataRows: result.data.length,
    firstRow: result.data[0]
  })

  return result
}

export function buildMultiCitySummerSeries(
  metros: MetroChartInput[],
  scenario: SspScenario
): { data: ChartDataPoint[]; series: { key: string; label: string; color: string }[] } {
  const years = unionProjectionYears(metros, scenario)
  return buildMultiCitySeries(metros, years, (metro, year) => {
    if (!metro.temperature?.baseline_1995_2014) return undefined
    const baseline = resolveSummerBaseline(metro.temperature.baseline_1995_2014)
    return rowAtYear(metro.temperature, scenario, year)?.summer_avg ?? baseline
  })
}

export function buildMultiCityWinterSeries(
  metros: MetroChartInput[],
  scenario: SspScenario
): { data: ChartDataPoint[]; series: { key: string; label: string; color: string }[] } {
  const years = unionProjectionYears(metros, scenario)
  return buildMultiCitySeries(metros, years, (metro, year) => {
    if (!metro.temperature?.baseline_1995_2014) return undefined
    const baseline = resolveWinterBaseline(metro.temperature.baseline_1995_2014)
    return rowAtYear(metro.temperature, scenario, year)?.winter_avg ?? baseline
  })
}

export function buildMultiCityDaysOver100Series(
  metros: MetroChartInput[],
  scenario: SspScenario
): { data: ChartDataPoint[]; series: { key: string; label: string; color: string }[] } {
  const years = unionProjectionYears(metros, scenario, true)
  return buildMultiCitySeries(metros, years, (metro, year) => {
    if (metro.wetBulb?.projections?.[String(year)]) {
      const row = metro.wetBulb.projections[String(year)] as Record<string, number>
      return row.days_over_100F
    }
    if (!metro.temperature) return undefined
    return rowAtYear(metro.temperature, scenario, year)?.days_over_100
  })
}

export function buildMultiCityWetBulbSeries(
  metros: MetroChartInput[]
): { data: ChartDataPoint[]; series: { key: string; label: string; color: string }[] } {
  const years = unionProjectionYears(metros, 'ssp245', true)
  return buildMultiCitySeries(metros, years, (metro, year) => {
    const row = metro.wetBulb?.projections?.[String(year)] as Record<string, number> | undefined
    return row?.wet_bulb_events
  })
}

export function metrosToChartInputs(
  locations: { metroKey: string; metroName: string }[],
  loadBundle: (key: string) => MetroDataBundle
): MetroChartInput[] {
  console.log('[metrosToChartInputs] Processing locations:', locations.map(l => l.metroKey))

  const result = locations.map((loc, idx) => {
    const bundle = loadBundle(loc.metroKey)
    console.log(`[metrosToChartInputs] ${idx}: ${loc.metroKey} -> has temp: ${!!bundle.temperature}`)

    return {
      metroKey: loc.metroKey,
      metroName: loc.metroName,
      temperature: bundle.temperature,
      wetBulb: bundle.wetBulb,
    }
  })

  console.log('[metrosToChartInputs] Result count:', result.length)
  return result
}

function wetBulbYears(wetBulb: WetBulbRecord): number[] {
  return Object.keys(wetBulb.projections ?? {})
    .map(Number)
    .sort((a, b) => a - b)
}

function wetBulbRowAt(
  wetBulb: WetBulbRecord | null,
  year: number
): Record<string, number> | undefined {
  if (!wetBulb?.projections) return undefined
  return wetBulb.projections[String(nearestProjectionYear(year))] as Record<string, number> | undefined
}

function resolveSummerBaseline(baseline: Record<string, number>): number {
  return (baseline.summer_avg as number) ?? (baseline.avg_summer_max as number) ?? 0
}

function resolveWinterBaseline(baseline: Record<string, number>): number {
  return (baseline.winter_avg as number) ?? (baseline.avg_winter_min as number) ?? 0
}

/** Approximate SSP1-2.6 warming as a fraction of SSP2-4.5 (~1.5°C vs ~2.7°C). */
const LOW_SCENARIO_WARMING_RATIO = 1.5 / 2.7

function scaleLowScenarioValue(
  baseline: number | undefined,
  moderate: number | undefined,
  roundInt = false
): number | undefined {
  if (baseline == null || moderate == null) return moderate
  const scaled = baseline + (moderate - baseline) * LOW_SCENARIO_WARMING_RATIO
  return roundInt ? Math.round(scaled) : Math.round(scaled * 10) / 10
}

function deriveLowScenarioRow(
  baseline: Record<string, number>,
  moderateRow: ProjectionRow
): ProjectionRow {
  const summerBaseline = resolveSummerBaseline(baseline)
  const winterBaseline = resolveWinterBaseline(baseline)
  return {
    annual_avg: scaleLowScenarioValue(baseline.avg_annual as number, moderateRow.annual_avg),
    summer_avg: scaleLowScenarioValue(summerBaseline, moderateRow.summer_avg),
    winter_avg: scaleLowScenarioValue(winterBaseline, moderateRow.winter_avg),
    days_over_100: scaleLowScenarioValue(
      baseline.days_over_100 as number,
      moderateRow.days_over_100,
      true
    ),
    days_over_110: scaleLowScenarioValue(
      baseline.days_over_110 as number,
      moderateRow.days_over_110,
      true
    ),
  }
}

export function hasTemperatureScenario(
  temperature: MetroRecord | null | undefined,
  scenario: SspScenario
): boolean {
  if (!temperature?.projections || !temperature.baseline_1995_2014) return false
  if (temperature.projections[scenario]) return true
  return scenario === 'ssp126' && Boolean(temperature.projections.ssp245)
}

function projectionYears(temperature: MetroRecord, scenario: SspScenario): number[] {
  const data =
    temperature.projections?.[scenario] ??
    (scenario === 'ssp126' ? temperature.projections?.ssp245 : undefined)
  if (!data) return []
  return Object.keys(data)
    .map(Number)
    .sort((a, b) => a - b)
}

function rowAtYear(
  temperature: MetroRecord,
  scenario: SspScenario,
  year: number
): ProjectionRow | undefined {
  const direct = temperature.projections?.[scenario]?.[String(year)]
  if (direct) return direct

  if (scenario === 'ssp126' && temperature.baseline_1995_2014) {
    const moderate = temperature.projections?.ssp245?.[String(year)]
    if (moderate) return deriveLowScenarioRow(temperature.baseline_1995_2014, moderate)
  }

  return undefined
}

function resolveDaysOver100Baseline(
  temperature: MetroRecord | null,
  wetBulb: WetBulbRecord | null
): number {
  const tempBaseline = temperature?.baseline_1995_2014?.days_over_100
  if (tempBaseline != null && tempBaseline > 0) return tempBaseline as number
  const wb2025 = wetBulb?.projections?.['2025']?.days_over_100F
  if (wb2025 != null) return wb2025 as number
  return (wetBulb?.baseline_1995_2014?.days_over_95F as number) ?? 0
}

export function nearestProjectionYear(target: number): number {
  return PROJECTION_YEARS.reduce((best, y) =>
    Math.abs(y - target) < Math.abs(best - target) ? y : best
  )
}

export function getProjection(
  temperature: MetroRecord | null,
  scenario: SspScenario,
  year: number
): ProjectionRow | undefined {
  if (!temperature) return undefined
  return rowAtYear(temperature, scenario, nearestProjectionYear(year))
}

export function buildTemperatureTrajectory(
  temperature: MetroRecord | null,
  scenario: SspScenario
): ChartDataPoint[] {
  if (!hasTemperatureScenario(temperature, scenario)) return []

  const baseline = temperature.baseline_1995_2014.avg_annual as number
  return projectionYears(temperature, scenario).map(year => {
    const row = rowAtYear(temperature, scenario, year)!
    return {
      year,
      temp: row.annual_avg ?? 0,
      baseline,
    }
  })
}

export function buildSeasonalTemperatureSeries(
  temperature: MetroRecord | null,
  scenario: SspScenario
): ChartDataPoint[] {
  if (!hasTemperatureScenario(temperature, scenario)) return []

  const b = temperature.baseline_1995_2014
  const summerBaseline = resolveSummerBaseline(b)
  const winterBaseline = resolveWinterBaseline(b)

  return projectionYears(temperature, scenario).map(year => {
    const row = rowAtYear(temperature, scenario, year)!
    return {
      year,
      summer: row.summer_avg ?? summerBaseline,
      winter: row.winter_avg ?? winterBaseline,
      summerBaseline,
      winterBaseline,
    }
  })
}

export function buildSummerTemperatureSeries(
  temperature: MetroRecord | null,
  scenario: SspScenario
): ChartDataPoint[] {
  if (!hasTemperatureScenario(temperature, scenario)) return []

  const summerBaseline = resolveSummerBaseline(temperature.baseline_1995_2014)
  return projectionYears(temperature, scenario).map(year => {
    const row = rowAtYear(temperature, scenario, year)!
    return {
      year,
      summer: row.summer_avg ?? summerBaseline,
      baseline: summerBaseline,
    }
  })
}

export function buildWinterTemperatureSeries(
  temperature: MetroRecord | null,
  scenario: SspScenario
): ChartDataPoint[] {
  if (!hasTemperatureScenario(temperature, scenario)) return []

  const winterBaseline = resolveWinterBaseline(temperature.baseline_1995_2014)
  return projectionYears(temperature, scenario).map(year => {
    const row = rowAtYear(temperature, scenario, year)!
    return {
      year,
      winter: row.winter_avg ?? winterBaseline,
      baseline: winterBaseline,
    }
  })
}

/** Per-city days >100°F — wet bulb dataset when available (Climate Suite source of truth). */
export function buildDaysOver100Series(
  temperature: MetroRecord | null,
  scenario: SspScenario,
  wetBulb: WetBulbRecord | null = null
): ChartDataPoint[] {
  const baseline = resolveDaysOver100Baseline(temperature, wetBulb)

  if (wetBulb?.projections) {
    return wetBulbYears(wetBulb).map(year => {
      const row = wetBulb.projections![String(year)] as Record<string, number>
      return {
        year,
        daysOver100: row.days_over_100F ?? 0,
        baseline,
      }
    })
  }

  if (!hasTemperatureScenario(temperature, scenario)) return []

  return projectionYears(temperature, scenario).map(year => {
    const row = rowAtYear(temperature, scenario, year)!
    return {
      year,
      daysOver100: row.days_over_100 ?? 0,
      baseline,
    }
  })
}

export function buildExtremeHeatSeries(
  temperature: MetroRecord | null,
  scenario: SspScenario
): ChartDataPoint[] {
  if (!hasTemperatureScenario(temperature, scenario)) return []

  return projectionYears(temperature, scenario).map(year => {
    const row = rowAtYear(temperature, scenario, year)!
    return {
      year,
      daysOver100: row.days_over_100 ?? 0,
      daysOver110: row.days_over_110 ?? 0,
    }
  })
}

export function buildPopulationSeries(population: MetroDataBundle['population']): ChartDataPoint[] {
  if (!population?.populations) return []
  return Object.keys(population.populations)
    .map(Number)
    .sort((a, b) => a - b)
    .map(year => ({
      year,
      population: population.populations![String(year)],
    }))
}

export function getTemperatureStats(
  temperature: MetroRecord | null,
  scenario: SspScenario,
  projectionYear: number,
  wetBulb: WetBulbRecord | null = null
): TemperatureStats | null {
  if (!hasTemperatureScenario(temperature, scenario)) return null

  const years = projectionYears(temperature, scenario)
  const yearKey = years.includes(nearestProjectionYear(projectionYear))
    ? nearestProjectionYear(projectionYear)
    : years.reduce((prev, curr) =>
        Math.abs(curr - projectionYear) < Math.abs(prev - projectionYear) ? curr : prev
      )

  const currentData = rowAtYear(temperature, scenario, yearKey)
  const baseline = temperature.baseline_1995_2014
  const wbCurrent = wetBulbRowAt(wetBulb, yearKey)

  if (currentData?.annual_avg == null || baseline.avg_annual == null) return null

  const summerBaseline = resolveSummerBaseline(baseline)
  const winterBaseline = resolveWinterBaseline(baseline)
  const days100Baseline = resolveDaysOver100Baseline(temperature, wetBulb)
  const tempDays = currentData.days_over_100
  const wbDays = wbCurrent?.days_over_100F as number | undefined
  const days100Current =
    tempDays != null && tempDays > 0 ? tempDays : (wbDays ?? tempDays ?? 0)

  return {
    current: {
      ...currentData,
      annual_avg: currentData.annual_avg,
      summer_avg: currentData.summer_avg ?? summerBaseline,
      winter_avg: currentData.winter_avg ?? winterBaseline,
      days_over_100: days100Current,
      days_over_110: currentData.days_over_110 ?? 0,
    },
    baseline: {
      avg_annual: baseline.avg_annual as number,
      summer_avg: summerBaseline,
      winter_avg: winterBaseline,
      days_over_100: days100Baseline,
      days_over_110: (baseline.days_over_110 as number) ?? 0,
    },
    decade: yearKey,
    tempIncrease: currentData.annual_avg - (baseline.avg_annual as number),
    daysOver100Increase: days100Current - days100Baseline,
  }
}

export function getWetBulbStats(
  wetBulb: WetBulbRecord | null,
  projectionYear: number
): { current: Record<string, number>; baseline: Record<string, number>; year: number } | null {
  if (!wetBulb?.projections || !wetBulb.baseline_1995_2014) return null

  const years = Object.keys(wetBulb.projections).map(Number).sort((a, b) => a - b)
  const closestYear = nearestProjectionYear(projectionYear)
  const yearKey = years.includes(closestYear)
    ? closestYear
    : years.reduce((prev, curr) =>
        Math.abs(curr - projectionYear) < Math.abs(prev - projectionYear) ? curr : prev
      )

  return {
    current: wetBulb.projections[String(yearKey)] as Record<string, number>,
    baseline: wetBulb.baseline_1995_2014 as Record<string, number>,
    year: yearKey,
  }
}

export function buildHumiditySeries(wetBulb: WetBulbRecord | null): ChartDataPoint[] {
  if (!wetBulb?.projections) return []
  const baseline =
    (wetBulb.baseline_1995_2014?.avg_summer_humidity as number | undefined) ??
    wetBulb.baseline_humidity ??
    0

  return Object.keys(wetBulb.projections)
    .map(Number)
    .sort((a, b) => a - b)
    .map(year => {
      const row = wetBulb.projections![String(year)]
      return {
        year,
        humidity: row.avg_summer_humidity ?? 0,
        peak: row.peak_humidity ?? 0,
        baseline,
      }
    })
}

export function buildWetBulbSeries(wetBulb: WetBulbRecord | null): ChartDataPoint[] {
  if (!wetBulb?.projections || !wetBulb.baseline_1995_2014) return []
  const baselineEvents = (wetBulb.baseline_1995_2014.wet_bulb_events as number) ?? 0

  return Object.keys(wetBulb.projections)
    .map(Number)
    .sort((a, b) => a - b)
    .map(year => {
      const row = wetBulb.projections![String(year)]
      return {
        year,
        events: row.wet_bulb_events ?? 0,
        baseline: baselineEvents,
      }
    })
}

interface RiverFlowEntry {
  scenarios?: Record<
    string,
    {
      flow_percentage?: Record<string, number>
      flow_status?: Record<string, string>
    }
  >
}

const RIVER_FLOW_PROJECTION_KEYS = Object.keys(
  (riverFlowProjections as { rivers: Record<string, RiverFlowEntry> }).rivers
)

function normalizeRiverProjectionKey(riverName: string): string | null {
  if (RIVER_FLOW_PROJECTION_KEYS.includes(riverName)) return riverName
  const stripped = riverName.replace(/\s+River$/i, '').trim()
  if (RIVER_FLOW_PROJECTION_KEYS.includes(stripped)) return stripped
  const firstWord = stripped.split(/\s+/)[0]
  if (RIVER_FLOW_PROJECTION_KEYS.includes(firstWord)) return firstWord
  return null
}

function flowPercentageFromRiversGeo(riverName: string): Record<string, number> | null {
  const feature = riversData.features.find(f => f.properties?.name === riverName)
  const projections = feature?.properties?.flow_projections as Record<string, number> | undefined
  const baseline = projections?.['2025']
  if (!projections || !baseline) return null

  const flow_percentage: Record<string, number> = {}
  for (const [year, flow] of Object.entries(projections)) {
    flow_percentage[year] = Math.round((flow / baseline) * 1000) / 10
  }
  return flow_percentage
}

function resolveRiverFlowPercentage(
  riverName: string,
  scenario: SspScenario
): Record<string, number> | null {
  const rivers = (riverFlowProjections as { rivers: Record<string, RiverFlowEntry> }).rivers
  const projectionKey = normalizeRiverProjectionKey(riverName)
  if (projectionKey) {
    const scenarioData = rivers[projectionKey]?.scenarios?.[scenario]
    if (scenarioData?.flow_percentage) return scenarioData.flow_percentage
  }
  return flowPercentageFromRiversGeo(riverName)
}

function riverHasFlowData(riverName: string, scenario: SspScenario): boolean {
  return resolveRiverFlowPercentage(riverName, scenario) != null
}

/** Linear interpolation onto the dashboard decade grid (2025–2095). */
function interpolateFlowAtYear(
  flowPercentage: Record<string, number>,
  year: number
): number | null {
  const availableYears = Object.keys(flowPercentage)
    .map(Number)
    .sort((a, b) => a - b)
  if (!availableYears.length) return null

  if (flowPercentage[String(year)] != null) {
    return flowPercentage[String(year)]
  }

  let lowerYear = availableYears[0]
  let upperYear = availableYears[availableYears.length - 1]

  if (year <= lowerYear) return flowPercentage[String(lowerYear)]
  if (year >= upperYear) return flowPercentage[String(upperYear)]

  for (let i = 0; i < availableYears.length - 1; i++) {
    if (availableYears[i] <= year && availableYears[i + 1] >= year) {
      lowerYear = availableYears[i]
      upperYear = availableYears[i + 1]
      break
    }
  }

  const lowerFlow = flowPercentage[String(lowerYear)]
  const upperFlow = flowPercentage[String(upperYear)]
  const ratio = (year - lowerYear) / (upperYear - lowerYear)
  return Math.round((lowerFlow + (upperFlow - lowerFlow) * ratio) * 10) / 10
}

function normalizeFlowToProjectionYears(
  flowPercentage: Record<string, number>
): Record<string, number> {
  const normalized: Record<string, number> = {}
  for (const year of PROJECTION_YEARS) {
    const value = interpolateFlowAtYear(flowPercentage, year)
    if (value != null) normalized[String(year)] = value
  }
  return normalized
}

function getPrimaryRiverConnection(metroName: string, scenario: SspScenario) {
  const connections = findRiversForMetro(metroName)
  if (!connections.length) return null

  const sorted = [...connections].sort((a, b) => b.dependencyPercent - a.dependencyPercent)
  return sorted.find(c => riverHasFlowData(c.riverName, scenario)) ?? sorted[0]
}

export interface DroughtStats {
  riverName: string
  flowPct: number
  droughtIndex: number
  status: string
  year: number
  climateRisk?: string
}

export function getDroughtStats(
  metroName: string,
  scenario: SspScenario,
  projectionYear: number,
  climateRisk?: string
): DroughtStats | null {
  const primary = getPrimaryRiverConnection(metroName, scenario)
  if (!primary) return null

  const flowPercentage = resolveRiverFlowPercentage(primary.riverName, scenario)
  if (!flowPercentage) return null

  const yearKey = String(nearestProjectionYear(projectionYear))
  const flowPct = flowPercentage[yearKey] ?? flowPercentage['2025']
  const status = 'unknown'

  return {
    riverName: primary.riverName,
    flowPct,
    droughtIndex: Math.round(100 - flowPct),
    status,
    year: Number(yearKey),
    climateRisk,
  }
}

export function buildDroughtSeries(metroName: string, scenario: SspScenario): ChartDataPoint[] {
  const primary = getPrimaryRiverConnection(metroName, scenario)
  if (!primary) return []

  const raw = resolveRiverFlowPercentage(primary.riverName, scenario)
  if (!raw) return []

  const flowPercentage = normalizeFlowToProjectionYears(raw)

  return PROJECTION_YEARS.map(year => ({
    year,
    flowPct: flowPercentage[String(year)],
    droughtIndex: Math.round(100 - flowPercentage[String(year)]),
  }))
}

export function getPrimaryRiverName(metroName: string, scenario: SspScenario = 'ssp245'): string | null {
  return getPrimaryRiverConnection(metroName, scenario)?.riverName ?? null
}

function buildMultiCityRiverMetricSeries(
  locations: { metroKey: string; metroName: string }[],
  scenario: SspScenario,
  valueKey: 'flowPct' | 'droughtIndex'
): { data: ChartDataPoint[]; series: { key: string; label: string; color: string }[] } {
  const perMetro = locations
    .map((loc, index) => ({
      loc,
      color: metroChartColor(index),
      points: buildDroughtSeries(loc.metroName, scenario),
    }))
    .filter(entry => entry.points.length > 0)

  if (!perMetro.length) return { data: [], series: [] }

  const years = [...PROJECTION_YEARS]

  const series = perMetro.map(({ loc, color }) => ({
    key: metroSeriesKey(loc.metroKey),
    label: loc.metroName,
    color,
  }))

  const data = years.map(year => {
    const row: ChartDataPoint = { year }
    for (const { loc, points } of perMetro) {
      const point = points.find(p => p.year === year)
      if (point && point[valueKey] != null) {
        row[metroSeriesKey(loc.metroKey)] = point[valueKey] as number
      }
    }
    return row
  })

  return { data, series }
}

export function buildMultiCityRiverFlowSeries(
  locations: { metroKey: string; metroName: string }[],
  scenario: SspScenario
) {
  return buildMultiCityRiverMetricSeries(locations, scenario, 'flowPct')
}

export function buildMultiCityDroughtStressSeries(
  locations: { metroKey: string; metroName: string }[],
  scenario: SspScenario
) {
  return buildMultiCityRiverMetricSeries(locations, scenario, 'droughtIndex')
}

const PRECIP_BASELINE_YEAR = 2025

export function buildProjectedPrecipitationSeries(
  metroName: string,
  baselinePrecipMm: number,
  scenario: SspScenario
): ChartDataPoint[] {
  const flowSeries = buildDroughtSeries(metroName, scenario)
  if (!flowSeries.length || baselinePrecipMm <= 0) return []

  const baseFlow =
    (flowSeries.find(p => p.year === PRECIP_BASELINE_YEAR)?.flowPct as number | undefined) ??
    (flowSeries[0].flowPct as number)

  if (!baseFlow) return []

  return flowSeries.map(p => ({
    year: p.year,
    precip: Math.round(baselinePrecipMm * ((p.flowPct as number) / baseFlow) * 100) / 100,
    baseline: baselinePrecipMm,
  }))
}

export function buildMultiCityProjectedPrecipitation(
  locations: { metroKey: string; metroName: string }[],
  scenario: SspScenario,
  baselines: Record<string, number>
): { data: ChartDataPoint[]; series: { key: string; label: string; color: string }[] } {
  const perMetro = locations
    .map((loc, index) => ({
      loc,
      color: metroChartColor(index),
      points: baselines[loc.metroKey]
        ? buildProjectedPrecipitationSeries(loc.metroName, baselines[loc.metroKey], scenario)
        : [],
    }))
    .filter(entry => entry.points.length > 0)

  if (!perMetro.length) return { data: [], series: [] }

  const years = [...PROJECTION_YEARS]

  const series = perMetro.map(({ loc, color }) => ({
    key: metroSeriesKey(loc.metroKey),
    label: loc.metroName,
    color,
  }))

  const data = years.map(year => {
    const row: ChartDataPoint = { year }
    for (const { loc, points } of perMetro) {
      const point = points.find(p => p.year === year)
      if (point?.precip != null) row[metroSeriesKey(loc.metroKey)] = point.precip as number
    }
    return row
  })

  return { data, series }
}
