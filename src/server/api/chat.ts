// ============================================================
// A 模式 API — POST /api/chat (SSE 流式 + Tool Calling)
// C 模式 API — POST /api/chat/route (Multi-Agent Router + 子Agent调度)
// Phase 4.12: Multi-Agent 基础设施
//   - Router: qwen2.5:7b 意图分类 → personality/career/marriage/general
//   - 子 Agent: 各领域专用 System Prompt + Tool Calling
//   - SSE 事件新增: route-start (路由结果)
// ============================================================

import { Hono } from 'hono'
import { streamText } from 'ai'
import type { ChatRequest, ChatMessage } from '../lib/types'
import { buildSystemPrompt } from '../prompts/system'
import { validateResponse } from '../lib/guardrail'
import { detectPaipanAttempt, buildBlockSSE } from '../lib/anti-hallucination'
import { createModel, loadConfig } from '../lib/llm'
import { getEnabledTools } from '../modules/llm/tools-executor'
import { getActiveApiKeys } from '../db/index'
import { orchestrate } from '../agents/orchestrate'

/** 滑动窗口：最多保留最近 N 条消息 */
const MAX_MESSAGES = 10

/** 工具调用最大步数（含初始回复 + 工具调用 + 后续回复） */
const MAX_TOOL_STEPS = 5

function trimMessages(messages: ChatMessage[]): ChatMessage[] {
  if (messages.length <= MAX_MESSAGES) return messages
  return messages.slice(-MAX_MESSAGES)
}

/**
 * 加载当前启用的工具（从数据库 active provider 读取 supported_tools）
 * 回退：无 provider 时默认启用 solar_term_calc + calendar_lookup
 */
function loadActiveTools(): Record<string, ReturnType<typeof import('ai').tool>> {
  try {
    const activeProviders = getActiveApiKeys()
    const localProvider = activeProviders.find(
      p => p.provider === 'local' && p.isActive === 1,
    )
    if (localProvider) {
      const tools = getEnabledTools({
        supportedToolsJson: localProvider.supportedTools ?? undefined,
      })
      const toolCount = Object.keys(tools).length
      if (toolCount > 0) {
        console.log(`[Chat] 已加载 ${toolCount} 个工具:`, Object.keys(tools).join(', '))
      }
      return tools as any
    }
  } catch (e) {
    console.warn('[Chat] 加载工具失败，降级为默认工具', e)
  }

  // 回退：默认启用八字核心工具（solar_term_calc + calendar_lookup）
  const defaultTools = getEnabledTools({})
  const toolCount = Object.keys(defaultTools).length
  if (toolCount > 0) {
    console.log(`[Chat] 已加载 ${toolCount} 个默认工具:`, Object.keys(defaultTools).join(', '))
  }
  return defaultTools as any
}

export const chatRoute = new Hono()

