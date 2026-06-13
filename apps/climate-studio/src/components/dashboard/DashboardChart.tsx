import React, { useMemo } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts'
import { cn } from '../../lib/utils'

export interface ChartSeries {
  key: string
  label: string
  color: string
  dashed?: boolean
}

interface DashboardChartProps {
  title: string
  subtitle?: string
  /** Short unit / scale note shown top-right above the plot */
  yAxisLabel?: string
  /** Layer-style attribution, e.g. "CHIRPS via Earth Engine" */
  source?: string
  data: ChartDataPoint[]
  series: ChartSeries[]
  height?: number
  yDomain?: [number | string, number | string]
  /** Tighten y-axis to data range (optional clamp, e.g. [0, 10] for drought index) */
  fitYDomain?: boolean
  yClamp?: [number, number]
  className?: string
  /** Unique id so Recharts remounts when city/data changes */
  chartId?: string
}

export interface ChartDataPoint {
  year: number
  [key: string]: number | string
}

const DEFAULT_HEIGHT = 220

function collectNumericValues(data: ChartDataPoint[], series: ChartSeries[]): number[] {
  const keys = new Set([...series.map(s => s.key), 'baseline'])
  const values: number[] = []
  for (const row of data) {
    for (const key of keys) {
      const v = row[key]
      if (typeof v === 'number' && Number.isFinite(v)) values.push(v)
    }
  }
  return values
}

function computeFittedYDomain(
  data: ChartDataPoint[],
  series: ChartSeries[],
  clamp?: [number, number]
): [number, number] {
  const values = collectNumericValues(data, series)
  if (!values.length) return [0, 10]

  let min = Math.min(...values)
  let max = Math.max(...values)
  const span = max - min || 0.5
  const pad = Math.max(span * 0.15, 0.35)
  min -= pad
  max += pad

  if (max - min < 1.5) {
    const mid = (Math.min(...values) + Math.max(...values)) / 2
    min = mid - 0.75
    max = mid + 0.75
  }

  if (clamp) {
    min = Math.max(clamp[0], min)
    max = Math.min(clamp[1], max)
    if (max <= min) max = min + 1
  }

  return [Math.round(min * 10) / 10, Math.round(max * 10) / 10]
}

export function DashboardChart({
  title,
  subtitle,
  yAxisLabel,
  source,
  data,
  series,
  height = DEFAULT_HEIGHT,
  yDomain,
  fitYDomain = false,
  yClamp,
  className,
  chartId,
}: DashboardChartProps) {
  const resolvedDomain = useMemo((): [number | string, number | string] => {
    if (yDomain) return yDomain
    if (fitYDomain) return computeFittedYDomain(data, series, yClamp)
    return ['auto', 'auto']
  }, [yDomain, fitYDomain, yClamp, data, series])

  return (
    <div className={cn('widget-container flex flex-col', className)}>
      <h4 className="widget-title shrink-0">{title}</h4>
      {subtitle && (
        <p className="mb-2 shrink-0 text-xs text-[var(--cs-text-tertiary)]">{subtitle}</p>
      )}
      {source && (
        <p className="mb-2 shrink-0 text-[11px] text-[var(--cs-text-tertiary)]">
          Source:{' '}
          <span className="font-medium text-[var(--cs-text-primary)]">{source}</span>
        </p>
      )}
      <div className="relative" style={{ width: '100%', height }}>
        {yAxisLabel && (
          <p className="pointer-events-none absolute right-0 top-0 z-10 m-0 pr-1 text-[10px] font-medium text-[var(--cs-text-tertiary)]">
            {yAxisLabel}
          </p>
        )}
        <ResponsiveContainer width="100%" height={height}>
          <LineChart
            key={chartId ?? title}
            data={data}
            margin={{ top: yAxisLabel ? 18 : 8, right: 12, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis
              dataKey="year"
              tick={{ fontSize: 11, fill: 'var(--cs-text-tertiary)' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: 'var(--cs-text-tertiary)' }}
              axisLine={false}
              tickLine={false}
              width={40}
              domain={resolvedDomain}
            />
            <Tooltip
              contentStyle={{
                background: 'var(--cs-surface-elevated)',
                border: '1px solid var(--cs-border-default)',
                borderRadius: '8px',
                fontSize: 12,
              }}
            />
            {series.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
            {series.map(s => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label}
                stroke={s.color}
                strokeWidth={s.dashed ? 1.5 : 2}
                strokeDasharray={s.dashed ? '4 4' : undefined}
                dot={s.dashed ? false : { r: 3, fill: s.color }}
                activeDot={{ r: 4 }}
                connectNulls={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
