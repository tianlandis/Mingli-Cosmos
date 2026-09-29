// ============================================================
// 排盘页（路由 `/`）
// 文件：src/pages/PaipanPage.tsx
//
// 结构：表单 → L0 命盘 → L1 速读 → L2 详情
// 状态来源：外壳层（useShell），保证切到「我的」再切回不丢命盘。
// ============================================================

import { useEffect, useState, type ReactNode } from 'react'
import BirthForm from '../components/BirthForm'
import BaziChart from '../components/BaziChart'
import ElementBar from '../components/ElementBar'
import ResultSummary from '../components/ResultSummary'
import ResultTabs from '../components/ResultTabs'
import ReportView from '../components/ReportView'
import SystemSwitcher from '../components/SystemSwitcher'
import { EmptyGuide, ErrorNotice, LoadingBar } from '../components/StateBlocks'
import { useShell } from '../lib/shell'
import { useReport } from '../hooks/useReport'
import { DEFAULT_SYSTEM_ID, getSystem } from '../lib/systems'
import { CREDIT_COSTS } from '../lib/credits'

export default function PaipanPage() {
  const {
    result, annotation, sessionId, systemId, payload, loading, error, calculate,
    showChat, openChat, closeChat,
  } = useShell()
  const report = useReport()

  // 换命盘时丢弃旧命书——否则会把 A 的命书显示在 B 的命盘下（串盘）
  const closeReport = report.close
  useEffect(() => {
    closeReport()
  }, [sessionId, closeReport])

  // 体系选择：后端 ADR-011 注册表目前只注册 bazi，其余为禁用态（先布局）。
  // 后续体系就绪时，把 selectedSystem 随 chart 请求的 `system` 字段下发即可。
  const [selectedSystem, setSelectedSystem] = useState(DEFAULT_SYSTEM_ID)
  const system = getSystem(selectedSystem)

  return (
    <>
      {/* 输入区 — 体系切换 + 卡片式生辰录入 */}
      <div className="mb-5 space-y-3">
        <SystemSwitcher value={selectedSystem} onChange={setSelectedSystem} />
        {system && (
          <p className="text-xs text-fg-tertiary tracking-wide">{system.desc}</p>
        )}
        {/* 体系随排盘请求下发（后端按 system 路由到对应引擎） */}
        <BirthForm
          onCalculate={v => void calculate(v, selectedSystem)}
          loading={loading}
        />
      </div>

      {/* 加载 / 错误 —— 紧凑内联，不挤占结果区 */}
      {loading && <LoadingBar />}
      {error && <ErrorNotice message={error} />}

      {/* ═══ 非八字体系结果（星座 / MBTI）═══
          产物形状由体系自定，八字那套 BaziChart 不适用，故单独渲染 */}
      {systemId !== 'bazi' && payload && (
        <div className="animate-in fade-in duration-500">
          <SystemResultCard system={systemId} payload={payload} />
        </div>
      )}

      {/* ═══ 结果区：L0 命盘 → L1 速读 → L2 详情 ═══ */}
      {result && (
        <div className="animate-in fade-in duration-500 space-y-4">
          {/* L0 命盘卡 —— 只依赖 result，排盘后立即上屏，不等批注 */}
          <section className="rounded-md border border-line-soft bg-white shadow-[0_1px_3px_rgba(28,25,20,0.05)] px-4 pt-3 pb-5 sm:px-6">
            <BaziChart
              yearPillar={result.yearPillar}
              monthPillar={result.monthPillar}
              dayPillar={result.dayPillar}
              hourPillar={result.hourPillar}
              dayMaster={result.dayMaster}
            />
            <ElementBar fiveElements={result.fiveElements} />
          </section>

          {/* L1 速读层 —— 人格画像 + 日主强弱 / 格局 / 命局总览 */}
          <ResultSummary annotation={annotation} dayMaster={result.dayMaster} />

          {/* L2 详情 Tab —— 命盘细节 / 人格画像 / 命理解读 / 大运流年 / 专题 / AI 问答 */}
          <ResultTabs
            result={result}
            annotation={annotation}
            sessionId={sessionId}
            showChat={showChat}
            onOpenChat={openChat}
            onCloseChat={closeChat}
          />

          {/* ═══ L3 命书层 ═══
              事实（四柱/格局/大运）引擎已免费给出；命书是 AI 把这些结论
              改写成有人味的完整长文，因此收点券。同命盘命中缓存不扣券。 */}
          <ReportSection
            loading={report.loading}
            error={report.error}
            cached={report.cached}
            hasReport={!!report.report}
            cost={CREDIT_COSTS.report?.credits ?? 5}
            onGenerate={() => void report.generate(sessionId)}
            onClose={report.close}
          >
            {report.report && <ReportView report={report.report} />}
          </ReportSection>
        </div>
      )}

      {/* 空状态 — 首屏能力引导 */}
      {!result && !loading && !error && <EmptyGuide />}
    </>
  )
}

// ════════════════════════════════════════════════════════════
// 非八字体系结果卡（本文件私有组件）
// ════════════════════════════════════════════════════════════

/** 星座产物（与 server/systems/astro.ts 的 AstroBundle 对齐） */
interface AstroPayload {
  sign: { index: number; name: string; en: string; element: string; since: string; until: string }
  birthAt: string
}

