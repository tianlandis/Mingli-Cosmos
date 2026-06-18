// ============================================================
// A 模式 API — POST /api/chat (SSE 流式)
// ============================================================

import { Hono } from 'hono'
import { streamText } from 'ai'
import type { ChatRequest, ChatMessage } from '../lib/types'
import { buildSystemPrompt } from '../prompts/system'
import { validateResponse, guardInput } from '../lib/guardrail'
import { createModel, loadConfig } from '../lib/llm'

/** 滑动窗口：最多保留最近 N 条消息 */
const MAX_MESSAGES = 10

function trimMessages(messages: ChatMessage[]): ChatMessage[] {
  if (messages.length <= MAX_MESSAGES) return messages
  return messages.slice(-MAX_MESSAGES)
}

export const chatRoute = new Hono()

chatRoute.post('/api/chat', async (c) => {
  const body = await c.req.json() as ChatRequest

  if (!body.chart || !body.annotation) {
    return c.json({ error: 'BAD_REQUEST', message: '缺少 chart 或 annotation 字段' }, 400)
  }

  if (!body.messages || body.messages.length === 0) {
    return c.json({ error: 'BAD_REQUEST', message: '缺少 messages 字段' }, 400)
  }

  // L2 输入护栏：检测用户是否在对话中要求排盘
  const lastUserMsg = body.messages.filter(m => m.role === 'user').pop()
  if (lastUserMsg) {
    const inputGuard = guardInput(lastUserMsg.content)
    if (inputGuard.blocked) {
      const encoder = new TextEncoder()
      const sseStream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'text-delta', textDelta: inputGuard.message })}\n\n`))
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
        },
      })
      return new Response(sseStream, {
        headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
      })
    }
  }

  const systemPrompt = buildSystemPrompt(body.chart, body.annotation, body.reportSummary)
  const trimmedMessages = trimMessages(body.messages)

  const model = createModel(loadConfig())

  const result = streamText({
    model,
    system: systemPrompt,
    messages: trimmedMessages,
    onFinish: ({ text }) => {
      const guard = validateResponse(text)
      if (!guard.passed) {
        console.warn('[Guardrail]', guard.reason)
      }
    },
  })

  // AI SDK v6 移除了 toDataStreamResponse()，手动构建 SSE 流
  const encoder = new TextEncoder()

  const sseStream = new ReadableStream({
    async start(controller) {
      try {
        for await (const delta of result.textStream) {
          const payload = JSON.stringify({ type: 'text-delta', textDelta: delta })
          controller.enqueue(encoder.encode(`data: ${payload}\n\n`))
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      } catch (err) {
        console.error('[Chat SSE] stream error:', err)
        controller.error(err)
      }
    },
  })

  return new Response(sseStream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
})
