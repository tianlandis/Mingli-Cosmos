// ============================================================
// 发现页 — 新增功能的布局入口
// 文件：src/pages/DiscoverPage.tsx
//
// 定位：把「待增加的功能」先落到前端框架里，逐个点亮。
//   - status='planned' 的卡片渲染为禁用态 + 「敬请期待」，不可点击。
//     这样功能清单可见、进度透明，但不会让用户点到空页面。
//   - 后端按功能扣点券落地后，把 status 改为 'available' 并补 route 即可点亮。
//
// 点券逻辑见 src/lib/credits.ts：引擎能算的免费，AI 润滑才收券。
// ============================================================

import {
  BookOpen, CalendarDays, Heart, Share2, Sun, Users,
} from 'lucide-react'
import type { ComponentType } from 'react'
import { FEATURES, costOf, type FeatureIconName } from '../lib/features'
import { CREDIT_UNIT, formatCredits } from '../lib/credits'
import { useShell } from '../lib/shell'

const ICONS: Record<FeatureIconName, ComponentType<{ size?: number; strokeWidth?: number }>> = {
  users: Users,
  family: Heart,
  book: BookOpen,
  calendar: CalendarDays,
  sun: Sun,
  share: Share2,
}

export default function DiscoverPage() {
  const { user, quotaRemaining } = useShell()

  return (
    <>
      <header className="mb-5">
        <h1
          className="text-xl sm:text-2xl font-bold tracking-[0.12em] text-fg-primary"
          style={{ fontFamily: '"Noto Serif SC", serif' }}
        >
          发现
        </h1>
        <p className="mt-1.5 text-sm text-fg-secondary leading-relaxed">
          排盘与批注由引擎本地计算，永久免费；消耗大模型的功能才用{CREDIT_UNIT}。
        </p>
      </header>

      <section
        aria-label="点券余额"
        className="mb-6 rounded-sm border border-line-strong bg-surface-raised p-4"
      >
        {user ? (
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-sm text-fg-secondary">点券余额</span>
            <span
              className="text-2xl font-medium text-brand"
              style={{ fontFamily: '"Noto Serif SC", serif' }}
            >
              {formatCredits(quotaRemaining)}
            </span>
          </div>
        ) : (
          <p className="text-sm text-fg-secondary">
            登录后查看点券余额。注册即送{CREDIT_UNIT}，排盘永久免费。
          </p>
        )}
      </section>

      <section aria-label="功能列表">
        <ul className="grid grid-cols-2 gap-3">
          {FEATURES.map(f => {
            const Icon = ICONS[f.icon]
            const cost = costOf(f.key)
            const planned = f.status === 'planned'
            const free = cost.credits === 0

            return (
              <li key={f.key}>
                <button
                  type="button"
                  disabled={planned}
                  aria-disabled={planned}
                  className={[
                    'w-full min-h-[104px] text-left rounded-sm border p-3.5 transition-colors',
                    'flex flex-col justify-between gap-2',
                    planned
                      ? 'border-line-strong bg-surface-muted opacity-70 cursor-not-allowed'
                      : 'border-line-strong bg-surface-raised cursor-pointer hover:border-brand',
                  ].join(' ')}
                >
                  <span className="flex items-start justify-between gap-2">
                    <Icon size={20} strokeWidth={1.8} aria-hidden="true" />
                    <span
                      className={[
                        'shrink-0 text-[11px] px-1.5 py-0.5 rounded-sm',
                        planned
                          ? 'bg-surface-muted text-fg-tertiary'
                          : free
                            ? 'bg-cinnabar-050 text-brand'
                            : 'bg-surface-muted text-fg-secondary',
                      ].join(' ')}
                    >
                      {planned ? '敬请期待' : free ? '免费' : formatCredits(cost.credits)}
                    </span>
                  </span>

                  <span className="block">
                    <span className="block text-sm font-medium text-fg-primary tracking-wide">
                      {f.title}
                    </span>
                    <span className="mt-0.5 block text-xs text-fg-tertiary leading-relaxed">
                      {f.desc}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </section>

      <p className="mt-6 text-xs text-fg-tertiary leading-relaxed">
        标注「敬请期待」的功能已完成前端布局，待后端能力就绪后逐个开放。
      </p>
    </>
  )
}
