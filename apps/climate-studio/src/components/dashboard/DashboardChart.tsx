import React from 'react'
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
  data: ChartDataPoint[]
  series: ChartSeries[]
  height?: number
  yDomain?: [number | string, number | string]
  className?: string
  /** Unique id so Recharts remounts when city/data changes */
  chartId?: string
}

export interface ChartDataPoint {
  year: number
  [key: string]: number | string
}

const DEFAULT_HEIGHT = 220

export function DashboardChart({
  title,
  subtitle,
  data,
  series,
  height = DEFAULT_HEIGHT,
  yDomain,
  className,
  chartId,
}: DashboardChartProps) {
  return (
    <div className={cn('widget-container flex flex-col', className)}>
      <h4 className="widget-title shrink-0">{title}</h4>
      {subtitle && (
        <p className="mb-2 shrink-0 text-xs text-[var(--cs-text-tertiary)]">{subtitle}</p>
      )}
      <div style={{ width: '100%', height }}>
        <ResponsiveContainer width="100%" height={height}>
          <LineChart
            key={chartId ?? title}
            data={data}
            margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
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
              domain={yDomain ?? ['auto', 'auto']}
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
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
