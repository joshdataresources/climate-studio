import React, { useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ChartDataPoint, ChartSeries } from './chartTypes'

const MARGIN = { top: 20, right: 12, bottom: 24, left: 40 }

function collectNumericValues(data: ChartDataPoint[], series: ChartSeries[]): number[] {
  const values: number[] = []
  for (const row of data) {
    for (const s of series) {
      const v = row[s.key]
      if (typeof v === 'number' && Number.isFinite(v)) values.push(v)
    }
  }
  return values
}

function resolveYBounds(
  data: ChartDataPoint[],
  series: ChartSeries[],
  yDomain?: [number | string, number | string],
  fitYDomain?: boolean,
  yClamp?: [number, number]
): [number, number] {
  if (yDomain && typeof yDomain[0] === 'number' && typeof yDomain[1] === 'number') {
    return [yDomain[0], yDomain[1]]
  }

  const values = collectNumericValues(data, series)
  if (!values.length) return [0, 10]

  if (!fitYDomain && yDomain?.[0] !== 'auto' && yDomain?.[1] !== 'auto') {
    return [Math.min(...values), Math.max(...values)]
  }

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

  if (yClamp) {
    min = Math.max(yClamp[0], min)
    max = Math.min(yClamp[1], max)
    if (max <= min) max = min + 1
  }

  return [Math.round(min * 10) / 10, Math.round(max * 10) / 10]
}

function scaleLinear(domain: [number, number], range: [number, number]) {
  const [d0, d1] = domain
  const [r0, r1] = range
  const span = d1 - d0 || 1
  return (v: number) => r0 + ((v - d0) / span) * (r1 - r0)
}

function buildPath(
  data: ChartDataPoint[],
  seriesKey: string,
  xScale: (year: number) => number,
  yScale: (v: number) => number
): string {
  const points: string[] = []
  let hasValidPoints = false

  for (let i = 0; i < data.length; i++) {
    const row = data[i]
    const v = row[seriesKey]

    if (typeof v === 'number' && Number.isFinite(v)) {
      const x = xScale(row.year).toFixed(2)
      const y = yScale(v).toFixed(2)
      points.push(`${hasValidPoints ? 'L' : 'M'}${x},${y}`)
      hasValidPoints = true
    }
  }

  return points.join(' ')
}

interface SvgLinePlotProps {
  height: number
  data: ChartDataPoint[]
  series: ChartSeries[]
  yDomain?: [number | string, number | string]
  fitYDomain?: boolean
  yClamp?: [number, number]
}

/** React SVG line chart — one <path> per series; add city → add line. */
export function SvgLinePlot({
  height,
  data,
  series,
  yDomain,
  fitYDomain,
  yClamp,
}: SvgLinePlotProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(320)

  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return
    const update = () => setWidth(Math.max(el.clientWidth, 200))
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const years = useMemo(() => data.map(d => d.year), [data])
  const yExtent = useMemo(
    () => resolveYBounds(data, series, yDomain, fitYDomain, yClamp),
    [data, series, yDomain, fitYDomain, yClamp]
  )

  const plotW = width - MARGIN.left - MARGIN.right
  const plotH = height - MARGIN.top - MARGIN.bottom

  const xScale = useMemo(
    () =>
      scaleLinear(
        [years[0] ?? 2025, years[years.length - 1] ?? 2095],
        [0, plotW]
      ),
    [years, plotW]
  )
  const yScale = useMemo(() => scaleLinear(yExtent, [plotH, 0]), [yExtent, plotH])

  const yTicks = useMemo(() => {
    const [min, max] = yExtent
    const count = 4
    return Array.from({ length: count }, (_, i) => min + ((max - min) * i) / (count - 1))
  }, [yExtent])

  const xTicks = useMemo(
    () => years.filter((_, i) => i % 2 === 0 || years.length <= 5),
    [years]
  )

  if (!series.length || !data.length) return null

  return (
    <div ref={containerRef} className="w-full" style={{ height }}>
      <svg width={width} height={height} role="img" aria-hidden>
        <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
          {yTicks.map(tick => (
            <g key={tick}>
              <line
                x1={0}
                x2={plotW}
                y1={yScale(tick)}
                y2={yScale(tick)}
                stroke="rgba(255,255,255,0.06)"
                strokeDasharray="3 3"
              />
              <text
                x={-6}
                y={yScale(tick)}
                textAnchor="end"
                dominantBaseline="middle"
                fill="var(--cs-text-tertiary)"
                fontSize={11}
              >
                {Number.isInteger(tick) ? tick : tick.toFixed(1)}
              </text>
            </g>
          ))}
          {xTicks.map(year => (
            <text
              key={year}
              x={xScale(year)}
              y={plotH + 16}
              textAnchor="middle"
              fill="var(--cs-text-tertiary)"
              fontSize={11}
            >
              {year}
            </text>
          ))}
          {series.map((s) => {
            const d = buildPath(data, s.key, xScale, yScale)
            if (!d) return null
            return (
              <path
                key={s.key}
                d={d}
                fill="none"
                stroke={s.color}
                strokeWidth={s.dashed ? 1.5 : 2}
                strokeDasharray={s.dashed ? '4 4' : undefined}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            )
          })}
          {series.map(s =>
            s.dashed
              ? null
              : data.map(row => {
                  const v = row[s.key]
                  if (typeof v !== 'number' || !Number.isFinite(v)) return null
                  return (
                    <circle
                      key={`${s.key}-${row.year}`}
                      cx={xScale(row.year)}
                      cy={yScale(v)}
                      r={3}
                      fill={s.color}
                    />
                  )
                })
          )}
        </g>
      </svg>
    </div>
  )
}
