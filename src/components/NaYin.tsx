import type { Pillar } from '../engine/types'

interface Props {
  yearPillar: Pillar
  monthPillar: Pillar
  dayPillar: Pillar
  hourPillar: Pillar
}

const PILLAR_LABELS = ['年柱', '月柱', '日柱', '时柱']

export default function NaYin({ yearPillar, monthPillar, dayPillar, hourPillar }: Props) {
  const pillars = [yearPillar, monthPillar, dayPillar, hourPillar]

  return (
    <div className="bg-stone-900/80 backdrop-blur rounded-2xl border border-amber-700/30 p-6 shadow-xl">
      <h2 className="text-lg font-bold text-amber-400 mb-4 border-b border-amber-700/20 pb-2">纳音五行</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {pillars.map((p, i) => (
          <div key={i} className="text-center bg-stone-800/50 rounded-xl p-3">
            <div className="text-xs text-stone-500 mb-1">{PILLAR_LABELS[i]}</div>
            <div className="text-base font-bold text-amber-300 mb-1">{p.ganZhi}</div>
            <div className="text-sm text-amber-500/80">{p.naYin || '-'}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
