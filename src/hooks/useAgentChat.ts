// ============================================================
// useAgentChat — 对话流状态 Hook（SSE 原生实现）
// Phase 4.12: Multi-Agent 模式支持
//   - mode: 'direct' (A模式单Agent) / 'multi' (C模式Multi-Agent)
//   - 解析 route-start 事件，显示当前活跃的子Agent
// ============================================================

import { useCallback, useRef, useState } from 'react'
import type { BaZiResult, AnnotationResult } from '../engine/index'
import type { ChatMessage } from '../server/lib/types'

export interface StreamingMessage {
  role: 'assistant'
  content: string
  done: boolean
}

export interface RouteInfo {
  agentName: string
  agentEmoji: string
  agentColor: string
}

export type ChatMode = 'direct' | 'multi'

export function useAgentChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [streaming, setStreaming] = useState<StreamingMessage | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<ChatMode>('direct')
  const [activeAgent, setActiveAgent] = useState<RouteInfo | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const isLoading = loading

  const toggleMode = useCallback(() => {
    setMode(prev => prev === 'direct' ? 'multi' : 'direct')
    setActiveAgent(null)
  }, [])

  const sendMessage = useCallback(async (
    content: string,
    chart: BaZiResult,
    annotation: AnnotationResult,
    reportSummary?: string,
  ) => {
    setError(null)
    setLoading(true)
    setActiveAgent(null)

    const userMsg: ChatMessage = { role: 'user', content }
    const history = [...messages, userMsg]
    setMessages(history)

    const abort = new AbortController()
    abortRef.current = abort

    // 根据模式选择 API 端点
    const endpoint = mode === 'multi' ? '/api/chat/route' : '/api/chat'

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chart,
          annotation,
          messages: history,
          reportSummary,
        }),
        signal: abort.signal,
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: '服务异常' }))
        throw new Error(err.message ?? `HTTP ${res.status}`)
      }

      const reader = res.body?.getReader()
      if (!reader) throw new Error('响应体不可读')

      const decoder = new TextDecoder()
      let buffer = ''
      let assistantText = ''

      setStreaming({ role: 'assistant', content: '', done: false })

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ') || line === 'data: [DONE]') continue
          try {
            const json = JSON.parse(line.slice(6))

            // ═══ Multi-Agent: 路由事件 ═══
            if (json.type === 'route-start') {
              setActiveAgent({
                agentName: json.agentName,
                agentEmoji: json.agentEmoji,
                agentColor: json.agentColor,
              })
              continue
            }

            // ═══ 文本增量 ═══
            if (json.type === 'text-delta' && json.textDelta) {
              assistantText += json.textDelta
              setStreaming({ role: 'assistant', content: assistantText, done: false })
            }
          } catch {
            // skip malformed chunk
          }
        }
      }

      setStreaming(null)
      setMessages(prev => [...prev, { role: 'assistant', content: assistantText }])
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return
      setError(e instanceof Error ? e.message : '对话请求失败')
      setMessages(prev => prev.slice(0, -1))
    } finally {
      setLoading(false)
      abortRef.current = null
    }
  }, [messages, mode])

  const stop = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const reset = useCallback(() => {
    setMessages([])
    setStreaming(null)
    setError(null)
    setActiveAgent(null)
  }, [])

  return {
    messages,
    streaming,
    loading: isLoading,
    error,
    mode,
    activeAgent,
    sendMessage,
    stop,
    reset,
    toggleMode,
  }
}
