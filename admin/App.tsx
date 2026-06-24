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
import ConfigPanel from './components/ConfigPanel'
import AuditLog from './components/AuditLog'
import { Construction, RefreshCw } from 'lucide-react'

function ConstructionPlaceholder() {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="size-16 flex items-center justify-center rounded-full bg-[#1A1F2E] border border-white/[0.06] mb-4">
        <Construction size={24} className="text-[#4A4540]" />
      </div>
      <p className="text-[#6B6459] text-base">功能开发中，敬请期待</p>
      <p className="text-[#4A4540] text-sm mt-1">模块建设中，完成后将自动启用</p>
    </div>
  )
}

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
        <Route path="/prompts" element={<PromptEditor apiHeaders={auth.apiHeaders} />} />
        <Route path="/guardrails" element={<GuardPanel />} />
        <Route path="/audit" element={<AuditLog apiHeaders={auth.apiHeaders} />} />
        <Route path="/llm" element={<LLMPage apiHeaders={auth.apiHeaders} />} />
        <Route path="/knowledge-dict" element={<KnowledgeDictPage />} />
        <Route path="/users" element={<ConstructionPlaceholder />} />
        <Route path="/orders" element={<ConstructionPlaceholder />} />
      </Routes>
    </Layout>
  )
}
