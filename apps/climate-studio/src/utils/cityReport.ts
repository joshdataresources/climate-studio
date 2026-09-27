/**
 * City resilience report: self-contained HTML generator.
 *
 * buildCityReportHtml() returns a complete, standalone HTML document (inline
 * styles + inline SVG, no external deps) for one metro, styled to match the
 * app's detail-card language (bold title, icon subtitle, solid status pills,
 * a tinted summary panel, a divided metric grid, footer chips). The same
 * string is shown in the report modal (via <iframe srcDoc>) and downloaded,
 * so the preview is exactly what the user gets. Pure + side-effect-free
 * except downloadCityReport(), which triggers a Blob download.
 */

import {
  metroResilience,
  rankMetros,
  metroTrajectory,
  trajectoryDomain,
  compositeEnvelope,
  scenarioHeatFactor,
  scenarioLabel,
  RESILIENCE_DECADES,
  RESILIENCE_SCENARIO,
  RESILIENCE_SCENARIOS,
  DEFAULT_WEIGHTS,
  type ResilienceScenario,
  type ResilienceWeights,
  type MetroResilience,
  type TrajectoryPoint,
  type EnvelopePoint,
} from './resilienceScore'
import nriData from '../data/fema_nri_metros.json'

const nri = ((nriData as any).metros ?? {}) as Record<string, any>

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string))
const fmt = (v: number | null | undefined) => (v == null ? 'n/a' : String(Math.round(v)))
const signed = (v: number) => (Math.round(v) > 0 ? `+${Math.round(v)}` : String(Math.round(v)))

/** 95.2 → "95th". FEMA percentiles are ranks among ~3,200 US counties. */
function ordinal(v: number): string {
  if (v >= 99.5) return '99th+'
  const n = Math.round(v)
  const s = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'
  return `${n}${s}`
}

type BandKey = 'good' | 'mod' | 'bad'
interface Band { key: BandKey; color: string; dark: string; tint: string; tintB: string; label: string }
const BANDS: Record<BandKey, Band> = {
  good: { key: 'good', color: '#10b981', dark: '#0f6e56', tint: '#e9f7f1', tintB: '#cdeee0', label: 'Resilient' },
  mod: { key: 'mod', color: '#f59e0b', dark: '#8a5a12', tint: '#fdf4e3', tintB: '#f6e2b8', label: 'Moderate' },
  bad: { key: 'bad', color: '#ef4444', dark: '#a3312d', tint: '#fdecec', tintB: '#f6cccc', label: 'Exposed' },
}
const bandOf = (s: number | null): Band =>
  s == null ? BANDS.mod : s >= 66 ? BANDS.good : s >= 40 ? BANDS.mod : BANDS.bad

const ICON_PIN =
  '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0Z"/><circle cx="12" cy="10" r="3"/></svg>'
const ICON_CAL =
  '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 10h18M8 2v4M16 2v4"/></svg>'
const ICON_SHIELD =
  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/></svg>'

type DimKey = 'heat' | 'water' | 'fire' | 'flood' | 'capacity'
interface DimRow { key: DimKey; label: string; desc: string; projected: boolean }
const DIMS: DimRow[] = [
  { key: 'heat', label: 'Heat', desc: 'Peak wet-bulb + days over 95°F', projected: true },
  { key: 'water', label: 'Water', desc: 'Health of the supply portfolio', projected: true },
  { key: 'fire', label: 'Wildfire', desc: 'FEMA wildfire risk, flipped', projected: false },
  { key: 'flood', label: 'Flood', desc: 'FEMA flood loss rate, flipped', projected: false },
  { key: 'capacity', label: 'Adaptive capacity', desc: 'FEMA resilience + vulnerability', projected: false },
]

