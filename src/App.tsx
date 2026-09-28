import { useEffect, useState } from 'react'
import Header from './components/Header'
import BirthForm from './components/BirthForm'
import BaziChart from './components/BaziChart'
import ElementBar from './components/ElementBar'
import ResultSummary from './components/ResultSummary'
import ResultTabs from './components/ResultTabs'
import AuthDialog from './components/AuthDialog'
import { useBazi } from './hooks/useBazi'
import { useUser } from './hooks/useUser'
import { track } from './lib/user-api'

export default function App() {
  const { result, annotation, loading, error, handleCalculate } = useBazi()
  const { user, login, register, logout } = useUser()
  const [showChat, setShowChat] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')

  // ── 页面访问埋点（M-8）──
  useEffect(() => { track('page_view') }, [])

  /** 排盘埋点：仅记录历法与性别维度，不采集出生时间等敏感信息 */
  const handleCalculateWithTrack = async (data: Parameters<typeof handleCalculate>[0]) => {
    setShowChat(false) // 换命盘 = 换对话上下文
    await handleCalculate(data)
    track('paipan', { calendarType: data.calendarType, gender: data.gender })
  }

  const openChat = () => {
    setShowChat(true)
    track('chat')
  }

  return (
    <div className="min-h-screen bg-[#FBF7F0] flex flex-col">
      <Header
        user={user}
        onLoginClick={() => { setAuthMode('login'); setAuthOpen(true) }}
        onLogout={logout}
      />

      <main className="flex-1 max-w-3xl mx-auto w-full px-3 sm:px-4 md:px-8 lg:pr-24 py-4 sm:py-6 safe-x">
        {/* 输入区 — 卡片式生辰录入（L 输入） */}
        <div className="mb-5">
          <BirthForm onCalculate={handleCalculateWithTrack} />
        </div>

        {/* Loading — 紧凑内联条，避免与结果区争抢首屏 */}
        {loading && (
          <div className="flex items-center justify-center gap-2 py-3 text-sm text-[#6B6459]">
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[#B83A2E] border-t-transparent" />
            计算中…
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-sm border border-[#D4A8A4] bg-[#F5EDEB] p-4 text-center text-sm text-[#9B2C22]">
            {error}
          </div>
        )}

        {/* ═══ 结果区：L0 命盘 → L1 速读 → L2 详情 ═══ */}
        {result && (
          <div className="animate-in fade-in duration-500 space-y-4">
            {/* L0 命盘卡 —— 只依赖 result，排盘后立即上屏，不等批注 */}
            <section className="rounded-md border border-[#E4DED3] bg-white shadow-[0_1px_3px_rgba(28,25,20,0.05)] px-4 pt-3 pb-5 sm:px-6">
              <BaziChart
                yearPillar={result.yearPillar}
                monthPillar={result.monthPillar}
                dayPillar={result.dayPillar}
                hourPillar={result.hourPillar}
                dayMaster={result.dayMaster}
              />
              <ElementBar fiveElements={result.fiveElements} />
            </section>

            {/* L1 速读三卡 —— 日主强弱 / 格局 / 命局总览 */}
            <ResultSummary annotation={annotation} dayMaster={result.dayMaster} />

            {/* L2 详情 Tab —— 命盘细节 / 命理解读 / 大运流年 / 专题 / AI 问答 */}
            <ResultTabs
              result={result}
              annotation={annotation}
              showChat={showChat}
              onOpenChat={openChat}
              onCloseChat={() => setShowChat(false)}
            />
          </div>
        )}

        {/* 空状态 — 首屏能力引导（有边界、有结构） */}
        {!result && !loading && !error && (
          <div className="rounded-md border border-dashed border-[#DDD6C8] bg-white/40 px-5 py-8 text-center">
            <div className="text-4xl mb-3 opacity-25 select-none">☯</div>
            <p className="text-[#8A8172] text-sm tracking-[0.15em] mb-4">
              填写上方生辰，即刻推演命盘
            </p>
            <div className="flex flex-wrap justify-center gap-1.5">
              {['四柱八字', '五行强弱', '十神', '大运流年', '命盘批注', 'AI 问答'].map(t => (
                <span
                  key={t}
                  className="px-2.5 py-1 rounded-full border border-[#E4DED3] bg-white/70 text-[11px] text-[#8A8172] tracking-wider"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        )}
      </main>

      <footer className="text-center py-4 text-xs text-[#B0A898] border-t border-[#D8D2C8] tracking-wider safe-bottom">
        八字排盘 · 四柱八字命理工具 · 仅供参考
      </footer>

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
