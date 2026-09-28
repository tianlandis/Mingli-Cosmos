// ============================================================
// C 端应用外壳 — 跨路由共享状态
// 文件：src/lib/shell.ts
//
// 为什么需要它：
//   引入路由后，页面会随 Tab 切换卸载重建。若把「排盘结果」留在页面内，
//   用户切到「我的」再切回「排盘」就会丢失命盘。这里把状态提升到外壳层，
//   通过 <Outlet context> 下发，页面用 useShell() 取用 —— 零第三方状态库。
// ============================================================

import { useOutletContext } from 'react-router-dom'
import type { BaZiResult } from '../engine'
import type { AnnotationResult } from '../engine/annotation'
import type { CurrentUser, UserSubscription } from '../hooks/useUser'
import type { ChartInput } from '../hooks/useBazi'

/** 排盘输入（与 BirthForm 的 onCalculate 载荷一致） */
export type PaipanInput = ChartInput

export interface ShellContextValue {
  // ── 用户态 ──
  user: CurrentUser | null
  subscription: UserSubscription | null
  quotaRemaining: number
  verifying: boolean
  refreshUser: () => Promise<void>
  logout: () => Promise<void>
  openAuth: (mode?: 'login' | 'register') => void

  // ── 排盘态（跨 Tab 保活）──
  result: BaZiResult | null
  annotation: AnnotationResult | null
  /** 服务端权威命盘会话 id（P5-3），对话据此取用权威快照；本地回退时为 null */
  sessionId: string | null
  loading: boolean
  error: string | null
  calculate: (data: PaipanInput) => Promise<void>
  /** 载入一份历史命盘（服务端权威快照） */
  loadChart: (id: string) => Promise<void>

  // ── AI 对话 ──
  showChat: boolean
  openChat: () => void
  closeChat: () => void
}

/** 在任一子路由页面中读取外壳状态 */
export function useShell(): ShellContextValue {
  return useOutletContext<ShellContextValue>()
}
