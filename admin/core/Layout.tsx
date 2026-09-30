// ============================================================
// Phase 4 — 管理后台内容布局 v2（可折叠侧边栏 · 面包屑 · 快捷键）
// 文件：admin/core/Layout.tsx
// ============================================================

import { useState, useEffect, type ReactNode } from 'react'
import { useLocation, Link } from 'react-router-dom'
import Sidebar from './Sidebar'
import { TooltipProvider } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { ChevronRight, Home, Menu } from 'lucide-react'

/** 桌面断点：≥1024px 时侧边栏常驻；否则折叠为抽屉（overlay） */
const DESKTOP_QUERY = '(min-width: 1024px)'

// ═══════════════════════════════════════
// 面包屑配置：路径 → 中文名
// ═══════════════════════════════════════

const BREADCRUMB_LABELS: Record<string, string> = {
  dashboard: '仪表盘',
  config: '系统配置',
  prompts: 'Prompt 模板',
  guardrails: 'L3 防幻觉护栏',  // 修复：缺失此项时面包屑直接显示英文 guardrails
  llm: 'LLM 供应商',
  'knowledge-dict': '命理规则字典',
  audit: '审计日志',
  users: 'C端用户',
  orders: '订单管理',
  account: '账户与安全',
}

function getBreadcrumbs(pathname: string) {
  const segments = pathname.split('/').filter(Boolean)
  const crumbs: { label: string; path: string }[] = [
    { label: '首页', path: '/dashboard' },
  ]
  for (let i = 0; i < segments.length; i++) {
    const label = BREADCRUMB_LABELS[segments[i]] || segments[i]
    const path = '/' + segments.slice(0, i + 1).join('/')
    crumbs.push({ label, path })
  }
  return crumbs
}

// ═══════════════════════════════════════
// Layout 组件
// ═══════════════════════════════════════

export default function Layout({
  onLogout,
  children,
}: {
  onLogout: () => void
  children: ReactNode
}) {
  const [collapsed, setCollapsed] = useState(() => {
    // 从 localStorage 读取折叠状态
    try {
      return localStorage.getItem('admin-sidebar-collapsed') === 'true'
    } catch {
      return false
    }
  })

  const location = useLocation()
  const breadcrumbs = getBreadcrumbs(location.pathname)

  // 是否桌面宽屏（决定侧边栏「常驻」还是「抽屉」）
  const [isDesktop, setIsDesktop] = useState(() => {
    try { return window.matchMedia(DESKTOP_QUERY).matches } catch { return true }
  })
  // 移动端抽屉是否打开
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    let mq: MediaQueryList
    try { mq = window.matchMedia(DESKTOP_QUERY) } catch { return }
    const onChange = () => setIsDesktop(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  // 路由变化时自动关闭移动抽屉
  useEffect(() => { setMobileOpen(false) }, [location.pathname])

  // 持久化折叠状态
  const toggleCollapse = () => {
    setCollapsed(prev => {
      const next = !prev
      try {
        localStorage.setItem('admin-sidebar-collapsed', String(next))
      } catch { /* ignore */ }
      return next
    })
  }

  // 桌面：折叠/展开；移动端：关闭抽屉
  const handleToggleSidebar = () => {
    if (!isDesktop) { setMobileOpen(false); return }
    toggleCollapse()
  }

  // 键盘快捷键：Ctrl+\ 折叠/展开侧边栏
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === '\\') {
        e.preventDefault()
        toggleCollapse()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-screen bg-[#0A1118]">
        {/* 移动端抽屉遮罩 */}
        {!isDesktop && mobileOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
        )}

        <Sidebar
          onLogout={onLogout}
          collapsed={isDesktop ? collapsed : false}
          onToggleCollapse={handleToggleSidebar}
          isDesktop={isDesktop}
          mobileOpen={mobileOpen}
        />

        {/* 主内容区 */}
        <main className="flex-1 overflow-y-auto flex flex-col min-w-0">
          {/* ═══ 面包屑导航 ═══ */}
          <div
            className={cn(
              'shrink-0 px-4 sm:px-6 py-3 border-b border-white/[0.06]',
              'bg-[#0A1118]/80 backdrop-blur-sm',
              'flex items-center gap-3',
            )}
          >
            {/* 移动端汉堡按钮 */}
            {!isDesktop && (
              <button
                onClick={() => setMobileOpen(true)}
                className={cn(
                  'size-8 shrink-0 flex items-center justify-center rounded-md',
                  'text-[#6B6459] hover:text-[#D8D2C8] hover:bg-white/[0.06]',
                  'transition-colors duration-150',
                )}
                title="打开菜单"
                aria-label="打开菜单"
              >
                <Menu size={16} />
              </button>
            )}
            <nav className="flex items-center gap-1.5 text-sm min-w-0 overflow-x-auto whitespace-nowrap">
              {breadcrumbs.map((crumb, i) => {
                const isLast = i === breadcrumbs.length - 1
                return (
                  <span key={crumb.path} className="flex items-center gap-1.5">
                    {i > 0 && (
                      <ChevronRight size={12} className="text-[#4A4540]" />
                    )}
                    {isLast ? (
                      <span className="text-[#D8D2C8] font-medium">
                        {i === 0 && <Home size={13} className="inline mr-1 -mt-0.5" />}
                        {crumb.label}
                      </span>
                    ) : (
                      <Link
                        to={crumb.path}
                        className="text-[#6B6459] hover:text-[#B8964A] transition-colors"
                      >
                        {i === 0 && <Home size={13} className="inline mr-1 -mt-0.5" />}
                        {crumb.label}
                      </Link>
                    )}
                  </span>
                )
              })}
            </nav>
          </div>

          {/* ═══ 页面内容 ═══ */}
          <div className="flex-1 min-h-0 p-6 lg:p-8">
            {children}
          </div>
        </main>
      </div>
    </TooltipProvider>
  )
}
