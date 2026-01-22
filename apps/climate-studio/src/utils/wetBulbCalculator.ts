/**
 * Wet Bulb Temperature Calculator
 *
 * Calculates wet bulb temperature from temperature and relative humidity.
 * Wet bulb temperature represents the lowest temperature that can be reached
 * by evaporative cooling - critical for human heat stress assessment.
 *
 * When wet bulb temperature exceeds 35°C (95°F), the human body cannot
 * effectively cool itself through sweating, making it potentially fatal
 * even for healthy individuals in shade with unlimited water.
 */

/**
 * Calculate wet bulb temperature using the Stull (2011) formula
 * This is an empirical approximation that works well for typical atmospheric conditions.
 *
 * @param tempF - Temperature in Fahrenheit
 * @param relativeHumidity - Relative humidity as percentage (0-100)
 * @returns Wet bulb temperature in Fahrenheit
 */
export function calculateWetBulbF(tempF: number, relativeHumidity: number): number {
  // Convert to Celsius for calculation
  const tempC = (tempF - 32) * 5 / 9

  // Stull (2011) formula - works for RH 5-99% and temp -20 to 50°C
  const wetBulbC = tempC * Math.atan(0.151977 * Math.sqrt(relativeHumidity + 8.313659)) +
    Math.atan(tempC + relativeHumidity) -
    Math.atan(relativeHumidity - 1.676331) +
    0.00391838 * Math.pow(relativeHumidity, 1.5) * Math.atan(0.023101 * relativeHumidity) -
    4.686035

  // Convert back to Fahrenheit
  return wetBulbC * 9 / 5 + 32
}

/**
 * Calculate wet bulb temperature in Celsius
 *
 * @param tempC - Temperature in Celsius
 * @param relativeHumidity - Relative humidity as percentage (0-100)
 * @returns Wet bulb temperature in Celsius
 */
export function calculateWetBulbC(tempC: number, relativeHumidity: number): number {
  // Stull (2011) formula
  return tempC * Math.atan(0.151977 * Math.sqrt(relativeHumidity + 8.313659)) +
    Math.atan(tempC + relativeHumidity) -
    Math.atan(relativeHumidity - 1.676331) +
    0.00391838 * Math.pow(relativeHumidity, 1.5) * Math.atan(0.023101 * relativeHumidity) -
    4.686035
}

/**
 * Determine the danger level of wet bulb temperature
 *
 * @param wetBulbC - Wet bulb temperature in Celsius
 * @returns Danger level category
 */
export function getWetBulbDangerLevel(wetBulbC: number): 'safe' | 'caution' | 'warning' | 'danger' | 'extreme' | 'fatal' {
  if (wetBulbC < 25) return 'safe'        // Normal conditions
  if (wetBulbC < 28) return 'caution'     // Some heat stress possible
  if (wetBulbC < 30) return 'warning'     // Significant heat stress
  if (wetBulbC < 32) return 'danger'      // Dangerous for extended exposure
  if (wetBulbC < 35) return 'extreme'     // Extremely dangerous
  return 'fatal'                          // Fatal for most humans within hours
}

/**
 * Get color for wet bulb danger visualization
 * Uses a gradient from yellow (low risk) to dark red (fatal risk)
 *
 * @param wetBulbC - Wet bulb temperature in Celsius
 * @returns Hex color string
 */
export function getWetBulbColor(wetBulbC: number): string {
  const level = getWetBulbDangerLevel(wetBulbC)
  const colors: Record<string, string> = {
    safe: '#fde047',      // Yellow - low risk but visible
    caution: '#fbbf24',   // Amber
    warning: '#fb923c',   // Orange
    danger: '#f97316',    // Dark orange
    extreme: '#ef4444',   // Red
    fatal: '#991b1b'      // Dark red
  }
  return colors[level]
}

/**
 * Get RGBA color array for Deck.GL layers
 *
 * @param wetBulbC - Wet bulb temperature in Celsius
 * @param alpha - Opacity (0-255)
 * @returns RGBA array [r, g, b, a]
 */
export function getWetBulbColorRGBA(wetBulbC: number, alpha: number = 180): [number, number, number, number] {
  const level = getWetBulbDangerLevel(wetBulbC)
  const colors: Record<string, [number, number, number, number]> = {
    safe: [253, 224, 71, alpha],      // Yellow
    caution: [251, 191, 36, alpha],   // Amber
    warning: [251, 146, 60, alpha],   // Orange
    danger: [249, 115, 22, alpha],    // Dark orange
    extreme: [239, 68, 68, alpha],    // Red
    fatal: [153, 27, 27, alpha]       // Dark red
  }
  return colors[level]
}

