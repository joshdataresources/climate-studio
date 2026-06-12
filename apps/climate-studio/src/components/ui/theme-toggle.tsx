import * as React from "react"
import { Sun, Moon } from "lucide-react"

import { cn } from "../../lib/utils"

export interface ThemeToggleProps {
  theme: "dark" | "light"
  onToggle: () => void
  className?: string
}

/** Sun/moon knob theme switch (demo `.theme-toggle`), sized via `--cs-theme-toggle-*` tokens. */
export function ThemeToggle({ theme, onToggle, className }: ThemeToggleProps) {
  const isLight = theme === "light"

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label="Toggle theme"
      className={cn(
        "relative h-7 w-14 rounded-full border border-[var(--cs-border-strong)] bg-transparent transition-colors duration-300 hover:border-[var(--cs-text-tertiary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50",
        className
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 grid h-6 w-6 place-items-center rounded-full border transition-all duration-300 ease-out",
          isLight
            ? "left-0.5 border-[var(--cs-theme-toggle-light-knob-border)] bg-[var(--cs-theme-toggle-light-knob-background)]"
            : "left-[30px] border-[var(--cs-theme-toggle-dark-knob-border)] bg-[var(--cs-theme-toggle-dark-knob-background)]"
        )}
      >
        {isLight ? (
          <Sun className="h-3.5 w-3.5 text-amber-500" />
        ) : (
          <Moon className="h-3.5 w-3.5 text-blue-400" />
        )}
      </span>
    </button>
  )
}
