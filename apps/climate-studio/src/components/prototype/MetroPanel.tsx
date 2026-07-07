import React, { useMemo, useState } from 'react'
import { X, ChevronDown, ChevronUp } from 'lucide-react'
import {
  metroResilience,
  metroTrajectory,
  RESILIENCE_DECADES,
} from '../../utils/resilienceScore'
import wetBulbData from '../../data/expanded_wet_bulb_projections.json'
import nriData from '../../data/fema_nri_metros.json'

/**
 * PROTOTYPE — unified metro panel: resilience score as the summary, the old
 * "Metro Weather" metrics as expandable evidence under the dimension they
 * feed. Replaces MetroTooltipBubble / MetroHumidityBubble /
 * MetroTemperaturePopup / MetroUnifiedPopup if adopted.
 *
 * Deliberately omitted: estimated_at_risk_population and
 * casualty_rate_percent from the wet-bulb JSON — their provenance is
 * unverified (same class of issue as the removed fabricated population data).
 */

const wetBulb = wetBulbData as Record<string, any>
const nri = ((nriData as any).metros ?? {}) as Record<string, any>

const scoreColor = (s: number) => (s >= 66 ? '#1D9E75' : s >= 40 ? '#EF9F27' : '#E24B4A')

function Sparkline({ values, years, markYear, color }: { values: number[]; years: number[]; markYear?: number; color: string }) {
  const w = 280
  const h = 40
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  const span = hi - lo || 1
  const x = (i: number) => 4 + (i * (w - 8)) / (values.length - 1)
  const y = (v: number) => h - 6 - ((v - lo) / span) * (h - 12)
  const pts = values.map((v, i) => `${x(i)},${y(v)}`).join(' ')
  const mi = markYear != null ? years.indexOf(markYear) : -1
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} role="img"
      aria-label={`Trend from ${Math.round(values[0])} in ${years[0]} to ${Math.round(values[values.length - 1])} in ${years[years.length - 1]}`}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {mi >= 0 && <circle cx={x(mi)} cy={y(values[mi])} r={4} fill={color} stroke="var(--cs-surface, #fff)" strokeWidth={2} />}
    </svg>
  )
}

function Chip({ tone, children }: { tone: 'ok' | 'warn' | 'muted'; children: React.ReactNode }) {
  const styles: Record<string, React.CSSProperties> = {
    ok: { background: 'rgba(29,158,117,0.12)', color: '#0F6E56' },
    warn: { background: 'rgba(239,159,39,0.15)', color: '#854F0B' },
    muted: { background: 'rgba(127,127,127,0.12)', color: 'var(--cs-text-tertiary, #666)' },
  }
  return (
    <span className="rounded-lg px-2 py-0.5 text-[11px]" style={styles[tone]}>
      {children}
    </span>
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
    <div className="border-t border-black/10 py-1.5">
      <button type="button" onClick={onToggle} className="flex w-full items-center justify-between text-left">
        <span className="text-[13px] font-medium">
          {label} · {score == null ? '—' : Math.round(score)}
        </span>
        {expanded ? <ChevronUp className="h-3.5 w-3.5 opacity-50" /> : <ChevronDown className="h-3.5 w-3.5 opacity-50" />}
      </button>
      <div className="mt-1 h-1.5 overflow-hidden rounded bg-black/10">
        <div
          className="h-full rounded"
          style={{ width: `${Math.max(2, Math.min(100, score ?? 0))}%`, background: scoreColor(score ?? 0) }}
        />
      </div>
      {expanded && <div className="mt-2 rounded-lg bg-black/5 px-2.5 py-2 text-xs">{children}</div>}
    </div>
  )
}

function Fact({ k, v, note }: { k: string; v: React.ReactNode; note?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 py-0.5">
      <span className="text-[var(--cs-text-tertiary,#666)]">{k}</span>
      <span className="text-right tabular-nums">
        {v}
        {note && <span className="ml-1 text-[11px] text-[#A32D2D]">{note}</span>}
      </span>
    </div>
  )
}

export interface MetroPanelProps {
  metroKey: string
  year: number
  rank: number
  total: number
  onClose: () => void
}

