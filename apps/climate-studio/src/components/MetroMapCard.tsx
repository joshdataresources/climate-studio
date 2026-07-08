import React, { useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, FileText } from 'lucide-react'
import { CityReportModal } from './CityReportModal'
import {
  metroResilience,
  rankMetros,
  RESILIENCE_DECADES,
} from '../utils/resilienceScore'
import wetBulbData from '../data/expanded_wet_bulb_projections.json'
import nriData from '../data/fema_nri_metros.json'
import aquiferData from '../data/metro-aquifers.json'
import waterAccessData from '../data/metro-water-access.json'

/**
 * Map-marker card for the Metro Weather layer: collapsed by default (name,
 * county, rank, composite score), expands to the five resilience dimensions,
 * each of which expands to the evidence that produced it (the old Metro
 * Weather metrics live under Heat). Replaces MetroTooltipBubble content.
 *
 * estimated_at_risk_population / casualty_rate_percent are intentionally
 * omitted (unverified provenance).
 */

const wetBulb = wetBulbData as Record<string, any>
const nri = ((nriData as any).metros ?? {}) as Record<string, any>
const metroAquifers = ((aquiferData as any).metros ?? {}) as Record<string, any>
const waterAccess = ((waterAccessData as any).metros ?? {}) as Record<string, any>

const scoreColor = (s: number) =>
  s >= 66 ? 'var(--cs-tone-emerald-text)' : s >= 40 ? 'var(--cs-tone-amber-text)' : 'var(--cs-tone-red-text)'

