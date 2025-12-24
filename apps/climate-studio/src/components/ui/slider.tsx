import * as React from "react"
import * as SliderPrimitive from "@radix-ui/react-slider"

import { cn } from "../../lib/utils"

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn(
      "relative flex w-full touch-none select-none items-center group",
      className
    )}
    {...props}
  >
    <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full transition-colors bg-[rgba(67,126,252,0.25)] dark:bg-[rgba(63,63,63,1)]">
      <SliderPrimitive.Range className="absolute h-full bg-gradient-to-r from-blue-500 to-blue-400" />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb className="
      block h-4 w-4 rounded-full 
      border-2 border-blue-400 
      bg-neutral-100 
      shadow-lg shadow-blue-500/20
      transition-all duration-150
      hover:scale-110 hover:border-blue-300
      focus-visible:outline-none 
      focus-visible:ring-2 focus-visible:ring-blue-500/50
      focus-visible:scale-110
      active:scale-95
      disabled:pointer-events-none disabled:opacity-50
    " />
  </SliderPrimitive.Root>
))
Slider.displayName = SliderPrimitive.Root.displayName

export { Slider }
