import React, { useRef, useLayoutEffect, useState } from 'react'
import type { ChartDataPoint, ChartSeries } from './chartTypes'

const MARGIN = { top: 20, right: 12, bottom: 24, left: 40 }

interface SvgLinePlotFixedProps {
  height: number
  data: ChartDataPoint[]
  series: ChartSeries[]
  yDomain?: [number | string, number | string]
  fitYDomain?: boolean
  yClamp?: [number, number]
}

export function SvgLinePlotFixed({
  height,
  data,
  series,
  yDomain,
  fitYDomain,
  yClamp,
}: SvgLinePlotFixedProps) {
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

  if (!series.length || !data.length) return null

  // Calculate bounds
  const years = data.map(d => d.year)
  const yearMin = Math.min(...years)
  const yearMax = Math.max(...years)

  // Calculate Y bounds
  let yMin = Infinity
  let yMax = -Infinity

  for (const row of data) {
    for (const s of series) {
      const v = row[s.key]
      if (typeof v === 'number' && Number.isFinite(v)) {
        yMin = Math.min(yMin, v)
        yMax = Math.max(yMax, v)
      }
    }
  }

  if (!Number.isFinite(yMin) || !Number.isFinite(yMax)) {
    yMin = 0
    yMax = 10
  }

  // Add padding
  const yPadding = (yMax - yMin) * 0.1 || 1
  yMin -= yPadding
  yMax += yPadding

  if (yDomain && typeof yDomain[0] === 'number' && typeof yDomain[1] === 'number') {
    yMin = yDomain[0]
    yMax = yDomain[1]
  }

  if (yClamp) {
    yMin = Math.max(yClamp[0], yMin)
    yMax = Math.min(yClamp[1], yMax)
  }

  // Scales
  const plotW = width - MARGIN.left - MARGIN.right
  const plotH = height - MARGIN.top - MARGIN.bottom

  const xScale = (year: number) => {
    return ((year - yearMin) / (yearMax - yearMin || 1)) * plotW
  }

  const yScale = (value: number) => {
    return plotH - ((value - yMin) / (yMax - yMin || 1)) * plotH
  }

  // Generate Y ticks
  const yTicks: number[] = []
  const tickCount = 5
  for (let i = 0; i < tickCount; i++) {
    yTicks.push(yMin + ((yMax - yMin) * i) / (tickCount - 1))
  }

  // X ticks
  const xTicks = years.filter((_, i) => i % 2 === 0 || years.length <= 5)

  return (
    <div ref={containerRef} className="w-full" style={{ height }}>
      <svg width={width} height={height} role="img" aria-hidden>
        <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
          {/* Y axis grid lines and labels */}
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

          {/* X axis labels */}
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

          {/* Draw lines for each series — thin marks, no offsets: coincident
              lines are rendered where the data actually is */}
          {series.map(s => {
            const points: string[] = []
            let firstPoint = true

            for (const row of data) {
              const value = row[s.key]
              if (typeof value === 'number' && Number.isFinite(value)) {
                const x = xScale(row.year).toFixed(2)
                const y = yScale(value).toFixed(2)
                points.push(`${firstPoint ? 'M' : 'L'}${x},${y}`)
                firstPoint = false
              }
            }

            const pathData = points.join(' ')
            if (!pathData) return null

            return (
              <path
                key={s.key}
                d={pathData}
                fill="none"
                stroke={s.color}
                strokeWidth={s.dashed ? 1.2 : 1.6}
                strokeDasharray={s.dashed ? '4 4' : undefined}
                strokeLinejoin="round"
                strokeLinecap="round"
                opacity={0.95}
              />
            )
          })}

          {/* Small dots on non-dashed lines */}
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
                      r={2.25}
                      fill={s.color}
                      stroke="rgba(24,24,24,0.85)"
                      strokeWidth={1}
                      opacity={0.95}
                    />
                  )
                })
          )}
        </g>
      </svg>
    </div>
  )
}