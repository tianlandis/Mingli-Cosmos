// ============================================================
// ResizablePanel 组件 — 可拖拽分栏布局
// 适配玄青新中式暗色主题
// ============================================================
import * as React from 'react'
import { cn } from '@/lib/utils'

// ═══════════════════════════════════════
// ResizablePanelGroup — 水平分栏容器
// ═══════════════════════════════════════

interface ResizablePanelGroupProps {
  direction?: 'horizontal' | 'vertical'
  children: React.ReactNode
  className?: string
}

export function ResizablePanelGroup({
  direction = 'horizontal',
  children,
  className,
}: ResizablePanelGroupProps) {
  return (
    <div
      className={cn(
        'flex min-h-0 flex-1',
        direction === 'horizontal' ? 'flex-row' : 'flex-col',
        className,
      )}
    >
      {children}
    </div>
  )
}

// ═══════════════════════════════════════
// ResizablePanel — 单个面板
// ═══════════════════════════════════════

interface ResizablePanelProps {
  children: React.ReactNode
  defaultSize?: number // 百分比 0-100
  minSize?: number
  maxSize?: number
  className?: string
}

export function ResizablePanel({
  children,
  defaultSize,
  minSize = 15,
  maxSize = 85,
  className,
}: ResizablePanelProps) {
  const style: React.CSSProperties = {}
  if (defaultSize !== undefined) {
    style.flexBasis = `${defaultSize}%`
    style.flexGrow = 0
    style.flexShrink = 0
  } else {
    style.flexGrow = 1
    style.flexShrink = 1
    style.minWidth = `${minSize}%`
    style.maxWidth = `${maxSize}%`
  }
  return (
    <div className={cn('overflow-hidden', className)} style={style}>
      {children}
    </div>
  )
}

// ═══════════════════════════════════════
// ResizableHandle — 可拖拽分割线
// ═══════════════════════════════════════

interface ResizableHandleProps {
  onResize?: (delta: number) => void
  className?: string
  disabled?: boolean
}

export function ResizableHandle({
  onResize,
  className,
  disabled,
}: ResizableHandleProps) {
  const ref = React.useRef<HTMLDivElement>(null)
  const dragging = React.useRef(false)
  const startX = React.useRef(0)

  const onMouseDown = React.useCallback(
    (e: React.MouseEvent) => {
      if (disabled) return
      e.preventDefault()
      dragging.current = true
      startX.current = e.clientX

      const onMouseMove = (ev: MouseEvent) => {
        if (!dragging.current) return
        const delta = ev.clientX - startX.current
        startX.current = ev.clientX
        onResize?.(delta)
      }

      const onMouseUp = () => {
        dragging.current = false
        document.removeEventListener('mousemove', onMouseMove)
        document.removeEventListener('mouseup', onMouseUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }

      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    },
    [onResize, disabled],
  )

  return (
    <div
      ref={ref}
      onMouseDown={onMouseDown}
      className={cn(
        'relative w-2 shrink-0 cursor-col-resize group',
        'before:absolute before:inset-y-0 before:left-1/2 before:-translate-x-px before:w-px before:bg-white/[0.04]',
        'hover:before:bg-[#B8964A]/40 transition-colors duration-200',
        disabled && 'cursor-default before:!bg-transparent',
        className,
      )}
    >
      {/* 中间拖拽指示点 */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <div className="flex flex-col gap-0.5">
          <div className="w-0.5 h-0.5 rounded-full bg-[#B8964A]/60" />
          <div className="w-0.5 h-0.5 rounded-full bg-[#B8964A]/60" />
          <div className="w-0.5 h-0.5 rounded-full bg-[#B8964A]/60" />
        </div>
      </div>
    </div>
  )
}
