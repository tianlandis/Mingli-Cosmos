// ============================================================
// Multi-Agent Router — Phase 4.12 C 模式
// 文件：src/server/agents/router-agent.ts
// 职责：使用 qwen2.5:7b 将用户意图分类到 personality/career/marriage/general
//       返回路由决策（domain + confidence），供 Orchestrator 调度
// ============================================================

import { generateText } from 'ai'
import { createModel, loadConfig } from '../lib/llm'
import { ROUTER_SYSTEM_PROMPT, AGENTS, type AgentIdentity } from './prompts'

/** 路由决策结果 */
export interface RouteDecision {
  domain: string
  agent: AgentIdentity
  confidence: number
}

/** 路由失败时的回退 */
const FALLBACK_DECISION: RouteDecision = {
  domain: 'general',
  agent: {
    id: 'general',
    name: '全科命理 · 墨白',
    emoji: '☯',
    domain: '综合',
    description: '通用命理分析',
    color: '#A09888',
  },
  confidence: 0.5,
}

/**
 * 使用 qwen2.5:7b 快速分类用户意图
 * - 调用 generateText 获取结构化 JSON 输出
 * - 结果解析容错，异常时回退到 general
 */
export async function classifyIntent(question: string): Promise<RouteDecision> {
  console.log(`[Router] 🔍 分类意图: "${question.slice(0, 60)}${question.length > 60 ? '...' : ''}"`)

  try {
    const model = createModel({
      ...loadConfig(),
      temperature: 0.1, // 低温度确保稳定分类
      maxTokens: 128,    // 仅需 JSON，少量 token
    })

    const result = await generateText({
      model,
      system: ROUTER_SYSTEM_PROMPT,
      prompt: `用户提问：「${question}」\n请给出分类结果（只输出 JSON，不要任何其他文字）。`,
      temperature: 0.1,
      maxTokens: 128,
    })

    const text = result.text.trim()
    console.log(`[Router] 原始输出: ${text}`)

    // 解析 JSON 输出
    const parsed = parseRouterResponse(text)
    const agent = AGENTS[parsed.domain] ?? FALLBACK_DECISION.agent

    console.log(
      `[Router] ✅ 路由 → ${agent.emoji} ${agent.name} (domain=${parsed.domain}, confidence=${parsed.confidence})`,
    )

    return { domain: parsed.domain, agent, confidence: parsed.confidence }
  } catch (err) {
    console.warn('[Router] ⚠️ 分类失败，回退 general:', err)
    return FALLBACK_DECISION
  }
}

/**
 * 解析 Router 的 JSON 输出，带多级容错
 */
function parseRouterResponse(text: string): { domain: string; confidence: number } {
  // 策略 1：精确 JSON 匹配
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    try {
      const obj = JSON.parse(jsonMatch[0])
      return {
        domain: validateDomain(obj.domain),
        confidence: clampConfidence(obj.confidence),
      }
    } catch { /* 继续尝试 */ }
  }

  // 策略 2：关键词回退
  const lower = text.toLowerCase()
  if (lower.includes('marriage') || lower.includes('婚姻')) {
    return { domain: 'marriage', confidence: 0.7 }
  }
  if (lower.includes('career') || lower.includes('事业')) {
    return { domain: 'career', confidence: 0.7 }
  }
  if (lower.includes('personality') || lower.includes('性格')) {
    return { domain: 'personality', confidence: 0.7 }
  }

  // 策略 3：默认 general
  return { domain: 'general', confidence: 0.5 }
}

function validateDomain(d: unknown): string {
  const valid = ['personality', 'career', 'marriage', 'general']
  if (typeof d === 'string' && valid.includes(d)) return d
  return 'general'
}

function clampConfidence(c: unknown): number {
  if (typeof c === 'number' && !isNaN(c)) return Math.max(0, Math.min(1, c))
  return 0.5
}
