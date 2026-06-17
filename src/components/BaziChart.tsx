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
    <div className="bg-stone-900/80 backdrop-blur rounded-2xl border border-amber-700/30 p-6 shadow-xl">
      <h2 className="text-lg font-bold text-amber-400 mb-4 border-b border-amber-700/20 pb-2">
        四柱八字
        <span className="text-sm text-stone-400 ml-3 font-normal">
          日主：<span className="text-red-400 font-bold text-lg">{dayMaster}</span>
        </span>
      </h2>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {pillars.map((p, i) => (
          <div key={i} className="text-center">
            <div className="text-xs text-stone-500 mb-1">{PILLAR_LABELS[i]}</div>
            {/* 天干 */}
            <div className={`text-3xl md:text-4xl font-bold py-2 rounded-t-xl ${
              i === 2 ? 'text-red-400 bg-red-900/20' : 'text-amber-200 bg-stone-800/50'
            }`}>
              {p.stem}
            </div>
            {/* 地支 */}
            <div className={`text-3xl md:text-4xl font-bold py-2 bg-stone-800/30 ${
              i === 2 ? 'text-red-300' : 'text-stone-200'
            }`}>
              {p.branch}
            </div>
            {/* 五行 */}
            <div className="text-xs text-stone-400 mt-1">
              {p.stemWuXing}{p.branchWuXing}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
