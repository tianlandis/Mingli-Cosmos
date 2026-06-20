import * as React from "react"
import { cn } from "@/lib/utils"

function Switch({ className, ...props }: React.ComponentProps<"button"> & { checked?: boolean; onCheckedChange?: (checked: boolean) => void }) {
  const { checked, onCheckedChange, ...rest } = props as any
  return (
    <button
      data-slot="switch"
      role="switch"
      aria-checked={checked}
      onClick={() => onCheckedChange?.(!checked)}
      className={cn(
        "peer data-[state=checked]:bg-primary data-[state=unchecked]:bg-input focus-visible:border-ring focus-visible:ring-ring/50 inline-flex h-5 w-9 shrink-0 items-center rounded-full border-2 border-transparent shadow-xs transition-all outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
        checked && "bg-primary",
        !checked && "bg-input",
        className
      )}
      {...rest}
    >
      <span
        className={cn(
          "pointer-events-none block size-4 rounded-full bg-background shadow-lg ring-0 transition-transform",
          checked ? "translate-x-4" : "translate-x-0"
        )}
      />
    </button>
  )
}

export { Switch }
