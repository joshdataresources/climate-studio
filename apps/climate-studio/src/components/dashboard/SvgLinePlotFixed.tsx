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
  // DEBUG: Log what we're rendering
  console.log('[SvgLinePlotFixed] ============ RENDER START ============')
  console.log('[SvgLinePlotFixed] Series count:', series.length)
  console.log('[SvgLinePlotFixed] Series details:')
  series.forEach((s, i) => {
    const hasData = data.some(row => typeof row[s.key] === 'number')
    const dataCount = data.filter(row => typeof row[s.key] === 'number').length
    console.log(`  [${i}] key="${s.key}", label="${s.label}", hasData=${hasData}, points=${dataCount}`)
  })
  console.log('[SvgLinePlotFixed] Data rows:', data.length)
  if (data.length > 0) {
    console.log('[SvgLinePlotFixed] Sample data:', data[0])
  }

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
  const tickCount = 4
  for (let i = 0; i < tickCount; i++) {
    yTicks.push(yMin + ((yMax - yMin) * i) / (tickCount - 1))
  }

  // X ticks
  const xTicks = years.filter((_, i) => i % 2 === 0 || years.length <= 5)

  console.log('[SvgLinePlotFixed] Rendering:', {
    seriesCount: series.length,
    seriesKeys: series.map(s => s.key),
    dataPoints: data.length,
    dataKeys: Object.keys(data[0] || {})
  })

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

          {/* Draw lines for each series */}
          {series.map((s, idx) => {
            // Build path for this series
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

            // DEBUG: Log path generation
            console.log(`  Path for ${s.key}: ${points.length} points, color: ${s.color}, has path: ${!!pathData}`)

            if (!pathData) return null

            // Add subtle variation for overlapping lines
            // Use a hash of the series key to create consistent but varied offsets
            const hashCode = s.key.split('').reduce((acc, char) => {
              return char.charCodeAt(0) + ((acc << 5) - acc)
            }, 0)
            const variation = (hashCode % 7) - 3 // Range: -3 to +3 pixels
            const offsetY = variation * 0.3 // Subtle offset: -0.9 to +0.9 pixels

            return (
              <g key={s.key}>
                {/* Shadow/background for better visibility */}
                <path
                  d={pathData}
                  fill="none"
                  stroke="rgba(0,0,0,0.2)"
                  strokeWidth={s.dashed ? 2.5 : 3.5}
                  strokeDasharray={s.dashed ? '4 4' : undefined}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  transform={`translate(0, ${offsetY})`}
                />
                {/* Main line */}
                <path
                  d={pathData}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={s.dashed ? 1.5 : 2.5}
                  strokeDasharray={s.dashed ? '4 4' : undefined}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  opacity={0.9}
                  transform={`translate(0, ${offsetY})`}
                />
              </g>
            )
          })}

          {/* Draw dots on non-dashed lines - with subtle variation to match lines */}
          {series.map((s, idx) =>
            s.dashed
              ? null
              : data.map(row => {
                  const v = row[s.key]
                  if (typeof v !== 'number' || !Number.isFinite(v)) return null

                  // Match the line offset calculation
                  const hashCode = s.key.split('').reduce((acc, char) => {
                    return char.charCodeAt(0) + ((acc << 5) - acc)
                  }, 0)
                  const variation = (hashCode % 7) - 3
                  const offsetY = variation * 0.3

                  return (
                    <circle
                      key={`${s.key}-${row.year}`}
                      cx={xScale(row.year)}
                      cy={yScale(v) + offsetY}
                      r={3}
                      fill={s.color}
                      stroke="white"
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