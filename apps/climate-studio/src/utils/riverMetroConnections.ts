/**
 * River-Metro Connection Utilities
 * 
 * Functions to help identify and visualize rivers that connect to metro cities
 * in the Metro Statistics Climate layer.
 */

import megaregionData from '../data/megaregion-data.json'
import riversData from '../data/rivers.json'
import metroConnectingRiversData from '../data/metro-connecting-rivers.json'

export interface Metro {
  name: string
  lat: number
  lon: number
  climate_risk: string
  region: string
  megaregion: string
  populations: Record<string, number>
}

export interface RiverConnection {
  riverName: string
  metroName: string
  dependencyPercent: number
  connectionType: 'primary_source' | 'significant_supply' | 'upstream_limiting'
  waterAccessRisk: 'high' | 'medium' | 'low'
  urbanProsperityImpact: 'critical' | 'significant' | 'moderate'
  distance?: number
}

export interface MetroRiverInfo {
  metro: Metro
  connections: RiverConnection[]
  totalDependency: number
  highestRisk: 'high' | 'medium' | 'low'
  criticalRivers: number
}

/**
 * Find all rivers connected to a specific metro city
 */
export function findRiversForMetro(metroName: string): RiverConnection[] {
  const connections: RiverConnection[] = []
  
  // Check major rivers (rivers.json)
  riversData.features.forEach(river => {
    if (river.properties?.cities_supplied) {
      river.properties.cities_supplied.forEach((city: any) => {
        if (cityMatches(city.name, metroName)) {
          connections.push({
            riverName: river.properties.name,
            metroName: metroName,
            dependencyPercent: parseFloat(city.dependency.replace('%', '')),
            connectionType: 'primary_source', // Major rivers are typically primary
            waterAccessRisk: calculateRiskFromFlow(river.properties),
            urbanProsperityImpact: 'critical',
          })
        }
      })
    }
  })
  
  // Check connecting rivers (metro-connecting-rivers.json)
  metroConnectingRiversData.features.forEach(river => {
    if (river.properties?.metro_cities) {
      river.properties.metro_cities.forEach((city: any) => {
        if (cityMatches(city.name, metroName)) {
          connections.push({
            riverName: river.properties.name,
            metroName: metroName,
            dependencyPercent: city.dependency_percent,
            connectionType: city.connection_type,
            waterAccessRisk: city.water_access_risk,
            urbanProsperityImpact: city.urban_prosperity_impact,
          })
        }
      })
    }
  })
  
  return connections
}

/**
 * Get comprehensive river information for a metro city
 */
export function getMetroRiverInfo(metroName: string): MetroRiverInfo | null {
  const metro = megaregionData.metros.find(m => 
    cityMatches(m.name, metroName)
  )
  
  if (!metro) return null
  
  const connections = findRiversForMetro(metroName)
  const totalDependency = connections.reduce((sum, c) => sum + c.dependencyPercent, 0)
  const highestRisk = connections.reduce((highest, c) => {
    const riskOrder = { high: 3, medium: 2, low: 1 }
    return riskOrder[c.waterAccessRisk] > riskOrder[highest] 
      ? c.waterAccessRisk 
      : highest
  }, 'low' as 'high' | 'medium' | 'low')
  
  const criticalRivers = connections.filter(c => 
    c.urbanProsperityImpact === 'critical'
  ).length
  
  return {
    metro,
    connections,
    totalDependency,
    highestRisk,
    criticalRivers
  }
}

/**
 * Get all metros with their river connections
 */
export function getAllMetroRiverInfo(): MetroRiverInfo[] {
  return megaregionData.metros
    .map(metro => getMetroRiverInfo(metro.name))
    .filter((info): info is MetroRiverInfo => info !== null)
    .filter(info => info.connections.length > 0) // Only metros with connections
}

/**
 * Filter rivers by visibility criteria
 */
export function filterRiversForDisplay(
  rivers: any[],
  options: {
    minFlow?: number
    maxFlow?: number
    showOnlyHighRisk?: boolean
    showOnlyCritical?: boolean
  } = {}
): any[] {
  return rivers.filter(river => {
    const flow = river.properties?.baseline_flow_cfs_2025 || 
                 river.properties?.flow_projections?.['2025'] || 0
    
    // Flow range filter
    if (options.minFlow && flow < options.minFlow) return false
    if (options.maxFlow && flow > options.maxFlow) return false
    
    // Risk filter
    if (options.showOnlyHighRisk) {
      const risk = river.properties?.water_access_risk ||
                   river.properties?.metro_cities?.[0]?.water_access_risk
      if (risk !== 'high') return false
    }
    
    // Critical impact filter
    if (options.showOnlyCritical) {
      const impact = river.properties?.urban_prosperity_impact ||
                     river.properties?.metro_cities?.[0]?.urban_prosperity_impact
      if (impact !== 'critical') return false
    }
    
    return true
  })
}

