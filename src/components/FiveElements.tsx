import { WUXING_LIST } from '../engine/types'
import { wxColor } from '../lib/wuxing'

interface Props {
  fiveElements: Record<string, number>
}

export default function FiveElements({ fiveElements }: Props) {
  const maxVal = Math.max(...Object.values(fiveElements), 1)

  return (
    <div>
      <h3 className="chapter-title">五行分布</h3>
      <div className="space-y-2.5">
        {WUXING_LIST.map(wx => {
          const count = fiveElements[wx] ?? 0
          const pct = Math.max((count / maxVal) * 100, 8)
          const color = wxColor(wx)
          return (
            <div key={wx} className="flex items-center gap-3">
              <span className="w-6 text-sm font-bold shrink-0" style={{ color }}>
                {wx}
              </span>
              <div className="flex-1 h-2.5 bg-[#E8E3D9] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${pct}%`, backgroundColor: color }}
                />
              </div>
              <span className="w-4 text-right text-xs font-medium text-[#6B6459]">{count}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