/** MBTI 产物（与 server/systems/mbti.ts 的 MbtiBundle 对齐） */
interface MbtiPayload {
  primaryType: string
  profile: {
    cognitiveFunctions: string
    typicalTypes: string[]
    traits: string
    portrait: string
    industrySuggestions: string[]
    energyAdjustments: string[]
  }
}

function SystemResultCard({ system, payload }: { system: string; payload: unknown }) {
  const card = 'rounded-md border border-line-soft bg-white shadow-[0_1px_3px_rgba(28,25,20,0.05)] px-4 py-5 sm:px-6'

  if (system === 'astro') {
    const p = payload as AstroPayload
    const s = p?.sign
    if (!s) return null
    return (
      <section className={card}>
        <h2 className="text-lg font-bold text-fg-primary tracking-wide serif">
          {s.name}
          <span className="ml-2 text-xs font-normal text-fg-secondary">{s.en}</span>
        </h2>
        <p className="mt-2 text-sm text-fg-secondary leading-relaxed">
          元素：{s.element} ｜ 太阳星座分界以<strong>中气时刻</strong>为准
          （与八字月支的「节」分界错开约 15°，故星座与八字月支常常不对应）。
        </p>
        <p className="mt-2 text-xs text-fg-tertiary leading-relaxed">
          本体系当前只提供太阳星座；月亮、上升需要星历计算，未提供前不做估算。
        </p>
      </section>
    )
  }

  if (system === 'mbti') {
    const p = payload as MbtiPayload
    const prof = p?.profile
    if (!prof) return null
    return (
      <section className={card}>
        <h2 className="text-lg font-bold text-fg-primary tracking-wide serif">
          {p.primaryType}
          <span className="ml-2 text-xs font-normal text-fg-secondary">
            {prof.typicalTypes.join(' / ')}
          </span>
        </h2>
        <p className="mt-2 text-sm text-fg-secondary leading-relaxed">{prof.portrait}</p>

        <dl className="mt-4 space-y-2 text-xs">
          <div>
            <dt className="text-fg-tertiary">认知功能</dt>
            <dd className="text-fg-secondary">{prof.cognitiveFunctions}</dd>
          </div>
          <div>
            <dt className="text-fg-tertiary">特质</dt>
            <dd className="text-fg-secondary">{prof.traits}</dd>
          </div>
          {prof.industrySuggestions?.length > 0 && (
            <div>
              <dt className="text-fg-tertiary">适配领域</dt>
              <dd className="text-fg-secondary">{prof.industrySuggestions.join('、')}</dd>
            </div>
          )}
          {prof.energyAdjustments?.length > 0 && (
            <div>
              <dt className="text-fg-tertiary">能量调节</dt>
              <dd className="text-fg-secondary">{prof.energyAdjustments.join('；')}</dd>
            </div>
          )}
        </dl>
        <p className="mt-3 text-xs text-fg-tertiary leading-relaxed">
          这是由生辰命盘推导的人格<strong>倾向</strong>，不是问卷测评结果。
        </p>
      </section>
    )
  }

  return null
}

// ════════════════════════════════════════════════════════════
// L3 命书区块（本文件私有组件，不对外导出以符合 react-refresh 规则）
// ════════════════════════════════════════════════════════════

interface ReportSectionProps {
  loading: boolean
  error: string | null
  cached: boolean
  hasReport: boolean
  cost: number
  onGenerate: () => void
  onClose: () => void
  children: ReactNode
}

function ReportSection({
  loading, error, cached, hasReport, cost, onGenerate, onClose, children,
}: ReportSectionProps) {
  // 已出命书时整块由 children 渲染（ReportView），外加关闭按钮
  if (hasReport) {
    return (
      <section className="space-y-2">
        {children}
        <div className="flex items-center justify-between">
          {cached && (
            <p className="text-xs text-fg-tertiary">
              命书来自缓存，本次未扣券
            </p>
          )}
          <button
            type="button"
            onClick={onClose}
            className="ml-auto min-h-[44px] px-4 rounded-sm border border-line-strong text-sm text-fg-secondary hover:text-fg-primary transition-colors"
          >
            收起命书
          </button>
        </div>
      </section>
    )
  }

  return (
    <section className="rounded-md border border-line-soft bg-white shadow-[0_1px_3px_rgba(28,25,20,0.05)] px-4 py-4 sm:px-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-medium text-fg-primary tracking-wide">
            📜 数字命书
          </h3>
          <p className="mt-1 text-xs text-fg-secondary leading-relaxed">
            把命盘结论写成一篇完整长文：人格底色、事业财运、婚姻感情、大运起伏。
            {cost > 0 ? `生成消耗 ${cost} 券；` : ''}
            同一张命盘再次生成会命中缓存，不再扣券。
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={onGenerate}
        disabled={loading}
        className="mt-3 w-full min-h-[44px] rounded-sm bg-brand text-white text-sm tracking-wide hover:opacity-90 disabled:opacity-50 transition-opacity"
      >
        {loading ? '命书生成中…（约需二三十秒）' : `生成我的命书${cost > 0 ? ` · ${cost} 券` : ''}`}
      </button>

      {error && (
        <p className="mt-2 text-xs text-cinnabar-600 leading-relaxed">{error}</p>
      )}
    </section>
  )
}
