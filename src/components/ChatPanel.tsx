// ============================================================
// ChatPanel — A/C 模式对话面板 (Phase 4.12 Multi-Agent)
// ============================================================

import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import type { BaZiResult, AnnotationResult } from '../engine/index'
import { useAgentChat, type StreamingMessage, type ChatMessage, type RouteInfo } from '../hooks/useAgentChat'

interface ChatPanelProps {
  chart: BaZiResult
  annotation: AnnotationResult
  reportSummary?: string
  onClose?: () => void
}

export default function ChatPanel({ chart, annotation, reportSummary, onClose }: ChatPanelProps) {
  const {
    messages, streaming, loading, error,
    mode, activeAgent,
    sendMessage, stop, reset, toggleMode,
  } = useAgentChat()

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
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-lg">{mode === 'multi' ? '🔮' : '🧘'}</span>
          <span className="text-sm font-bold text-[#5B5040] tracking-wider truncate">
            {mode === 'multi' ? '墨白 · 多Agent调度' : '墨白 · 命理问答'}
          </span>
          {loading && (
            <div className="inline-block animate-spin rounded-full h-3 w-3 border border-[#B83A2E] border-t-transparent shrink-0" />
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Multi-Agent 模式切换 */}
          <button
            type="button"
            onClick={toggleMode}
            className={`text-[10px] px-2 py-1 rounded-sm font-medium transition-colors ${
              mode === 'multi'
                ? 'bg-[#B83A2E] text-white'
                : 'bg-[#E8E3D8] text-[#8B7A5E] hover:bg-[#DDD6C8]'
            }`}
            title={mode === 'direct' ? '切换到多Agent智能调度模式' : '切换到单Agent直接对话模式'}
          >
            {mode === 'direct' ? '⚡ 单Agent' : '🔮 Multi-Agent'}
          </button>
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

      {/* Multi-Agent 路由状态栏 */}
      {mode === 'multi' && activeAgent && (
        <AgentRouteBar agent={activeAgent} />
      )}

      {/* 消息列表 */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {!hasContent && (
          <div className="text-center py-12">
            <div className="text-4xl mb-3 opacity-20">☯</div>
            <p className="text-[#B0A898] text-xs tracking-wider leading-relaxed">
              {mode === 'multi' ? (
                <>
                  开启 Multi-Agent 智能调度
                  <br />
                  系统自动分析问题类型，分派给专精 Agent 回答
                </>
              ) : (
                <>
                  命书已生成，可在此追问命理问题
                  <br />
                  例如：我的事业方向、婚姻缘分、财运流年
                </>
              )}
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
            placeholder={
              mode === 'multi'
                ? '说点什么，系统会自动分派给合适的 Agent...'
                : '输入你的命理问题...'
            }
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

// ─── Multi-Agent 路由状态栏 ───

function AgentRouteBar({ agent }: { agent: RouteInfo }) {
  return (
    <div
      className="flex items-center gap-2 px-4 py-1.5 text-[11px] font-medium animate-in fade-in slide-in-from-top-1"
      style={{
        background: `${agent.agentColor}10`,
        borderBottom: `1px solid ${agent.agentColor}30`,
        color: agent.agentColor,
      }}
    >
      <span className="text-sm">{agent.agentEmoji}</span>
      <span>{agent.agentName}</span>
      <span className="text-[10px] opacity-60 ml-auto">已调度</span>
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