function metricCell(d: DimRow, v: number | null): string {
  const b = bandOf(v)
  const w = v == null ? 0 : Math.max(3, Math.min(100, v))
  const tag = d.projected
    ? '<span class="tag tag-proj">Projected</span>'
    : '<span class="tag">Present-day</span>'
  return `<div class="metric">
    <div class="lab">${esc(d.label)} ${tag}</div>
    <div class="num" style="color:${v == null ? '#9aa1ac' : b.dark}">${fmt(v)}<span class="unit">/100</span></div>
    <div class="track"><div class="fill" style="width:${w}%;background:${v == null ? '#c9ccd2' : b.color}"></div></div>
    <div class="desc">${esc(d.desc)}</div>
  </div>`
}

/** Share of the composite that comes from dimensions held flat over time
 * (fire, flood, capacity), given the weights and which dimensions exist. */
function staticShare(r: MetroResilience, w: ResilienceWeights): number {
  const hz: Array<[number | null, number, boolean]> = [
    [r.heat, w.heat, false],
    [r.water, w.water, false],
    [r.fire, w.fire, true],
    [r.flood, w.flood, true],
  ]
  const avail = hz.filter(([v]) => v != null)
  const tot = avail.reduce((s, [, wt]) => s + wt, 0) || 1
  const flatHz = avail.filter(([, , flat]) => flat).reduce((s, [, wt]) => s + wt, 0) / tot
  const cs = r.capacity == null ? 0 : Math.max(0, Math.min(1, w.capacityShare))
  return cs + (1 - cs) * flatHz
}

/**
 * Composite trajectory chart, drawn on ONE y-axis range shared by every metro
 * (trajectoryDomain) so lines are comparable across reports instead of being
 * fit to each city. Grey band: range of all metros' composites per decade,
 * with the median metro as a dotted line. Solid line: this metro's composite.
 * Dashed indigo: plain average of heat + water (the only dimensions that change
 * by decade). Thin grey: this metro under the other scenario. Vertical rule
 * marks the report's projection year.
 */
