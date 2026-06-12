import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "../../lib/utils"

const iconTileVariants = cva("grid shrink-0 place-items-center", {
  variants: {
    tone: {
      sky: "bg-[var(--cs-tone-sky-bg)] text-[var(--cs-tone-sky-text)]",
      orange: "bg-[var(--cs-tone-orange-bg)] text-[var(--cs-tone-orange-text)]",
      stone: "bg-[var(--cs-tone-stone-bg)] text-[var(--cs-tone-stone-text)]",
      violet: "bg-[var(--cs-tone-violet-bg)] text-[var(--cs-tone-violet-text)]",
      amber: "bg-[var(--cs-tone-amber-bg)] text-[var(--cs-tone-amber-text)]",
      emerald: "bg-[var(--cs-tone-emerald-bg)] text-[var(--cs-tone-emerald-text)]",
      red: "bg-[var(--cs-tone-red-bg)] text-[var(--cs-tone-red-text)]",
      blue: "bg-[var(--cs-tone-blue-bg)] text-[var(--cs-tone-blue-text)]",
    },
    size: {
      sm: "h-5 w-5 rounded [&_svg]:h-3.5 [&_svg]:w-3.5",
      md: "h-6 w-6 rounded-md [&_svg]:h-4 [&_svg]:w-4",
      lg: "h-8 w-8 rounded-lg [&_svg]:h-5 [&_svg]:w-5",
    },
  },
  defaultVariants: {
    tone: "sky",
    size: "md",
  },
})

export type IconTileTone = NonNullable<VariantProps<typeof iconTileVariants>["tone"]>

export interface IconTileProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof iconTileVariants> {}

/**
 * Tone-based icon chip (demo `.layer-icon`, `.layer-icon-sm`, `.icon-tile-sm`).
 * Light-theme tone colors resolve automatically through `--cs-tone-*` tokens.
 */
export function IconTile({ className, tone, size, ...props }: IconTileProps) {
  return <span className={cn(iconTileVariants({ tone, size }), className)} {...props} />
}
