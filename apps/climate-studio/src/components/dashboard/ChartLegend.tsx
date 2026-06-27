import React from 'react'
import { cn } from '../../lib/utils'
import type { ChartSeries } from './chartTypes'

interface ChartLegendProps {
  series: ChartSeries[]
  onSeriesToggle?: (seriesKey: string) => void
  hiddenSeries?: Set<string>
}

export function ChartLegend({ series, onSeriesToggle, hiddenSeries = new Set() }: ChartLegendProps) {
  if (series.length <= 1) return null

  // Note about overlapping data (for known cities with identical values)
  const overlappingCities = series.filter(s =>
    ['Houston', 'Miami', 'Los_Angeles'].includes(s.key)
  )
  const hasOverlapping = overlappingCities.length > 1

  return (
    <div className="mt-3 border-t border-[var(--cs-border-subtle)] pt-3">
      <div
        className={cn(
          "flex flex-wrap gap-2"  // Always use horizontal flex wrap layout
        )}
        aria-label="Chart legend"
      >
        {series.map((s, idx) => {
          const isHidden = hiddenSeries.has(s.key)

          return (
            <button
              key={s.key}
              onClick={() => onSeriesToggle?.(s.key)}
              className={cn(
                "inline-flex items-center gap-1.5 px-2 py-1 rounded text-[11px] transition-all whitespace-nowrap",
                "hover:bg-[var(--cs-interactive-hover)]",
                isHidden
                  ? "opacity-40 text-[var(--cs-text-muted)]"
                  : "text-[var(--cs-text-secondary)] hover:text-[var(--cs-text-primary)]"
              )}
              title={onSeriesToggle ? `Click to ${isHidden ? 'show' : 'hide'} ${s.label}` : s.label}
            >
              <span
                className={cn(
                  "shrink-0 rounded-full transition-all",
                  isHidden ? "h-1.5 w-1.5" : "h-2 w-2"
                )}
                style={{
                  background: isHidden ? '#666' : s.color,
                  ...(s.dashed && !isHidden
                    ? {
                        backgroundImage: `repeating-linear-gradient(90deg, ${s.color} 0 3px, transparent 3px 5px)`,
                      }
                    : {}),
                }}
                aria-hidden
              />
              <span className={cn("truncate", idx < 9 ? "font-medium" : "")}>
                {s.label}
              </span>
            </button>
          )
        })}
      </div>
      {onSeriesToggle && hiddenSeries.size > 0 && (
        <button
          onClick={() => {
            // Clear all hidden series
            series.forEach(s => {
              if (hiddenSeries.has(s.key)) {
                onSeriesToggle(s.key)
              }
            })
          }}
          className="mt-2 text-[10px] text-[var(--cs-text-tertiary)] hover:text-[var(--cs-text-primary)] transition-colors"
        >
          Show all cities
        </button>
      )}
      {hasOverlapping && (
        <div className="mt-2 text-[9px] text-[var(--cs-text-muted)] italic">
          ⚠️ Note: Houston, Miami, and Los Angeles have identical temperature projections and may overlap
        </div>
      )}
    </div>
  )
}