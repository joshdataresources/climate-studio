import * as React from "react"
import { ChevronDown } from "lucide-react"

import { cn } from "../../lib/utils"

interface AccordionItemProps {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
  icon?: React.ReactNode
  className?: string
}

export function AccordionItem({ title, children, defaultOpen = true, icon, className }: AccordionItemProps) {
  const [isOpen, setIsOpen] = React.useState(defaultOpen)

  return (
    <div className={cn("widget-container widget-container-no-padding overflow-hidden", className)}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="accordion-trigger flex w-full items-center justify-between px-4 py-3.5 text-left transition-all duration-200 hover:bg-[var(--cs-accordion-trigger-hover-bg)] group border-0 bg-transparent"
      >
        <div className="flex items-center gap-2">
          {icon && (
            <span className="shrink-0 transition-colors">
              {icon}
            </span>
          )}
          <h4 className="text-sm font-semibold tracking-[-0.01em] text-[var(--cs-text-primary)]">{title}</h4>
        </div>
        <div className={`
          flex items-center justify-center w-6 h-6 rounded-md
          bg-white/[0.04] transition-all duration-200
          ${isOpen ? 'bg-blue-500/10' : ''}
        `}>
          <ChevronDown
            className={`h-3.5 w-3.5 transition-transform duration-200 ${
              isOpen
                ? "rotate-180 text-[var(--cs-accordion-chevron-open-color)]"
                : "text-[var(--cs-text-tertiary)]"
            }`}
          />
        </div>
      </button>
      <div 
        className={`
          grid transition-all duration-200 ease-out
          ${isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}
        `}
      >
        <div className="overflow-hidden">
          <div className="space-y-3 px-4 pb-4 pt-1">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
