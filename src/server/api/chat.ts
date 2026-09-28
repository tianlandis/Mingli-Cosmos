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
import { getActiveApiKeys, isDbReady, getConfig } from '../db/index'
import {
  reserveQuota,
  commitQuota,
  refundQuota,
  type ReserveFailReason,
} from '../db/index'
import { orchestrate } from '../agents/orchestrate'
import { extractBearerToken, verifyUserToken } from '../core/middleware/user-auth'
import { resolveChartSource } from '../lib/chart-source'
import { newTraceId } from '../lib/trace'

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

/**
 * [P5-4 ADR-004] 幂等额度预留（替代旧的 consumeQuota 单点扣减）
 *
 * 安全边界（保证不影响既有行为）：
 *   1. 仅在 DB 已初始化时才读取配置（isDbReady），避免在测试中误建真实库文件
 *   2. 默认关闭（quota_enforce_chat != 'true'），未登录 / 无 token 请求直接放行
 *   3. 预留失败（额度不足 / 账号停用）返回结构化错误，由前端引导订阅
 *
 * @returns { reject } 需要中断请求；{ key } 预留成功（流结束需 commit / 失败需 refund）
 */
function reserveChatQuota(c: any, refKey?: string): {
  reject?: Response
  key?: string
} {
  if (!isDbReady()) return {}

  let enabled = false
  try {
    enabled = getConfig('quota_enforce_chat')?.value === 'true'
  } catch {
    return {}
  }
  if (!enabled) return {}

  const token = extractBearerToken(c)
  if (!token) return {}

  const payload = verifyUserToken(token)
  if (!payload) return {}

  // 幂等键：优先取客户端头（重试复用），否则服务端生成
  const headerKey = c.req.header('x-idempotency-key')
  const key = headerKey && /^[\w.:-]{8,128}$/.test(headerKey)
    ? headerKey
    : `chat_${payload.userId}_${newTraceId()}`

  const res = reserveQuota({
    userId: payload.userId,
    idempotencyKey: key,
    cost: 1,
    reason: 'chat',
    refKey: refKey ?? null,
  })

  if (res.ok) return { key }

  const map: Record<ReserveFailReason, { status: 402 | 403 | 401 | 409; code: string; message: string }> = {
    QUOTA_EXHAUSTED: {
      status: 402, code: 'QUOTA_EXHAUSTED',
      message: 'AI 深度解读额度已用完，请订阅套餐或联系客服',
    },
    ACCOUNT_DISABLED: { status: 403, code: 'ACCOUNT_DISABLED', message: '账号已被停用，请联系客服' },
    USER_NOT_FOUND: { status: 401, code: 'UNAUTHORIZED', message: '登录状态失效，请重新登录' },
    KEY_REFUNDED: { status: 409, code: 'IDEMPOTENCY_KEY_REFUNDED', message: '该幂等键已退款，请用新键重试' },
  }
  const m = map[res.reason ?? 'QUOTA_EXHAUSTED']
  return {
    reject: c.json({
      error: m.code,
      code: m.code,
      message: m.message,
      quotaRemaining: res.balanceAfter ?? 0,
    }, m.status),
  }
}

