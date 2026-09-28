// ============================================================
// 统一状态块 — 加载 / 错误 / 空态
// 文件：src/components/StateBlocks.tsx
//
// 目的：把散落在各处的临时状态写法收敛成同一套视觉与语义，
//       避免「同一件事三种样式」。均为纯展示组件，不含业务逻辑。
// ============================================================

import { AlertCircle, Loader2 } from 'lucide-react'

/** 内联加载条 —— 紧凑，不与结果区争首屏 */
export function LoadingBar({ text = '计算中…' }: { text?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center justify-center gap-2 py-3 text-sm text-fg-secondary"
    >
      <Loader2 size={16} className="animate-spin text-brand" aria-hidden="true" />
      {text}
    </div>
  )
}

/** 错误提示 —— 语义化 alert，朱砂淡底 */
export function ErrorNotice({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-sm border border-cinnabar-200 bg-cinnabar-100 p-3.5 text-sm text-brand-strong"
    >
      <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </div>
  )
}

const FEATURES = ['四柱八字', '五行强弱', '十神', '大运流年', '命盘批注', '人格画像', 'AI 问答']

/** 空态引导 —— 首屏无结果时的能力说明（有边界、有结构） */
export function EmptyGuide() {
  return (
    <div className="rounded-md border border-dashed border-line-strong bg-surface-raised/40 px-5 py-8 text-center">
      <div className="text-4xl mb-3 opacity-25 select-none" aria-hidden="true">☯</div>
      <p className="text-fg-secondary text-sm tracking-[0.15em] mb-4">
        填写上方生辰，即刻推演命盘
      </p>
      <ul className="flex flex-wrap justify-center gap-1.5 list-none p-0 m-0">
        {FEATURES.map(t => (
          <li
            key={t}
            className="px-2.5 py-1 rounded-full border border-line-soft bg-surface-raised/70 text-[11px] text-fg-secondary tracking-wider"
          >
            {t}
          </li>
        ))}
      </ul>
    </div>
  )
}
