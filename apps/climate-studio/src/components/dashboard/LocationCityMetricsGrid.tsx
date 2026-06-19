import React from 'react'
import { cn } from '../../lib/utils'
import type { TemperatureStats } from '../../utils/metroChartData'

type MetricTone = 'neutral' | 'orange' | 'red' | 'blue' | 'amber'

const TONE_STYLES: Record<
  MetricTone,
  { bg: string; value: string; label: string }
> = {
  neutral: {
    bg: 'rgba(148, 163, 184, 0.1)',
    value: 'var(--cs-text-primary)',
    label: 'var(--cs-text-tertiary)',
  },
  orange: {
    bg: 'rgba(251, 146, 60, 0.1)',
    value: 'var(--cs-tone-orange-text)',
    label: 'var(--cs-tone-orange-text)',
  },
  red: {
    bg: 'rgba(239, 68, 68, 0.1)',
    value: 'var(--cs-tone-red-text)',
    label: 'var(--cs-tone-red-text)',
  },
  blue: {
    bg: 'rgba(59, 130, 246, 0.1)',
    value: 'var(--cs-tone-blue-text)',
    label: 'var(--cs-tone-blue-text)',
  },
  amber: {
    bg: 'rgba(245, 158, 11, 0.1)',
    value: 'var(--cs-tone-amber-text)',
    label: 'var(--cs-tone-amber-text)',
  },
}

interface MetricTileProps {
  label: string
  value: string
  caption: string
  tone?: MetricTone
}

function MetricTile({ label, value, caption, tone = 'neutral' }: MetricTileProps) {
  const style = TONE_STYLES[tone]
  return (
    <div
      className="flex min-h-[4.5rem] flex-col gap-1 rounded-lg p-3"
      style={{ backgroundColor: style.bg }}
    >
      <span className="text-[11px] font-medium" style={{ color: style.label }}>
        {label}
      </span>
      <span className="text-lg font-semibold leading-tight" style={{ color: style.value }}>
        {value}
      </span>
      <span className="text-[10px] text-[var(--cs-text-tertiary)]">{caption}</span>
    </div>
  )
}

function formatDelta(value: number, unit = '°F'): string {
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(1)}${unit}`
}

interface LocationCityMetricsGridProps {
  stats: TemperatureStats
  projectionYear: number
  className?: string
}

/** 4×2 aquifer-style metric grid for a single city tab. */
export function LocationCityMetricsGrid({
  stats,
  projectionYear,
  className,
}: LocationCityMetricsGridProps) {
  const { current, baseline } = stats
  const summerDelta = current.summer_avg - baseline.summer_avg
  const winterDelta = current.winter_avg - baseline.winter_avg
  const days110Delta = current.days_over_110 - baseline.days_over_110

  return (
    <div className={cn('grid grid-cols-2 gap-3 sm:grid-cols-4', className)}>
      <MetricTile
        label="Annual avg"
        value={`${current.annual_avg.toFixed(1)}°F`}
        caption={`Baseline ${baseline.avg_annual.toFixed(1)}°F`}
        tone="neutral"
      />
      <MetricTile
        label="Summer avg"
        value={`${current.summer_avg.toFixed(1)}°F`}
        caption={`Baseline ${baseline.summer_avg.toFixed(1)}°F`}
        tone="orange"
      />
      <MetricTile
        label="Winter avg"
        value={`${current.winter_avg.toFixed(1)}°F`}
        caption={`Baseline ${baseline.winter_avg.toFixed(1)}°F`}
        tone="blue"
      />
      <MetricTile
        label="Days >100°F"
        value={String(current.days_over_100)}
        caption={
          stats.daysOver100Increase > 0
            ? `+${stats.daysOver100Increase} vs baseline`
            : `Baseline ${baseline.days_over_100}`
        }
        tone="red"
      />
      <MetricTile
        label="Temp anomaly"
        value={formatDelta(stats.tempIncrease)}
        caption={`At ${projectionYear}`}
        tone="amber"
      />
      <MetricTile
        label="Summer Δ"
        value={formatDelta(summerDelta)}
        caption="vs 1995–2014 baseline"
        tone="orange"
      />
      <MetricTile
        label="Winter Δ"
        value={formatDelta(winterDelta)}
        caption="vs 1995–2014 baseline"
        tone="blue"
      />
      <MetricTile
        label="Days >110°F"
        value={String(current.days_over_110)}
        caption={
          days110Delta > 0
            ? `+${days110Delta} vs baseline`
            : `Baseline ${baseline.days_over_110}`
        }
        tone="red"
      />
    </div>
  )
}
