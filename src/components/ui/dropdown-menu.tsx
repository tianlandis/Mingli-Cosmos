"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

// ── 简化版 DropdownMenu（无需 @radix-ui 依赖，纯 React 实现） ──

interface DropdownContextType {
  open: boolean
  setOpen: (open: boolean) => void
}

const DropdownContext = React.createContext<DropdownContextType>({
  open: false,
  setOpen: () => {},
})

function DropdownMenu({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false)

  React.useEffect(() => {
    if (!open) return
    const handleClick = () => setOpen(false)
    document.addEventListener("click", handleClick)
    return () => document.removeEventListener("click", handleClick)
  }, [open])

  return (
    <DropdownContext.Provider value={{ open, setOpen }}>
      <div className="relative inline-block">{children}</div>
    </DropdownContext.Provider>
  )
}

function DropdownMenuTrigger({
  children,
  asChild,
  className,
  ...props
}: React.ComponentProps<"button"> & { asChild?: boolean }) {
  const { open, setOpen } = React.useContext(DropdownContext)

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<any>, {
      onClick: (e: React.MouseEvent) => {
        e.stopPropagation()
        setOpen(!open)
        ;(children as React.ReactElement<any>).props.onClick?.(e)
      },
    })
  }

  return (
    <button
      data-slot="dropdown-menu-trigger"
      onClick={(e) => {
        e.stopPropagation()
        setOpen(!open)
      }}
      className={className}
      {...props}
    >
      {children}
    </button>
  )
}

function DropdownMenuContent({
  className,
  align = "end",
  sideOffset = 4,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  align?: "start" | "center" | "end"
  sideOffset?: number
}) {
  const { open } = React.useContext(DropdownContext)

  if (!open) return null

  return (
    <div
      data-slot="dropdown-menu-content"
      className={cn(
        "absolute z-50 min-w-[8rem] overflow-hidden rounded-md p-1 shadow-lg",
        "bg-[#1A2332] border border-white/[0.08]",
        "animate-in fade-in-0 zoom-in-95",
        align === "end" && "right-0",
        align === "center" && "left-1/2 -translate-x-1/2",
      )}
      style={{ marginTop: sideOffset }}
      onClick={(e) => e.stopPropagation()}
      {...props}
    >
      {children}
    </div>
  )
}

function DropdownMenuItem({
  className,
  inset,
  ...props
}: React.ComponentProps<"button"> & { inset?: boolean }) {
  return (
    <button
      data-slot="dropdown-menu-item"
      className={cn(
        "relative flex w-full cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors",
        "text-[#A09888] hover:bg-white/[0.06] hover:text-[#EDE8DF]",
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        inset && "pl-8",
        className,
      )}
      {...props}
    />
  )
}

function DropdownMenuSeparator({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dropdown-menu-separator"
      className={cn("my-1 h-px bg-white/[0.06]", className)}
      {...props}
    />
  )
}

function DropdownMenuLabel({ className, inset, ...props }: React.ComponentProps<"div"> & { inset?: boolean }) {
  return (
    <div
      data-slot="dropdown-menu-label"
      className={cn(
        "px-2 py-1.5 text-sm font-semibold text-[#6B6459]",
        inset && "pl-8",
        className,
      )}
      {...props}
    />
  )
}

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
}
