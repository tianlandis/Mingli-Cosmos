import type { Pillar } from '../engine/types'

interface Props {
  yearPillar: Pillar
  monthPillar: Pillar
  dayPillar: Pillar
  hourPillar: Pillar
  dayMaster: string
}

const PILLAR_LABELS = ['年柱', '月柱', '日柱', '时柱']

export default function BaziChart({ yearPillar, monthPillar, dayPillar, hourPillar, dayMaster }: Props) {
  const pillars = [yearPillar, monthPillar, dayPillar, hourPillar]

  return (
    <div className="text-center py-6">
      {/* 四柱大字 — 命盘英雄 */}
      <div className="grid grid-cols-4 gap-2 md:gap-4 max-w-md mx-auto mb-4">
        {pillars.map((p, i) => {
          const isDay = i === 2
          return (
            <div key={i} className="text-center">
              <div className="text-xs text-[#B0A898] mb-2 tracking-wider">{PILLAR_LABELS[i]}</div>
              {/* 天干 */}
              <div
                className={
                  isDay
                    ? 'seal-stamp text-3xl md:text-4xl mx-auto mb-1.5 w-14 h-14 md:w-16 md:h-16'
                    : 'text-3xl md:text-4xl font-bold text-[#1C1914] mb-1.5'
                }
                style={isDay ? undefined : { fontFamily: '"Noto Serif SC", serif' }}
              >
                {p.stem}
              </div>
              {/* 地支 */}
              <div
                className="text-3xl md:text-4xl font-bold text-[#4A4438]"
                style={{ fontFamily: '"Noto Serif SC", serif' }}
              >
                {p.branch}
              </div>
              {/* 五行标签 */}
              <div className="text-xs text-[#B0A898] mt-1 tracking-wider">
                {p.stemWuXing}{p.branchWuXing}
              </div>
            </div>
          )
        })}
      </div>

      {/* 命盘署名 */}
      <div className="text-center text-xs text-[#B0A898] tracking-widest mt-4">
        日主 <span className="text-[#B83A2E] font-bold text-sm" style={{ fontFamily: '"Noto Serif SC", serif' }}>{dayMaster}</span>
        <span className="mx-1.5 opacity-30">|</span>
        四柱八字命盘
      </div>
    </div>
  )
}