function trajectorySvg(
  traj: TrajectoryPoint[],
  alt: TrajectoryPoint[],
  altLabel: string,
  year: number,
  color: string,
  domain: [number, number],
  env: EnvelopePoint[],
): string {
  if (!traj.length) return ''
  const W = 820, H = 262, x0 = 34, x1 = 800, y0 = 26, y1 = 182
  const [dlo, dhi] = domain
  const n = RESILIENCE_DECADES.length
  const X = (i: number) => x0 + (i * (x1 - x0)) / (n - 1)
  const clamp = (v: number) => Math.max(dlo, Math.min(dhi, v))
  const Y = (v: number) => y0 + ((dhi - clamp(v)) * (y1 - y0)) / (dhi - dlo || 1)
  const EXPOSURE_COLOR = '#6366f1'
  const ALT_COLOR = '#b6bcc6'
  const BAND_COLOR = '#eceef3'
  const MEDIAN_COLOR = '#8b93a1'
  const line = (vals: number[]) => vals.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' ')
  const ticks: number[] = []
  for (let g = dlo; g <= dhi; g += 10) ticks.push(g)
  const grid = ticks
    .map(g => `<line x1="${x0}" y1="${Y(g)}" x2="${x1}" y2="${Y(g)}" stroke="#eef0f2" stroke-width="1"/>` +
      `<text x="${x0 - 6}" y="${Y(g) + 3}" text-anchor="end" font-size="10" fill="#9aa1ac">${g}</text>`)
    .join('')
  const upHint = `<text x="${x1}" y="${y0 - 10}" text-anchor="end" font-size="10" fill="#9aa1ac">higher = more resilient · same scale for every city</text>`
  const yi = RESILIENCE_DECADES.indexOf(year)
  const marker = yi >= 0
    ? `<line x1="${X(yi)}" y1="${y0 - 4}" x2="${X(yi)}" y2="${y1}" stroke="#101728" stroke-opacity=".18" stroke-width="1" stroke-dasharray="2,3"/>`
    : ''
  const hasEnv = env.length === n
  const band = hasEnv
    ? `<polygon fill="${BAND_COLOR}" points="${env.map((e, i) => `${X(i).toFixed(1)},${Y(e.max).toFixed(1)}`).join(' ')} ${env.map((e, i) => `${X(i).toFixed(1)},${Y(e.min).toFixed(1)}`).reverse().join(' ')}"/>` +
      `<polyline fill="none" stroke="${MEDIAN_COLOR}" stroke-width="1.4" stroke-dasharray="1.5,3" stroke-linecap="round" points="${line(env.map(e => e.median))}"/>`
    : ''
  const comp = traj.map(t => t.composite)
  const exposure = traj.map(t => (t.heat + t.water) / 2)
  const altLine = alt.length === traj.length
    ? `<polyline fill="none" stroke="${ALT_COLOR}" stroke-width="1.6" stroke-linejoin="round" points="${line(alt.map(t => t.composite))}"/>`
    : ''
  const dots = comp.map((v, i) => `<circle cx="${X(i).toFixed(1)}" cy="${Y(v).toFixed(1)}" r="3" fill="${color}"/>`).join('')
  const expDots = exposure.map((v, i) => `<circle cx="${X(i).toFixed(1)}" cy="${Y(v).toFixed(1)}" r="2.5" fill="${EXPOSURE_COLOR}"/>`).join('')
  const endLabel = (v: number, i: number, c: string) =>
    `<text x="${X(i) + 6}" y="${Y(v) - 8}" text-anchor="start" font-size="10.5" font-weight="600" fill="${c}">${Math.round(v)}</text>`
  const xlab = traj
    .map((t, i) => `<text x="${X(i).toFixed(1)}" y="${y1 + 16}" text-anchor="middle" font-size="10" fill="${i === yi ? '#101728' : '#9aa1ac'}" font-weight="${i === yi ? 600 : 400}">${t.year}</text>`)
    .join('')
  const count = hasEnv ? env[0].count : 0
  const legend =
    `<g transform="translate(${x0},${y1 + 38})" font-size="11" fill="#6b7280">` +
    `<line x1="0" y1="-4" x2="16" y2="-4" stroke="${color}" stroke-width="2.6"/><text x="21" y="0">Composite score</text>` +
    `<line x1="140" y1="-4" x2="156" y2="-4" stroke="${EXPOSURE_COLOR}" stroke-width="2.2" stroke-dasharray="4,3"/><text x="161" y="0">Heat + water average (the part that changes)</text>` +
    (altLine ? `<line x1="450" y1="-4" x2="466" y2="-4" stroke="${ALT_COLOR}" stroke-width="1.6"/><text x="471" y="0">Composite under ${esc(altLabel)}</text>` : '') +
    (hasEnv
      ? `<rect x="0" y="14" width="16" height="9" rx="2" fill="${BAND_COLOR}" stroke="#d9dce3"/><text x="21" y="22">Range across all ${count} metros</text>` +
        `<line x1="210" y1="18" x2="226" y2="18" stroke="${MEDIAN_COLOR}" stroke-width="1.6" stroke-dasharray="1.5,3" stroke-linecap="round"/><text x="231" y="22">Median metro</text>`
      : '') +
    `</g>`
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Composite resilience trajectory to 2095 on a scale shared by all metros, with the range across all metros. Higher is more resilient.">` +
    `${band}${grid}${upHint}${marker}${altLine}` +
    `<polyline fill="none" stroke="${EXPOSURE_COLOR}" stroke-width="2.2" stroke-dasharray="4,3" stroke-linejoin="round" stroke-linecap="round" points="${line(exposure)}"/>${expDots}` +
    `<polyline fill="none" stroke="${color}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" points="${line(comp)}"/>${dots}` +
    `${endLabel(comp[0], 0, color)}${endLabel(comp[comp.length - 1], comp.length - 1, color)}` +
    `${xlab}${legend}</svg>`
}

