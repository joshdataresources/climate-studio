/**
 * Environmental Resilience Index — scoring engine
 *
 * Turns the project's existing per-metro climate data into a comparable
 * 0–100 resilience score, higher = more resilient. Five dimensions:
 *
 *   heat     — from expanded_wet_bulb_projections.json (peak wet-bulb + extreme
 *              heat days), min-max normalized across all metros for the year.
 *              Forward-looking (per decade, ssp585, to 2095).
 *   water    — ACCESS-WEIGHTED supply portfolio (metro-water-access.json,
 *              utility-documented mixes): Σ share × source-health, where
 *              rivers/reservoirs inherit projected flow retention
 *              (river-flow-projections.json), groundwater inherits aquifer
 *              stress (metro-aquifers.json), Great Lakes are buffered
 *              storage, desal/recycled are near climate-independent, and
 *              imports carry the source basin's health minus conveyance
 *              risk. Legacy river-mapping remains as fallback.
 *              Forward-looking (per decade).
 *   fire     — 100 − FEMA NRI wildfire risk percentile (WFIR_RISKS).
 *   flood    — 100 − max(inland IFLD_ALR_NPCTL, coastal CFLD_ALR_NPCTL):
 *              expected-annual-loss RATE percentiles, not *_RISKS magnitude
 *              percentiles (which scale with county size and pin big metros
 *              at ~100, adding no signal).
 *   capacity — adaptive capacity: mean of FEMA Community Resilience
 *              (RESL_SCORE) and inverted Social Vulnerability (100 − SOVI).
 *
 * fire / flood / capacity come from fema_nri_metros.json (NRI 2.0, per
 * principal county). NRI is a PRESENT-DAY snapshot, so those three dimensions
 * are held flat across projection decades; heat and water carry the trend.
 *
 * composite = (1 − capacityShare) · exposure + capacityShare · capacity
 *   where exposure is the weight-normalized mean of the available hazard
 *   dimensions (heat, water, fire, flood). Weights are tunable via
 *   ResilienceWeights (see DEFAULT_WEIGHTS).
 *
 * This is a self-contained, side-effect-free module: it reads committed JSON
 * and computes on demand. Provenance caveats (water declines are
 * literature-parameterized, ~19/52 metros have real river coverage, NRI is
 * present-day) live in docs/resilience-index-framework.html.
 */

import wetBulbData from '../data/expanded_wet_bulb_projections.json'
import riversData from '../data/rivers.json'
import riverFlowData from '../data/river-flow-projections.json'
import connectingRiversData from '../data/metro-connecting-rivers.json'
import nriData from '../data/fema_nri_metros.json'
import aquiferData from '../data/metro-aquifers.json'
import waterAccessData from '../data/metro-water-access.json'

export const RESILIENCE_DECADES = [2025, 2035, 2045, 2055, 2065, 2075, 2085, 2095]
export const RESILIENCE_SCENARIO = 'ssp585'

/** Tunable weighting for the composite. Dimension weights are relative (they
 * are normalized over the dimensions actually available for a metro);
 * capacityShare is the exposure-vs-capacity blend (0 = exposure only,
 * 1 = capacity only). */
export interface ResilienceWeights {
  heat: number
  water: number
  fire: number
  flood: number
  capacityShare: number
}

/** Equal hazard weights, 60:40 exposure:capacity. */
export const DEFAULT_WEIGHTS: ResilienceWeights = Object.freeze({
  heat: 1,
  water: 1,
  fire: 1,
  flood: 1,
  capacityShare: 0.4,
})

const wetBulb = wetBulbData as Record<string, any>
const rivers = ((riversData as any).features ?? []) as any[]
const riverFlow = ((riverFlowData as any).rivers ?? {}) as Record<string, any>
const connecting = ((connectingRiversData as any).features ?? []) as any[]
const nri = ((nriData as any).metros ?? {}) as Record<string, any>
const metroAquifers = ((aquiferData as any).metros ?? {}) as Record<string, any>
const waterAccess = ((waterAccessData as any).metros ?? {}) as Record<string, any>

