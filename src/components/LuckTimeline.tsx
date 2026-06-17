import type { DaYun } from '../engine/types'
import type { DaYunAnalysisItem, CurrentYearAnalysis, Milestone } from '../engine/annotation/types'

interface Props {
  daYun: DaYun[]
  currentDaYun: DaYun | null
  /** 可选批注数据，缺失时纯展示干支/年份 */
  luckAnalysis?: {
    daYunList: DaYunAnalysisItem[]
    currentYear: CurrentYearAnalysis
    milestones: Milestone[]
  }
}

export default function LuckTimeline({ daYun, currentDaYun, luckAnalysis }: Props) {
  // ── 合并原始大运 + 批注数据 ──
  const merged = daYun.map((dy) => {
    const annotation = luckAnalysis?.daYunList?.find(
      (a) =>
        a.startAge === dy.startAge &&
        a.ganZhi === dy.ganZhi,
    )
    return { ...dy, annotation }
  })

  const direction = merged[0]?.isForward ? '顺行' : '逆行'

  // ── 辅助渲染函数 ──
  const qualityColor = (q: string | undefined) => {
    if (q === '佳') return 'text-[#4A7C3F] bg-[#E8F0E4]'
    if (q === '不佳') return 'text-[#B83A2E] bg-[#F5EDEB]'
    return 'text-[#B0A898] bg-[#EDE8DF]'
  }

  const qualityLabel = (q: string | undefined) => {
    if (q === '佳') return '佳'
    if (q === '不佳') return '不佳'
    if (q === '平') return '平'
    return ''
  }

  return (
    <div>
      <h3 className="chapter-title">
        大运竖轴
        <span className="text-xs text-[#B0A898] ml-3 font-normal tracking-wider">
          {direction} · 共 {merged.length} 步
        </span>
      </h3>

      {/* 当前流年提示 */}
      {luckAnalysis?.currentYear && (
        <div className="mb-5 bg-[#FEF9F0] border border-[#E0D8C0] rounded-sm px-4 py-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[#B8973E] text-xs font-bold tracking-wider">当前流年</span>
            <span
              className="text-[#8A6D20] text-sm font-bold"
              style={{ fontFamily: '"Noto Serif SC", serif' }}
            >
              {luckAnalysis.currentYear.ganZhi}
            </span>
          </div>
          {luckAnalysis.currentYear.interpretation && (
            <p className="text-[#6B6459] text-xs leading-relaxed">
              {luckAnalysis.currentYear.interpretation}
            </p>
          )}
          {luckAnalysis.currentYear.focus?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {luckAnalysis.currentYear.focus.map((f, i) => (
                <span key={i} className="ink-tag active text-xs px-2 py-0.5">
                  {f}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── 竖向时间轴 ── */}
      <div className="relative">
        {merged.length === 0 && (
          <p className="text-[#B0A898] text-sm py-4 text-center">暂无大运数据</p>
        )}

        {merged.map((dy, i) => {
          const isActive =
            !!currentDaYun &&
            dy.startAge === currentDaYun.startAge &&
            dy.ganZhi === currentDaYun.ganZhi

          const quality = (dy as typeof dy & { annotation?: DaYunAnalysisItem }).annotation?.quality

          return (
            <div key={i} className="flex items-stretch">
              {/* 左侧：年龄标记 + 竖线 */}
              <div className="relative flex flex-col items-center w-14 shrink-0">
                {/* 连接线 */}
                {i > 0 && (
                  <div
                    className={`absolute top-0 -translate-y-1/2 w-0.5 h-3 ${isActive ? 'bg-[#B83A2E]' : 'bg-[#D8D2C8]'}`}
                    style={{ left: '50%', transform: 'translateX(-50%)' }}
                  />
                )}
                {/* 圆点 */}
                <div
                  className={`relative z-10 mt-3 w-3 h-3 rounded-full border-2 ${
                    isActive
                      ? 'bg-[#B83A2E] border-[#B83A2E] ring-2 ring-[#B83A2E]/20'
                      : 'border-[#C4B8A8] bg-[#FBF7F0]'
                  }`}
                />
                {/* 年龄文字 */}
                <span
                  className={`mt-1 text-xs font-bold ${isActive ? 'text-[#9B2C22]' : 'text-[#B0A898]'}`}
                >
                  {dy.startAge}岁
                </span>
                {/* 竖轴线到下一个节点 */}
                {i < merged.length - 1 && (
                  <div className="flex-1 w-0.5 bg-[#D8D2C8] min-h-[28px]" />
                )}
              </div>

              {/* 右侧：内容卡片 */}
              <div
                className={`flex-1 ml-3 mb-3 rounded-sm px-4 py-3 transition-colors ${
                  isActive
                    ? 'bg-[#FDF5F3] border border-[#D4A8A4]'
                    : 'bg-[#F5F2EB] border border-transparent'
                }`}
              >
                <div className="flex items-center gap-3 mb-1 flex-wrap">
                  {/* 干支 */}
                  <span
                    className={`text-base font-bold ${isActive ? 'text-[#9B2C22]' : 'text-[#1C1914]'}`}
                    style={{ fontFamily: '"Noto Serif SC", serif' }}
                  >
                    {dy.ganZhi}
                  </span>
                  {/* 年份范围 */}
                  <span className="text-[#B0A898] text-xs">
                    {dy.startYear} – {dy.endYear}年 · {dy.startAge}–{dy.endAge}岁
                  </span>
                  {/* 当前大运标签 */}
                  {isActive && (
                    <span className="text-xs font-bold text-[#B83A2E] bg-[#B83A2E]/10 px-2 py-0.5 rounded-full">
                      ● 当前大运
                    </span>
                  )}
                  {/* 品质徽章 */}
                  {quality && (
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded-sm ml-auto shrink-0 ${qualityColor(quality)}`}
                    >
                      {qualityLabel(quality)}
                    </span>
                  )}
                </div>

                {/* 解读文字 */}
                {((dy as typeof dy & { annotation?: DaYunAnalysisItem }).annotation
                  ?.interpretation) ? (
                  <p className="text-[#6B6459] text-xs leading-relaxed mt-1.5">
                    {(dy as typeof dy & { annotation?: DaYunAnalysisItem }).annotation!.interpretation}
                  </p>
                ) : (
                  <p className="text-[#C4B8A8] text-xs italic mt-1.5">暂无解读</p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* ── 人生关键节点 ── */}
      {luckAnalysis?.milestones && luckAnalysis.milestones.length > 0 && (
        <div className="mt-6 pt-5 border-t border-[#D8D2C8]">
          <div className="text-[#B83A2E] text-xs font-bold mb-3 tracking-wider">
            人生关键节点
          </div>
          <div className="flex flex-wrap gap-2">
            {luckAnalysis.milestones.slice(0, 8).map((m, i) => (
              <div
                key={i}
                className="bg-white/50 border border-[#E0DBD0] rounded-sm px-3 py-2"
              >
                <div className="text-[#1C1914] text-xs font-bold">
                  {m.age}岁 ({m.year}年)
                </div>
                <div className="text-[#B0A898] text-xs mt-0.5">{m.event}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
