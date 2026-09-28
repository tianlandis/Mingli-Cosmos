// ============================================================
// 移动端底部 Tab 导航
// 文件：src/components/BottomNav.tsx
//
// 约束（沿用项目移动端规范）：
//   - 仅手机显示（sm:hidden），桌面走 Header 内的顶部导航，避免重复
//   - 触摸目标 = 整条 h-14（56px）≥ 44px
//   - 底部安全区（iPhone 横条）用 .safe-bottom
//   - 固定定位不遮挡内容：页面底部由 .bottom-nav-offset 预留等高间距
// ============================================================

import { NavLink } from 'react-router-dom'
import { Compass, LayoutGrid, User } from 'lucide-react'

interface NavItem {
  to: string
  label: string
  icon: typeof Compass
  end: boolean
}

const ITEMS: NavItem[] = [
  { to: '/', label: '排盘', icon: Compass, end: true },
  { to: '/discover', label: '发现', icon: LayoutGrid, end: false },
  { to: '/my', label: '我的', icon: User, end: false },
]

export default function BottomNav() {
  return (
    <nav
      aria-label="底部导航"
      className="sm:hidden fixed bottom-0 inset-x-0 z-30 bg-surface-raised/95 backdrop-blur-sm border-t border-line-strong safe-bottom"
    >
      <ul className="flex">
        {ITEMS.map(item => {
          const Icon = item.icon
          return (
            <li key={item.to} className="flex-1">
              <NavLink
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center gap-0.5 h-14 text-[11px] tracking-wider transition-colors ${
                    isActive ? 'text-brand font-medium' : 'text-fg-tertiary'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon size={20} strokeWidth={isActive ? 2.4 : 1.8} aria-hidden="true" />
                    <span>{item.label}</span>
                  </>
                )}
              </NavLink>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
