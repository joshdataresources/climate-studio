import { getAquiferStoragePercentAt } from './metroAquiferData'
import { loadMetroBundle } from './metroResolver'
import {
  getDroughtStats,
  getTemperatureStats,
  getWetBulbStats,
  hasTemperatureScenario,
} from './metroChartData'
import { getMetroRiverInfo } from './riverMetroConnections'
import type { SspScenario } from './scenarioMapping'

export type OutlookLevel = 'stable' | 'manageable' | 'watch' | 'stressed' | 'critical'

export interface DomainOutlook {
  id: string
  label: string
  present: OutlookLevel
  future: OutlookLevel
  presentDetail: string
  futureDetail: string
}

export interface MetroOutlook {
  presentYear: number
  futureYear: number
  presentLevel: OutlookLevel
  futureLevel: OutlookLevel
  headline: string
  narrative: string
  domains: DomainOutlook[]
}

const PRESENT_YEAR = 2025

const COASTAL_METRO_NAMES = [
  'Miami',
  'Tampa',
  'New Orleans',
  'Houston',
  'Boston',
  'New York',
  'Philadelphia',
  'Baltimore',
  'Washington',
  'Norfolk',
  'Charleston',
  'Jacksonville',
  'San Diego',
  'Los Angeles',
  'San Francisco',
  'Oakland',
  'Seattle',
  'Portland',
  'Honolulu',
  'Virginia Beach',
  'Mobile',
  'Galveston',
]

const LEVEL_ORDER: OutlookLevel[] = [
  'stable',
  'manageable',
  'watch',
  'stressed',
  'critical',
]

const LEVEL_LABELS: Record<OutlookLevel, string> = {
  stable: 'Stable',
  manageable: 'Manageable',
  watch: 'Watch',
  stressed: 'Stressed',
  critical: 'Critical',
}

export function outlookLevelLabel(level: OutlookLevel): string {
  return LEVEL_LABELS[level]
}

/** NOAA intermediate SLR heuristic — matches map layer scaling. */
export function estimateSeaLevelFeet(year: number): number {
  if (year >= 2100) return 10
  if (year <= 2025) return 1
  return Math.round((1 + ((year - 2025) / (2100 - 2025)) * 9) * 10) / 10
}

function isCoastalMetro(metroName: string): boolean {
  const normalized = metroName.toLowerCase()
  return COASTAL_METRO_NAMES.some(name => normalized.includes(name.toLowerCase()))
}

function scoreToLevel(score: number): OutlookLevel {
  if (score < 18) return 'stable'
  if (score < 36) return 'manageable'
  if (score < 54) return 'watch'
  if (score < 72) return 'stressed'
  return 'critical'
}

function maxLevel(a: OutlookLevel, b: OutlookLevel): OutlookLevel {
  return LEVEL_ORDER.indexOf(a) >= LEVEL_ORDER.indexOf(b) ? a : b
}

function heatScore(tempIncrease: number, daysOver100: number, daysBaseline: number): number {
  const daysDelta = Math.max(0, daysOver100 - daysBaseline)
  return Math.min(100, tempIncrease * 7 + daysDelta * 2.5)
}

function aquiferScore(remainingPct: number): number {
  return Math.min(100, Math.max(0, 100 - remainingPct) * 1.15)
}

function riverScore(flowPct: number, waterRisk: 'high' | 'medium' | 'low'): number {
  const decline = Math.max(0, 100 - flowPct)
  const riskBonus = waterRisk === 'high' ? 18 : waterRisk === 'medium' ? 8 : 0
  return Math.min(100, decline * 0.85 + riskBonus)
}

function humidityScore(wetBulbEvents: number, baselineEvents: number, atRiskPop?: number): number {
  const eventDelta = Math.max(0, wetBulbEvents - baselineEvents)
  let score = eventDelta * 4
  if (atRiskPop != null && atRiskPop > 0) {
    score += Math.min(30, Math.log10(atRiskPop + 1) * 8)
  }
  return Math.min(100, score)
}

