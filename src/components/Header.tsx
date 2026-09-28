// ============================================================
// 顶部导航（Phase 4b M-6：接入 C 端登录态）
// 文件：src/components/Header.tsx
// ============================================================

import { LogOut, User } from 'lucide-react'
import type { CurrentUser } from '../hooks/useUser'

interface HeaderProps {
  user: CurrentUser | null
  onLoginClick: () => void
  onLogout: () => void
}

const VIP_LABEL: Record<string, string> = {
  free: '免费',
  basic: '会员',
  pro: '专业',
}

export default function Header({ user, onLoginClick, onLogout }: HeaderProps) {
  return (
    <header className="w-full bg-surface-page border-b border-line-strong py-2.5 sm:py-3 px-4 sm:px-6 safe-top">
      <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
        <h1
          className="text-lg sm:text-xl font-bold tracking-[0.15em] text-fg-primary shrink-0"
          style={{ fontFamily: '"Noto Serif SC", serif' }}
        >
          八字排盘
        </h1>

        <div className="flex items-center gap-3">
          <span className="text-xs text-fg-tertiary hidden sm:block tracking-wider">
            四柱八字 · 传统命理
          </span>

          {user ? (
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex flex-col items-end leading-tight">
                <span className="text-xs font-medium text-fg-primary">
                  {user.nickname || user.username}
                </span>
                <span className="text-[10px] text-[#8A8172]">
                  {VIP_LABEL[user.vipLevel] || user.vipLevel} · 剩余 {user.quotaRemaining} 次
                </span>
              </div>
              <span className="sm:hidden size-7 flex items-center justify-center rounded-full bg-[#F0E9DF] border border-line-strong">
                <User size={13} className="text-fg-secondary" />
              </span>
              <button
                onClick={onLogout}
                title="退出登录"
                aria-label="退出登录"
                className="p-2 sm:p-1.5 rounded-sm text-[#8A8172] hover:text-fg-primary hover:bg-[#F0E9DF] transition-colors"
              >
                <LogOut size={15} />
              </button>
            </div>
          ) : (
            <button
              onClick={onLoginClick}
              className="px-3.5 py-2 sm:px-3 sm:py-1.5 rounded-sm border border-brand text-brand text-xs font-bold tracking-wider hover:bg-[#F9F0EB] transition-colors"
            >
              登录 / 注册
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
