import { useState } from 'react'
import Header from './components/Header'
import BirthForm from './components/BirthForm'
import BaziChart from './components/BaziChart'
import HiddenStems from './components/HiddenStems'
import FiveElements from './components/FiveElements'
import TenGods from './components/TenGods'
import LuckTimeline from './components/LuckTimeline'
import TopicTabs from './components/TopicTabs'
import AnnotationPanel from './components/AnnotationPanel'
import ChatPanel from './components/ChatPanel'
import { useBazi } from './hooks/useBazi'

export default function App() {
  const { result, annotation, loading, error, handleCalculate } = useBazi()
  const [showChat, setShowChat] = useState(false)

  return (
    <div className="min-h-screen bg-[#FBF7F0] flex flex-col">
      <Header />

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 md:px-8 lg:pr-24 py-6">
        {/* 输入区 — 紧凑工具栏 */}
        <div className="mb-8">
          <BirthForm onCalculate={handleCalculate} />
        </div>

        {/* Loading */}
        {loading && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-[#B83A2E] border-t-transparent" />
            <p className="text-[#6B6459] mt-3 text-sm">计算中...</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-[#F5EDEB] border border-[#D4A8A4] rounded-sm p-4 text-[#9B2C22] text-sm text-center">
            {error}
          </div>
        )}

        {/* 结果 — 命书章节流式布局 */}
        {result && !loading && (
          <div className="animate-in fade-in duration-500">
            {/* 命盘英雄区 */}
            <BaziChart
              yearPillar={result.yearPillar}
              monthPillar={result.monthPillar}
              dayPillar={result.dayPillar}
              hourPillar={result.hourPillar}
              dayMaster={result.dayMaster}
            />

            {/* 藏干 */}
            <div className="chapter">
              <HiddenStems
                yearPillar={result.yearPillar}
                monthPillar={result.monthPillar}
                dayPillar={result.dayPillar}
                hourPillar={result.hourPillar}
              />
            </div>

            {/* 五行 & 十神 并排 */}
            <div className="chapter">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FiveElements fiveElements={result.fiveElements} />
                <TenGods tenGods={result.tenGods} />
              </div>
            </div>

            {/* 大运竖轴 — 时间线 */}
            <div className="chapter">
              <LuckTimeline
                daYun={result.daYun}
                currentDaYun={result.currentDaYun}
                luckAnalysis={annotation?.luckAnalysis}
              />
            </div>

            {/* 命盘批注 */}
            {annotation && (
              <div className="chapter">
                <AnnotationPanel annotation={annotation} />
              </div>
            )}

            {/* 专题 Tab */}
            {annotation?.specialTopics && (
              <div className="chapter">
                <TopicTabs specialTopics={annotation.specialTopics} />
              </div>
            )}

            {/* A 模式入口 + 对话面板 */}
            {annotation && (
              <div className="chapter">
                {!showChat ? (
                  <button
                    type="button"
                    onClick={() => setShowChat(true)}
                    className="w-full py-3 px-4 rounded-sm border border-dashed border-[#B83A2E] bg-[#FDF8F5] text-[#B83A2E] text-sm font-bold tracking-wider hover:bg-[#F9F0EB] transition-colors"
                  >
                    🧘 向墨白提问命理问题
                  </button>
                ) : (
                  <ChatPanel
                    chart={result}
                    annotation={annotation}
                    onClose={() => setShowChat(false)}
                  />
                )}
              </div>
            )}
          </div>
        )}

        {/* 空状态 */}
        {!result && !loading && !error && (
          <div className="text-center py-16">
            <div className="text-5xl mb-4 opacity-30">☯</div>
            <p className="text-[#B0A898] text-sm tracking-wider">请输入出生信息，点击「排盘」查看命盘</p>
          </div>
        )}
      </main>

      <footer className="text-center py-4 text-[#B0A898] text-xs border-t border-[#D8D2C8] tracking-wider">
        八字排盘 · 四柱八字命理工具 · 仅供参考
      </footer>
    </div>
  )
}
