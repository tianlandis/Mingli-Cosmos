// ============================================================
// Phase 4 — 管理后台内容布局
// 文件：admin/core/Layout.tsx
// 职责：左栏 Sidebar + 右栏主内容区，新中式暗色通栏
// ============================================================

import type { ReactNode } from 'react'
import type { PageKey } from './menu.config'
import Sidebar from './Sidebar'
import { TooltipProvider } from '@/components/ui/tooltip'

export interface LayoutProps {
  activePage: PageKey
  onNavigate: (page: PageKey) => void
  onLogout: () => void
  children: ReactNode
}

export default function Layout({ activePage, onNavigate, onLogout, children }: LayoutProps) {
  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-screen bg-[#12100E]">
        <Sidebar activePage={activePage} onNavigate={onNavigate} onLogout={onLogout} />
        <main className="flex-1 overflow-y-auto">
          <div className="min-h-full p-6 lg:p-8">
            {children}
          </div>
        </main>
      </div>
    </TooltipProvider>
  )
}
