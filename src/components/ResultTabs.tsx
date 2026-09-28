import { useState } from 'react'
import type { BaZiResult } from '../engine/types'
import type { AnnotationResult } from '../engine/annotation'
import HiddenStems from './HiddenStems'
import TenGods from './TenGods'
import LuckTimeline from './LuckTimeline'
import TopicTabs from './TopicTabs'
import AnnotationPanel from './AnnotationPanel'
import DayMasterStrength from './DayMasterStrength'
import ChatPanel from './ChatPanel'

type TabKey = 'chart' | 'reading' | 'luck' | 'topics' | 'chat'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'chart', label: '命盘细节' },
  { key: 'reading', label: '命理解读' },
  { key: 'luck', label: '大运流年' },
  { key: 'topics', label: '专题' },
  { key: 'chat', label: 'AI 问答' },
]

interface Props {
  result: BaZiResult
  annotation: AnnotationResult | null
  showChat: boolean
  onOpenChat: () => void
  onCloseChat: () => void
}

function Placeholder({ text }: { text: string }) {
  return <p className="py-8 text-center text-sm italic text-[#C4B8A8]">{text}</p>
}

/**
 * L2 详情区 —— 把原先 9 段等权堆叠的内容按主题收进 5 个 Tab。
 * 面板全部保持挂载（用 hidden 切换），避免切走时丢失 ChatPanel 的会话状态。
 */
export default function ResultTabs({ result, annotation, showChat, onOpenChat, onCloseChat }: Props) {
  const [active, setActive] = useState<TabKey>('chart')

  const placeholderFor = (key: TabKey) =>
    key === 'reading' ? '批注生成中…' : key === 'topics' ? '暂无专题分析' : '数据准备中…'

  return (
    <section className="rounded-md border border-[#E4DED3] bg-white overflow-hidden">
      <div role="tablist" aria-label="命盘详情" className="flex border-b border-[#E8E3D9] overflow-x-auto">
        {TABS.map(t => {
          const selected = active === t.key
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setActive(t.key)}
              className={`relative shrink-0 px-4 py-3 text-sm tracking-wider whitespace-nowrap transition-colors ${
                selected ? 'text-[#B83A2E] font-medium' : 'text-[#B0A898] hover:text-[#6B6459]'
              }`}
            >
              {t.label}
              {selected && (
                <span className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-[#B83A2E]" />
              )}
            </button>
          )
        })}
      </div>

      <div className="p-4 sm:p-5">
        {/* 命盘细节：只依赖 result */}
        <div role="tabpanel" hidden={active !== 'chart'} className="space-y-6">
          <HiddenStems
            yearPillar={result.yearPillar}
            monthPillar={result.monthPillar}
            dayPillar={result.dayPillar}
            hourPillar={result.hourPillar}
          />
          <TenGods tenGods={result.tenGods} />
        </div>

        <div role="tabpanel" hidden={active !== 'reading'}>
          {annotation ? (
            <div className="space-y-6">
              <DayMasterStrength analysis={annotation.strengthAnalysis} dayMaster={result.dayMaster} />
              <AnnotationPanel annotation={annotation} />
            </div>
          ) : (
            <Placeholder text={placeholderFor('reading')} />
          )}
        </div>

        <div role="tabpanel" hidden={active !== 'luck'}>
          <LuckTimeline
            daYun={result.daYun}
            currentDaYun={result.currentDaYun}
            luckAnalysis={annotation?.luckAnalysis}
          />
        </div>

        <div role="tabpanel" hidden={active !== 'topics'}>
          {annotation?.specialTopics
            ? <TopicTabs specialTopics={annotation.specialTopics} />
            : <Placeholder text={placeholderFor('topics')} />}
        </div>

        <div role="tabpanel" hidden={active !== 'chat'}>
          {!annotation ? (
            <Placeholder text="数据准备中…" />
          ) : showChat ? (
            <ChatPanel chart={result} annotation={annotation} onClose={onCloseChat} />
          ) : (
            <button
              type="button"
              onClick={onOpenChat}
              className="w-full rounded-sm border border-dashed border-[#B83A2E] bg-[#FDF8F5] py-3 px-4 text-sm font-bold tracking-wider text-[#B83A2E] transition-colors hover:bg-[#F9F0EB]"
            >
              向墨白提问命理问题
            </button>
          )}
        </div>
      </div>
    </section>
  )
}
