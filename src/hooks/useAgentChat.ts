// ============================================================
// useAgentChat — 对话流状态 Hook（SSE 原生实现）
// ============================================================

import { useCallback, useRef, useState } from 'react'
import type { BaZiResult, AnnotationResult } from '../engine/index'
import type { ChatMessage } from '../server/lib/types'

export interface StreamingMessage {
  role: 'assistant'
  content: string
  done: boolean
}

export function useAgentChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [streaming, setStreaming] = useState<StreamingMessage | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const isLoading = loading

  const sendMessage = useCallback(async (
    content: string,
    chart: BaZiResult,
    annotation: AnnotationResult,
    reportSummary?: string,
  ) => {
    setError(null)
    setLoading(true)

    const userMsg: ChatMessage = { role: 'user', content }
    const history = [...messages, userMsg]
    setMessages(history)

    const abort = new AbortController()
    abortRef.current = abort

    try {
      const res = await fetch('/api/chat', {
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
            // AI SDK v6 流格式：{ type: 'text-delta', textDelta: '...' }
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
      // 撤回发送的用户消息
      setMessages(prev => prev.slice(0, -1))
    } finally {
      setLoading(false)
      abortRef.current = null
    }
  }, [messages])

  const stop = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const reset = useCallback(() => {
    setMessages([])
    setStreaming(null)
    setError(null)
  }, [])

  return { messages, streaming, loading: isLoading, error, sendMessage, stop, reset }
}