chatRoute.post('/api/chat', async (c) => {
  const body = await c.req.json() as ChatRequest

  // ── [P5-3 ADR-005] 解析权威排盘数据源（session 权威 / 重算校验 / 兼容旧客户端）──
  const resolved = await resolveChartSource({
    sessionId: body.sessionId,
    chart: body.chart,
    annotation: body.annotation,
    birth: body.birth,
  })
  if (!resolved.ok) {
    const status = resolved.code === 'SESSION_NOT_FOUND' ? 404
      : resolved.code === 'CHART_MISMATCH' ? 409
        : 400
    return c.json({
      error: resolved.code,
      message: resolved.message,
      ...(resolved.detail ? { detail: resolved.detail } : {}),
      ...(resolved.hint ? { hint: resolved.hint } : {}),
    }, status)
  }
  const { chart, annotation } = resolved.data
  c.header('X-Chart-Verified', String(resolved.data.verified))
  c.header('X-Chart-Source', resolved.data.source)
  for (const w of resolved.warnings) console.warn('[ChartSource]', w)

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

  // ── [P5-4 ADR-004] 幂等额度预留（默认关闭，配置 quota_enforce_chat=true 开启）──
  const quota = reserveChatQuota(c, resolved.data.sessionId)
  if (quota.reject) return quota.reject

  const systemPrompt = buildSystemPrompt(chart, annotation, body.reportSummary)
  const trimmedMessages = trimMessages(body.messages)
  const model = createModel(loadConfig())
  const tools = loadActiveTools()

  console.log(`\n[Chat] ═══ 新对话 ═══`)
  console.log(`[Chat] 日主: ${chart.dayMaster} | 消息: ${trimmedMessages.length} | 来源: ${resolved.data.source} verified=${resolved.data.verified}`)
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
    onFinish: ({ text }: { text: string }) => {
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

        // 终极兜底：非流式模型 fullStream 只有 finish chunk（可能不含 .text）
        //           使用 result.text (Promise<string>) 获取完整输出
        console.log(`[Chat DEBUG] fullText=${fullText.length} chars, toolCallCount=${toolCallCount}`)
        if (!fullText) {
          try {
            const awaitedText = await result.text
            if (awaitedText && awaitedText.length > 0) {
              console.log(`[Chat DEBUG] result.text() fallback: ${awaitedText.length} chars`)
              fullText = awaitedText
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ type: 'text-delta', textDelta: awaitedText })}\n\n`,
                ),
              )
            }
          } catch (e) {
            console.warn('[Chat DEBUG] result.text() failed:', e)
          }
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
        // [P5-4] AI 成功 → 落定额度（幂等）
        if (quota.key) commitQuota(quota.key)
        controller.close()
      } catch (err) {
        console.error('[Chat SSE] stream error:', err)
        // [P5-4] AI 失败 → 退回额度（幂等，且不会退两次）
        if (quota.key) {
          const r = refundQuota(quota.key)
          if (r.refunded) console.warn(`[Chat] 额度已退回 ${r.amount}（key=${quota.key}）`)
        }
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

  // ── [P5-3 ADR-005] 权威数据源解析（与 /api/chat 同口径）──
  const resolved = await resolveChartSource({
    sessionId: body.sessionId,
    chart: body.chart,
    annotation: body.annotation,
    birth: body.birth,
  })
  if (!resolved.ok) {
    const status = resolved.code === 'SESSION_NOT_FOUND' ? 404
      : resolved.code === 'CHART_MISMATCH' ? 409
        : 400
    return c.json({
      error: resolved.code,
      message: resolved.message,
      ...(resolved.detail ? { detail: resolved.detail } : {}),
      ...(resolved.hint ? { hint: resolved.hint } : {}),
    }, status)
  }
  const { chart, annotation } = resolved.data
  c.header('X-Chart-Verified', String(resolved.data.verified))
  c.header('X-Chart-Source', resolved.data.source)

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
      chart,
      annotation,
      messages: trimmedMessages,
      reportSummary: body.reportSummary,
    })
  } catch (err) {
    console.error('[Multi-Agent] 路由失败:', err)
    // 回退：使用默认墨白 prompt
    const fallbackPrompt = buildSystemPrompt(chart, annotation, body.reportSummary)
    return createSSEStream(trimmedMessages, fallbackPrompt, 'general')
  }

  const { route, systemPrompt } = routeResult

  console.log(
    `\n[Multi-Agent] ═══ ${route.agent.emoji} ${route.agent.name} ═══`,
    `confidence=${route.confidence.toFixed(2)}`,
  )

  return createSSEStream(trimmedMessages, systemPrompt, route.agent.id)
})

/**
 * 共享 SSE 流式响应工厂
 * - routeAgentId: 用于注入 route-start 事件
 */
function createSSEStream(
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
    onFinish: ({ text }: { text: string }) => {
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

        // 终极兜底：非流式模型 → await result.text() 获取完整输出
        if (!fullText) {
          try {
            const awaitedText = await result.text
            if (awaitedText && awaitedText.length > 0) {
              console.log(`[Multi-Agent] result.text() fallback: ${awaitedText.length} chars`)
              fullText = awaitedText
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ type: 'text-delta', textDelta: awaitedText })}\n\n`,
                ),
              )
            }
          } catch (e) {
            console.warn('[Multi-Agent] result.text() failed:', e)
          }
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
