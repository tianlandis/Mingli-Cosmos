import type { DaYun } from '../engine/types'

interface Props {
  daYun: DaYun[]
  currentDaYun: DaYun | null
  currentYear: { stem: string; branch: string; ganZhi: string }
}

export default function LuckCycle({ daYun, currentDaYun, currentYear }: Props) {
  const direction = daYun[0]?.isForward ? '顺行' : '逆行'

  return (
    <div className="bg-stone-900/80 backdrop-blur rounded-2xl border border-amber-700/30 p-6 shadow-xl">
      <h2 className="text-lg font-bold text-amber-400 mb-4 border-b border-amber-700/20 pb-2">
        大运流年
        <span className="text-sm text-stone-400 ml-3 font-normal">
          当前流年：<span className="text-amber-300 font-bold">{currentYear.ganZhi}</span>
        </span>
      </h2>

      <div className="flex flex-wrap gap-2 mb-4 text-xs">
        <span className="rounded-full bg-stone-800/70 px-3 py-1 text-stone-300">大运{direction}</span>
        {currentDaYun ? (
          <span className="rounded-full bg-amber-900/40 px-3 py-1 text-amber-200">
            当前大运：{currentDaYun.ganZhi}（{currentDaYun.startYear}-{currentDaYun.endYear}）
          </span>
        ) : (
          <span className="rounded-full bg-stone-800/70 px-3 py-1 text-stone-400">当前尚未进入列表内大运</span>
        )}
      </div>

      {/* 大运时间线 */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {daYun.map((dy, i) => {
          const isActive = currentDaYun && dy.startAge === currentDaYun.startAge
          return (
            <div
              key={i}
              className={`flex-shrink-0 w-28 rounded-xl p-3 text-center transition-all ${
                isActive
                  ? 'bg-amber-800/60 ring-2 ring-amber-500'
                  : 'bg-stone-800/50'
              }`}
            >
              <div className="text-xs text-stone-500">{dy.startAge}岁起</div>
              <div className={`text-lg font-bold mt-1 ${isActive ? 'text-amber-200' : 'text-stone-300'}`}>
                {dy.ganZhi}
              </div>
              <div className="text-xs text-stone-500 mt-1">
                {dy.startYear}-{dy.endYear}
              </div>
              {isActive && (
                <div className="text-xs text-amber-400 mt-1 font-bold">● 当前</div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
