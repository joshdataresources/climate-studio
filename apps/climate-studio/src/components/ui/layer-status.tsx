import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "../../lib/utils"

const layerStatusVariants = cva("flex items-center gap-2.5 rounded-lg border p-2.5", {
  variants: {
    status: {
      loading:
        "border-[var(--cs-layer-status-loading-border)] bg-[var(--cs-layer-status-loading-bg)] [--layer-status-title:var(--cs-layer-status-loading-title)]",
      success:
        "border-[var(--cs-layer-status-success-border)] bg-[var(--cs-layer-status-success-bg)] [--layer-status-title:var(--cs-layer-status-success-title)]",
      fallback:
        "border-[var(--cs-layer-status-fallback-border)] bg-[var(--cs-layer-status-fallback-bg)] [--layer-status-title:var(--cs-layer-status-fallback-title)]",
      error:
        "border-[var(--cs-layer-status-error-border)] bg-[var(--cs-layer-status-error-bg)] [--layer-status-title:var(--cs-layer-status-error-title)]",
    },
  },
  defaultVariants: {
    status: "loading",
  },
})

const defaultGlyphs: Record<string, string> = {
  loading: "\u23F3",
  success: "\u2705",
  fallback: "\u26A0\uFE0F",
  error: "\u274C",
}

export interface LayerStatusProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title">,
    VariantProps<typeof layerStatusVariants> {
  title: React.ReactNode
  sub?: React.ReactNode
  /** Override the default status emoji glyph. */
  glyph?: React.ReactNode
}

/** Layer load status row (demo `.layer-status`). */
export function LayerStatus({ status, title, sub, glyph, className, ...props }: LayerStatusProps) {
  return (
    <div className={cn(layerStatusVariants({ status }), className)} {...props}>
      <span className="text-lg leading-none">{glyph ?? defaultGlyphs[status ?? "loading"]}</span>
      <div className="min-w-0">
        <div className="text-[13px] font-medium text-[var(--layer-status-title)]">{title}</div>
        {sub && <div className="mt-0.5 text-[11px] text-[var(--cs-text-tertiary)]">{sub}</div>}
      </div>
    </div>
  )
}