/** Decade-by-decade table of every dimension, so the chart can be checked. */
function trajectoryTable(traj: TrajectoryPoint[], year: number): string {
  const rows: Array<{ label: string; key: keyof TrajectoryPoint; flat: boolean; strong?: boolean }> = [
    { label: 'Heat', key: 'heat', flat: false },
    { label: 'Water', key: 'water', flat: false },
    { label: 'Wildfire', key: 'fire', flat: true },
    { label: 'Flood', key: 'flood', flat: true },
    { label: 'Adaptive capacity', key: 'capacity', flat: true },
    { label: 'Composite', key: 'composite', flat: false, strong: true },
  ]
  const head = `<tr><th></th>${traj.map(t => `<th class="${t.year === year ? 'sel' : ''}">${t.year}</th>`).join('')}<th>Change</th></tr>`
  const body = rows.map(r => {
    const vals = traj.map(t => t[r.key] as number | null)
    const first = vals[0], last = vals[vals.length - 1]
    const delta = first == null || last == null ? 'n/a' : signed(last - first)
    const cls = [r.flat ? 'flat' : '', r.strong ? 'strong' : ''].join(' ').trim()
    const label = r.flat ? `${r.label} <span class="tag">held flat</span>` : r.label
    return `<tr class="${cls}"><td>${label}</td>${vals.map((v, i) => `<td class="${traj[i].year === year ? 'sel' : ''}">${fmt(v)}</td>`).join('')}<td class="delta">${delta}</td></tr>`
  }).join('')
  return `<table class="ttable">${head}${body}</table>`
}

interface FemaRow { measure: string; value: string; reads: string; feeds: string; used: boolean }

function femaRows(r: MetroResilience): FemaRow[] | null {
  const rec = nri[r.metroKey]
  if (!rec) return null
  const rows: FemaRow[] = []
  const pct = (v: number | null | undefined) => (v == null ? 'n/a' : `${ordinal(v)} percentile`)

  const fireSrc = rec.wildfire_alr_pctl ?? rec.wildfire_risk
  if (fireSrc != null) {
    rows.push({
      measure: rec.wildfire_alr_pctl != null ? 'Wildfire loss rate' : 'Wildfire risk',
      value: pct(fireSrc),
      reads: `Higher wildfire risk than ${Math.round(fireSrc)}% of US counties`,
      feeds: `Wildfire ${fmt(r.fire)} = 100 − ${Math.round(fireSrc)}`,
      used: true,
    })
  }
  const inl = rec.inland_flood_alr_pctl as number | null
  const coa = rec.coastal_flood_alr_pctl as number | null
  const worse = Math.max(inl ?? 0, coa ?? 0)
  rows.push({
    measure: 'Inland flood loss rate',
    value: pct(inl),
    reads: inl == null ? 'No inland flood record' : `Higher expected flood losses (per $ exposed) than ${Math.round(inl)}% of counties`,
    feeds: `Flood ${fmt(r.flood)} = 100 − ${Math.round(worse)} (worse of inland and coastal)`,
    used: true,
  })
  rows.push({
    measure: 'Coastal flood loss rate',
    value: coa == null || coa === 0 ? 'No coastal exposure' : pct(coa),
    reads: coa == null || coa === 0 ? 'County has no coastline in FEMA’s model' : `Higher coastal flood losses (per $ exposed) than ${Math.round(coa)}% of counties`,
    feeds: 'Same flood score, see above',
    used: true,
  })
  const resl = rec.community_resilience as number | null
  const sovi = rec.social_vulnerability as number | null
  rows.push({
    measure: 'Community resilience',
    value: pct(resl),
    reads: resl == null ? 'n/a' : `More resilient than ${Math.round(resl)}% of counties (higher = better)`,
    feeds: resl == null || sovi == null ? 'n/a' : `Capacity ${fmt(r.capacity)} = (${Math.round(resl)} + (100 − ${Math.round(sovi)})) ÷ 2`,
    used: true,
  })
  rows.push({
    measure: 'Social vulnerability',
    value: pct(sovi),
    reads: sovi == null ? 'n/a' : `More vulnerable than ${Math.round(sovi)}% of counties (higher = worse)`,
    feeds: 'Same capacity score, see above',
    used: true,
  })
  const ref = (measure: string, v: number | null | undefined, note: string) => {
    if (v == null) return
    rows.push({ measure, value: pct(v), reads: `Higher risk than ${Math.round(v)}% of counties`, feeds: note, used: false })
  }
  ref('Heat wave risk', rec.heat_wave_risk, 'Not used. Heat comes from wet-bulb projections')
  ref('Drought risk', rec.drought_risk, 'Not used. Water comes from supply projections')
  ref('Overall FEMA risk (18 hazards)', rec.composite_risk, 'Not used. Context only')
  return rows
}