// SVG sparkline needs literal colors; mirrors --cs-tone-red-text (dark) is a
// CSS var so we pass the var through style — SVG stroke accepts var().
function Sparkline({ values, color }: { values: number[]; color: string }) {
  const w = 240
  const h = 32
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  const span = hi - lo || 1
  const x = (i: number) => 4 + (i * (w - 8)) / (values.length - 1)
  const y = (v: number) => h - 5 - ((v - lo) / span) * (h - 10)
  const pts = values.map((v, i) => `${x(i)},${y(v)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} role="img" aria-label="Trend by decade">
      <polyline points={pts} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function Fact({ k, v, note }: { k: string; v: React.ReactNode; note?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 py-0.5">
      <span className="text-[var(--cs-text-tertiary)]">{k}</span>
      <span className="text-right tabular-nums">
        {v}
        {note && <span className="ml-1 text-[11px] text-[var(--cs-tone-red-text)]">{note}</span>}
      </span>
    </div>
  )
}

interface RowProps {
  label: string
  score: number | null
  expanded: boolean
  onToggle: () => void
  children: React.ReactNode
}

function DimensionRow({ label, score, expanded, onToggle, children }: RowProps) {
  return (
    <div className="py-1.5">
      <button
        type="button"
        onClick={onToggle}
        className="unstyled-btn flex w-full items-center justify-between border-0 bg-transparent p-0 text-left"
      >
        <span className="text-[13px] font-medium">
          {label} · {score == null ? '—' : Math.round(score)}
        </span>
        {expanded ? <ChevronUp className="h-3.5 w-3.5 opacity-50" /> : <ChevronDown className="h-3.5 w-3.5 opacity-50" />}
      </button>
      <div className="mt-1 h-1.5 overflow-hidden rounded" style={{ background: 'rgba(0,0,0,0.10)' }}>
        <div
          className="h-full rounded"
          style={{ width: `${Math.max(2, Math.min(100, score ?? 0))}%`, background: scoreColor(score ?? 0) }}
        />
      </div>
      {expanded && <div className="mt-2 text-xs">{children}</div>}
    </div>
  )
}

/** Resolve a display name ("Houston", "Las Vegas, NV") to the wet-bulb metro key. */
function resolveMetroKey(name: string): string | null {
  if (wetBulb[name]) return name
  const lower = name.trim().toLowerCase()
  const cityOnly = lower.split(',')[0].trim()
  for (const k of Object.keys(wetBulb)) {
    const full = String(wetBulb[k].name ?? '').trim().toLowerCase()
    if (k.toLowerCase() === lower || k.toLowerCase() === cityOnly) return k
    if (full === lower || full.split(',')[0].trim() === cityOnly) return k
  }
  return null
}

export interface MetroMapCardProps {
  metroName: string
  year: number
}

export function MetroMapCard({ metroName, year }: MetroMapCardProps) {
  const [open, setOpen] = useState(false)
  const [showReport, setShowReport] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null) // all dimensions collapsed by default
  const toggle = (k: string) => setExpanded(e => (e === k ? null : k))

  const metroKey = useMemo(() => resolveMetroKey(metroName), [metroName])
  const r = useMemo(() => (metroKey ? metroResilience(metroKey, year) : null), [metroKey, year])
  const rankInfo = useMemo(() => {
    if (!metroKey) return null
    const ranked = rankMetros(year)
    const idx = ranked.findIndex(m => m.metroKey === metroKey)
    return idx >= 0 ? { rank: idx + 1, total: ranked.length } : null
  }, [metroKey, year])

  if (!metroKey || !r) return null
  const wb = wetBulb[metroKey]
  const n = nri[metroKey]
  const p = wb.projections?.[String(r.year)] ?? {}
  const base = wb.baseline_1995_2014 ?? {}
  const heatDaysDelta =
    p.days_over_95F != null && base.days_over_95F != null ? p.days_over_95F - base.days_over_95F : null
  const heatDaysSeries = RESILIENCE_DECADES.map(d => wb.projections?.[String(d)]?.days_over_95F ?? 0)

  return (
    <div
      className="pointer-events-auto relative rounded-xl border border-[var(--cs-border-default)] bg-[var(--cs-surface-overlay)] px-3 py-2 shadow-lg backdrop-blur"
      style={{ width: open ? 300 : 232 }}
    >
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="unstyled-btn flex w-full items-start justify-between gap-2 border-0 bg-transparent p-0 text-left"
      >
        <div className="min-w-0">
          <p className="flex items-center gap-1 truncate text-[14px] font-medium text-[var(--cs-text-primary)]">
            {r.name}
            {open ? <ChevronUp className="h-3.5 w-3.5 shrink-0 opacity-50" /> : <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-50" />}
          </p>
          <p className="truncate text-[11px] text-[var(--cs-text-tertiary)]">
            {rankInfo ? `rank ${rankInfo.rank} of ${rankInfo.total} · ` : ''}{r.year}
            {r.county ? ` · ${r.county} County` : ''}
          </p>
        </div>
        <span className="text-[22px] font-semibold leading-none tabular-nums" style={{ color: scoreColor(r.composite) }}>
          {Math.round(r.composite)}
        </span>
      </button>

      {open && (
        <div className="mt-2 text-[var(--cs-text-primary)]">
          <DimensionRow label="Heat" score={r.heat} expanded={expanded === 'heat'} onToggle={() => toggle('heat')}>
            <Fact k="peak wet-bulb" v={p.peak_wet_bulb_F != null ? `${p.peak_wet_bulb_F}°F` : '—'} />
            <Fact
              k="days over 95°F"
              v={p.days_over_95F ?? '—'}
              note={heatDaysDelta != null && heatDaysDelta !== 0 ? `(${heatDaysDelta > 0 ? '+' : ''}${heatDaysDelta} vs 1995)` : undefined}
            />
            <Fact k="summer humidity" v={p.avg_summer_humidity != null ? `${p.avg_summer_humidity}%` : '—'} />
            <Fact k="wet-bulb events" v={p.wet_bulb_events ?? '—'} />
            <Sparkline values={heatDaysSeries} color="var(--cs-tone-red-text)" />
            <p className="mt-1 text-[11px] text-[var(--cs-text-tertiary)]">
              days over 95°F by decade · NASA NEX-GDDP-CMIP6 · ssp585
            </p>
          </DimensionRow>

          <DimensionRow label="Water" score={r.water} expanded={expanded === 'water'} onToggle={() => toggle('water')}>
            {waterAccess[metroKey]?.portfolio?.map((item: any, i: number) => (
              <Fact
                key={i}
                k={`${Math.round(item.share * 100)}% ${item.type}`}
                v={String(item.name ?? '').length > 34 ? `${String(item.name).slice(0, 34)}…` : item.name}
              />
            )) ?? <Fact k="supply" v={r.waterSource} />}
            {(() => {
              const aq = metroAquifers[metroKey]
              if (!aq) return null
              return aq.aquifer ? (
                <Fact k="aquifer" v={`${aq.aquifer} · ${aq.stress} stress`} />
              ) : (
                <Fact k="aquifer" v="none — surface-water dependent" />
              )
            })()}
            <p className="mt-1 text-[11px] text-[var(--cs-text-tertiary)]">
              {r.waterCoverage === 'portfolio'
                ? 'utility supply portfolio · sources weighted by share; rivers/reservoirs carry projected flow declines'
                : r.waterCoverage === 'river'
                  ? 'dependency-weighted river flow · literature-parameterized declines'
                  : 'no mapped river source — placeholder default; treat with caution'}
            </p>
          </DimensionRow>

          <DimensionRow label="Fire" score={r.fire} expanded={expanded === 'fire'} onToggle={() => toggle('fire')}>
            <Fact k="wildfire risk percentile" v={n?.wildfire_risk != null ? Math.round(n.wildfire_risk) : '—'} />
            <p className="mt-1 text-[11px] text-[var(--cs-text-tertiary)]">
              FEMA NRI 2.0 · {n?.county ?? '—'} County · present-day snapshot
            </p>
          </DimensionRow>

          <DimensionRow label="Flood" score={r.flood} expanded={expanded === 'flood'} onToggle={() => toggle('flood')}>
            <Fact k="inland loss-rate pctl" v={n?.inland_flood_alr_pctl != null ? Math.round(n.inland_flood_alr_pctl) : '—'} />
            <Fact k="coastal loss-rate pctl" v={n?.coastal_flood_alr_pctl != null ? Math.round(n.coastal_flood_alr_pctl) : 'no exposure'} />
            <p className="mt-1 text-[11px] text-[var(--cs-text-tertiary)]">
              FEMA expected-annual-loss RATE percentiles (not magnitude)
            </p>
          </DimensionRow>

          <DimensionRow label="Capacity" score={r.capacity} expanded={expanded === 'capacity'} onToggle={() => toggle('capacity')}>
            <Fact k="community resilience" v={n?.community_resilience != null ? Math.round(n.community_resilience) : '—'} />
            <Fact k="social vulnerability" v={n?.social_vulnerability != null ? Math.round(n.social_vulnerability) : '—'} />
            <p className="mt-1 text-[11px] text-[var(--cs-text-tertiary)]">
              capacity = ½·RESL + ½·(100 − SOVI) · county granularity
            </p>
          </DimensionRow>

          <button
            type="button"
            onClick={() => setShowReport(true)}
            className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-md py-2 text-[12px] font-medium text-white transition-opacity hover:opacity-90"
            style={{ background: 'var(--cs-brand-primary)' }}
          >
            <FileText className="h-3.5 w-3.5" /> Generate report
          </button>
        </div>
      )}
      {showReport && (
        <CityReportModal metroKey={metroKey} year={year} onClose={() => setShowReport(false)} />
      )}
    </div>
  )
}
