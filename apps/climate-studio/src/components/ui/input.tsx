import * as React from "react"

import { cn } from "../../lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-md border border-[var(--cs-border-default)] bg-[var(--cs-input-background)] px-3 py-1 text-base text-[var(--cs-text-primary)] shadow-[var(--cs-shadow-sm)] transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-[var(--cs-text-tertiary)] hover:bg-[var(--cs-interactive-hover)] focus-visible:outline-none focus-visible:border-[var(--cs-brand-primary)] focus-visible:ring-1 focus-visible:ring-blue-500/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