chatRoute.post('/api/chat', async (c) => {
  const body = await c.req.json() as ChatRequest

  if (!body.chart || !body.annotation) {
    return c.json({ error: 'BAD_REQUEST', message: '缺少 chart 或 annotation 字段' }, 400)
  }

  // 校验 chart 结构完整性（必须有 yearPillar + dayMaster 等排盘核心字段）
  if (!body.chart.yearPillar || !body.chart.dayMaster) {
    return c.json({
      error: 'BAD_REQUEST',
      message: 'chart 必须包含完整八字排盘结果',
      hint: '请先调用 POST /api/report 完成排盘后，将返回的 chart + annotation 传入 /api/chat',
      required: ['yearPillar', 'monthPillar', 'dayPillar', 'hourPillar', 'dayMaster'],
    }, 400)
  }

  if (!body.messages || body.messages.length === 0) {
    return c.json({ error: 'BAD_REQUEST', message: '缺少 messages 字段' }, 400)
  }

  // 防幻觉 L2：用户输入检测 → 拦截排盘请求
  const lastUserMsg = body.messages.filter(m => m.role === 'user').pop()
  if (lastUserMsg) {
    const attempt = detectPaipanAttempt(lastUserMsg.content)
    if (attempt.blocked) {
      return buildBlockSSE(attempt.message)
    }
  }

  const systemPrompt = buildSystemPrompt(body.chart, body.annotation, body.reportSummary)
  const trimmedMessages = trimMessages(body.messages)
  const model = createModel(loadConfig())
  const tools = loadActiveTools()

  console.log(`\n[Chat] ═══ 新对话 ═══`)
  console.log(`[Chat] 日主: ${body.chart.dayMaster} | 消息: ${trimmedMessages.length}`)
  console.log(`[Chat] 工具: ${Object.keys(tools).length > 0 ? Object.keys(tools).join(', ') : '无'}`)
  if (lastUserMsg) {
    const preview = lastUserMsg.content.slice(0, 80)
    console.log(`[Chat] 用户: ${preview}${lastUserMsg.content.length > 80 ? '...' : ''}`)
  }

  const result = streamText({
    model,
    system: systemPrompt,
    messages: trimmedMessages,
    tools: Object.keys(tools).length > 0 ? tools : undefined,
    maxSteps: MAX_TOOL_STEPS,
    onFinish: ({ text }) => {
      if (text) {
        const guard = validateResponse(text)
        if (!guard.passed) {
          console.warn('[Guardrail]', guard.reason)
        }
        console.log(`[Chat] 生成完成 (${text.length} 字符)`)
      }
    },
  } as any)

  // AI SDK v6 fullStream：处理 text-delta / tool-call / tool-result / step-start 等所有 chunk 类型
  const encoder = new TextEncoder()
  let toolCallCount = 0
  let fullText = ''

  const sseStream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of result.fullStream) {
          switch (chunk.type) {
            case 'text-delta': {
              const delta = (chunk as any).textDelta
              if (typeof delta === 'string' && delta.length > 0) {
                fullText += delta
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({ type: 'text-delta', textDelta: delta })}\n\n`,
                  ),
                )
              }
              break
            }

            case 'tool-call': {
              toolCallCount++
              const tc = chunk as any
              console.log(
                `\n[ToolCall #${toolCallCount}] 🔧 ${tc.toolName}`,
                `入参: ${JSON.stringify(tc.args || tc.input)}`,
              )
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: 'tool-call',
                    toolCallId: tc.toolCallId,
                    toolName: tc.toolName,
                    args: tc.args || tc.input,
                  })}\n\n`,
                ),
              )
              break
            }

            case 'tool-result': {
              const tr = chunk as any
              const preview =
                typeof tr.output === 'object'
                  ? JSON.stringify(tr.output).slice(0, 200)
                  : String(tr.result || tr.output || '').slice(0, 200)
              console.log(`[ToolResult #${toolCallCount}] ✅ ${preview}`)
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: 'tool-result',
                    toolCallId: tr.toolCallId,
                    toolName: tr.toolName,
                    result: tr.output || tr.result,
                  })}\n\n`,
                ),
              )
              break
            }

            case 'finish': {
              const fc = chunk as any
              if (fc.finishReason) {
                console.log(`[Chat] finishReason=${fc.finishReason}`)
              }
              if (fc.text) fullText += fc.text
              // DEBUG: log finish chunk keys
              console.log(`[Chat DEBUG] finish chunk keys:`, Object.keys(fc).join(', '))
              if (fc.text) console.log(`[Chat DEBUG] finish text length=${fc.text.length}`)
              break
            }

            default:
              console.log(`[Chat DEBUG] unknown chunk type: ${chunk.type}, keys:`, Object.keys(chunk).join(', '))
              break
          }
        }

        if (toolCallCount > 0) {
          console.log(`[Chat] ═══ 共 ${toolCallCount} 次工具调用 ═══\n`)
        }

        // 兜底：非流式模型 → finish chunk 的 fc.text 未被 text-delta 推送
        console.log(`[Chat DEBUG] fullText=${fullText.length} chars, toolCallCount=${toolCallCount}`)
        if (fullText && toolCallCount === 0) {
          console.log(`[Chat DEBUG] enqueuing fallback text-delta`)
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: 'text-delta', textDelta: fullText })}\n\n`,
            ),
          )
        }

        // 护栏检查
        if (fullText) {
          const guard = validateResponse(fullText)
          if (!guard.passed) {
            const sanitized = guard.sanitized || fullText
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: 'guardrail',
                  reason: guard.reason,
                  sanitized,
                })}\n\n`,
              ),
            )
          }
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

// ═══════════════════════════════════════
// C 模式 Multi-Agent 入口 — POST /api/chat/route
// Phase 4.12: Router → 意图分类 → 子Agent调度 → SSE流
// ═══════════════════════════════════════

chatRoute.post('/api/chat/route', async (c) => {
  const body = await c.req.json() as ChatRequest

  if (!body.chart || !body.annotation) {
    return c.json({ error: 'BAD_REQUEST', message: '缺少 chart 或 annotation 字段' }, 400)
  }
  if (!body.chart.yearPillar || !body.chart.dayMaster) {
    return c.json({
      error: 'BAD_REQUEST',
      message: 'chart 必须包含完整八字排盘结果',
      hint: '请先调用 POST /api/report 完成排盘后，将返回的 chart + annotation 传入 /api/chat/route',
    }, 400)
  }
  if (!body.messages || body.messages.length === 0) {
    return c.json({ error: 'BAD_REQUEST', message: '缺少 messages 字段' }, 400)
  }

  // L2 防幻觉
  const lastUserMsg = body.messages.filter(m => m.role === 'user').pop()
  if (lastUserMsg) {
    const attempt = detectPaipanAttempt(lastUserMsg.content)
    if (attempt.blocked) {
      return buildBlockSSE(attempt.message)
    }
  }

  const trimmedMessages = trimMessages(body.messages)

  // ── Router 意图分类 ──
  let routeResult: Awaited<ReturnType<typeof orchestrate>>
  try {
    routeResult = await orchestrate({
      chart: body.chart,
      annotation: body.annotation,
      messages: trimmedMessages,
      reportSummary: body.reportSummary,
    })
  } catch (err) {
    console.error('[Multi-Agent] 路由失败:', err)
    // 回退：使用默认墨白 prompt
    const fallbackPrompt = buildSystemPrompt(body.chart, body.annotation, body.reportSummary)
    return createSSEStream(body, trimmedMessages, fallbackPrompt, 'general')
  }

  const { route, systemPrompt } = routeResult

  console.log(
    `\n[Multi-Agent] ═══ ${route.agent.emoji} ${route.agent.name} ═══`,
    `confidence=${route.confidence.toFixed(2)}`,
  )

  return createSSEStream(body, trimmedMessages, systemPrompt, route.agent.id)
})

/**
 * 共享 SSE 流式响应工厂
 * - routeAgentId: 用于注入 route-start 事件
 */
function createSSEStream(
  body: ChatRequest,
  messages: ChatMessage[],
  systemPrompt: string,
  routeAgentId: string,
): Response {
  const model = createModel(loadConfig())
  const tools = loadActiveTools()

  const result = streamText({
    model,
    system: systemPrompt,
    messages,
    tools: Object.keys(tools).length > 0 ? tools : undefined,
    maxSteps: MAX_TOOL_STEPS,
    onFinish: ({ text }) => {
      if (text) {
        const guard = validateResponse(text)
        if (!guard.passed) console.warn('[Guardrail]', guard.reason)
        console.log(`[Multi-Agent] 生成完成 (${text.length} 字符)`)
      }
    },
  } as any)

  const encoder = new TextEncoder()
  let toolCallCount = 0
  let fullText = ''
  let routed = false

  const sseStream = new ReadableStream({
    async start(controller) {
      try {
        // ── 先推送路由事件 ──
        if (routeAgentId !== 'general') {
          const agentMeta = (await import('../agents/prompts')).AGENTS[routeAgentId]
          if (agentMeta) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: 'route-start',
                  agentId: agentMeta.id,
                  agentName: agentMeta.name,
                  agentEmoji: agentMeta.emoji,
                  agentColor: agentMeta.color,
                })}\n\n`,
              ),
            )
            routed = true
          }
        }

        for await (const chunk of result.fullStream) {
          switch (chunk.type) {
            case 'text-delta': {
              const delta = (chunk as any).textDelta
              if (typeof delta === 'string' && delta.length > 0) {
                fullText += delta
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({ type: 'text-delta', textDelta: delta })}\n\n`,
                  ),
                )
              }
              break
            }

            case 'tool-call': {
              toolCallCount++
              const tc = chunk as any
              console.log(
                `\n[ToolCall #${toolCallCount}] 🔧 ${tc.toolName}`,
                `入参: ${JSON.stringify(tc.args || tc.input)}`,
              )
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: 'tool-call',
                    toolCallId: tc.toolCallId,
                    toolName: tc.toolName,
                    args: tc.args || tc.input,
                  })}\n\n`,
                ),
              )
              break
            }

            case 'tool-result': {
              const tr = chunk as any
              const preview =
                typeof tr.output === 'object'
                  ? JSON.stringify(tr.output).slice(0, 200)
                  : String(tr.result || tr.output || '').slice(0, 200)
              console.log(`[ToolResult #${toolCallCount}] ✅ ${preview}`)
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: 'tool-result',
                    toolCallId: tr.toolCallId,
                    toolName: tr.toolName,
                    result: tr.output || tr.result,
                  })}\n\n`,
                ),
              )
              break
            }

            case 'finish': {
              const fc = chunk as any
              if (fc.text) fullText += fc.text
              break
            }
          }
        }

        // 兜底：非流式模型 → finish chunk 的 fc.text 未被 text-delta 推送
        if (fullText && toolCallCount === 0) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: 'text-delta', textDelta: fullText })}\n\n`,
            ),
          )
        }

        // 护栏检查
        if (fullText) {
          const guard = validateResponse(fullText)
          if (!guard.passed) {
            const sanitized = guard.sanitized || fullText
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: 'guardrail',
                  reason: guard.reason,
                  sanitized,
                })}\n\n`,
              ),
            )
          }
        }

        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      } catch (err) {
        console.error('[Multi-Agent SSE] stream error:', err)
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
}
