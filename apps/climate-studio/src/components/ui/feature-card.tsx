import * as React from "react"

import { cn } from "../../lib/utils"

export interface FeatureCardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  title?: React.ReactNode
}

/** Inset glass card (demo `.feature-card`). */
export function FeatureCard({ title, className, children, ...props }: FeatureCardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-[var(--cs-feature-card-border)] bg-[var(--cs-feature-card-background)] p-3 shadow-[var(--cs-feature-card-shadow)] transition-colors [backdrop-filter:var(--cs-feature-card-blur)] [-webkit-backdrop-filter:var(--cs-feature-card-blur)]",
        className
      )}
      {...props}
    >
      {title && (
        <div className="mb-2.5 text-xs font-semibold tracking-[-0.01em] text-[var(--cs-text-primary)]">
          {title}
        </div>
      )}
      {children}
    </div>
  )
}
