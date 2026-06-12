import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "../../lib/utils"

const metricBadgeClasses =
  "gap-1.5 rounded-full border-transparent px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.02em] [&_svg]:h-3 [&_svg]:w-3"

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80",
        outline: "text-foreground",
        success: `${metricBadgeClasses} bg-[var(--cs-metric-badge-success-background)] text-[var(--cs-metric-badge-success-text-color)]`,
        warning: `${metricBadgeClasses} bg-[var(--cs-metric-badge-warning-background)] text-[var(--cs-metric-badge-warning-text-color)]`,
        error: `${metricBadgeClasses} bg-[var(--cs-metric-badge-error-background)] text-[var(--cs-metric-badge-error-text-color)]`,
        info: `${metricBadgeClasses} bg-[var(--cs-metric-badge-info-background)] text-[var(--cs-metric-badge-info-text-color)]`,
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
