import * as React from "react"

import { cn } from "../../lib/utils"

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Percentage 0-100 */
  value: number
}

/** Progress bar (demo `.progress` / `.progress-bar`). */
export function Progress({ value, className, ...props }: ProgressProps) {
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
      className={cn("h-2 w-full overflow-hidden rounded-full bg-[var(--cs-progress-track)]", className)}
      {...props}
    >
      <div
        className="h-full rounded-full bg-[var(--cs-progress-bar)] transition-[width] duration-300 ease-out"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  )
}
