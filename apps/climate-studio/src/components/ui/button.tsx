import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "../../lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md border border-transparent text-sm font-medium text-[var(--cs-text-primary)] transition-colors focus-visible:outline-none focus-visible:border-[var(--cs-brand-primary)] focus-visible:ring-1 focus-visible:ring-blue-500/50 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--cs-surface-elevated)] border-[var(--cs-border-default)] shadow-[var(--cs-shadow-sm)] hover:bg-[var(--cs-interactive-hover)]",
        secondary:
          "bg-[var(--cs-surface-elevated)] border-[var(--cs-border-default)] shadow-[var(--cs-shadow-sm)] hover:bg-[var(--cs-interactive-hover)]",
        destructive:
          "bg-[var(--cs-button-destructive-background)] text-white hover:bg-[var(--cs-button-destructive-background-hover)]",
        outline:
          "bg-[var(--cs-surface-base)] border-[var(--cs-border-default)] shadow-[var(--cs-shadow-sm)] hover:bg-[var(--cs-interactive-hover)]",
        ghost: "bg-transparent hover:bg-[var(--cs-interactive-hover)]",
        text: "border-0 bg-transparent hover:bg-[var(--cs-interactive-hover)]",
        link: "border-0 bg-transparent text-[var(--cs-brand-primary)] underline-offset-4 hover:underline",
        primary:
          "bg-[var(--cs-button-primary-background)] text-white hover:bg-[var(--cs-button-primary-background-hover)]",
        success:
          "bg-[var(--cs-button-success-background)] text-white hover:bg-[var(--cs-button-success-background-hover)]",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
