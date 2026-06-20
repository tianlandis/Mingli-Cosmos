import * as React from "react"
import { cn } from "@/lib/utils"

function Select({
  className,
  children,
  ...props
}: React.ComponentProps<"select">) {
  return (
    <select
      data-slot="select"
      className={cn(
        "flex h-9 w-full rounded-md border border-[#3A3630] bg-[#1A1816] px-3 py-1",
        "text-sm text-[#EDE8DF] shadow-sm transition-colors",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#C04030] focus-visible:border-[#C04030]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "appearance-none",
        className
      )}
      {...props}
    >
      {children}
    </select>
  )
}

export { Select }
