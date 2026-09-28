import { useEffect, useRef, useState } from 'react'
import { Sparkles } from 'lucide-react'
import type { BaZiResult } from '../engine/types'
import type { AnnotationResult } from '../engine/annotation'
import HiddenStems from './HiddenStems'
import TenGods from './TenGods'
import LuckTimeline from './LuckTimeline'
import TopicTabs from './TopicTabs'
import AnnotationPanel from './AnnotationPanel'
import DayMasterStrength from './DayMasterStrength'
import PersonalityProfile from './PersonalityProfile'
import ChatPanel from './ChatPanel'

type TabKey = 'chart' | 'personality' | 'reading' | 'luck' | 'topics' | 'chat'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'chart', label: '命盘细节' },
  { key: 'personality', label: '人格画像' },
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
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
      <Sparkles size={18} className="text-neutral-300" aria-hidden="true" />
      <p className="text-sm text-fg-tertiary">{text}</p>
    </div>
  )
}

/**
 * L2 详情区 —— 把原先 9 段等权堆叠的内容按主题收进 6 个 Tab。
 *
 * 两个关键实现约束：
 *   1. 面板全部保持挂载（用 hidden 切换），避免切走时丢失 ChatPanel 的会话状态；
 *   2. 完整键盘可达：← / → / Home / End 在 Tab 间移动焦点并激活（WCAG 2.1）。
 */
export default function ResultTabs({ result, annotation, showChat, onOpenChat, onCloseChat }: Props) {
  const [active, setActive] = useState<TabKey>('chart')
  const tabRefs = useRef<Partial<Record<TabKey, HTMLButtonElement | null>>>({})

  const placeholderFor = (key: TabKey) =>
    key === 'reading' ? '批注生成中…'
      : key === 'personality' ? '人格画像生成中…'
        : key === 'topics' ? '暂无专题分析' : '数据准备中…'

  // 切换 Tab 后把当前标签滚入视野（移动端标签栏可横向滚动）
  useEffect(() => {
    tabRefs.current[active]?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' })
  }, [active])

  // 标准 roving tabindex：方向键在其中移动并同步激活
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const idx = TABS.findIndex(t => t.key === active)
    let next: number | null = null
    if (e.key === 'ArrowRight') next = (idx + 1) % TABS.length
    else if (e.key === 'ArrowLeft') next = (idx - 1 + TABS.length) % TABS.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = TABS.length - 1
    if (next === null) return
    e.preventDefault()
    const key = TABS[next].key
    setActive(key)
    tabRefs.current[key]?.focus()
  }

  return (
    <section className="rounded-md border border-line-soft bg-white">
      {/* 移动端：标签栏吸顶，长内容滚动时无需回顶部即可切 Tab */}
      <div
        role="tablist"
        aria-label="命盘详情"
        aria-orientation="horizontal"
        onKeyDown={onKeyDown}
        className="flex border-b border-paper-350 overflow-x-auto rounded-t-md sticky top-0 z-20 bg-white/95 backdrop-blur-sm"
      >
        {TABS.map(t => {
          const selected = active === t.key
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              id={`tab-${t.key}`}
              ref={el => { tabRefs.current[t.key] = el }}
              aria-selected={selected}
              aria-controls={`panel-${t.key}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(t.key)}
              className={`relative shrink-0 px-4 py-3.5 sm:py-3 text-sm tracking-wider whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset ${
                selected ? 'text-brand font-medium' : 'text-fg-tertiary hover:text-fg-secondary'
              }`}
            >
              {t.label}
              {selected && (
                <span className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-brand" />
              )}
            </button>
          )
        })}
      </div>

      <div className="p-4 sm:p-5 rounded-b-md">
        {/* 命盘细节：只依赖 result */}
        <div role="tabpanel" id="panel-chart" aria-labelledby="tab-chart" tabIndex={0} hidden={active !== 'chart'} className="space-y-6">
          <HiddenStems
            yearPillar={result.yearPillar}
            monthPillar={result.monthPillar}
            dayPillar={result.dayPillar}
            hourPillar={result.hourPillar}
          />
          <TenGods tenGods={result.tenGods} />
        </div>

        {/* 人格画像：16 型人格（规则引擎产出，非 LLM） */}
        <div role="tabpanel" id="panel-personality" aria-labelledby="tab-personality" tabIndex={0} hidden={active !== 'personality'}>
          {annotation ? (
            <PersonalityProfile mbti={annotation.patternAnalysis.mbti} />
          ) : (
            <Placeholder text={placeholderFor('personality')} />
          )}
        </div>

        <div role="tabpanel" id="panel-reading" aria-labelledby="tab-reading" tabIndex={0} hidden={active !== 'reading'}>
          {annotation ? (
            <div className="space-y-6">
              <DayMasterStrength analysis={annotation.strengthAnalysis} dayMaster={result.dayMaster} />
              <AnnotationPanel annotation={annotation} />
            </div>
          ) : (
            <Placeholder text={placeholderFor('reading')} />
          )}
        </div>

        <div role="tabpanel" id="panel-luck" aria-labelledby="tab-luck" tabIndex={0} hidden={active !== 'luck'}>
          <LuckTimeline
            daYun={result.daYun}
            currentDaYun={result.currentDaYun}
            luckAnalysis={annotation?.luckAnalysis}
          />
        </div>

        <div role="tabpanel" id="panel-topics" aria-labelledby="tab-topics" tabIndex={0} hidden={active !== 'topics'}>
          {annotation?.specialTopics
            ? <TopicTabs specialTopics={annotation.specialTopics} />
            : <Placeholder text={placeholderFor('topics')} />}
        </div>

        <div role="tabpanel" id="panel-chat" aria-labelledby="tab-chat" tabIndex={0} hidden={active !== 'chat'}>
          {!annotation ? (
            <Placeholder text="数据准备中…" />
          ) : showChat ? (
            <ChatPanel chart={result} annotation={annotation} onClose={onCloseChat} />
          ) : (
            <button
              type="button"
              onClick={onOpenChat}
              className="w-full rounded-sm border border-dashed border-brand bg-cinnabar-050 py-3 px-4 text-sm font-bold tracking-wider text-brand transition-colors hover:bg-cinnabar-100"
            >
              向墨白提问命理问题
            </button>
          )}
        </div>
      </div>
    </section>
  )
}
