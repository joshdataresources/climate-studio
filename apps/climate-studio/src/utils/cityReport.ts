/**
 * City resilience report — self-contained HTML generator.
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
  RESILIENCE_DECADES,
  DEFAULT_WEIGHTS,
  type ResilienceWeights,
  type MetroResilience,
} from './resilienceScore'
import nriData from '../data/fema_nri_metros.json'

const nri = ((nriData as any).metros ?? {}) as Record<string, any>

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string))
const fmt = (v: number | null | undefined) => (v == null ? '—' : String(Math.round(v)))

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

interface DimRow { key: 'heat' | 'water' | 'fire' | 'flood' | 'capacity'; label: string; desc: string }
const DIMS: DimRow[] = [
  { key: 'heat', label: 'Heat', desc: 'Wet-bulb + extreme-heat days' },
  { key: 'water', label: 'Water', desc: 'Utility supply-portfolio health' },
  { key: 'fire', label: 'Wildfire', desc: 'FEMA wildfire risk' },
  { key: 'flood', label: 'Flood', desc: 'FEMA flood loss-rate' },
  { key: 'capacity', label: 'Adaptive capacity', desc: 'FEMA resilience + vulnerability' },
]

function metricCell(label: string, desc: string, v: number | null): string {
  const b = bandOf(v)
  const w = v == null ? 0 : Math.max(3, Math.min(100, v))
  return `<div class="metric">
    <div class="lab">${esc(label)}</div>
    <div class="num" style="color:${v == null ? '#9aa1ac' : b.dark}">${fmt(v)}<span class="unit">/100</span></div>
    <div class="track"><div class="fill" style="width:${w}%;background:${v == null ? '#c9ccd2' : b.color}"></div></div>
    <div class="desc">${esc(desc)}</div>
  </div>`
}

function trajectorySvg(metroKey: string, weights: ResilienceWeights, color: string): string {
  const traj = metroTrajectory(metroKey, weights)
  if (!traj.length) return ''
  const W = 820, H = 190, x0 = 34, x1 = 800, y0 = 14, y1 = 156
  const n = RESILIENCE_DECADES.length
  const X = (i: number) => x0 + (i * (x1 - x0)) / (n - 1)
  const Y = (v: number) => y0 + ((100 - v) * (y1 - y0)) / 100
  const grid = [0, 25, 50, 75, 100]
    .map(g => `<line x1="${x0}" y1="${Y(g)}" x2="${x1}" y2="${Y(g)}" stroke="#eef0f2" stroke-width="1"/>` +
      `<text x="${x0 - 6}" y="${Y(g) + 3}" text-anchor="end" font-size="10" fill="#9aa1ac">${g}</text>`)
    .join('')
  const pts = traj.map((t, i) => `${X(i).toFixed(1)},${Y(t.composite).toFixed(1)}`).join(' ')
  const dots = traj.map((t, i) => `<circle cx="${X(i).toFixed(1)}" cy="${Y(t.composite).toFixed(1)}" r="3" fill="${color}"/>`).join('')
  const xlab = traj
    .map((t, i) => `<text x="${X(i).toFixed(1)}" y="${y1 + 16}" text-anchor="middle" font-size="10" fill="#9aa1ac">${t.year}</text>`)
    .join('')
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Composite resilience trajectory to 2095">` +
    `${grid}<polyline fill="none" stroke="${color}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" points="${pts}"/>${dots}${xlab}</svg>`
}

function femaCells(metroKey: string): string {
  const rec = nri[metroKey]
  if (!rec) return '<div class="fitem"><div class="lab">FEMA record</div><div class="fval">not matched</div></div>'
  const rows: Array<[string, string]> = [
    ['County', `${rec.county ?? '—'}${rec.state ? ', ' + rec.state : ''}`],
    ['Wildfire risk pctl', fmt(rec.wildfire_risk)],
    ['Inland flood loss-rate', fmt(rec.inland_flood_alr_pctl)],
    ['Coastal flood loss-rate', rec.coastal_flood_alr_pctl == null ? 'none' : fmt(rec.coastal_flood_alr_pctl)],
    ['Community resilience', fmt(rec.community_resilience)],
    ['Social vulnerability', fmt(rec.social_vulnerability)],
  ]
  return rows.map(([k, v]) => `<div class="fitem"><div class="lab">${esc(k)}</div><div class="fval">${esc(v)}</div></div>`).join('')
}

export function buildCityReportHtml(
  metroKey: string,
  year: number,
  weights: ResilienceWeights = DEFAULT_WEIGHTS,
): string {
  const r: MetroResilience | null = metroResilience(metroKey, year, weights)
  const generated = new Date().toISOString().slice(0, 10)

  if (!r) {
    return `<!doctype html><html><head><meta charset="utf-8"><title>Resilience report</title></head>` +
      `<body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;padding:40px;color:#101728">` +
      `<h1>No data</h1><p>No resilience data is available for "${esc(metroKey)}".</p></body></html>`
  }

  const rec = nri[metroKey] || {}
  const b = bandOf(r.composite)
  const ranked = rankMetros(r.year, weights)
  const rank = ranked.findIndex(m => m.metroKey === metroKey) + 1
  const total = ranked.length
  const narrative =
    b.key === 'good'
      ? `holds up well across the modeled hazards for ${r.year}.`
      : b.key === 'mod'
        ? `carries moderate exposure for ${r.year} — some dimensions are strong, others strained.`
        : `is heavily exposed across multiple hazards for ${r.year}.`
  const wNote = `heat ${weights.heat} · water ${weights.water} · fire ${weights.fire} · flood ${weights.flood} · ` +
    `${Math.round((1 - weights.capacityShare) * 100)}:${Math.round(weights.capacityShare * 100)} exposure:capacity`

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Resilience report — ${esc(r.name)} (${r.year})</title>
<style>
  :root{--ink:#101728;--muted:#6b7280;--faint:#9aa1ac;--line:#e9eaed;--bg:#f4f5f7}
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.5}
  .sheet{max-width:900px;margin:0 auto;background:#fff;padding:28px 34px}
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
  .metric{padding:12px 0;border-bottom:1px solid var(--line)}
  .metric .lab{font-size:12px;color:var(--muted)}
  .metric .num{font-size:22px;font-weight:700;margin-top:1px}
  .metric .num .unit{font-size:12px;font-weight:600;color:var(--faint);margin-left:2px}
  .metric .track{height:5px;background:#eef0f2;border-radius:3px;overflow:hidden;margin:6px 0 4px}
  .metric .fill{height:100%;border-radius:3px}
  .metric .desc{font-size:11px;color:var(--faint)}
  .section{margin-top:22px}
  .section-h{font-size:13px;font-weight:600;color:var(--ink);margin-bottom:10px;display:flex;align-items:center;gap:7px}
  .note{font-size:11.5px;color:var(--faint);margin-top:8px;line-height:1.5}
  .fema-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:var(--line);border:1px solid var(--line);border-radius:12px;overflow:hidden}
  .fitem{background:#fff;padding:12px 14px}
  .fitem .lab{font-size:11px;color:var(--muted);margin-bottom:3px}
  .fitem .fval{font-size:16px;font-weight:600;font-variant-numeric:tabular-nums}
  .chips{display:flex;gap:10px;flex-wrap:wrap;margin-top:22px}
  .chip{background:var(--bg);border:1px solid var(--line);border-radius:11px;padding:9px 15px}
  .chip .lab{font-size:11px;color:var(--muted)}
  .chip .val{font-size:14px;font-weight:600}
  .foot{margin-top:22px;padding-top:14px;border-top:1px solid var(--line);font-size:11px;color:var(--faint);line-height:1.55}
  @media print{body{background:#fff}.sheet{max-width:none;padding:0}}
</style>
</head>
<body>
<div class="sheet">
  <div class="title">${esc(r.name)}</div>
  <div class="subtitle">
    ${r.county ? `<span class="item">${ICON_PIN}${esc(r.county)} County${rec.state ? ', ' + esc(rec.state) : ''}</span>` : ''}
    <span class="item">${ICON_CAL}Projection year ${r.year} · high-emissions (ssp585)</span>
  </div>

  <div class="pills">
    <span class="pill" style="background:${b.color}"><span class="dot"></span>${b.label} · ${Math.round(r.composite)}/100</span>
    <span class="pill" style="background:#4f6ef7">Rank #${rank} of ${total} metros</span>
  </div>

  <div class="cols">
    <div class="left">
      <div class="panel" style="background:${b.tint};border:1px solid ${b.tintB};color:${b.dark}">
        <div class="panel-h" style="color:${b.dark}">${ICON_SHIELD} Resilience score</div>
        <div class="big" style="color:${b.dark}">${Math.round(r.composite)}<span class="unit">/100</span></div>
        <div class="cap" style="color:${b.dark};opacity:.85">higher = more resilient · blend of hazard exposure and adaptive capacity</div>
        <p class="narr" style="color:${b.dark}"><strong>${esc(r.name.split(',')[0])}</strong> ranks #${rank} of ${total} US metros and ${narrative}</p>
      </div>
    </div>
    <div class="right">
      <div class="grid">
        ${DIMS.map(d => metricCell(d.label, d.desc, r[d.key] as number | null)).join('')}
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-h">Composite trajectory to 2095</div>
    ${trajectorySvg(metroKey, weights, b.color)}
    <div class="note">Composite resilience by decade under the current weighting. Heat and water carry the forward trend; fire, flood, and capacity are present-day FEMA values held flat.</div>
  </div>

  <div class="section">
    <div class="section-h">FEMA National Risk Index — county context</div>
    <div class="fema-grid">${femaCells(metroKey)}</div>
    <div class="note">${esc(r.waterSource)} · water coverage: ${esc(r.waterCoverage)}.</div>
  </div>

  <div class="chips">
    <span class="chip"><div class="lab">Scenario</div><div class="val">ssp585</div></span>
    <span class="chip"><div class="lab">Projection year</div><div class="val">${r.year}</div></span>
    <span class="chip"><div class="lab">Metros compared</div><div class="val">${total}</div></span>
    <span class="chip"><div class="lab">Generated</div><div class="val">${generated}</div></span>
  </div>

  <div class="foot">
    Weighting: ${esc(wNote)}.<br>
    Sources: NASA NEX-GDDP-CMIP6 wet-bulb projections; river-flow projections (USGS / Bureau of Reclamation / EPA, literature-parameterized); utility supply portfolios; FEMA National Risk Index 2.0 (present-day, per principal county). Methodology: docs/resilience-index-framework.html. This report is a decision aid, not a guarantee of future conditions.
  </div>
</div>
</body>
</html>`
}

export function downloadCityReport(
  metroKey: string,
  year: number,
  weights: ResilienceWeights = DEFAULT_WEIGHTS,
): void {
  const r = metroResilience(metroKey, year, weights)
  const html = buildCityReportHtml(metroKey, year, weights)
  const cityName = (r?.name || metroKey).split(',')[0].trim().replace(/\s+/g, '-')
  const fileYear = r?.year ?? year
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `Resilience-Report-${cityName}-${fileYear}.html`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
