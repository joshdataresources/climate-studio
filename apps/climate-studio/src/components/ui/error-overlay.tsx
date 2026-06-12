import * as React from "react"
import { AlertCircle, RefreshCw } from "lucide-react"

import { cn } from "../../lib/utils"

export interface ErrorOverlayProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  title?: React.ReactNode
  /** Name of the failing layer, shown in the detail block. */
  layerName: React.ReactNode
  message: React.ReactNode
  onRefresh?: () => void
  onDismiss?: () => void
}

/** Layer failure overlay (demo `.error-overlay`). Presentational; wrap for modal use. */
export function ErrorOverlay({
  title = "Layer Loading Failed",
  layerName,
  message,
  onRefresh,
  onDismiss,
  className,
  ...props
}: ErrorOverlayProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-3.5 rounded-xl border-2 border-[var(--cs-error-overlay-border)] bg-[var(--cs-error-overlay-bg)] p-5 text-white shadow-2xl backdrop-blur-md",
        className
      )}
      {...props}
    >
      <AlertCircle className="mt-0.5 h-[22px] w-[22px] shrink-0 text-[var(--cs-error-overlay-icon)]" />
      <div className="flex-1">
        <div className="mb-2.5 text-base font-semibold">{title}</div>
        <div className="rounded-lg bg-[var(--cs-error-overlay-block-bg)] p-3 text-[var(--cs-error-overlay-block-text)]">
          <div className="mb-1 font-medium">{layerName}</div>
          <div className="text-xs opacity-80">{message}</div>
          <div className="mt-2.5 flex gap-2">
            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                className="inline-flex h-8 items-center gap-2 rounded-md bg-red-600 px-3 text-xs font-medium text-white transition-colors hover:bg-red-700 [&_svg]:h-3.5 [&_svg]:w-3.5"
              >
                <RefreshCw />
                Refresh
              </button>
            )}
            {onDismiss && (
              <button
                type="button"
                onClick={onDismiss}
                className="inline-flex h-8 items-center rounded-md border border-white/20 bg-transparent px-3 text-xs font-medium text-white transition-colors hover:bg-white/10"
              >
                Dismiss
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
