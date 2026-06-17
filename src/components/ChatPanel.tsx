// ============================================================
// ChatPanel — A 模式对话面板
// ============================================================

import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import type { BaZiResult, AnnotationResult } from '../engine/index'
import { useAgentChat, type StreamingMessage, type ChatMessage } from '../hooks/useAgentChat'

interface ChatPanelProps {
  chart: BaZiResult
  annotation: AnnotationResult
  reportSummary?: string
  onClose?: () => void
}

export default function ChatPanel({ chart, annotation, reportSummary, onClose }: ChatPanelProps) {
  const { messages, streaming, loading, error, sendMessage, stop, reset } = useAgentChat()
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, streaming])

  const doSend = useCallback(() => {
    const text = input.trim()
    if (!text || loading) return
    setInput('')
    sendMessage(text, chart, annotation, reportSummary)
  }, [input, loading, sendMessage, chart, annotation, reportSummary])

  const handleSubmit = useCallback((e: FormEvent) => {
    e.preventDefault()
    doSend()
  }, [doSend])

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      doSend()
    }
  }, [doSend])

  const hasContent = messages.length > 0 || streaming

  return (
    <div className="flex flex-col h-[500px] bg-white border border-[#D8D2C8] rounded-sm overflow-hidden">
      {/* 标题栏 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#D8D2C8] bg-[#FAF7F2] shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-lg">🧘</span>
          <span className="text-sm font-bold text-[#5B5040] tracking-wider">墨白 · 命理问答</span>
          {loading && (
            <div className="inline-block animate-spin rounded-full h-3 w-3 border border-[#B83A2E] border-t-transparent" />
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={reset}
            className="text-xs text-[#B0A898] hover:text-[#8B3A2B] transition-colors"
          >
            新对话
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="text-xs text-[#B0A898] hover:text-[#8B3A2B] transition-colors"
            >
              关闭
            </button>
          )}
        </div>
      </div>

      {/* 消息列表 */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {!hasContent && (
          <div className="text-center py-12">
            <div className="text-4xl mb-3 opacity-20">☯</div>
            <p className="text-[#B0A898] text-xs tracking-wider leading-relaxed">
              命书已生成，可在此追问命理问题
              <br />
              例如：我的事业方向、婚姻缘分、财运流年
            </p>
          </div>
        )}

        {messages.map((m, i) => (
          <Bubble key={i} message={m} />
        ))}

        {streaming && (
          <Bubble message={streaming} streaming />
        )}

        {error && (
          <div className="bg-[#FDF2F0] border border-[#F5C6CB] rounded-sm p-3 text-xs text-[#9B2C22]">
            {error}
          </div>
        )}
      </div>

      {/* 输入区 */}
      <form onSubmit={handleSubmit} className="shrink-0 border-t border-[#D8D2C8] p-3 bg-[#FAF7F2]">
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入你的命理问题..."
            rows={1}
            className="flex-1 resize-none rounded-sm border border-[#D8D2C8] px-3 py-2 text-sm bg-white placeholder:text-[#B0A898] focus:outline-none focus:border-[#B83A2E] transition-colors"
            disabled={loading}
          />
          {loading ? (
            <button
              type="button"
              onClick={stop}
              className="px-4 py-2 rounded-sm bg-[#B0A898] text-white text-sm font-bold hover:bg-[#8B8070] transition-colors"
            >
              停止
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              className="px-4 py-2 rounded-sm bg-[#B83A2E] text-white text-sm font-bold hover:bg-[#9B2C22] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              发送
            </button>
          )}
        </div>
        <p className="text-[10px] text-[#B0A898] mt-1.5 text-center">
          墨白基于命盘数据作答 · 仅供参考，不构成人生建议
        </p>
      </form>
    </div>
  )
}

// ─── 消息气泡子组件 ───

function Bubble({ message, streaming = false }: { message: StreamingMessage | ChatMessage; streaming?: boolean }) {
  const isUser = message.role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-sm px-3.5 py-2.5 text-sm leading-relaxed ${
          isUser
            ? 'bg-[#B83A2E] text-white'
            : 'bg-[#F5F0E8] text-[#4A4035]'
        } ${streaming ? 'animate-pulse' : ''}`}
      >
        <div className="whitespace-pre-wrap">{message.content || (streaming ? '...' : '')}</div>
      </div>
    </div>
  )
}
