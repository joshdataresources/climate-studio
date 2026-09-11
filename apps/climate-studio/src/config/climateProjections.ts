/**
 * Published climate projections, kept in one place with their sources.
 *
 * These figures used to be invented inline in ClimateProjectionsWidget — a set of
 * linear formulas over made-up constants (`2.0 + yearProgress * 2.8`,
 * `precipBase = 800`, `droughtBase = 1.0`) presented to the user as projections.
 * Anything displayed as a projection should be traceable to a source, so the numbers
 * live here next to their citations and the widget reads them.
 *
 * Values are central estimates, not the full likely range. Both reports publish
 * ranges; if the UI ever shows uncertainty bands, they come from the same sources.
 */

export type ScenarioId = 'rcp26' | 'rcp45' | 'rcp85'

/**
 * Global mean sea level rise in feet, relative to a 2000 baseline.
 *
 * Source: NOAA Technical Report NOS 01, "Global and Regional Sea Level Rise
 * Scenarios for the United States" (2022), Table 2.2 — GMSL scenarios, converted
 * from metres. The report's scenarios are named by their 2100 value; the app's
 * emissions scenarios map onto them as the closest published track.
 *
 *   rcp26 → Intermediate-Low (0.5 m by 2100)
 *   rcp45 → Intermediate     (1.0 m by 2100)
 *   rcp85 → Intermediate-High(1.5 m by 2100)
 *
 * The previous code ramped to 10 ft by 2100 for every scenario. 10 ft is the deepest
 * inundation layer NOAA's Sea Level Rise Viewer publishes, not a projection — it is
 * roughly 3 m, above even the report's High scenario.
 */
const SEA_LEVEL_FEET_BY_DECADE: Record<ScenarioId, Record<number, number>> = {
  // NOAA Intermediate-Low: 0.1, 0.2, 0.3, 0.4, 0.5 m at 2030/2050/2070/2090/2100
  rcp26: { 2000: 0.0, 2020: 0.2, 2030: 0.3, 2040: 0.5, 2050: 0.7, 2060: 0.9, 2070: 1.0, 2080: 1.2, 2090: 1.4, 2100: 1.6 },
  // NOAA Intermediate: 1.0 m by 2100
  rcp45: { 2000: 0.0, 2020: 0.2, 2030: 0.4, 2040: 0.7, 2050: 1.0, 2060: 1.4, 2070: 1.8, 2080: 2.3, 2090: 2.8, 2100: 3.3 },
  // NOAA Intermediate-High: 1.5 m by 2100
  rcp85: { 2000: 0.0, 2020: 0.3, 2030: 0.5, 2040: 0.9, 2050: 1.4, 2060: 2.0, 2070: 2.7, 2080: 3.5, 2090: 4.2, 2100: 4.9 },
}

/**
 * Global surface temperature anomaly in °C, relative to the 1850-1900 baseline.
 *
 * Source: IPCC AR6 WG1 Summary for Policymakers, Table SPM.1 — best estimates for
 * near-term (2021-2040), mid-term (2041-2060) and long-term (2081-2100). RCP
 * scenarios are mapped to their closest SSP pathway:
 *
 *   rcp26 → SSP1-2.6  (1.5 / 1.7 / 1.8 °C)
 *   rcp45 → SSP2-4.5  (1.5 / 2.0 / 2.7 °C)
 *   rcp85 → SSP5-8.5  (1.6 / 2.4 / 4.4 °C)
 */
const TEMP_ANOMALY_BY_PERIOD: Record<ScenarioId, Record<number, number>> = {
  rcp26: { 2030: 1.5, 2050: 1.7, 2090: 1.8 },
  rcp45: { 2030: 1.5, 2050: 2.0, 2090: 2.7 },
  rcp85: { 2030: 1.6, 2050: 2.4, 2090: 4.4 },
}

/** Linear interpolation across a sparse year→value table, clamped at both ends. */
function interpolate(table: Record<number, number>, year: number): number {
  const years = Object.keys(table).map(Number).sort((a, b) => a - b)
  if (year <= years[0]) return table[years[0]]
  if (year >= years[years.length - 1]) return table[years[years.length - 1]]

  for (let i = 0; i < years.length - 1; i++) {
    const lo = years[i]
    const hi = years[i + 1]
    if (year >= lo && year <= hi) {
      const t = (year - lo) / (hi - lo)
      return table[lo] + (table[hi] - table[lo]) * t
    }
  }
  return table[years[years.length - 1]]
}

const asScenario = (scenario: string): ScenarioId =>
  scenario === 'rcp26' || scenario === 'rcp85' ? scenario : 'rcp45'

/** Projected global mean sea level rise, in feet, for a year and scenario. */
export function seaLevelRiseFeet(year: number, scenario: string): number {
  return interpolate(SEA_LEVEL_FEET_BY_DECADE[asScenario(scenario)], year)
}

/** Projected global temperature anomaly in °C above the 1850-1900 baseline. */
export function temperatureAnomalyC(year: number, scenario: string): number {
  return interpolate(TEMP_ANOMALY_BY_PERIOD[asScenario(scenario)], year)
}

/** Citations, so the UI can say where a figure came from. */
export const PROJECTION_SOURCES = {
  seaLevel: 'NOAA Technical Report NOS 01 (2022), GMSL scenarios',
  temperature: 'IPCC AR6 WG1, Table SPM.1',
} as const

/**
 * NOAA publishes its inundation layers in whole feet from 1 to 10, so the projected
 * rise is rounded to the nearest layer the tile service can actually serve.
 */
export const NOAA_MIN_FEET = 1
export const NOAA_MAX_FEET = 10

export function noaaInundationFeet(year: number, scenario: string): number {
  const feet = Math.round(seaLevelRiseFeet(year, scenario))
  return Math.min(NOAA_MAX_FEET, Math.max(NOAA_MIN_FEET, feet))
}
