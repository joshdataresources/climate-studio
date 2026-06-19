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

  // Responsive layout based on number of series
  const useColumns = series.length > 6
  const useTwoColumns = series.length > 4 && series.length <= 6

  return (
    <div className="mt-3 border-t border-[var(--cs-border-subtle)] pt-3">
      <div
        className={cn(
          "gap-2",
          useColumns ? "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4" :
          useTwoColumns ? "grid grid-cols-2" :
          "flex flex-wrap"
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
                "inline-flex items-center gap-1.5 px-2 py-1 rounded text-[11px] transition-all",
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
              {idx === 0 && series.length > 4 && (
                <span className="ml-auto text-[9px] text-[var(--cs-text-muted)]">
                  {series.length} cities
                </span>
              )}
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
    </div>
  )
}