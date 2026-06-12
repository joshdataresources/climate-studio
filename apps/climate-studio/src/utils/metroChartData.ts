import riverFlowProjections from '../data/river-flow-projections.json'
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

function projectionYears(temperature: MetroRecord, scenario: SspScenario): number[] {
  const data = temperature.projections?.[scenario]
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
  return temperature.projections?.[scenario]?.[String(year)]
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
  if (!temperature?.projections?.[scenario] || !temperature.baseline_1995_2014) return []

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
  if (!temperature?.projections?.[scenario] || !temperature.baseline_1995_2014) return []

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

  if (!temperature?.projections?.[scenario]) return []

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
  if (!temperature?.projections?.[scenario]) return []

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
  if (!temperature?.projections?.[scenario] || !temperature.baseline_1995_2014) return null

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
  const connections = findRiversForMetro(metroName)
  if (!connections.length) return null

  const primary = [...connections].sort((a, b) => b.dependencyPercent - a.dependencyPercent)[0]
  const rivers = (riverFlowProjections as { rivers: Record<string, RiverFlowEntry> }).rivers
  const scenarioData = rivers[primary.riverName]?.scenarios?.[scenario]
  if (!scenarioData?.flow_percentage) return null

  const yearKey = String(nearestProjectionYear(projectionYear))
  const flowPct = scenarioData.flow_percentage[yearKey] ?? scenarioData.flow_percentage['2025']
  const status = scenarioData.flow_status?.[yearKey] ?? 'unknown'

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
  const connections = findRiversForMetro(metroName)
  if (!connections.length) return []

  const primary = [...connections].sort((a, b) => b.dependencyPercent - a.dependencyPercent)[0]
  const scenarioData =
    (riverFlowProjections as { rivers: Record<string, RiverFlowEntry> }).rivers[primary.riverName]
      ?.scenarios?.[scenario]
  if (!scenarioData?.flow_percentage) return []

  return Object.keys(scenarioData.flow_percentage)
    .map(Number)
    .sort((a, b) => a - b)
    .map(year => ({
      year,
      flowPct: scenarioData.flow_percentage![String(year)],
      droughtIndex: Math.round(100 - scenarioData.flow_percentage![String(year)]),
    }))
}
