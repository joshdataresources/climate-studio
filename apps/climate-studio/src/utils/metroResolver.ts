import metroTempProjections from '../data/metro_temperature_projections.json'
import wetBulbProjections from '../data/expanded_wet_bulb_projections.json'
import megaregionData from '../data/megaregion-data.json'
import { cityMatches } from './riverMetroConnections'

export interface MetroRecord {
  name: string
  lat: number
  lon: number
  baseline_1995_2014?: Record<string, number>
  projections?: Record<string, Record<string, Record<string, number>>>
}

export interface MetroMatch {
  key: string
  name: string
  lat: number
  lon: number
  distanceKm?: number
  resolvedFrom?: string
}

export interface WetBulbRecord {
  name: string
  lat: number
  lon: number
  baseline_1995_2014?: Record<string, number>
  projections?: Record<string, Record<string, number>>
}

export interface PopulationRecord {
  name: string
  lat: number
  lon: number
  climate_risk?: string
  populations?: Record<string, number>
}

export interface MetroDataBundle {
  metroKey: string
  temperature: MetroRecord | null
  wetBulb: WetBulbRecord | null
  population: PopulationRecord | null
}

const metros = metroTempProjections as Record<string, MetroRecord>

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

export function getAllMetroKeys(): string[] {
  return Object.keys(metros).sort()
}

/** Fuzzy name match against metro temperature dataset keys/names. */
export function resolveMetroByName(searchLabel: string): MetroMatch | null {
  const normalized = searchLabel.trim()
  if (!normalized) return null

  for (const [key, record] of Object.entries(metros)) {
    if (cityMatches(key, normalized) || cityMatches(record.name, normalized)) {
      return { key, name: record.name, lat: record.lat, lon: record.lon, resolvedFrom: searchLabel }
    }
  }
  return null
}

/** Find nearest metro with temperature projection data. */
export function resolveNearestMetro(lat: number, lon: number, resolvedFrom?: string): MetroMatch | null {
  let best: MetroMatch | null = null
  let bestDist = Infinity

  for (const [key, record] of Object.entries(metros)) {
    const dist = haversineKm(lat, lon, record.lat, record.lon)
    if (dist < bestDist) {
      bestDist = dist
      best = {
        key,
        name: record.name,
        lat: record.lat,
        lon: record.lon,
        distanceKm: Math.round(dist),
        resolvedFrom,
      }
    }
  }
  return best
}

function normalizeMetroLabel(name: string): string {
  return name
    .toLowerCase()
    .replace(/,/g, '')
    .replace(/\s+(tx|az|ga|nv|ny|ca|fl|etc)\.?$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function findWetBulbRecord(metroKey: string, metroName: string): WetBulbRecord | null {
  const wetBulbJson = wetBulbProjections as Record<string, WetBulbRecord>
  if (wetBulbJson[metroKey]) return wetBulbJson[metroKey]

  const target = normalizeMetroLabel(metroName)
  const keyNorm = normalizeMetroLabel(metroKey)

  return (
    wetBulbJson[metroKey] ??
    Object.entries(wetBulbJson).find(([key, city]) => {
      const cityNorm = normalizeMetroLabel(city.name)
      return cityNorm === target || cityNorm === keyNorm || key === metroKey
    })?.[1] ??
    null
  )
}

function findPopulationRecord(metroKey: string, metroName: string): PopulationRecord | null {
  const metrosList = (megaregionData as { metros: PopulationRecord[] }).metros ?? []
  return (
    metrosList.find(
      m =>
        cityMatches(m.name, metroName) ||
        cityMatches(m.name, metroKey) ||
        cityMatches(metroKey, m.name)
    ) ?? null
  )
}

export function loadMetroBundle(metroKey: string): MetroDataBundle {
  const temperature = metros[metroKey] ?? null
  const name = temperature?.name ?? metroKey
  return {
    metroKey,
    temperature,
    wetBulb: findWetBulbRecord(metroKey, name),
    population: findPopulationRecord(metroKey, name),
  }
}
