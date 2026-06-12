import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { CheckCircle2, AlertTriangle, AlertCircle, Info } from "lucide-react"

import { cn } from "../../lib/utils"

const calloutVariants = cva("flex items-center gap-3 rounded-lg border p-3", {
  variants: {
    status: {
      success:
        "border-[var(--cs-callout-success-border)] bg-[var(--cs-callout-success-bg)] [--callout-title:var(--cs-callout-success-title)] [--callout-disc:var(--cs-callout-success-disc)]",
      warning:
        "border-[var(--cs-callout-warning-border)] bg-[var(--cs-callout-warning-bg)] [--callout-title:var(--cs-callout-warning-title)] [--callout-disc:var(--cs-callout-warning-disc)]",
      error:
        "border-[var(--cs-callout-error-border)] bg-[var(--cs-callout-error-bg)] [--callout-title:var(--cs-callout-error-title)] [--callout-disc:var(--cs-callout-error-disc)]",
      info: "border-[var(--cs-callout-info-border)] bg-[var(--cs-callout-info-bg)] [--callout-title:var(--cs-callout-info-title)] [--callout-disc:var(--cs-callout-info-disc)]",
    },
  },
  defaultVariants: {
    status: "info",
  },
})

const defaultIcons: Record<string, React.ReactNode> = {
  success: <CheckCircle2 />,
  warning: <AlertTriangle />,
  error: <AlertCircle />,
  info: <Info />,
}

export interface CalloutProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title">,
    VariantProps<typeof calloutVariants> {
  title: React.ReactNode
  description?: React.ReactNode
  /** Replaces the default status icon disc entirely (e.g. a Spinner). */
  icon?: React.ReactNode
  titleClassName?: string
}

/** Status callout (demo `.callout`). */
export function Callout({
  status,
  title,
  description,
  icon,
  titleClassName,
  className,
  children,
  ...props
}: CalloutProps) {
  return (
    <div className={cn(calloutVariants({ status }), className)} {...props}>
      {icon ?? (
        <div
          className={cn(
            "grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--callout-disc)] [&_svg]:h-3.5 [&_svg]:w-3.5",
            status === "warning" ? "[&_svg]:text-black" : "[&_svg]:text-white"
          )}
        >
          {defaultIcons[status ?? "info"]}
        </div>
      )}
      <div className="min-w-0">
        <div className={cn("text-sm font-medium leading-tight text-[var(--callout-title)]", titleClassName)}>
          {title}
        </div>
        {description && (
          <div className="mt-0.5 text-xs text-[var(--cs-text-tertiary)]">{description}</div>
        )}
        {children}
      </div>
    </div>
  )
}
