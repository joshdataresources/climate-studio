import * as React from "react"

import { cn } from "../../lib/utils"

export interface SpinnerProps extends React.HTMLAttributes<HTMLDivElement> {}

/**
 * Ring spinner (demo `.spinner`). Recolor via `border-color` utilities,
 * e.g. `className="border-purple-500 border-t-transparent"`.
 */
export function Spinner({ className, ...props }: SpinnerProps) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={cn(
        "h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-[var(--cs-spinner-color)] border-t-transparent",
        className
      )}
      {...props}
    />
  )
}