export interface WaterResult {
  score: number
  source: string
  coverage: 'portfolio' | 'river' | 'fallback'
}

export interface MetroResilience {
  metroKey: string
  name: string
  lat: number
  lon: number
  year: number
  heat: number
  water: number
  /** 100 − NRI wildfire percentile; null when the metro has no NRI record. */
  fire: number | null
  /** 100 − max(inland, coastal) NRI flood EAL-rate percentile; null without NRI. */
  flood: number | null
  /** mean(RESL_SCORE, 100 − SOVI_SCORE); null without NRI. */
  capacity: number | null
  composite: number
  waterSource: string
  waterCoverage: 'portfolio' | 'river' | 'fallback'
  /** 'nri' when FEMA county data backs fire/flood/capacity. */
  nriCoverage: 'nri' | 'none'
  county?: string
}

const round1 = (x: number) => Math.round(x * 10) / 10
const cityKey = (name: string) => (name || '').split(',')[0].trim().toLowerCase()

function snapDecade(year: number): number {
  return RESILIENCE_DECADES.reduce((a, b) => (Math.abs(b - year) < Math.abs(a - year) ? b : a))
}

function norm(x: number, lo: number, hi: number): number {
  return hi === lo ? 0 : ((x - lo) / (hi - lo)) * 100
}

// ---- heat: min-max normalized on a FIXED global scale (all metros × all
// decades), so heat is ABSOLUTE and a metro's score falls as its wet-bulb /
// heat-days rise over time. Per-decade normalization hid that trend (every
// metro warmed together, so relative position — and the score — stayed flat),
// which made composite trajectories look straight. ----
let heatGlobalRange: { pmin: number; pmax: number; dmin: number; dmax: number } | null = null

function heatRange() {
  if (heatGlobalRange) return heatGlobalRange
  let pmin = Infinity, pmax = -Infinity, dmin = Infinity, dmax = -Infinity
  for (const c of Object.values(wetBulb)) {
    const proj = (c as any).projections ?? {}
    for (const y of RESILIENCE_DECADES) {
      const p = proj[String(y)]
      if (!p) continue
      if (p.peak_wet_bulb_F != null) { pmin = Math.min(pmin, p.peak_wet_bulb_F); pmax = Math.max(pmax, p.peak_wet_bulb_F) }
      if (p.days_over_95F != null) { dmin = Math.min(dmin, p.days_over_95F); dmax = Math.max(dmax, p.days_over_95F) }
    }
  }
  heatGlobalRange = { pmin, pmax, dmin, dmax }
  return heatGlobalRange
}

export function heatScore(metroKey: string, year: number): number | null {
  const dec = snapDecade(year)
  const p = wetBulb[metroKey]?.projections?.[String(dec)]
  if (!p || p.peak_wet_bulb_F == null || p.days_over_95F == null) return null
  const { pmin, pmax, dmin, dmax } = heatRange()
  const hazard = 0.5 * norm(p.peak_wet_bulb_F, pmin, pmax) + 0.5 * norm(p.days_over_95F, dmin, dmax)
  return round1(100 - hazard)
}

// ---- water: build metro -> supplying-river map once ----
function flowKey(riverName: string): string | null {
  const canal: Record<string, string> = {
    'CAP Canal (Central Arizona Project)': 'Colorado',
    'California Aqueduct': 'Sacramento',
    'Colorado River Aqueduct': 'Colorado',
  }
  if (canal[riverName]) return canal[riverName]
  let n = (riverName || '').replace(' River', '').trim()
  if (n === 'South Platte') n = 'Platte'
  return riverFlow[n] ? n : null
}

interface SupplyLink { fk: string | null; dep: number; river: string }
const supply: Record<string, SupplyLink[]> = {}
for (const f of rivers) {
  const p = f.properties || {}
  const fk = flowKey(p.name)
  for (const cs of (p.cities_supplied || [])) {
    const ck = cityKey(cs.name)
    const dep = parseFloat(String(cs.dependency ?? '0').replace('%', '')) || 0
    if (!supply[ck]) supply[ck] = []
    supply[ck].push({ fk, dep, river: p.name })
  }
}

