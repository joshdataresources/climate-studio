import * as React from "react"

import { cn } from "../../lib/utils"

export interface LayerToggleCardProps {
  label: React.ReactNode
  checked?: boolean
  defaultChecked?: boolean
  onCheckedChange?: (checked: boolean) => void
  className?: string
}

/** Checkbox layer card with active glow (demo `.layer-card`). */
export function LayerToggleCard({
  label,
  checked,
  defaultChecked = false,
  onCheckedChange,
  className,
}: LayerToggleCardProps) {
  const [internalChecked, setInternalChecked] = React.useState(defaultChecked)
  const isChecked = checked ?? internalChecked

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (checked === undefined) setInternalChecked(e.target.checked)
    onCheckedChange?.(e.target.checked)
  }

  return (
    <label
      className={cn(
        "flex cursor-pointer items-center gap-3 rounded-xl border p-3.5 transition-all duration-200 [backdrop-filter:var(--cs-layer-card-blur)] [-webkit-backdrop-filter:var(--cs-layer-card-blur)]",
        isChecked
          ? "border-[var(--cs-layer-card-border-active)] [background:var(--cs-layer-card-background-active)] shadow-[var(--cs-layer-card-shadow-active)]"
          : "border-[var(--cs-layer-card-border)] [background:var(--cs-layer-card-background)] shadow-[var(--cs-layer-card-shadow)] hover:border-[var(--cs-layer-card-border-hover)] hover:[background:var(--cs-layer-card-background-hover)] hover:shadow-[var(--cs-layer-card-shadow-hover)]",
        className
      )}
    >
      <input
        type="checkbox"
        className="h-4 w-4 accent-blue-500"
        checked={isChecked}
        onChange={handleChange}
      />
      <span className="text-sm font-medium text-[var(--cs-text-primary)]">{label}</span>
    </label>
  )
}
