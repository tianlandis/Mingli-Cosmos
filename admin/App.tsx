// ============================================================
// Phase 5 — 管理后台 App（玄青朱砂 · 新中式暗色）
// 文件：admin/App.tsx
// 职责：全局 401 拦截 + 统一 API 客户端注册 + 页面路由
// ============================================================

import { useState, useEffect } from 'react'
import { useAuth } from './hooks/useAuth'
import { setUnauthorizedHandler } from './lib/api'
import Login from './components/Login'
import { Layout } from './core'
import type { PageKey } from './core/menu.config'
import DashboardPage from './modules/dashboard/DashboardPage'
import LLMPage from './modules/llm/LLMPage'
import PromptEditor from './modules/prompts/PromptEditor'
import KnowledgeDictPage from './modules/knowledge-dict/KnowledgeDictPage'
import ConfigPanel from './components/ConfigPanel'
import AuditLog from './components/AuditLog'
import { Construction, RefreshCw } from 'lucide-react'

export default function App() {
  const auth = useAuth()
  const [page, setPage] = useState<PageKey>('dashboard')

  // ═══ 全局 401 拦截：任何 API 调用返回 401 时自动踢回登录页 ═══
  useEffect(() => {
    setUnauthorizedHandler(() => {
      auth.logout()
    })
  }, [auth.logout])

  // ── 启动时 token 验证 loading ──
  if (auth.verifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0A1118]">
        <div className="flex flex-col items-center gap-4">
          <div className="size-14 flex items-center justify-center border-3 border-[#C04030] rounded-sm font-serif font-bold text-[#C04030] text-xl -rotate-3 shadow-[0_0_20px_rgba(192,64,48,0.15)]">
            墨
          </div>
          <RefreshCw size={20} className="animate-spin text-[#B8964A]" />
          <p className="text-sm text-[#6B6459] tracking-[0.05em]">验证登录状态...</p>
        </div>
      </div>
    )
  }

  if (!auth.isAuthenticated) {
    return <Login onLogin={auth.login} />
  }

  return (
    <Layout activePage={page} onNavigate={setPage} onLogout={auth.logout}>
      {page === 'dashboard' && <DashboardPage apiHeaders={auth.apiHeaders} />}
      {page === 'config' && <ConfigPanel apiHeaders={auth.apiHeaders} />}
      {page === 'prompts' && <PromptEditor apiHeaders={auth.apiHeaders} />}
      {page === 'audit' && <AuditLog apiHeaders={auth.apiHeaders} />}
      {page === 'llm' && <LLMPage apiHeaders={auth.apiHeaders} />}
      {page === 'knowledge-dict' && <KnowledgeDictPage />}
      {(page === 'users' || page === 'orders') && (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="size-16 flex items-center justify-center rounded-full bg-[#1A1F2E] border border-white/[0.06] mb-4">
            <Construction size={24} className="text-[#4A4540]" />
          </div>
          <p className="text-[#6B6459] text-base">功能开发中，敬请期待</p>
          <p className="text-[#4A4540] text-sm mt-1">模块建设中，完成后将自动启用</p>
        </div>
      )}

    </Layout>
  )
}
