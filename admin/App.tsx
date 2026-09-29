// ============================================================
// Phase 5 — 管理后台 App（玄青朱砂 · 新中式暗色 · react-router 改造）
// 文件：admin/App.tsx
// 职责：全局 401 拦截 + 统一 API 客户端注册 + react-router 路由
// ============================================================

import { useEffect } from 'react'
import { Routes, Route, Navigate, useLocation, Link } from 'react-router-dom'
import { Compass } from 'lucide-react'
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

/** 404：未注册路径的兜底页（原先是空白内容区） */
function NotFound() {
  const { pathname } = useLocation()
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-3">
      <div className="size-12 flex items-center justify-center rounded-xl bg-[#B8964A]/10 border border-[#B8964A]/20">
        <Compass size={22} className="text-[#B8964A]" />
      </div>
      <h3 className="text-base font-semibold text-[#EDE8DF] tracking-[0.04em]">页面不存在</h3>
      <p className="text-sm text-[#6B6459]">
        未找到路径 <code className="font-mono text-[#A09888]">{pathname}</code>
      </p>
      <Link
        to="/dashboard"
        className="mt-2 px-4 py-2 text-sm rounded-lg border border-[#B8964A]/20 text-[#B8964A] hover:bg-[#B8964A]/10 transition-colors"
      >
        返回仪表盘
      </Link>
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
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/config" element={<ConfigPanel />} />
        <Route path="/prompts" element={<PromptEditor />} />
        <Route path="/guardrails" element={<GuardPanel />} />
        <Route path="/audit" element={<AuditLog />} />
        <Route path="/llm" element={<LLMPage />} />
        <Route path="/knowledge-dict" element={<KnowledgeDictPage />} />
        <Route path="/users" element={<UsersPage />} />
        <Route path="/orders" element={<OrdersPage />} />
        {/* 兜底：未注册路径原先渲染空白内容区，用户无从判断是地址错还是页面坏了 */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Layout>
  )
}
