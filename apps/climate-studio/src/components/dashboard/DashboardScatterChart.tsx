import React, { useRef, useLayoutEffect, useState } from 'react'
import { cn } from '../../lib/utils'
import { ChartLegend } from './ChartLegend'

const MARGIN = { top: 20, right: 16, bottom: 34, left: 44 }
const CONTEXT_FILL = 'rgba(148, 163, 184, 0.5)'
const SURFACE_RING = 'rgba(24, 24, 24, 0.85)'

export interface ScatterPoint {
  id: string
  label: string
  x: number
  y: number
  /** Marker radius in px (encodes a third variable when set). */
  r?: number
  /** Series color for this point; falls back to highlight/context styling. */
  color?: string
  /** Render in the accent color with a direct label. */
  highlight?: boolean
  /** Direct-label this point even when not highlighted (e.g. notable outliers). */
  labeled?: boolean
  /** Extra tooltip lines below the x/y readout. */
  detail?: string[]
}

interface DashboardScatterChartProps {
  title: string
  subtitle?: string
  source?: string
  points: ScatterPoint[]
  xLabel: string
  yLabel: string
  highlightColor?: string
  /** When set (2+ series), a legend row identifies the point colors. */
  series?: Array<{ key: string; label: string; color: string }>
  xScale?: 'linear' | 'log'
  /** Explicit x tick values (e.g. decades on a time axis). */
  xTicks?: number[]
  /** Horizontal threshold line (e.g. a danger limit); extends the y-domain to include it. */
  yReference?: { value: number; label: string }
  formatX?: (v: number) => string
  formatY?: (v: number) => string
  height?: number
  className?: string
}

function niceTicks(min: number, max: number, count = 4): number[] {
  if (!(max > min)) return [min]
  const span = max - min
  const step = Math.pow(10, Math.floor(Math.log10(span / count)))
  const candidates = [step, step * 2, step * 5, step * 10]
  const chosen = candidates.find(s => span / s <= count) ?? step * 10
  const start = Math.ceil(min / chosen) * chosen
  const ticks: number[] = []
  for (let v = start; v <= max + chosen * 1e-6; v += chosen) {
    ticks.push(Math.round(v * 1e6) / 1e6)
  }
  return ticks
}

function logTicks(min: number, max: number): number[] {
  const ticks: number[] = []
  for (let e = Math.floor(Math.log10(Math.max(min, 1e-9))); Math.pow(10, e) <= max * 1.0001; e++) {
    const v = Math.pow(10, e)
    if (v >= min * 0.999) ticks.push(v)
  }
  return ticks.length >= 2 ? ticks : [min, max]
}

/** Cross-entity scatter in the dashboard chart style: muted context dots,
 *  accent-colored highlights with direct labels, per-mark hover tooltip. */
