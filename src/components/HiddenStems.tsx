import type { Pillar } from '../engine/types'

interface Props {
  yearPillar: Pillar
  monthPillar: Pillar
  dayPillar: Pillar
  hourPillar: Pillar
}

const PILLAR_LABELS = ['年柱', '月柱', '日柱', '时柱']

export default function HiddenStems(props: Props) {
  const pillars = [props.yearPillar, props.monthPillar, props.dayPillar, props.hourPillar]

  return (
    <div>
      <h3 className="chapter-title">地支藏干</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {pillars.map((p, i) => (
          <div key={i} className="ink-card text-center">
            <div className="text-xs text-[#B0A898] mb-1 tracking-wider">{PILLAR_LABELS[i]}</div>
            <div className="text-lg font-bold text-[#4A4438] mb-1" style={{ fontFamily: '"Noto Serif SC", serif' }}>
              {p.branch}
            </div>
            <div className="text-xs text-[#6B6459] tracking-wider">
              {p.hiddenStems.length > 0
                ? p.hiddenStems.join(' · ')
                : '—'}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
