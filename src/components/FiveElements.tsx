import { WUXING_COLORS, WUXING_LIST } from '../engine/types'

interface Props {
  fiveElements: Record<string, number>
}

export default function FiveElements({ fiveElements }: Props) {
  const maxVal = Math.max(...Object.values(fiveElements), 1)

  return (
    <div className="bg-stone-900/80 backdrop-blur rounded-2xl border border-amber-700/30 p-6 shadow-xl">
      <h2 className="text-lg font-bold text-amber-400 mb-4 border-b border-amber-700/20 pb-2">五行分布</h2>
      <div className="flex gap-3 items-end h-40">
        {WUXING_LIST.map(wx => {
          const count = fiveElements[wx] ?? 0
          const height = Math.max((count / maxVal) * 100, 4)
          const color = WUXING_COLORS[wx] ?? '#888'
          return (
            <div key={wx} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-sm font-bold text-stone-300">{count}</span>
              <div
                className="w-full rounded-t-lg transition-all duration-500 min-h-[4px]"
                style={{ height: `${height}%`, backgroundColor: color }}
              />
              <span className="text-xs text-stone-500 mt-1">{wx}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