/**
 * Calculate the danger zone radius based on wet bulb events and population
 * More events + larger population = larger danger zone
 *
 * @param wetBulbEvents - Number of dangerous wet bulb events
 * @param population - Population in the metro area
 * @returns Radius in kilometers
 */
export function calculateDangerZoneRadius(wetBulbEvents: number, population: number): number {
  // Base radius depends on population (larger cities = larger zones)
  const populationFactor = Math.sqrt(population / 1000000) // Normalize to millions
  const baseRadius = 30 + populationFactor * 15 // 30-60km base

  // Scale with wet bulb events (more events = larger zone)
  const eventFactor = 1 + (wetBulbEvents / 50) * 0.5 // Up to 50% increase

  return Math.min(baseRadius * eventFactor, 120) // Cap at 120km
}

/**
 * Estimate wet bulb data from temperature projections
 * Used when only temperature data is available (no humidity projections)
 *
 * @param summerAvgF - Average summer temperature in Fahrenheit
 * @param baselineHumidity - Regional baseline humidity (0-100)
 * @param yearFromNow - Years from 2025
 * @returns Estimated wet bulb projection data
 */
export function estimateWetBulbProjection(
  summerAvgF: number,
  baselineHumidity: number,
  yearFromNow: number
): {
  avgSummerHumidity: number
  peakHumidity: number
  wetBulbEvents: number
  daysOver95F: number
  daysOver100F: number
  wetBulbTempC: number
  wetBulbTempF: number
} {
  // Humidity tends to increase with warming in humid regions, decrease in arid
  const humidityTrend = baselineHumidity > 60 ? 0.1 : -0.05 // % per year
  const projectedHumidity = Math.min(95, Math.max(30, baselineHumidity + humidityTrend * yearFromNow))
  const peakHumidity = Math.min(98, projectedHumidity + 5)

  // Calculate wet bulb temperature
  const wetBulbTempF = calculateWetBulbF(summerAvgF, projectedHumidity)
  const wetBulbTempC = (wetBulbTempF - 32) * 5 / 9

  // Estimate dangerous wet bulb events (days where WBT could approach dangerous levels)
  // Events increase exponentially as temperatures rise
  const tempAnomaly = summerAvgF - 90 // Baseline around 90°F
  const wetBulbEvents = Math.max(0, Math.round(
    Math.pow(Math.max(0, tempAnomaly), 1.5) * (projectedHumidity / 70) * 0.3
  ))

  // Estimate extreme temperature days
  const daysOver95F = Math.round(summerAvgF > 85 ? (summerAvgF - 85) * 8 : 0)
  const daysOver100F = Math.round(summerAvgF > 95 ? (summerAvgF - 95) * 6 : 0)

  return {
    avgSummerHumidity: Math.round(projectedHumidity),
    peakHumidity: Math.round(peakHumidity),
    wetBulbEvents,
    daysOver95F,
    daysOver100F,
    wetBulbTempC: Math.round(wetBulbTempC * 10) / 10,
    wetBulbTempF: Math.round(wetBulbTempF * 10) / 10
  }
}

/**
 * Regional baseline humidity values by metro area
 * Based on historical average summer humidity (1995-2014)
 */
export const REGIONAL_BASELINE_HUMIDITY: Record<string, number> = {
  // Gulf Coast - Very high humidity
  'Houston': 76,
  'New Orleans': 78,
  'Tampa': 74,
  'Miami': 75,
  'Jacksonville': 73,
  'Mobile': 77,

  // Southeast - High humidity
  'Atlanta': 68,
  'Charlotte': 66,
  'Raleigh': 67,
  'Nashville': 65,
  'Memphis': 68,
  'Birmingham': 69,

  // Mid-Atlantic / Northeast
  'Washington': 64,
  'Philadelphia': 62,
  'New York': 61,
  'Boston': 60,
  'Baltimore': 63,
  'Pittsburgh': 62,

  // Midwest
  'Chicago': 58,
  'Detroit': 59,
  'Cleveland': 61,
  'Minneapolis': 56,
  'St. Louis': 64,
  'Kansas City': 62,
  'Indianapolis': 63,
  'Cincinnati': 63,
  'Milwaukee': 58,
  'Columbus': 62,

  // Great Plains / Mountain West
  'Denver': 38,
  'Salt Lake City': 32,
  'Albuquerque': 28,
  'Oklahoma City': 55,
  'Omaha': 58,

  // Southwest - Arid
  'Phoenix': 24,
  'Las Vegas': 22,
  'Tucson': 26,
  'El Paso': 30,

  // West Coast
  'Los Angeles': 48,
  'San Diego': 54,
  'San Francisco': 62,
  'San Jose': 52,
  'Seattle': 58,
  'Portland': 55,
  'Sacramento': 40,

  // Texas
  'Dallas': 58,
  'Austin': 62,
  'San Antonio': 60,

  // Florida
  'Orlando': 72,

  // Default for unknown cities
  'default': 55
}

