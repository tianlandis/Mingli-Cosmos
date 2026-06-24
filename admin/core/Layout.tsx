// ============================================================
// Phase 4 — 管理后台内容布局 v2（可折叠侧边栏 · 面包屑 · 快捷键）
// 文件：admin/core/Layout.tsx
// ============================================================

import { useState, useEffect, type ReactNode } from 'react'
import { useLocation, Link } from 'react-router-dom'
import Sidebar from './Sidebar'
import { TooltipProvider } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { ChevronRight, Home } from 'lucide-react'

// ═══════════════════════════════════════
// 面包屑配置：路径 → 中文名
// ═══════════════════════════════════════

const BREADCRUMB_LABELS: Record<string, string> = {
  dashboard: '仪表盘',
  config: '系统配置',
  prompts: 'Prompt 模板',
  llm: 'LLM 供应商',
  'knowledge-dict': '命理规则字典',
  audit: '审计日志',
  users: 'C端用户',
  orders: '订单管理',
}

function getBreadcrumbs(pathname: string) {
  const segments = pathname.split('/').filter(Boolean)
  const crumbs: { label: string; path: string }[] = [
    { label: '首页', path: '/dashboard' },
  ]
  for (let i = 0; i < segments.length; i++) {
    const label = BREADCRUMB_LABELS[segments[i]] || segments[i]
    const path = '/' + segments.slice(0, i + 1).join('/')
    if (i === segments.length - 1) {
      crumbs.push({ label, path })
    } else {
      crumbs.push({ label, path })
    }
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
        <Sidebar
          onLogout={onLogout}
          collapsed={collapsed}
          onToggleCollapse={toggleCollapse}
        />

        {/* 主内容区 */}
        <main className="flex-1 overflow-y-auto flex flex-col min-w-0">
          {/* ═══ 面包屑导航 ═══ */}
          <div
            className={cn(
              'shrink-0 px-6 py-3 border-b border-white/[0.06]',
              'bg-[#0A1118]/80 backdrop-blur-sm',
            )}
          >
            <nav className="flex items-center gap-1.5 text-sm">
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