function coastalScore(seaLevelFeet: number): number {
  if (seaLevelFeet <= 1.5) return 8
  if (seaLevelFeet <= 3) return 28
  if (seaLevelFeet <= 5) return 48
  if (seaLevelFeet <= 7) return 68
  return Math.min(100, 68 + (seaLevelFeet - 7) * 10)
}

function buildHeadline(present: OutlookLevel, future: OutlookLevel, futureYear: number): string {
  if (present === future) {
    return `${LEVEL_LABELS[future]} outlook through ${futureYear}`
  }
  if (LEVEL_ORDER.indexOf(future) <= LEVEL_ORDER.indexOf(present)) {
    return `${LEVEL_LABELS[present]} today · holds through ${futureYear}`
  }
  return `${LEVEL_LABELS[present]} today · ${LEVEL_LABELS[future].toLowerCase()} by ${futureYear}`
}

function buildNarrative(
  present: OutlookLevel,
  future: OutlookLevel,
  futureYear: number,
  domains: DomainOutlook[]
): string {
  const worsening = domains.filter(
    d => LEVEL_ORDER.indexOf(d.future) > LEVEL_ORDER.indexOf(d.present)
  )

  if (!worsening.length) {
    return `Projections stay within a ${LEVEL_LABELS[present].toLowerCase()} band for this metro under the selected scenario.`
  }

  const drivers = worsening.slice(0, 3).map(d => d.label.toLowerCase()).join(', ')
  const shift =
    LEVEL_ORDER.indexOf(future) > LEVEL_ORDER.indexOf(present)
      ? `Overall outlook shifts from ${LEVEL_LABELS[present].toLowerCase()} to ${LEVEL_LABELS[future].toLowerCase()} by ${futureYear}.`
      : `Some stress drivers intensify by ${futureYear}, but the composite outlook stays ${LEVEL_LABELS[future].toLowerCase()}.`

  return `${shift} Primary drivers: ${drivers}.`
}

export interface MetroOutlookInput {
  metroKey: string
  metroName: string
  lat: number
  lon: number
  scenario: SspScenario
  projectionYear: number
}