// metro-connecting-rivers carries its own raw flow_projections (adds a few metros)
interface ConnectingLink { base: number; flow: Record<string, number>; river: string }
const connectingLink: Record<string, ConnectingLink> = {}
for (const f of connecting) {
  const p = f.properties || {}
  const fp = p.flow_projections || {}
  const base = fp['2025']
  if (!base) continue
  for (const mc of (p.metro_cities || [])) {
    connectingLink[cityKey(mc.name)] = { base, flow: fp, river: p.name }
  }
}

const GREAT_LAKES = new Set(['chicago', 'detroit', 'cleveland', 'milwaukee'])
const CANAL_PENALTY: Record<string, number> = { phoenix: 6, tucson: 6, 'las vegas': 6, 'los angeles': 4, 'san diego': 4 }

/**
 * Groundwater adjustment from metro-aquifers.json: a spatial join of each
 * metro against the app's USGS principal-aquifer polygons, classified by
 * stress and scaled by documented municipal dependence. Signed: a healthy
 * aquifer is a small buffer (+), a stressed one a penalty (−), and metros
 * over no productive aquifer (e.g. Raleigh) get 0. Replaces the old flat
 * −10 stub on OKC/Memphis. Regenerate: scripts/build-metro-aquifers.py.
 */
function aquiferAdjust(metroKey?: string): number {
  if (!metroKey) return 0
  return metroAquifers[metroKey]?.adjust ?? 0
}

// ---- water access portfolio (metro-water-access.json) ----
// Utility-documented supply mix per metro: score = Σ share × source-health.
// Rivers/reservoirs inherit the matched river's projected flow retention;
// Great Lakes are treated as deep buffered storage; groundwater inherits the
// aquifer join's stress; desal/recycled are near climate-independent.

const GREAT_LAKES_RE = /lake (michigan|superior|erie|huron|ontario)/
const AQUIFER_HEALTH: Record<string, number> = { severe: 30, high: 45, moderate: 65, low: 85 }
const SOURCE_DEFAULT: Record<string, number> = { river: 65, reservoir: 75, imported: 55 }

function riverKeyFromName(name: string): string | null {
  const n = name.toLowerCase()
  for (const k of Object.keys(riverFlow)) {
    if (n.includes(k.toLowerCase())) return k
  }
  // imported systems that carry Colorado-basin water under project names
  if (n.includes('lake mead') || n.includes('central arizona') || /\bcap\b/.test(n) || n.includes('san juan-chama') || n.includes('all-american')) return 'Colorado'
  if (n.includes('state water project') || /\bswp\b/.test(n)) return 'Sacramento'
  return null
}

function flowPct(key: string, dec: number): number | null {
  return riverFlow[key]?.scenarios?.[RESILIENCE_SCENARIO]?.flow_percentage?.[String(dec)] ?? null
}

function portfolioWaterScore(metroKey: string, dec: number): WaterResult | null {
  const acc = waterAccess[metroKey]
  if (!acc?.portfolio?.length) return null
  let score = 0
  for (const item of acc.portfolio) {
    const name = String(item.name ?? '')
    let h: number
    if (item.type === 'desalination') h = 92
    else if (item.type === 'recycled') h = 90
    else if (item.type === 'groundwater') {
      h = AQUIFER_HEALTH[metroAquifers[metroKey]?.stress as string] ?? 60
    } else if (GREAT_LAKES_RE.test(name.toLowerCase())) {
      h = 90
    } else {
      const rk = riverKeyFromName(name)
      const pct = rk ? flowPct(rk, dec) : null
      if (pct != null) {
        // reservoirs buffer variability slightly; long conveyance adds risk
        h = pct + (item.type === 'reservoir' ? 4 : item.type === 'imported' ? -5 : 0)
      } else {
        h = SOURCE_DEFAULT[item.type as string] ?? 60
      }
    }
    score += (item.share ?? 0) * h
  }
  const byType: Record<string, number> = {}
  for (const i of acc.portfolio) byType[i.type] = (byType[i.type] ?? 0) + (i.share ?? 0)
  const top = Object.entries(byType)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([t, s]) => `${Math.round(s * 100)}% ${t}`)
    .join(' + ')
  return {
    score: round1(Math.max(0, Math.min(100, score))),
    source: `Supply: ${top}`,
    coverage: 'portfolio',
  }
}

