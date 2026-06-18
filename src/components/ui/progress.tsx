import * as React from "react"
import { cn } from "@/lib/utils"

interface ProgressProps extends React.ComponentProps<"div"> {
  value?: number // 0-100
  max?: number
  indicatorClassName?: string
}

/**
 * shadcn-style Progress 组件
 * 用纯 CSS 实现进度条，无需 @radix-ui/react-progress
 */
function Progress({
  className,
  value = 0,
  max = 100,
  indicatorClassName,
  ...props
}: ProgressProps) {
  const pct = Math.min(Math.max((value / max) * 100, 0), 100)

  return (
    <div
      data-slot="progress"
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      className={cn(
        "bg-secondary relative h-3 w-full overflow-hidden rounded-full",
        className,
      )}
      {...props}
    >
      <div
        className={cn(
          "h-full rounded-full transition-all duration-300 ease-in-out",
          indicatorClassName,
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

export { Progress }
export type { ProgressProps }