function femaSection(r: MetroResilience): string {
  const rec = nri[r.metroKey]
  const rows = femaRows(r)
  if (!rows || !rec) {
    return `<div class="note">No FEMA National Risk Index record is matched to this metro, so wildfire, flood and capacity are left out of the composite.</div>`
  }
  const countyName = `${esc(rec.county)} County${rec.state ? ', ' + esc(rec.state) : ''}`
  const table =
    `<table class="ftable"><tr><th>FEMA measure</th><th>FEMA value</th><th>What it means</th><th>How it feeds the scores above</th></tr>` +
    rows.map(x => `<tr class="${x.used ? '' : 'ref'}"><td>${esc(x.measure)}</td><td class="fv">${esc(x.value)}</td><td>${esc(x.reads)}</td><td>${esc(x.feeds)}</td></tr>`).join('') +
    `</table>`
  const fireCaveat = rec.wildfire_alr_pctl == null
    ? `<div class="note">Wildfire uses FEMA’s risk percentile, which rises with the amount of population and property in a county. Flood uses the loss-rate percentile, which corrects for that. Switching wildfire to its loss-rate percentile (WFIR_ALR_NPCTL) is a pending data refresh.</div>`
    : ''
  return `<div class="explain">
      <div class="explain-h">Why these numbers look different from the scores above</div>
      <ul>
        <li><strong>Different scale.</strong> FEMA values are percentile ranks among roughly 3,200 US counties. For hazards, a higher percentile means more risk. The scores above are flipped (100 − percentile) so that higher always means more resilient.</li>
        <li><strong>Present-day only.</strong> FEMA does not project the future. These values are the same in every decade and every scenario.</li>
        <li><strong>One county, not the metro.</strong> FEMA data is for ${countyName}, the metro’s principal county.</li>
        <li><strong>Combined.</strong> Flood takes the worse of inland and coastal. Capacity averages resilience and flipped vulnerability.</li>
      </ul>
    </div>
    ${table}${fireCaveat}`
}

function waterNote(r: MetroResilience): string {
  const share = Math.round(r.waterProjectedShare * 100)
  const src = esc(r.waterSource.replace(/^(Supply|River):\s*/, ''))
  if (share === 0) {
    return `<strong>Water is held flat for this metro.</strong> None of its supply sources (${src}) have a river-flow projection yet, so water keeps its present-day value in every decade.`
  }
  if (share < 100) {
    return `<strong>Water is partly projected.</strong> ${share}% of supply follows projected river flow. The rest (${src}) is held at a present-day value.`
  }
  return `Water follows projected river flow for the whole supply (${src}).`
}