export function waterScore(metroName: string, year: number, metroKey?: string): WaterResult {
  const dec = snapDecade(year)

  // Preferred path: utility-documented access portfolio (all 52 metros).
  // Groundwater stress and conveyance risk are embedded per-source here, so
  // the legacy aquifer/canal adjustments below only apply to the fallback.
  if (metroKey) {
    const p = portfolioWaterScore(metroKey, dec)
    if (p) return p
  }

  const ck = cityKey(metroName)
  const links = supply[ck] || []
  const matched = links.filter(l => l.fk)

  let health: number
  let source: string
  let coverage: 'river' | 'fallback'

  if (matched.length) {
    const totalDep = matched.reduce((s, l) => s + l.dep, 0) || 1
    health = matched.reduce((s, l) => {
      const pct = riverFlow[l.fk as string]?.scenarios?.[RESILIENCE_SCENARIO]?.flow_percentage?.[String(dec)]
      return s + (pct ?? 60) * l.dep
    }, 0) / totalDep
    source = 'River: ' + Array.from(new Set(matched.map(l => l.fk))).join(', ')
    coverage = 'river'
  } else if (connectingLink[ck]) {
    const c = connectingLink[ck]
    const years = Object.keys(c.flow).map(Number)
    const ny = years.reduce((a, b) => (Math.abs(b - dec) < Math.abs(a - dec) ? b : a))
    health = (c.flow[String(ny)] / c.base) * 100
    source = 'River: ' + c.river
    coverage = 'river'
  } else if (GREAT_LAKES.has(ck)) {
    health = 90; source = 'Great Lakes supply'; coverage = 'fallback'
  } else if (links.length) {
    health = 62; source = 'Unmapped river source'; coverage = 'fallback'
  } else {
    health = 60; source = 'No mapped source'; coverage = 'fallback'
  }

  const adjusted = health + aquiferAdjust(metroKey) - (CANAL_PENALTY[ck] || 0)
  return { score: round1(Math.max(0, Math.min(100, adjusted))), source, coverage }
}

// ---- fire / flood / capacity: FEMA NRI (present-day, held flat by decade) ----

/** 100 − NRI wildfire percentile. Prefers the annualized-loss-RATE percentile
 * (wildfire_alr_pctl = WFIR_ALR_NPCTL), which normalizes out exposed
 * population/property the same way the flood dimension does; falls back to the
 * magnitude percentile (wildfire_risk = WFIR_RISKS) until the ALR field is
 * populated. Null when the metro has no NRI record. */
export function fireScore(metroKey: string): number | null {
  const rec = nri[metroKey]
  if (!rec) return null
  const pctl = rec.wildfire_alr_pctl ?? rec.wildfire_risk
  if (pctl == null) return null
  return round1(100 - pctl)
}

/** 100 − max(inland, coastal) NRI expected-annual-loss RATE percentile
 * (IFLD_ALR_NPCTL / CFLD_ALR_NPCTL). Rate percentiles normalize out exposed
 * population/property — the *_RISKS magnitude percentiles pin every big-metro
 * county near 100 and carry no signal. A null coastal value in the NRI means
 * "no coastal exposure", so nulls count as zero risk. */
export function floodScore(metroKey: string): number | null {
  const rec = nri[metroKey]
  if (!rec) return null
  const risk = Math.max(rec.inland_flood_alr_pctl ?? 0, rec.coastal_flood_alr_pctl ?? 0)
  return round1(100 - risk)
}