/**
 * Get river color based on flow depletion
 */
export function getRiverColor(
  properties: any,
  projectionYear: number = 2025
): string {
  const baseline = properties?.baseline_flow_cfs_2025 || 
                   properties?.flow_projections?.['2025']
  const projections = properties?.flow_projections
  
  if (!baseline || !projections) {
    return '#6366f1' // Default purple
  }
  
  const currentFlow = getFlowForYear(projections, projectionYear)
  if (currentFlow === null) {
    return '#6366f1'
  }
  
  const percentageOfBaseline = (currentFlow / baseline) * 100
  
  if (percentageOfBaseline >= 95) {
    return '#22c55e' // Green - Stable
  }
  if (percentageOfBaseline >= 80) {
    return '#3b82f6' // Blue - Moderate decline
  }
  if (percentageOfBaseline >= 60) {
    return '#f97316' // Orange - Significant decline
  }
  
  return '#ef4444' // Red - Severe decline
}

/**
 * Get flow for a specific year from projections
 */
function getFlowForYear(
  projections: Record<string, number>,
  year: number
): number | null {
  if (!projections) return null
  
  const availableYears = Object.keys(projections)
    .map(Number)
    .sort((a, b) => a - b)
  
  if (projections[year.toString()]) {
    return projections[year.toString()]
  }
  
  // Interpolate between nearest years
  let lowerYear = availableYears[0]
  let upperYear = availableYears[availableYears.length - 1]
  
  for (let i = 0; i < availableYears.length - 1; i++) {
    if (availableYears[i] <= year && availableYears[i + 1] >= year) {
      lowerYear = availableYears[i]
      upperYear = availableYears[i + 1]
      break
    }
  }
  
  if (year <= lowerYear) return projections[lowerYear.toString()]
  if (year >= upperYear) return projections[upperYear.toString()]
  
  // Linear interpolation
  const lowerFlow = projections[lowerYear.toString()]
  const upperFlow = projections[upperYear.toString()]
  const ratio = (year - lowerYear) / (upperYear - lowerYear)
  
  return lowerFlow + (upperFlow - lowerFlow) * ratio
}

/**
 * Calculate risk from flow properties
 */
function calculateRiskFromFlow(properties: any): 'high' | 'medium' | 'low' {
  const projections = properties?.flow_projections
  if (!projections) return 'low'
  
  const baseline = projections['2025'] || 0
  const future = projections['2050'] || baseline
  
  const decline = ((baseline - future) / baseline) * 100
  
  if (decline > 30) return 'high'
  if (decline > 15) return 'medium'
  return 'low'
}

/**
 * Check if city names match (flexible matching)
 */
function cityMatches(city1: string, city2: string): boolean {
  const normalize = (name: string) => 
    name.toLowerCase()
      .replace(/,/g, '')
      .replace(/\s+/g, ' ')
      .trim()
  
  const n1 = normalize(city1)
  const n2 = normalize(city2)
  
  return n1 === n2 || 
         n1.includes(n2) || 
         n2.includes(n1)
}

/**
 * Get all rivers that should be displayed for visible metros
 */
export function getRiversForVisibleMetros(
  visibleMetroNames: string[],
  projectionYear: number = 2025
): any[] {
  const allRivers: any[] = []
  
  // Get rivers from both datasets
  const majorRivers = riversData.features.map(river => ({
    ...river,
    source: 'major'
  }))
  
  const connectingRivers = metroConnectingRiversData.features.map(river => ({
    ...river,
    source: 'connecting'
  }))
  
  // Filter to only rivers connected to visible metros
  const relevantRivers = [...majorRivers, ...connectingRivers].filter(river => {
    // Check if river supplies any visible metro
    const citiesSupplied = river.properties?.cities_supplied || 
                          river.properties?.metro_cities || []
    
    return citiesSupplied.some((city: any) => {
      const cityName = city.name || city.metro_name
      return visibleMetroNames.some(metroName => 
        cityMatches(cityName, metroName)
      )
    })
  })
  
  // Enhance with colors based on projection year
  return relevantRivers.map(river => ({
    ...river,
    properties: {
      ...river.properties,
      lineColor: getRiverColor(river.properties, projectionYear)
    }
  }))
}
