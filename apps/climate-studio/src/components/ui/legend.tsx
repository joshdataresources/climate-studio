import * as React from "react"

import { cn } from "../../lib/utils"

/**
 * Named climate gradients defined in tokens.css (`--cs-gradient-*`).
 * `precip` automatically adapts in the light theme.
 */
export const climateGradients = {
  tempAnomaly: "var(--cs-gradient-temp-anomaly)",
  tempActual: "var(--cs-gradient-temp-actual)",
  precip: "var(--cs-gradient-precip)",
  precipLegend: "var(--cs-gradient-precip-legend)",
  population: "var(--cs-gradient-population)",
  drought: "var(--cs-gradient-drought)",
  soil: "var(--cs-gradient-soil)",
} as const

export interface GradientBarProps extends React.HTMLAttributes<HTMLDivElement> {
  /** CSS background, e.g. `climateGradients.precip` or any `linear-gradient(...)`. */
  gradient: string
}

/** Borderless gradient strip (demo `.gradient-bar`). */
export function GradientBar({ gradient, className, ...props }: GradientBarProps) {
  return (
    <div
      className={cn("h-4 w-full rounded-full", className)}
      style={{ background: gradient }}
      {...props}
    />
  )
}

export interface LegendRowProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  title: React.ReactNode
  gradient: string
  /** Range caption rendered centered under the bar, e.g. "0 – 10 mm/day". */
  range?: React.ReactNode
}

/** Colorbar legend row (demo `.legend-row`). */
export function LegendRow({ title, gradient, range, className, ...props }: LegendRowProps) {
  return (
    <div className={className} {...props}>
      <div className="mb-1.5 text-[13px] font-semibold text-[var(--cs-text-primary)]">{title}</div>
      <div
        className="h-4 rounded-md border border-[var(--cs-legend-bar-border)]"
        style={{ background: gradient }}
      />
      {range && (
        <div className="mt-1 text-center text-[11px] text-[var(--cs-text-tertiary)]">{range}</div>
      )}
    </div>
  )
}