/**
 * Get baseline humidity for a city
 */
export function getBaselineHumidity(cityName: string): number {
  // Try exact match first
  if (cityName in REGIONAL_BASELINE_HUMIDITY) {
    return REGIONAL_BASELINE_HUMIDITY[cityName]
  }

  // Try partial match (for names like "Phoenix-Mesa-Scottsdale")
  for (const [key, value] of Object.entries(REGIONAL_BASELINE_HUMIDITY)) {
    if (cityName.includes(key) || key.includes(cityName.split(',')[0])) {
      return value
    }
  }

  return REGIONAL_BASELINE_HUMIDITY['default']
}

/**
 * Create GeoJSON circle polygon for visualization
 *
 * @param lng - Center longitude
 * @param lat - Center latitude
 * @param radiusKm - Radius in kilometers
 * @param numPoints - Number of points in the polygon (default 64)
 * @returns Array of coordinates forming a circle polygon
 */
export function createCirclePolygon(
  lng: number,
  lat: number,
  radiusKm: number,
  numPoints: number = 64
): number[][] {
  const coords: number[][] = []
  const earthRadiusKm = 6371

  for (let i = 0; i <= numPoints; i++) {
    const angle = (i / numPoints) * 2 * Math.PI

    // Convert km to degrees (rough approximation)
    const latOffset = (radiusKm / earthRadiusKm) * (180 / Math.PI)
    const lngOffset = (radiusKm / earthRadiusKm) * (180 / Math.PI) / Math.cos(lat * Math.PI / 180)

    coords.push([
      lng + lngOffset * Math.cos(angle),
      lat + latOffset * Math.sin(angle)
    ])
  }

  return coords
}

/**
 * Interpolate wet bulb data between projection years
 *
 * @param projections - Object with year keys and projection data
 * @param targetYear - Year to interpolate to
 * @returns Interpolated projection data
 */
export function interpolateWetBulbProjection(
  projections: Record<string, {
    avg_summer_humidity: number
    peak_humidity: number
    wet_bulb_events: number
    days_over_95F: number
    days_over_100F: number
    estimated_at_risk_population: number
    casualty_rate_percent: number
    extent_radius_km: number
  }>,
  targetYear: number
): {
  avg_summer_humidity: number
  peak_humidity: number
  wet_bulb_events: number
  days_over_95F: number
  days_over_100F: number
  estimated_at_risk_population: number
  casualty_rate_percent: number
  extent_radius_km: number
} {
  const years = Object.keys(projections).map(Number).sort((a, b) => a - b)

  // Find surrounding years
  let lowerYear = years[0]
  let upperYear = years[years.length - 1]

  for (const year of years) {
    if (year <= targetYear) lowerYear = year
    if (year >= targetYear && upperYear === years[years.length - 1]) upperYear = year
  }

  // If exact match or outside range, return closest
  if (lowerYear === upperYear || targetYear <= lowerYear) {
    return projections[lowerYear.toString()]
  }
  if (targetYear >= upperYear) {
    return projections[upperYear.toString()]
  }

  // Interpolate
  const ratio = (targetYear - lowerYear) / (upperYear - lowerYear)
  const lower = projections[lowerYear.toString()]
  const upper = projections[upperYear.toString()]

  return {
    avg_summer_humidity: Math.round(lower.avg_summer_humidity + (upper.avg_summer_humidity - lower.avg_summer_humidity) * ratio),
    peak_humidity: Math.round(lower.peak_humidity + (upper.peak_humidity - lower.peak_humidity) * ratio),
    wet_bulb_events: Math.round(lower.wet_bulb_events + (upper.wet_bulb_events - lower.wet_bulb_events) * ratio),
    days_over_95F: Math.round(lower.days_over_95F + (upper.days_over_95F - lower.days_over_95F) * ratio),
    days_over_100F: Math.round(lower.days_over_100F + (upper.days_over_100F - lower.days_over_100F) * ratio),
    estimated_at_risk_population: Math.round(lower.estimated_at_risk_population + (upper.estimated_at_risk_population - lower.estimated_at_risk_population) * ratio),
    casualty_rate_percent: Math.round((lower.casualty_rate_percent + (upper.casualty_rate_percent - lower.casualty_rate_percent) * ratio) * 10) / 10,
    extent_radius_km: Math.round(lower.extent_radius_km + (upper.extent_radius_km - lower.extent_radius_km) * ratio)
  }
}
