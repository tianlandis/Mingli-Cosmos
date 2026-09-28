// ============================================================
// 应用外壳（路由根元素）
// 文件：src/App.tsx
//
// 职责：
//   1. 持有跨路由共享状态（登录态 / 排盘结果 / 对话开关）→ 经 <Outlet context>
//      下发，保证 Tab 切换不丢命盘；
//   2. 渲染全局布局：Header（含顶部导航）+ 页面内容 + Footer + 底部 Tab；
//   3. 托管全局登录弹窗。
//
// 页面本身在 src/pages/ 下，路由表在 src/main.tsx。
// ============================================================

import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Header from './components/Header'
import BottomNav from './components/BottomNav'
import AuthDialog from './components/AuthDialog'
import { useBazi } from './hooks/useBazi'
import { useUser } from './hooks/useUser'
import { track } from './lib/user-api'
import type { PaipanInput, ShellContextValue } from './lib/shell'

export default function App() {
  const { result, annotation, sessionId, loading, error, handleCalculate, loadChart } = useBazi()
  const { user, subscription, quotaRemaining, verifying, refresh, logout, login, register } = useUser()
  const [showChat, setShowChat] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')
  const { pathname } = useLocation()

  // ── 页面访问埋点（按路由上报，切换 Tab 也会记录）──
  useEffect(() => { track('page_view', { path: pathname }) }, [pathname])

  /** 排盘：换命盘 = 换对话上下文；埋点仅记录历法与性别，不采集出生时间等敏感信息 */
  const calculate = async (data: PaipanInput) => {
    setShowChat(false)
    await handleCalculate(data)
    track('paipan', { calendarType: data.calendarType, gender: data.gender })
  }

  const ctx: ShellContextValue = {
    user, subscription, quotaRemaining, verifying,
    refreshUser: refresh,
    logout,
    openAuth: (mode = 'login') => { setAuthMode(mode); setAuthOpen(true) },
    result, annotation, sessionId, loading, error,
    calculate,
    loadChart,
    showChat,
    openChat: () => { setShowChat(true); track('chat') },
    closeChat: () => setShowChat(false),
  }

  return (
    <div className="min-h-screen bg-surface-page flex flex-col">
      <Header
        user={user}
        onLoginClick={() => ctx.openAuth('login')}
        onLogout={() => { void logout() }}
      />

      <main className="flex-1 max-w-3xl mx-auto w-full px-3 sm:px-4 md:px-8 py-4 sm:py-6 safe-x">
        <Outlet context={ctx} />
      </main>

      <footer className="text-center py-4 text-xs text-fg-tertiary border-t border-line-strong tracking-wider pb-bottom-nav">
        八字排盘 · 四柱八字命理工具 · 仅供参考
      </footer>

      <BottomNav />

      <AuthDialog
        open={authOpen}
        mode={authMode}
        onClose={() => setAuthOpen(false)}
        onModeChange={setAuthMode}
        onLogin={login}
        onRegister={register}
      />
    </div>
  )
}
