import React, { useMemo, useState } from 'react'
import { DashboardChart } from './DashboardChart'
import type { ChartDataPoint, ChartSeries } from './chartTypes'
import {
  rankMetros,
  metroTrajectory,
  RESILIENCE_DECADES,
  DEFAULT_WEIGHTS,
  type ResilienceWeights,
  type MetroResilience,
} from '../../utils/resilienceScore'

// Chart series colors mirror the design-system chart scale (SVG plot needs
// literal colors): --cs-chart-1..5 from design.md.
const SERIES_COLORS = ['#437efc', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444']

// Score bands are semantic (good / moderate / exposed) → tone tokens.
const barColor = (s: number) =>
  s >= 66 ? 'var(--cs-tone-emerald-text)' : s >= 40 ? 'var(--cs-tone-amber-text)' : 'var(--cs-tone-red-text)'

interface DimSlider {
  key: 'heat' | 'water' | 'fire' | 'flood'
  label: string
}

const DIM_SLIDERS: DimSlider[] = [
  { key: 'heat', label: 'Heat' },
  { key: 'water', label: 'Water' },
  { key: 'fire', label: 'Fire' },
  { key: 'flood', label: 'Flood' },
]

interface LeaderboardRow {
  m: MetroResilience
  rank: number
}

interface LeaderboardCardProps {
  year: number
  ranked: MetroResilience[]
  topN: number
  /** Metro keys that must appear even when ranked below topN (with their true rank). */
  pinnedKeys?: string[]
  weights: ResilienceWeights
  setWeights: React.Dispatch<React.SetStateAction<ResilienceWeights>>
}

function ResilienceLeaderboardCard({ year, ranked, topN, pinnedKeys, weights, setWeights }: LeaderboardCardProps) {
  // topN is the TOTAL row budget: pinned metros ranked below the cutoff take
  // their seats from the top of the list (e.g. 3 pinned below → top 7 + 3).
  const pinnedRanks = (pinnedKeys ?? [])
    .map(key => ranked.findIndex(r => r.metroKey === key) + 1)
    .filter(r => r > 0)
  let cutoff = topN
  for (let i = 0; i < 3; i++) {
    const outside = pinnedRanks.filter(r => r > cutoff).length
    cutoff = Math.max(1, topN - outside)
  }
  const rows: LeaderboardRow[] = ranked.slice(0, cutoff).map((m, i) => ({ m, rank: i + 1 }))
  const pinned: LeaderboardRow[] = pinnedRanks
    .filter(r => r > cutoff)
    .sort((a, b) => a - b)
    .map(r => ({ m: ranked[r - 1], rank: r }))

  const isDefault =
    DIM_SLIDERS.every(d => weights[d.key] === DEFAULT_WEIGHTS[d.key]) &&
    weights.capacityShare === DEFAULT_WEIGHTS.capacityShare

  const setDim = (key: DimSlider['key'], value: number) =>
    setWeights(w => ({ ...w, [key]: value }))

  const renderRow = ({ m, rank }: LeaderboardRow) => (
    <div key={m.metroKey} className="flex items-center gap-2">
      <span className="w-6 text-xs tabular-nums text-[var(--cs-text-tertiary)]">{rank}</span>
      <span className="flex-1 truncate text-sm">{m.name}</span>
      <div className="h-2 w-16 overflow-hidden rounded bg-[var(--cs-surface-sunken)]">
        <div
          className="h-full rounded"
          style={{ width: `${Math.max(2, Math.min(100, m.composite))}%`, background: barColor(m.composite) }}
        />
      </div>
      <span className="w-7 text-right text-sm font-semibold tabular-nums">{Math.round(m.composite)}</span>
    </div>
  )

  return (
    <div className="widget-container flex h-full flex-col">
      <h4 className="widget-title shrink-0">Resilience leaderboard · {year}</h4>
      <p className="mb-2 shrink-0 text-xs text-[var(--cs-text-tertiary)]">
        Composite of heat, water, fire, flood + adaptive capacity · 0–100, higher = more resilient
      </p>

      <div className="grid flex-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          {rows.map(renderRow)}
          {pinned.length > 0 && (
            <div className="py-0.5 text-center text-xs leading-none text-[var(--cs-text-tertiary)]">···</div>
          )}
          {pinned.map(renderRow)}
        </div>

        <div className="flex flex-col border-t border-[var(--cs-border-default)] pt-4 md:border-l md:border-t-0 md:pl-4 md:pt-0">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium">Weights</span>
            {!isDefault && (
              <button
                type="button"
                className="text-xs text-[var(--cs-text-tertiary)] underline"
                onClick={() => setWeights({ ...DEFAULT_WEIGHTS })}
              >
                Reset
              </button>
            )}
          </div>
          <div className="grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-2">
            {DIM_SLIDERS.map(d => (
              <React.Fragment key={d.key}>
                <label htmlFor={`weight-${d.key}`} className="text-xs">{d.label}</label>
                <input
                  id={`weight-${d.key}`}
                  type="range"
                  min={0}
                  max={2}
                  step={0.1}
                  value={weights[d.key]}
                  onChange={e => setDim(d.key, Number(e.target.value))}
                  className="w-full accent-[var(--cs-brand-primary)]"
                  aria-label={`${d.label} weight`}
                />
                <span className="w-12 text-right text-xs tabular-nums text-[var(--cs-text-tertiary)]">
                  {weights[d.key].toFixed(1)}
                </span>
              </React.Fragment>
            ))}
            <div className="col-span-3 my-1 border-t border-[var(--cs-border-default)]" />
            <label htmlFor="weight-capacity" className="text-xs">Capacity</label>
            <input
              id="weight-capacity"
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={weights.capacityShare}
              onChange={e => setWeights(w => ({ ...w, capacityShare: Number(e.target.value) }))}
              className="w-full accent-[var(--cs-brand-primary)]"
              aria-label="Exposure vs adaptive-capacity blend"
            />
            <span className="w-12 text-right text-xs tabular-nums text-[var(--cs-text-tertiary)]">
              {Math.round((1 - weights.capacityShare) * 100)}:{Math.round(weights.capacityShare * 100)}
            </span>
            <p className="col-span-3 text-[11px] leading-snug text-[var(--cs-text-tertiary)]">
              Capacity is a metro's ability to adapt — FEMA Community Resilience blended with inverted Social
              Vulnerability. Unlike the hazard weights above, this slider sets how much adaptive capacity offsets
              hazard exposure in the composite (shown as exposure:capacity).
            </p>
          </div>
          <p className="mt-3 text-[11px] leading-snug text-[var(--cs-text-tertiary)]">
            Heat is projected per decade; water is each utility's documented supply portfolio (rivers, reservoirs,
            groundwater, imports, desal, reuse) weighted by share, with river-fed sources carrying projected flow
            declines; fire, flood, and capacity are FEMA NRI present-day percentiles held flat. See
            docs/resilience-index-framework.html.
          </p>
        </div>
      </div>
    </div>
  )
}

