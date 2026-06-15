import Header from './components/Header'
import BirthForm from './components/BirthForm'
import BaziChart from './components/BaziChart'
import HiddenStems from './components/HiddenStems'
import NaYin from './components/NaYin'
import FiveElements from './components/FiveElements'
import TenGods from './components/TenGods'
import LuckCycle from './components/LuckCycle'
import AnnotationPanel from './components/AnnotationPanel'
import { useBazi } from './hooks/useBazi'

export default function App() {
  const { result, annotation, loading, error, handleCalculate } = useBazi()

  return (
    <div className="min-h-screen bg-[#1a1410] flex flex-col">
      <Header />

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6">
        {/* 输入区 */}
        <div className="mb-6">
          <BirthForm onCalculate={handleCalculate} />
        </div>

        {/* Loading */}
        {loading && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-3 border-amber-700 border-t-transparent" />
            <p className="text-stone-400 mt-3">计算中...</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-900/30 border border-red-700/50 rounded-xl p-4 text-red-300 text-center">
            {error}
          </div>
        )}

        {/* 结果 */}
        {result && !loading && (
          <div className="space-y-4 animate-in fade-in duration-500">
            {/* 八字主表 */}
            <BaziChart
              yearPillar={result.yearPillar}
              monthPillar={result.monthPillar}
              dayPillar={result.dayPillar}
              hourPillar={result.hourPillar}
              dayMaster={result.dayMaster}
            />

            {/* 藏干 & 纳音 并排 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <HiddenStems
                yearPillar={result.yearPillar}
                monthPillar={result.monthPillar}
                dayPillar={result.dayPillar}
                hourPillar={result.hourPillar}
              />
              <NaYin
                yearPillar={result.yearPillar}
                monthPillar={result.monthPillar}
                dayPillar={result.dayPillar}
                hourPillar={result.hourPillar}
              />
            </div>

            {/* 五行 & 十神 并排 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FiveElements fiveElements={result.fiveElements} />
              <TenGods tenGods={result.tenGods} />
            </div>

            {/* 大运流年 */}
            <LuckCycle
              daYun={result.daYun}
              currentDaYun={result.currentDaYun}
              currentYear={result.currentYear}
            />

            {/* 命盘批注 */}
            {annotation && <AnnotationPanel annotation={annotation} />}
          </div>
        )}

        {/* 空状态 */}
        {!result && !loading && !error && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">☯</div>
            <p className="text-stone-500 text-lg">请输入出生信息，点击「排盘」查看命盘</p>
          </div>
        )}
      </main>

      <footer className="text-center py-4 text-stone-600 text-xs border-t border-stone-800">
        八字排盘 · 四柱八字命理工具 · 仅供参考
      </footer>
    </div>
  )
}
