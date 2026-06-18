// ============================================================
// Slider 组件 — 适配玄青新中式暗色主题
// ============================================================
import * as React from 'react'
import { cn } from '@/lib/utils'

interface SliderProps {
  value: number
  min?: number
  max?: number
  step?: number
  onValueChange: (value: number) => void
  className?: string
  disabled?: boolean
}

function Slider({ value, min = 0, max = 100, step = 1, onValueChange, className, disabled }: SliderProps) {
  const trackRef = React.useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = React.useState(false)

  const pct = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100))

  const updateFromEvent = (clientX: number) => {
    if (!trackRef.current || disabled) return
    const rect = trackRef.current.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
    const raw = ratio * (max - min) + min
    const stepped = Math.round(raw / step) * step
    onValueChange(Math.min(max, Math.max(min, stepped)))
  }

  const onMouseDown = (e: React.MouseEvent) => {
    if (disabled) return
    setDragging(true)
    updateFromEvent(e.clientX)
  }

  React.useEffect(() => {
    if (!dragging) return
    const onMove = (e: MouseEvent) => updateFromEvent(e.clientX)
    const onUp = () => setDragging(false)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [dragging, value, min, max, step])

  return (
    <div
      ref={trackRef}
      role="slider"
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      tabIndex={disabled ? -1 : 0}
      onMouseDown={onMouseDown}
      onKeyDown={(e) => {
        if (disabled) return
        if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); onValueChange(Math.min(max, value + step)) }
        if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); onValueChange(Math.max(min, value - step)) }
      }}
      className={cn(
        'relative h-5 flex items-center cursor-pointer select-none touch-none',
        disabled && 'opacity-50 cursor-not-allowed',
        className,
      )}
    >
      {/* track */}
      <div className="relative h-1.5 w-full rounded-full bg-white/[0.08]">
        <div
          className="absolute h-full rounded-full bg-gradient-to-r from-[#B8964A] to-[#C04030] transition-all duration-100"
          style={{ width: `${pct}%` }}
        />
      </div>
      {/* thumb */}
      <div
        className={cn(
          'absolute top-1/2 -translate-y-1/2 size-4 rounded-full border-2 border-[#B8964A] bg-[#1A1F2E] shadow-[0_0_8px_rgba(184,150,74,0.3)] transition-all',
          dragging && 'scale-110 shadow-[0_0_14px_rgba(184,150,74,0.5)]',
        )}
        style={{ left: `calc(${pct}% - ${pct === 0 ? '0px' : pct === 100 ? '16px' : '8px'})` }}
      />
    </div>
  )
}

export { Slider }