/** Adaptive capacity: mean of Community Resilience (RESL_SCORE, higher =
 * better) and inverted Social Vulnerability (100 − SOVI_SCORE). */
export function capacityScore(metroKey: string): number | null {
  const rec = nri[metroKey]
  if (!rec || rec.community_resilience == null || rec.social_vulnerability == null) return null
  return round1(0.5 * rec.community_resilience + 0.5 * (100 - rec.social_vulnerability))
}

// ---- composite + ranking + trajectory ----

/** Weight-normalized mean of the hazard dimensions that exist for the metro,
 * blended with adaptive capacity by capacityShare. */
function compose(
  heat: number,
  water: number,
  fire: number | null,
  flood: number | null,
  capacity: number | null,
  w: ResilienceWeights,
): number {
  const dims: Array<[number | null, number]> = [
    [heat, w.heat],
    [water, w.water],
    [fire, w.fire],
    [flood, w.flood],
  ]
  const avail = dims.filter(([v]) => v != null) as Array<[number, number]>
  let totalW = avail.reduce((s, [, wt]) => s + wt, 0)
  const exposure = totalW > 0
    ? avail.reduce((s, [v, wt]) => s + v * wt, 0) / totalW
    : avail.reduce((s, [v]) => s + v, 0) / Math.max(1, avail.length) // all-zero weights: fall back to equal
  if (capacity == null) return round1(exposure)
  const cs = Math.max(0, Math.min(1, w.capacityShare))
  return round1((1 - cs) * exposure + cs * capacity)
}

export function metroResilience(
  metroKey: string,
  year: number,
  weights: ResilienceWeights = DEFAULT_WEIGHTS,
): MetroResilience | null {
  const c = wetBulb[metroKey]
  if (!c) return null
  const heat = heatScore(metroKey, year)
  if (heat == null) return null
  const water = waterScore(c.name || metroKey, year, metroKey)
  const fire = fireScore(metroKey)
  const flood = floodScore(metroKey)
  const capacity = capacityScore(metroKey)
  return {
    metroKey,
    name: c.name || metroKey,
    lat: c.lat,
    lon: c.lon,
    year: snapDecade(year),
    heat,
    water: water.score,
    fire,
    flood,
    capacity,
    composite: compose(heat, water.score, fire, flood, capacity, weights),
    waterSource: water.source,
    waterCoverage: water.coverage,
    nriCoverage: nri[metroKey] ? 'nri' : 'none',
    county: nri[metroKey]?.county,
  }
}

export function rankMetros(year: number, weights: ResilienceWeights = DEFAULT_WEIGHTS): MetroResilience[] {
  const rows: MetroResilience[] = []
  for (const key of Object.keys(wetBulb)) {
    const r = metroResilience(key, year, weights)
    if (r) rows.push(r)
  }
  return rows.sort((a, b) => b.composite - a.composite)
}

export interface TrajectoryPoint {
  year: number
  heat: number
  water: number
  fire: number | null
  flood: number | null
  capacity: number | null
  composite: number
}

export function metroTrajectory(metroKey: string, weights: ResilienceWeights = DEFAULT_WEIGHTS): TrajectoryPoint[] {
  const out: TrajectoryPoint[] = []
  for (const y of RESILIENCE_DECADES) {
    const r = metroResilience(metroKey, y, weights)
    if (r) out.push({ year: y, heat: r.heat, water: r.water, fire: r.fire, flood: r.flood, capacity: r.capacity, composite: r.composite })
  }
  return out
}

/** Colour ramp for the map / bars: red (low) → amber → green (high). Returns [r,g,b,a]. */
export function resilienceColorRGBA(score: number, alpha = 200): [number, number, number, number] {
  if (score >= 66) return [29, 158, 117, alpha]   // teal-green, resilient
  if (score >= 40) return [239, 159, 39, alpha]    // amber, moderate
  return [226, 75, 74, alpha]                      // red, exposed
}