export function DashboardScatterChart({
  title,
  subtitle,
  source,
  points,
  xLabel,
  yLabel,
  highlightColor = '#8b5cf6',
  series,
  xScale = 'linear',
  xTicks: xTicksProp,
  yReference,
  formatX = v => String(v),
  formatY = v => String(v),
  height = 260,
  className,
}: DashboardScatterChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(320)
  const [hovered, setHovered] = useState<ScatterPoint | null>(null)

  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return
    const update = () => setWidth(Math.max(el.clientWidth, 200))
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  if (!points.length) return null

  const xs = points.map(p => p.x)
  const ys = points.map(p => p.y)
  let xMin = Math.min(...xs)
  let xMax = Math.max(...xs)
  let yMin = Math.min(...ys)
  let yMax = Math.max(...ys)

  if (xScale === 'log') {
    // Log domain snaps to surrounding powers of ten
    xMin = Math.pow(10, Math.floor(Math.log10(Math.max(xMin, 1e-9))))
    xMax = Math.pow(10, Math.ceil(Math.log10(Math.max(xMax, 1e-9))))
  } else {
    const xPad = (xMax - xMin) * 0.06 || 1
    xMin = Math.max(0, xMin - xPad)
    xMax += xPad
  }
  const yPad = (yMax - yMin) * 0.1 || 1
  yMin = Math.max(0, yMin - yPad)
  yMax += yPad
  if (yReference) {
    yMin = Math.min(yMin, yReference.value - yPad)
    yMax = Math.max(yMax, yReference.value + yPad)
  }

  const plotW = width - MARGIN.left - MARGIN.right
  const plotH = height - MARGIN.top - MARGIN.bottom

  const xPos = (v: number) =>
    xScale === 'log'
      ? ((Math.log10(v) - Math.log10(xMin)) / (Math.log10(xMax) - Math.log10(xMin) || 1)) * plotW
      : ((v - xMin) / (xMax - xMin || 1)) * plotW
  const yPos = (v: number) => plotH - ((v - yMin) / (yMax - yMin || 1)) * plotH

  const xTicks =
    xTicksProp ?? (xScale === 'log' ? logTicks(xMin, xMax) : niceTicks(xMin, xMax))
  const yTicks = niceTicks(yMin, yMax)

  // Highlighted points render (and label) above the context cloud
  const ordered = [...points].sort((a, b) => Number(a.highlight ?? false) - Number(b.highlight ?? false))

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
      <div ref={containerRef} className="relative" style={{ width: '100%', height }}>
        <svg width={width} height={height} role="img" aria-label={`${title}: ${yLabel} vs ${xLabel}`}>
          <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
            {yTicks.map(tick => (
              <g key={`y-${tick}`}>
                <line
                  x1={0}
                  x2={plotW}
                  y1={yPos(tick)}
                  y2={yPos(tick)}
                  stroke="rgba(255,255,255,0.06)"
                  strokeDasharray="3 3"
                />
                <text
                  x={-6}
                  y={yPos(tick)}
                  textAnchor="end"
                  dominantBaseline="middle"
                  fill="var(--cs-text-tertiary)"
                  fontSize={11}
                >
                  {formatY(tick)}
                </text>
              </g>
            ))}
            {xTicks.map(tick => (
              <g key={`x-${tick}`}>
                <line
                  x1={xPos(tick)}
                  x2={xPos(tick)}
                  y1={0}
                  y2={plotH}
                  stroke="rgba(255,255,255,0.04)"
                  strokeDasharray="3 3"
                />
                <text
                  x={xPos(tick)}
                  y={plotH + 16}
                  textAnchor="middle"
                  fill="var(--cs-text-tertiary)"
                  fontSize={11}
                >
                  {formatX(tick)}
                </text>
              </g>
            ))}
            <text
              x={plotW / 2}
              y={plotH + 30}
              textAnchor="middle"
              fill="var(--cs-text-tertiary)"
              fontSize={10}
            >
              {xLabel}
            </text>

            {yReference && (
              <g>
                <line
                  x1={0}
                  x2={plotW}
                  y1={yPos(yReference.value)}
                  y2={yPos(yReference.value)}
                  stroke="rgba(239, 68, 68, 0.65)"
                  strokeWidth={1.2}
                  strokeDasharray="6 4"
                />
                <text
                  x={plotW - 2}
                  y={yPos(yReference.value) - 5}
                  textAnchor="end"
                  fill="rgba(239, 68, 68, 0.9)"
                  fontSize={10}
                  fontWeight={600}
                >
                  {yReference.label}
                </text>
              </g>
            )}

            {ordered.map(p => {
              const r = p.r ?? 4.5
              const cx = xPos(p.x)
              const cy = yPos(p.y)
              const isHovered = hovered?.id === p.id
              return (
                <g key={p.id}>
                  <circle
                    cx={cx}
                    cy={cy}
                    r={p.highlight ? Math.max(r, 6) : r}
                    fill={p.color ?? (p.highlight ? highlightColor : CONTEXT_FILL)}
                    stroke={p.highlight ? 'white' : SURFACE_RING}
                    strokeWidth={1.5}
                    opacity={isHovered ? 1 : p.highlight ? 0.95 : 0.85}
                  />
                  {(p.highlight || p.labeled) && (
                    <text
                      x={cx}
                      y={cy - (p.highlight ? Math.max(r, 6) : r) - 4}
                      textAnchor="middle"
                      fill={p.highlight ? 'var(--cs-text-primary)' : 'var(--cs-text-tertiary)'}
                      fontSize={10.5}
                      fontWeight={p.highlight ? 600 : 400}
                    >
                      {p.label}
                    </text>
                  )}
                  {/* Oversized invisible hit target for hover */}
                  <circle
                    cx={cx}
                    cy={cy}
                    r={Math.max(r, 6) + 6}
                    fill="transparent"
                    onMouseEnter={() => setHovered(p)}
                    onMouseLeave={() => setHovered(prev => (prev?.id === p.id ? null : prev))}
                  />
                </g>
              )
            })}
          </g>
        </svg>
        <p className="pointer-events-none absolute right-0 top-0 m-0 pr-1 text-[10px] font-medium text-[var(--cs-text-tertiary)]">
          {yLabel}
        </p>
        {hovered && (
          <div
            className="pointer-events-none absolute z-20 rounded-md border border-white/10 bg-[rgba(24,24,24,0.95)] px-2.5 py-1.5 text-xs shadow-lg"
            style={{
              left: Math.min(MARGIN.left + xPos(hovered.x) + 10, width - 150),
              top: Math.max(MARGIN.top + yPos(hovered.y) - 40, 0),
            }}
          >
            <div className="font-semibold text-[var(--cs-text-primary)]">{hovered.label}</div>
            {(hovered.detail ?? [`${formatX(hovered.x)} · ${formatY(hovered.y)} ${yLabel}`]).map(line => (
              <div key={line} className="text-[var(--cs-text-tertiary)]">
                {line}
              </div>
            ))}
          </div>
        )}
      </div>
      {series && series.length > 1 && <ChartLegend series={series} />}
    </div>
  )
}
