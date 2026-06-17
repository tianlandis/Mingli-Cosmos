import type { DaYun } from '../engine/types'

interface Props {
  daYun: DaYun[]
  currentDaYun: DaYun | null
  currentYear: { stem: string; branch: string; ganZhi: string }
}

export default function LuckCycle({ daYun, currentDaYun, currentYear }: Props) {
  const direction = daYun[0]?.isForward ? '顺行' : '逆行'

  return (
    <div>
      <h3 className="chapter-title">
        大运流年
        <span className="text-xs text-[#B0A898] ml-3 font-normal tracking-wider">
          流年 {currentYear.ganZhi}
        </span>
      </h3>

      {/* 当前状态标签 */}
      <div className="flex flex-wrap gap-2 mb-4">
        <span className="ink-tag">大运{direction}</span>
        {currentDaYun ? (
          <span className="ink-tag active">
            当前 {currentDaYun.ganZhi}（{currentDaYun.startYear}-{currentDaYun.endYear}）
          </span>
        ) : (
          <span className="ink-tag">尚未进入列表内大运</span>
        )}
      </div>

      {/* 大运时间线 */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {daYun.map((dy, i) => {
          const isActive = currentDaYun && dy.startAge === currentDaYun.startAge
          return (
            <div
              key={i}
              className={`flex-shrink-0 w-28 rounded-sm p-3 text-center transition-all ${
                isActive
                  ? 'bg-[#F5EDEB] ring-2 ring-[#B83A2E]'
                  : 'ink-card'
              }`}
            >
              <div className="text-xs text-[#B0A898]">{dy.startAge}岁起</div>
              <div
                className={`text-lg font-bold mt-1 ${isActive ? 'text-[#9B2C22]' : 'text-[#1C1914]'}`}
                style={{ fontFamily: '"Noto Serif SC", serif' }}
              >
                {dy.ganZhi}
              </div>
              <div className="text-xs text-[#B0A898] mt-1">
                {dy.startYear}-{dy.endYear}
              </div>
              {isActive && (
                <div className="text-xs text-[#B83A2E] mt-1 font-bold">● 当前</div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
