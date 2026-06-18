// ============================================================
// Phase 4 — 管理后台更新 App.tsx
// 文件：admin/App.tsx
// 职责：登录守卫 + 新 Layout + 模块路由
// ============================================================

import { useState, useCallback } from 'react'
import { useAuth } from './hooks/useAuth'
import Login from './components/Login'
import { Layout } from './core'
import type { PageKey } from './core/menu.config'
import DashboardPage from './modules/dashboard/DashboardPage'
import LLMPage from './modules/llm/LLMPage'
import PromptEditor from './modules/prompts/PromptEditor'
import ConfigPanel from './components/ConfigPanel'
import AuditLog from './components/AuditLog'

export default function App() {
  const auth = useAuth()
  const [page, setPage] = useState<PageKey>('dashboard')

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
      {(page === 'users' || page === 'orders' || page === 'knowledge') && (
        <div className="admin-card p-8 text-center">
          <p className="text-[#6B6459] text-sm">功能开发中，敬请期待</p>
        </div>
      )}
    </Layout>
  )
}
