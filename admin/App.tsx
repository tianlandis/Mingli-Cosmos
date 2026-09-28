// ============================================================
// Phase 5 — 管理后台 App（玄青朱砂 · 新中式暗色 · react-router 改造）
// 文件：admin/App.tsx
// 职责：全局 401 拦截 + 统一 API 客户端注册 + react-router 路由
// ============================================================

import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { setUnauthorizedHandler } from './lib/api'
import Login from './components/Login'
import Layout from './core/Layout'
import DashboardPage from './modules/dashboard/DashboardPage'
import LLMPage from './modules/llm/LLMPage'
import PromptEditor from './modules/prompts/PromptEditor'
import GuardPanel from './modules/prompts/GuardPanel'
import KnowledgeDictPage from './modules/knowledge-dict/KnowledgeDictPage'
import UsersPage from './modules/users/UsersPage'
import OrdersPage from './modules/orders/OrdersPage'
import ConfigPanel from './components/ConfigPanel'
import AuditLog from './components/AuditLog'
import { RefreshCw } from 'lucide-react'

export default function App() {
  const auth = useAuth()

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
    <Layout onLogout={auth.logout}>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage apiHeaders={auth.apiHeaders} />} />
        <Route path="/config" element={<ConfigPanel apiHeaders={auth.apiHeaders} />} />
        <Route path="/prompts" element={<PromptEditor />} />
        <Route path="/guardrails" element={<GuardPanel />} />
        <Route path="/audit" element={<AuditLog apiHeaders={auth.apiHeaders} />} />
        <Route path="/llm" element={<LLMPage apiHeaders={auth.apiHeaders} />} />
        <Route path="/knowledge-dict" element={<KnowledgeDictPage />} />
        <Route path="/users" element={<UsersPage />} />
        <Route path="/orders" element={<OrdersPage />} />
      </Routes>
    </Layout>
  )
}
