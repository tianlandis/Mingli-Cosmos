import { useState } from 'react'
import type { SpecialTopics } from '../engine/annotation/types'

interface Props {
  specialTopics: SpecialTopics
}

type TopicKey = keyof SpecialTopics

type TabConfig = {
  key: TopicKey
  label: string
  icon: string
}

const TAB_CONFIG: TabConfig[] = [
  { key: 'personality', label: '性格', icon: '🧠' },
  { key: 'career', label: '事业', icon: '💼' },
  { key: 'wealth', label: '财运', icon: '💰' },
  { key: 'marriage', label: '婚姻', icon: '💍' },
  { key: 'health', label: '健康', icon: '❤️' },
  { key: 'children', label: '子女', icon: '👶' },
]

export default function TopicTabs({ specialTopics }: Props) {
  const [active, setActive] = useState<TopicKey>('personality')

  const activeItems = specialTopics[active] ?? []

  return (
    <div>
      <h3 className="chapter-title">专题批注</h3>

      {/* Tab 标签栏 */}
      <div className="flex border-b border-[#D8D2C8] mb-4 overflow-x-auto -mx-1 px-1">
        {TAB_CONFIG.map((tab) => {
          const isActive = active === tab.key
          const itemCount = specialTopics[tab.key]?.length ?? 0
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActive(tab.key)}
              disabled={itemCount === 0}
              className={`relative shrink-0 px-4 py-2.5 text-sm font-medium tracking-wider transition-colors whitespace-nowrap
                ${isActive
                  ? 'text-[#B83A2E]'
                  : itemCount === 0
                    ? 'text-[#D8D2C8] cursor-not-allowed'
                    : 'text-[#B0A898] hover:text-[#6B6459]'
                }
              `}
            >
              <span className="mr-1.5">{tab.icon}</span>
              {tab.label}
              {itemCount > 0 && (
                <span
                  className={`ml-1.5 text-xs ${
                    isActive ? 'text-[#B83A2E]' : 'text-[#C4B8A8]'
                  }`}
                >
                  {itemCount}
                </span>
              )}
              {/* 下划线 */}
              {isActive && (
                <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-[#B83A2E] rounded-full" />
              )}
            </button>
          )
        })}
      </div>

      {/* Tab 内容区 */}
      <div className="ink-card min-h-[120px]">
        {activeItems.length === 0 ? (
          <p className="text-[#C4B8A8] text-sm py-4 text-center italic">
            暂无{TAB_CONFIG.find((t) => t.key === active)?.label}专题分析
          </p>
        ) : (
          <ul className="space-y-2.5">
            {activeItems.map((tip, i) => (
              <li
                key={i}
                className="text-[#6B6459] text-sm leading-relaxed flex items-start gap-2"
              >
                <span className="text-[#C4B8A8] shrink-0 mt-0.5 font-bold">·</span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
