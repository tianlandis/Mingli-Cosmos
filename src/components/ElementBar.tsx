import { WUXING_LIST } from '../engine/types'
import { wxColor } from '../lib/wuxing'

interface Props {
  fiveElements: Record<string, number>
}

/**
 * L0 命盘卡内的五行占比：横向五等分，只依赖 result，随命盘一起首帧渲染。
 * 与 FiveElements（L2 详情里的竖排长条）区分：这里只做"一眼看分布"。
 */
export default function ElementBar({ fiveElements }: Props) {
  const total = Object.values(fiveElements).reduce((a, b) => a + b, 0) || 1

  return (
    <div className="grid grid-cols-5 gap-2 mt-4 pt-4 border-t border-[#E8E3D9]">
      {WUXING_LIST.map(wx => {
        const count = fiveElements[wx] ?? 0
        const pct = Math.round((count / total) * 100)
        const color = wxColor(wx)
        return (
          <div key={wx} className="text-center">
            <div className="h-1.5 rounded-full bg-[#EDE8DF] overflow-hidden mb-2">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.max(pct, 4)}%`, backgroundColor: color }}
              />
            </div>
            <div className="flex items-baseline justify-center gap-1">
              <span className="text-xs font-bold" style={{ color }}>{wx}</span>
              <span className="text-[11px] text-[#B0A898] tabular-nums">{count}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
