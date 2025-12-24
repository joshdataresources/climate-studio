import * as React from "react"
import { ChevronDown } from "lucide-react"

interface AccordionItemProps {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
  icon?: React.ReactNode
}

export function AccordionItem({ title, children, defaultOpen = true, icon }: AccordionItemProps) {
  const [isOpen, setIsOpen] = React.useState(defaultOpen)

  return (
    <div className="widget-container widget-container-no-padding overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="accordion-trigger flex w-full items-center justify-between px-4 py-3.5 text-left transition-all duration-200 hover:bg-white/[0.04] group border-0 bg-transparent"
      >
        <div className="flex items-center gap-2.5">
          {icon && (
            <span className="text-muted-foreground group-hover:text-foreground transition-colors">
              {icon}
            </span>
          )}
          <h4 className="text-sm font-semibold tracking-tight">{title}</h4>
        </div>
        <div className={`
          flex items-center justify-center w-6 h-6 rounded-md
          bg-white/[0.04] transition-all duration-200
          group-hover:bg-white/[0.08]
          ${isOpen ? 'bg-blue-500/10' : ''}
        `}>
          <ChevronDown
            className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 ${isOpen ? "rotate-180 text-blue-400" : ""}`}
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
