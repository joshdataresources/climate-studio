/**
 * Feet of sea level rise the app projects for a given forecast year.
 *
 * Kept here rather than inline so the Climate Projections panel and the map layer
 * cannot drift apart. They did: the panel computed this figure and displayed it,
 * while the map interpolated a `seaLevelRiseFeet` state whose setter was never
 * called, so dragging the year slider changed the number on screen while the map
 * kept drawing the 3 ft inundation.
 *
 * NOAA publishes its inundation tiles in whole feet, so the result is rounded and
 * clamped to the range the tile endpoint can actually serve.
 */
export const NOAA_MIN_FEET = 1
export const NOAA_MAX_FEET = 10

const BASE_YEAR = 2025
const END_YEAR = 2100

export function seaLevelFeetForYear(year: number): number {
  const progress = (year - BASE_YEAR) / (END_YEAR - BASE_YEAR)
  const feet = Math.round(NOAA_MIN_FEET + progress * (NOAA_MAX_FEET - NOAA_MIN_FEET))
  return Math.min(NOAA_MAX_FEET, Math.max(NOAA_MIN_FEET, feet))
}