export function getMetroOutlook(input: MetroOutlookInput): MetroOutlook | null {
  const bundle = loadMetroBundle(input.metroKey)
  const { temperature, wetBulb, population } = bundle

  if (!hasTemperatureScenario(temperature, input.scenario)) return null

  const presentYear = PRESENT_YEAR
  const futureYear = input.projectionYear

  const presentTemp = getTemperatureStats(temperature, input.scenario, presentYear, wetBulb)
  const futureTemp = getTemperatureStats(temperature, input.scenario, futureYear, wetBulb)
  if (!presentTemp || !futureTemp) return null

  const presentWb = getWetBulbStats(wetBulb, presentYear)
  const futureWb = getWetBulbStats(wetBulb, futureYear)

  const riverInfo = getMetroRiverInfo(input.metroName)
  const presentDrought = getDroughtStats(
    input.metroName,
    input.scenario,
    presentYear,
    population?.climate_risk
  )
  const futureDrought = getDroughtStats(
    input.metroName,
    input.scenario,
    futureYear,
    population?.climate_risk
  )

  const presentAquifer = getAquiferStoragePercentAt(input.lat, input.lon, presentYear)
  const futureAquifer = getAquiferStoragePercentAt(input.lat, input.lon, futureYear)

  const coastal = isCoastalMetro(input.metroName)
  const presentSlr = coastal ? estimateSeaLevelFeet(presentYear) : null
  const futureSlr = coastal ? estimateSeaLevelFeet(futureYear) : null

  const domains: DomainOutlook[] = []

  domains.push({
    id: 'heat',
    label: 'Extreme heat',
    present: scoreToLevel(
      heatScore(
        presentTemp.tempIncrease,
        presentTemp.current.days_over_100,
        presentTemp.baseline.days_over_100
      )
    ),
    future: scoreToLevel(
      heatScore(
        futureTemp.tempIncrease,
        futureTemp.current.days_over_100,
        futureTemp.baseline.days_over_100
      )
    ),
    presentDetail: `+${presentTemp.tempIncrease.toFixed(1)}°F · ${presentTemp.current.days_over_100} days >100°F`,
    futureDetail: `+${futureTemp.tempIncrease.toFixed(1)}°F · ${futureTemp.current.days_over_100} days >100°F`,
  })

  if (presentWb && futureWb) {
    domains.push({
      id: 'humidity',
      label: 'Heat & humidity',
      present: scoreToLevel(
        humidityScore(
          presentWb.current.wet_bulb_events as number,
          presentWb.baseline.wet_bulb_events as number,
          presentWb.current.estimated_at_risk_population as number | undefined
        )
      ),
      future: scoreToLevel(
        humidityScore(
          futureWb.current.wet_bulb_events as number,
          futureWb.baseline.wet_bulb_events as number,
          futureWb.current.estimated_at_risk_population as number | undefined
        )
      ),
      presentDetail: `${presentWb.current.wet_bulb_events} dangerous heat-humidity events`,
      futureDetail: `${futureWb.current.wet_bulb_events} dangerous heat-humidity events`,
    })
  }

  if (presentDrought && futureDrought && riverInfo) {
    domains.push({
      id: 'water',
      label: 'River & water supply',
      present: scoreToLevel(
        riverScore(presentDrought.flowPct, riverInfo.highestRisk)
      ),
      future: scoreToLevel(
        riverScore(futureDrought.flowPct, riverInfo.highestRisk)
      ),
      presentDetail: `${presentDrought.riverName} at ${presentDrought.flowPct}% of baseline flow`,
      futureDetail: `${futureDrought.riverName} at ${futureDrought.flowPct}% of baseline flow`,
    })
  }

  if (presentAquifer && futureAquifer) {
    domains.push({
      id: 'aquifer',
      label: 'Aquifer storage',
      present: scoreToLevel(aquiferScore(presentAquifer.remainingPct)),
      future: scoreToLevel(aquiferScore(futureAquifer.remainingPct)),
      presentDetail: `${presentAquifer.remainingPct}% of 2025 capacity · ${presentAquifer.name}`,
      futureDetail: `${futureAquifer.remainingPct}% of 2025 capacity · ${futureAquifer.name}`,
    })
  }

  if (presentSlr != null && futureSlr != null) {
    domains.push({
      id: 'coastal',
      label: 'Sea level rise',
      present: scoreToLevel(coastalScore(presentSlr)),
      future: scoreToLevel(coastalScore(futureSlr)),
      presentDetail: `~${presentSlr} ft above today (NOAA intermediate)`,
      futureDetail: `~${futureSlr} ft above today (NOAA intermediate)`,
    })
  }

  const resolvedPresent = domains.reduce(
    (worst, d) => maxLevel(worst, d.present),
    scoreToLevel(
      heatScore(
        presentTemp.tempIncrease,
        presentTemp.current.days_over_100,
        presentTemp.baseline.days_over_100
      )
    )
  )

  const futureLevel = domains.reduce(
    (worst, d) => maxLevel(worst, d.future),
    scoreToLevel(
      heatScore(
        futureTemp.tempIncrease,
        futureTemp.current.days_over_100,
        futureTemp.baseline.days_over_100
      )
    )
  )

  return {
    presentYear,
    futureYear,
    presentLevel: resolvedPresent,
    futureLevel,
    headline: buildHeadline(resolvedPresent, futureLevel, futureYear),
    narrative: buildNarrative(resolvedPresent, futureLevel, futureYear, domains),
    domains,
  }
}
