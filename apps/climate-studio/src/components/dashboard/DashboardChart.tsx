import React, { useState, useMemo } from 'react'
import { cn } from '../../lib/utils'
import { SvgLinePlotFixed as SvgLinePlot } from './SvgLinePlotFixed'
import { ChartLegend } from './ChartLegend'
export type { ChartDataPoint, ChartSeries } from './chartTypes'
import type { ChartDataPoint, ChartSeries } from './chartTypes'

interface DashboardChartProps {
  title: string
  subtitle?: string
  yAxisLabel?: string
  source?: string
  data: ChartDataPoint[]
  series: ChartSeries[]
  height?: number
  yDomain?: [number | string, number | string]
  fitYDomain?: boolean
  yClamp?: [number, number]
  className?: string
  chartId?: string
}

const DEFAULT_HEIGHT = 220

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
  console.log(`[DashboardChart ${chartId || title}] Input:`, {
    seriesCount: series.length,
    dataRows: data.length,
    seriesKeys: series.map(s => s.key)
  })
  const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(new Set())

  const handleSeriesToggle = (seriesKey: string) => {
    setHiddenSeries(prev => {
      const next = new Set(prev)
      if (next.has(seriesKey)) {
        next.delete(seriesKey)
      } else {
        next.add(seriesKey)
      }
      return next
    })
  }

  // Filter data to exclude hidden series
  // Changed: Show all series by default, only filter if user explicitly hides them
  const visibleSeries = useMemo(
    () => {
      // Always show all series unless user has explicitly hidden some
      const result = hiddenSeries.size > 0
        ? series.filter(s => !hiddenSeries.has(s.key))
        : series // Show all series by default

      console.log(`[DashboardChart ${chartId || title}] Visible series:`, {
        inputCount: series.length,
        visibleCount: result.length,
        hiddenCount: hiddenSeries.size,
        showingAll: hiddenSeries.size === 0
      })

      return result
    },
    [series, hiddenSeries, chartId, title]
  )

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
        <SvgLinePlot
          height={height}
          data={data}
          series={visibleSeries}
          yDomain={yDomain}
          fitYDomain={fitYDomain}
          yClamp={yClamp}
        />
      </div>
      <ChartLegend
        series={series}
        onSeriesToggle={series.length > 1 ? handleSeriesToggle : undefined} // Allow toggling for 2+ series
        hiddenSeries={hiddenSeries}
      />
    </div>
  )
}
