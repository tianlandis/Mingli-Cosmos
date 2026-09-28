// ============================================================
// 体系切换器（八字 / 星座 / MBTI）
// 文件：src/components/SystemSwitcher.tsx
//
// 接后端 ADR-011 多体系注册表：selected id 直接作为 `system` 传给
// POST /api/v1/app/chart（未注册的体系后端返回 400）。
//
// 未注册的体系渲染为禁用态并标注「规划中」——先布局，不造可用假象。
// 触摸目标 min-h-[44px]；键盘可达（原生 button，禁用态保持可聚焦以朗读状态）。
// ============================================================

import { SYSTEMS } from '../lib/systems'

interface SystemSwitcherProps {
  value: string
  onChange: (id: string) => void
  disabled?: boolean
}

export default function SystemSwitcher({ value, onChange, disabled }: SystemSwitcherProps) {
  return (
    <div
      role="radiogroup"
      aria-label="命理体系"
      className="flex flex-wrap gap-2"
    >
      {SYSTEMS.map(s => {
        const planned = s.status !== 'available'
        const isOff = planned || disabled === true
        const selected = s.id === value
        return (
          <button
            key={s.id}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-disabled={isOff}
            disabled={isOff}
            title={planned ? `${s.label} · 规划中` : s.desc}
            onClick={() => !isOff && onChange(s.id)}
            className={[
              'min-h-[44px] px-3.5 rounded-sm text-sm tracking-wider transition-colors',
              'flex items-center gap-1.5',
              selected
                ? 'bg-brand text-white border border-brand'
                : 'bg-surface-raised text-fg-secondary border border-line-strong',
              isOff ? 'opacity-45 cursor-not-allowed' : 'cursor-pointer',
            ].join(' ')}
          >
            <span>{s.label}</span>
            {planned && (
              <span className="text-[11px] px-1.5 py-0.5 rounded-sm bg-surface-muted text-fg-tertiary">
                规划中
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