interface TrajectoryCardProps {
  ranked: MetroResilience[]
  weights: ResilienceWeights
  /** Metro keys to plot. Defaults to the current top 5. */
  trajectoryKeys?: string[]
}

function ResilienceTrajectoryCard({ ranked, weights, trajectoryKeys }: TrajectoryCardProps) {
  const { data, series } = useMemo(() => {
    const picks = trajectoryKeys?.length
      ? ranked.filter(m => trajectoryKeys.includes(m.metroKey))
      : ranked.slice(0, 5)

    const series: ChartSeries[] = picks.map((m, i) => ({
      key: m.metroKey,
      label: m.name,
      color: SERIES_COLORS[i % SERIES_COLORS.length],
    }))

    const traj: Record<string, Record<number, number>> = {}
    for (const m of picks) {
      if (!traj[m.metroKey]) traj[m.metroKey] = {}
      for (const t of metroTrajectory(m.metroKey, weights)) traj[m.metroKey][t.year] = t.composite
    }

    const data: ChartDataPoint[] = RESILIENCE_DECADES.map(y => {
      const row: ChartDataPoint = { year: y }
      for (const m of picks) row[m.metroKey] = traj[m.metroKey]?.[y] ?? 0
      return row
    })

    return { data, series }
  }, [ranked, trajectoryKeys, weights])

  return (
    <DashboardChart
      className="h-full"
      title="Composite resilience trajectory"
      subtitle="Top metros · 0–100 · to 2095"
      data={data}
      series={series}
      fitYDomain
      yClamp={[0, 100]}
      source="Climate Studio · NEX-GDDP-CMIP6 + USGS/BuRec + FEMA NRI"
      chartId="resilience-trajectory"
    />
  )
}

export interface ResilienceSectionProps {
  year?: number
  topN?: number
  /** Metro keys that must appear in the list even below topN (true rank shown). */
  pinnedKeys?: string[]
  /** Metro keys to plot in the trajectory chart. Defaults to the current top 5. */
  trajectoryKeys?: string[]
}

/**
 * Dashboard section: resilience leaderboard and composite trajectory as two
 * equal-height widget-container modules sharing one tunable ResilienceWeights
 * state, so slider changes re-rank the leaderboard and redraw the trajectory
 * together. DashboardChart supplies its own widget-container — don't wrap it.
 */
export function ResilienceSection({ year = 2055, topN = 10, pinnedKeys, trajectoryKeys }: ResilienceSectionProps) {
  const [weights, setWeights] = useState<ResilienceWeights>({ ...DEFAULT_WEIGHTS })
  const ranked = useMemo(() => rankMetros(year, weights), [year, weights])

  return (
    <div className="grid items-stretch gap-4 lg:grid-cols-2">
      <ResilienceLeaderboardCard
        year={year}
        ranked={ranked}
        topN={topN}
        pinnedKeys={pinnedKeys}
        weights={weights}
        setWeights={setWeights}
      />
      <ResilienceTrajectoryCard ranked={ranked} weights={weights} trajectoryKeys={trajectoryKeys} />
    </div>
  )
}
