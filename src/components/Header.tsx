// ============================================================
// 顶部导航（Phase 4b M-6：接入 C 端登录态）
// 文件：src/components/Header.tsx
//
// 导航分工：
//   - 桌面（sm+）：本组件内的顶部导航（排盘 / 我的）
//   - 手机：由 BottomNav 承担底部 Tab，此处只保留标题与账户入口
// ============================================================

import { Link, NavLink } from 'react-router-dom'
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

const NAV = [
  { to: '/', label: '排盘', end: true },
  { to: '/my', label: '我的', end: false },
]

export default function Header({ user, onLoginClick, onLogout }: HeaderProps) {
  return (
    <header className="w-full bg-surface-page border-b border-line-strong py-2.5 sm:py-3 px-4 sm:px-6 safe-top">
      <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 sm:gap-6 min-w-0">
          <Link
            to="/"
            className="text-lg sm:text-xl font-bold tracking-[0.15em] text-fg-primary shrink-0"
            style={{ fontFamily: '"Noto Serif SC", serif' }}
          >
            八字排盘
          </Link>

          <nav aria-label="主导航" className="hidden sm:flex items-center gap-1">
            {NAV.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded-sm text-sm tracking-wider transition-colors ${
                    isActive
                      ? 'text-brand font-medium bg-cinnabar-050'
                      : 'text-fg-secondary hover:text-fg-primary hover:bg-surface-muted'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <span className="text-xs text-fg-tertiary hidden sm:block tracking-wider">
            四柱八字 · 传统命理
          </span>

          {user ? (
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex flex-col items-end leading-tight">
                <span className="text-xs font-medium text-fg-primary">
                  {user.nickname || user.username}
                </span>
                <span className="text-[10px] text-fg-tertiary">
                  {VIP_LABEL[user.vipLevel] || user.vipLevel} · 剩余 {user.quotaRemaining} 次
                </span>
              </div>
              <span className="sm:hidden size-7 flex items-center justify-center rounded-full bg-surface-muted border border-line-strong">
                <User size={13} className="text-fg-secondary" aria-hidden="true" />
              </span>
              <button
                onClick={onLogout}
                title="退出登录"
                aria-label="退出登录"
                className="p-2 sm:p-1.5 rounded-sm text-fg-secondary hover:text-fg-primary hover:bg-surface-muted transition-colors"
              >
                <LogOut size={15} aria-hidden="true" />
              </button>
            </div>
          ) : (
            <button
              onClick={onLoginClick}
              className="px-3.5 py-2 sm:px-3 sm:py-1.5 rounded-sm border border-brand text-brand text-xs font-bold tracking-wider hover:bg-cinnabar-050 transition-colors"
            >
              登录 / 注册
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
