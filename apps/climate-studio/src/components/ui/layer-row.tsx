import * as React from "react"
import { GripVertical, Settings, X } from "lucide-react"

import { cn } from "../../lib/utils"

export interface LayerRowProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  /** Layer icon, typically an `IconTile` wrapping a layer glyph. */
  icon: React.ReactNode
  title: React.ReactNode
  /** Source attribution line; hidden when `showSource` is false. */
  source?: React.ReactNode
  showSource?: boolean
  active?: boolean
  draggable?: boolean
  onSettings?: () => void
  onRemove?: () => void
  /** Extra action buttons rendered before settings/remove. */
  actions?: React.ReactNode
}

function RowActionButton({
  label,
  onClick,
  children,
}: {
  label: string
  onClick?: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation()
        onClick?.()
      }}
      className="grid h-6 w-6 place-items-center rounded border-0 bg-transparent text-[var(--cs-text-tertiary)] transition-colors hover:bg-[var(--cs-interactive-hover)] hover:text-[var(--cs-text-primary)] [&_svg]:h-[13px] [&_svg]:w-[13px]"
    >
      {children}
    </button>
  )
}

/** Draggable layer palette row (demo `.layer-row`). */
export function LayerRow({
  icon,
  title,
  source,
  showSource = true,
  active = false,
  draggable = true,
  onSettings,
  onRemove,
  actions,
  className,
  ...props
}: LayerRowProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md border px-3 py-2 transition-all duration-200 [backdrop-filter:var(--cs-layer-card-blur)] [-webkit-backdrop-filter:var(--cs-layer-card-blur)]",
        props.onClick && "cursor-pointer",
        active
          ? "border-[var(--cs-layer-card-border-active)] [background:var(--cs-layer-card-background-active)] shadow-[var(--cs-layer-card-shadow-active)]"
          : "border-[var(--cs-layer-card-border)] [background:var(--cs-layer-card-background)] shadow-[var(--cs-layer-card-shadow)] hover:border-[var(--cs-layer-card-border-hover)] hover:[background:var(--cs-layer-card-background-hover)] hover:shadow-[var(--cs-layer-card-shadow-hover)]",
        className
      )}
      {...props}
    >
      {draggable && (
        <span
          aria-hidden="true"
          className="grid h-4 w-4 shrink-0 cursor-grab place-items-center text-[var(--cs-text-tertiary)] hover:text-[var(--cs-text-secondary)]"
        >
          <GripVertical className="h-4 w-4" />
        </span>
      )}
      {icon}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-[var(--cs-text-primary)]">{title}</div>
        {source && showSource && (
          <div className="truncate text-xs text-[var(--cs-text-tertiary)]">{source}</div>
        )}
      </div>
      <div className="flex gap-0.5">
        {actions}
        {onSettings && (
          <RowActionButton label="Settings" onClick={onSettings}>
            <Settings />
          </RowActionButton>
        )}
        {onRemove && (
          <RowActionButton label="Remove" onClick={onRemove}>
            <X />
          </RowActionButton>
        )}
      </div>
    </div>
  )
}
