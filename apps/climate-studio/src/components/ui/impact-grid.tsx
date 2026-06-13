import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "../../lib/utils"

const impactValueVariants = cva("text-[13px] font-semibold leading-tight", {
  variants: {
    tone: {
      neutral: "text-[var(--cs-text-primary)]",
      sky: "text-[var(--cs-tone-sky-text)]",
      orange: "text-[var(--cs-tone-orange-text)]",
      stone: "text-[var(--cs-tone-stone-text)]",
      violet: "text-[var(--cs-tone-violet-text)]",
      red: "text-[var(--cs-tone-red-text)]",
      blue: "text-[var(--cs-tone-blue-text)]",
      yellow: "text-[var(--cs-tone-amber-text)]",
      green: "text-[var(--cs-tone-emerald-text)]",
      amber: "text-[var(--cs-tone-amber-text)]",
      emerald: "text-[var(--cs-tone-emerald-text)]",
    },
  },
  defaultVariants: {
    tone: "sky",
  },
})

export interface ImpactMetricProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof impactValueVariants> {
  label: React.ReactNode
  value: React.ReactNode
  caption?: React.ReactNode
}

/** Single label/value impact readout (demo `.impact`). */
export function ImpactMetric({
  label,
  value,
  caption,
  tone,
  className,
  ...props
}: ImpactMetricProps) {
  return (
    <div className={cn("flex min-h-[72px] flex-col gap-0.5", className)} {...props}>
      <span className="text-[11px] text-[var(--cs-text-tertiary)]">{label}</span>
      <span className={impactValueVariants({ tone })}>{value}</span>
      {caption && (
        <span className="text-[10px] text-[var(--cs-text-tertiary)]">{caption}</span>
      )}
    </div>
  )
}

export interface ImpactGridProps extends React.HTMLAttributes<HTMLDivElement> {}

/** 3-column impact metrics grid (demo `.impact-grid`). */
export function ImpactGrid({ className, ...props }: ImpactGridProps) {
  return (
    <div
      className={cn("grid grid-cols-3 gap-x-3 gap-y-2.5", className)}
      {...props}
    />
  )
}