export function MetroPanel({ metroKey, year, rank, total, onClose }: MetroPanelProps) {
  const [expanded, setExpanded] = useState<string | null>('heat')
  const toggle = (k: string) => setExpanded(e => (e === k ? null : k))

  const r = useMemo(() => metroResilience(metroKey, year), [metroKey, year])
  const traj = useMemo(() => metroTrajectory(metroKey), [metroKey])
  const wb = wetBulb[metroKey]
  const n = nri[metroKey]

  if (!r || !wb) return null
  const p = wb.projections?.[String(r.year)] ?? {}
  const base = wb.baseline_1995_2014 ?? {}
  const heatDaysDelta = p.days_over_95F != null && base.days_over_95F != null ? p.days_over_95F - base.days_over_95F : null
  const heatDaysSeries = RESILIENCE_DECADES.map(d => wb.projections?.[String(d)]?.days_over_95F ?? 0)

  return (
    <div className="absolute bottom-4 right-4 top-4 z-10 w-[340px] overflow-y-auto rounded-xl border border-black/10 bg-white/95 p-4 shadow-lg backdrop-blur dark:bg-zinc-900/95">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[15px] font-medium">{r.name}</p>
          <p className="text-xs text-[var(--cs-text-tertiary,#666)]">
            {r.county ? `${r.county} County · ` : ''}{r.year} · ssp585
          </p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close panel" className="rounded p-1 hover:bg-black/5">
          <X className="h-4 w-4 opacity-60" />
        </button>
      </div>

      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-[34px] font-medium leading-none tabular-nums" style={{ color: scoreColor(r.composite) }}>
          {Math.round(r.composite)}
        </span>
        <span className="text-xs text-[var(--cs-text-tertiary,#666)]">resilience · rank {rank} of {total}</span>
      </div>

      <div className="mb-3 mt-2 flex flex-wrap gap-1.5">
        {r.waterCoverage === 'river'
          ? <Chip tone="ok">river-mapped water</Chip>
          : <Chip tone="warn">water unmapped — default used</Chip>}
        <Chip tone="muted">fire / flood / capacity = present-day</Chip>
      </div>

      <DimensionRow label="Heat" score={r.heat} expanded={expanded === 'heat'} onToggle={() => toggle('heat')}>
        <Fact k="peak wet-bulb" v={p.peak_wet_bulb_F != null ? `${p.peak_wet_bulb_F}°F` : '—'} />
        <Fact
          k="days over 95°F"
          v={p.days_over_95F ?? '—'}
          note={heatDaysDelta != null && heatDaysDelta !== 0 ? `(${heatDaysDelta > 0 ? '+' : ''}${heatDaysDelta} vs 1995–2014)` : undefined}
        />
        <Fact k="summer humidity" v={p.avg_summer_humidity != null ? `${p.avg_summer_humidity}%` : '—'} />
        <Fact k="wet-bulb events" v={p.wet_bulb_events ?? '—'} />
        <Sparkline values={heatDaysSeries} years={RESILIENCE_DECADES} markYear={r.year} color="#E24B4A" />
        <p className="mt-1 text-[11px] text-[var(--cs-text-tertiary,#666)]">
          days over 95°F by decade · NASA NEX-GDDP-CMIP6, ssp585
        </p>
      </DimensionRow>

      <DimensionRow label="Water" score={r.water} expanded={expanded === 'water'} onToggle={() => toggle('water')}>
        <Fact k="supply" v={r.waterSource} />
        <Fact k="flow retained" v={`${Math.round(r.water)}%`} />
        <p className="mt-1 text-[11px] text-[var(--cs-text-tertiary,#666)]">
          {r.waterCoverage === 'river'
            ? 'dependency-weighted river flow · decline rates are literature-parameterized (USGS / BuRec / EPA)'
            : 'no mapped river source — placeholder default; treat with caution'}
        </p>
      </DimensionRow>

      <DimensionRow label="Fire" score={r.fire} expanded={expanded === 'fire'} onToggle={() => toggle('fire')}>
        <Fact k="wildfire risk percentile" v={n?.wildfire_risk != null ? Math.round(n.wildfire_risk) : '—'} />
        <p className="mt-1 text-[11px] text-[var(--cs-text-tertiary,#666)]">
          FEMA NRI 2.0, {n?.county ?? '—'} County · national percentile, higher = worse · present-day snapshot
        </p>
      </DimensionRow>

      <DimensionRow label="Flood" score={r.flood} expanded={expanded === 'flood'} onToggle={() => toggle('flood')}>
        <Fact k="inland loss-rate percentile" v={n?.inland_flood_alr_pctl != null ? Math.round(n.inland_flood_alr_pctl) : '—'} />
        <Fact k="coastal loss-rate percentile" v={n?.coastal_flood_alr_pctl != null ? Math.round(n.coastal_flood_alr_pctl) : 'no coastal exposure'} />
        <p className="mt-1 text-[11px] text-[var(--cs-text-tertiary,#666)]">
          FEMA NRI expected-annual-loss rate percentiles — rate, not magnitude, so big counties aren't auto-pinned
        </p>
      </DimensionRow>

      <DimensionRow label="Capacity" score={r.capacity} expanded={expanded === 'capacity'} onToggle={() => toggle('capacity')}>
        <Fact k="community resilience" v={n?.community_resilience != null ? Math.round(n.community_resilience) : '—'} />
        <Fact k="social vulnerability" v={n?.social_vulnerability != null ? Math.round(n.social_vulnerability) : '—'} />
        <p className="mt-1 text-[11px] text-[var(--cs-text-tertiary,#666)]">
          capacity = ½·RESL + ½·(100 − SOVI) · county granularity — a metro can straddle very different counties
        </p>
      </DimensionRow>

      <div className="mt-2 border-t border-black/10 pt-2">
        <div className="flex items-baseline justify-between">
          <span className="text-xs text-[var(--cs-text-tertiary,#666)]">composite trajectory 2025–2095</span>
          <span className="text-xs tabular-nums text-[var(--cs-text-tertiary,#666)]">
            {Math.round(traj[0]?.composite ?? 0)} → {Math.round(traj[traj.length - 1]?.composite ?? 0)}
          </span>
        </div>
        <Sparkline
          values={traj.map(t => t.composite)}
          years={traj.map(t => t.year)}
          markYear={r.year}
          color={scoreColor(r.composite)}
        />
      </div>
    </div>
  )
}
