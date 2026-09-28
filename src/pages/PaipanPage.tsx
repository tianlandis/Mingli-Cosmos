// ============================================================
// 排盘页（路由 `/`）
// 文件：src/pages/PaipanPage.tsx
//
// 结构：表单 → L0 命盘 → L1 速读 → L2 详情
// 状态来源：外壳层（useShell），保证切到「我的」再切回不丢命盘。
// ============================================================

import BirthForm from '../components/BirthForm'
import BaziChart from '../components/BaziChart'
import ElementBar from '../components/ElementBar'
import ResultSummary from '../components/ResultSummary'
import ResultTabs from '../components/ResultTabs'
import { EmptyGuide, ErrorNotice, LoadingBar } from '../components/StateBlocks'
import { useShell } from '../lib/shell'

export default function PaipanPage() {
  const {
    result, annotation, loading, error, calculate,
    showChat, openChat, closeChat,
  } = useShell()

  return (
    <>
      {/* 输入区 — 卡片式生辰录入 */}
      <div className="mb-5">
        <BirthForm onCalculate={calculate} loading={loading} />
      </div>

      {/* 加载 / 错误 —— 紧凑内联，不挤占结果区 */}
      {loading && <LoadingBar />}
      {error && <ErrorNotice message={error} />}

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
            showChat={showChat}
            onOpenChat={openChat}
            onCloseChat={closeChat}
          />
        </div>
      )}

      {/* 空状态 — 首屏能力引导 */}
      {!result && !loading && !error && <EmptyGuide />}
    </>
  )
}