export function buildCityReportHtml(
  metroKey: string,
  year: number,
  weights: ResilienceWeights = DEFAULT_WEIGHTS,
  scenario: ResilienceScenario = RESILIENCE_SCENARIO,
): string {
  const r: MetroResilience | null = metroResilience(metroKey, year, weights, scenario)
  const generated = new Date().toISOString().slice(0, 10)

  if (!r) {
    return `<!doctype html><html><head><meta charset="utf-8"><title>Resilience report</title></head>` +
      `<body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;padding:40px;color:#101728">` +
      `<h1>No data</h1><p>No resilience data is available for "${esc(metroKey)}".</p></body></html>`
  }

  const rec = nri[metroKey] || {}
  const b = bandOf(r.composite)
  const ranked = rankMetros(r.year, weights, scenario)
  const rank = ranked.findIndex(m => m.metroKey === metroKey) + 1
  const total = ranked.length
  const scen = RESILIENCE_SCENARIOS.find(s => s.id === scenario)
  const scenShort = scen?.short ?? scenario
  const altScen = RESILIENCE_SCENARIOS.find(s => s.id !== scenario)
  const traj = metroTrajectory(metroKey, weights, scenario)
  const alt = altScen ? metroTrajectory(metroKey, weights, altScen.id) : []
  const first = traj[0], last = traj[traj.length - 1]
  const flatPct = Math.round(staticShare(r, weights) * 100)
  const medianNow = compositeEnvelope(weights, scenario).find(e => e.year === r.year)?.median ?? null
  const narrative =
    b.key === 'good'
      ? `holds up well across the modeled hazards in ${r.year}.`
      : b.key === 'mod'
        ? `carries moderate exposure in ${r.year}. Some dimensions are strong, others strained.`
        : `is heavily exposed across multiple hazards in ${r.year}.`
  const wNote = `heat ${weights.heat} · water ${weights.water} · fire ${weights.fire} · flood ${weights.flood} · ` +
    `${Math.round((1 - weights.capacityShare) * 100)}:${Math.round(weights.capacityShare * 100)} exposure:capacity`
  const heatMethod = scenario === 'ssp585'
    ? 'Heat uses NASA NEX-GDDP-CMIP6 wet-bulb projections under SSP5-8.5.'
    : `Heat under ${esc(scenShort)} is scaled from the SSP5-8.5 wet-bulb projections: the change since 2025 is multiplied by the ratio of warming between the two scenarios in NASA NEX-GDDP-CMIP6 temperature projections (${Math.round(scenarioHeatFactor(scenario, 2095) * 100)}% by 2095).`
  const summary = first && last
    ? `Composite goes from <strong>${Math.round(first.composite)}</strong> in ${first.year} to <strong>${Math.round(last.composite)}</strong> in ${last.year} (${signed(last.composite - first.composite)}). ` +
      `Heat goes from ${fmt(first.heat)} to ${fmt(last.heat)} and water from ${fmt(first.water)} to ${fmt(last.water)}.` +
      (medianNow != null
        ? ` In ${r.year} it sits ${Math.abs(Math.round(r.composite - medianNow)) < 1 ? 'right at' : `${Math.abs(Math.round(r.composite - medianNow))} points ${r.composite > medianNow ? 'above' : 'below'}`} the median metro (${Math.round(medianNow)}).`
        : '')
    : ''

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Resilience report: ${esc(r.name)} (${r.year}, ${esc(scenShort)})</title>
<style>
  :root{--ink:#101728;--muted:#6b7280;--faint:#9aa1ac;--line:#e9eaed;--bg:#f4f5f7}
  *{box-sizing:border-box}
  body{margin:0;background:#fff;color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.5}
  .sheet{max-width:940px;margin:0 auto;background:#fff;padding:28px 34px}
  .title{font-size:25px;font-weight:700;letter-spacing:-.01em;margin:0 0 5px}
  .subtitle{display:flex;gap:18px;flex-wrap:wrap;color:var(--muted);font-size:13px;margin-bottom:16px}
  .subtitle .item{display:flex;align-items:center;gap:6px}
  .pills{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:20px}
  .pill{display:inline-flex;align-items:center;gap:7px;padding:9px 15px;border-radius:11px;font-size:13px;font-weight:600;color:#fff}
  .dot{width:8px;height:8px;border-radius:50%;background:#fff;opacity:.9}
  .cols{display:flex;gap:20px;align-items:stretch;flex-wrap:wrap}
  .left{flex:1 1 280px}
  .right{flex:1 1 380px}
  .panel{height:100%;border-radius:14px;padding:18px 20px}
  .panel-h{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:600;margin-bottom:12px}
  .big{font-size:46px;font-weight:700;line-height:1}
  .big .unit{font-size:15px;font-weight:600;opacity:.7;margin-left:4px}
  .cap{font-size:12px;margin:2px 0 12px}
  .narr{font-size:13px;line-height:1.5;margin:0}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:0 26px}
  .metric{padding:12px 0;border-top:1px solid var(--line)}
  .metric .lab{font-size:12px;color:var(--muted);display:flex;align-items:center;gap:6px}
  .metric .num{font-size:22px;font-weight:700;margin-top:1px}
  .metric .num .unit{font-size:12px;font-weight:600;color:var(--faint);margin-left:2px}
  .metric .track{height:5px;background:#eef0f2;border-radius:3px;overflow:hidden;margin:6px 0 4px}
  .metric .fill{height:100%;border-radius:3px}
  .metric .desc{font-size:11px;color:var(--faint)}
  .tag{display:inline-block;font-size:9.5px;font-weight:600;letter-spacing:.02em;text-transform:uppercase;padding:1px 6px;border-radius:5px;background:#eef0f2;color:#6b7280;vertical-align:middle}
  .tag-proj{background:#e8ebff;color:#4f46e5}
  .section{margin-top:26px}
  .section-h{font-size:14px;font-weight:650;color:var(--ink);margin-bottom:6px;display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}
  .section-h .sub{font-size:12px;font-weight:500;color:var(--muted)}
  .lead{font-size:13px;color:#374151;margin:0 0 10px}
  .note{font-size:11.5px;color:var(--muted);margin-top:8px;line-height:1.55}
  .notes{margin-top:10px;display:grid;gap:6px}
  table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums}
  .ttable{margin-top:6px;font-size:12px}
  .ttable th,.ttable td{padding:6px 6px;text-align:right;border-top:1px solid var(--line)}
  .ttable th{font-weight:600;color:var(--muted);font-size:11px;border-top:0}
  .ttable td:first-child,.ttable th:first-child{text-align:left;white-space:nowrap}
  .ttable .sel{background:#f4f6fb}
  .ttable tr.flat td{color:var(--faint)}
  .ttable tr.flat td:first-child{color:var(--muted)}
  .ttable tr.strong td{font-weight:700;border-top:1.5px solid #d6d9de}
  .ttable td.delta{font-weight:600}
  .explain{background:var(--bg);border-radius:12px;padding:14px 16px;margin:4px 0 12px}
  .explain-h{font-size:12.5px;font-weight:650;margin-bottom:6px}
  .explain ul{margin:0;padding-left:18px;font-size:12.5px;color:#374151;display:grid;gap:4px}
  .ftable{font-size:12px}
  .ftable th,.ftable td{padding:8px 8px;text-align:left;border-top:1px solid var(--line);vertical-align:top}
  .ftable th{font-weight:600;color:var(--muted);font-size:11px;border-top:0}
  .ftable td.fv{font-weight:650;white-space:nowrap}
  .ftable tr.ref td{color:var(--faint)}
  .ftable tr.ref td.fv{font-weight:500}
  .chips{display:flex;gap:10px;flex-wrap:wrap;margin-top:22px}
  .chip{background:var(--bg);border-radius:11px;padding:9px 15px}
  .chip .lab{font-size:11px;color:var(--muted)}
  .chip .val{font-size:14px;font-weight:600}
  .foot{margin-top:22px;padding-top:14px;border-top:1px solid var(--line);font-size:11px;color:var(--faint);line-height:1.55}
  @media (max-width:640px){.sheet{padding:18px 16px}.grid{grid-template-columns:1fr}.ttable,.ftable{display:block;overflow-x:auto}}
  @media print{body{background:#fff}.sheet{max-width:none;padding:0}.section{break-inside:avoid}}
</style>
</head>
<body>
<div class="sheet">
  <div class="title">${esc(r.name)}</div>
  <div class="subtitle">
    ${r.county ? `<span class="item">${ICON_PIN}${esc(r.county)} County${rec.state ? ', ' + esc(rec.state) : ''}</span>` : ''}
    <span class="item">${ICON_CAL}Projection year ${r.year} · ${esc(scenarioLabel(scenario))}</span>
  </div>

  <div class="pills">
    <span class="pill" style="background:${b.color}"><span class="dot"></span>${b.label} · ${Math.round(r.composite)}/100</span>
    <span class="pill" style="background:#4f6ef7">Rank #${rank} of ${total} metros</span>
  </div>

  <div class="cols">
    <div class="left">
      <div class="panel" style="background:${b.tint};color:${b.dark}">
        <div class="panel-h" style="color:${b.dark}">${ICON_SHIELD} Resilience score</div>
        <div class="big" style="color:${b.dark}">${Math.round(r.composite)}<span class="unit">/100</span></div>
        <div class="cap" style="color:${b.dark};opacity:.85">Higher = more resilient. Blends hazard exposure with adaptive capacity.</div>
        <p class="narr" style="color:${b.dark}"><strong>${esc(r.name.split(',')[0])}</strong> ranks #${rank} of ${total} US metros under ${esc(scenShort)} and ${narrative}</p>
      </div>
    </div>
    <div class="right">
      <div class="grid">
        ${DIMS.map(d => metricCell(d, r[d.key] as number | null)).join('')}
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-h">Composite trajectory to 2095 <span class="sub">${esc(scenShort)}</span></div>
    <p class="lead">${summary}</p>
    ${trajectorySvg(traj, alt, altScen?.short ?? '', r.year, b.color, trajectoryDomain(weights), compositeEnvelope(weights, scenario))}
    ${trajectoryTable(traj, r.year)}
    <div class="notes">
      <div class="note"><strong>Why the composite moves slowly.</strong> ${flatPct}% of this score comes from present-day FEMA values (wildfire, flood, adaptive capacity) that do not change by decade. Only heat and water carry the climate trend, which is why the dashed heat + water line falls faster than the composite.</div>
      <div class="note">${waterNote(r)}</div>
      <div class="note">${heatMethod}</div>
    </div>
  </div>

  <div class="section">
    <div class="section-h">FEMA National Risk Index inputs <span class="sub">county level, present-day</span></div>
    ${femaSection(r)}
  </div>

  <div class="chips">
    <span class="chip"><div class="lab">Scenario</div><div class="val">${esc(scenShort)}</div></span>
    <span class="chip"><div class="lab">Projection year</div><div class="val">${r.year}</div></span>
    <span class="chip"><div class="lab">Metros compared</div><div class="val">${total}</div></span>
    <span class="chip"><div class="lab">Generated</div><div class="val">${generated}</div></span>
  </div>

  <div class="foot">
    Weighting: ${esc(wNote)}.<br>
    Sources: NASA NEX-GDDP-CMIP6 wet-bulb (SSP5-8.5) and temperature (SSP2-4.5, SSP5-8.5) projections. River-flow projections (USGS, Bureau of Reclamation, EPA, literature-parameterized). Utility supply portfolios. FEMA National Risk Index 2.0 (present-day, principal county). Methodology: docs/resilience-index-framework.html. This report is a decision aid, not a guarantee of future conditions.
  </div>
</div>
</body>
</html>`
}

export function downloadCityReport(
  metroKey: string,
  year: number,
  weights: ResilienceWeights = DEFAULT_WEIGHTS,
  scenario: ResilienceScenario = RESILIENCE_SCENARIO,
): void {
  const r = metroResilience(metroKey, year, weights, scenario)
  const html = buildCityReportHtml(metroKey, year, weights, scenario)
  const cityName = (r?.name || metroKey).split(',')[0].trim().replace(/\s+/g, '-')
  const fileYear = r?.year ?? year
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `Resilience-Report-${cityName}-${fileYear}-${scenario}.html`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
