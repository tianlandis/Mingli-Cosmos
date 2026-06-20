// ============================================================
// Multi-Agent Orchestrator — Phase 4.12 C 模式
// 文件：src/server/agents/orchestrate.ts
// 职责：Router → 意图分类 → 子 Agent 调度 → SSE 流式输出
// ============================================================

import type { BaZiResult, AnnotationResult } from '../../engine/index'
import type { ChatMessage } from '../lib/types'
import { classifyIntent, type RouteDecision } from './router-agent'
import {
  buildPersonalityPrompt,
  buildCareerPrompt,
  buildMarriagePrompt,
  buildGeneralPrompt,
} from './prompts'

/** Orchestrator 输入 */
export interface OrchestrateInput {
  chart: BaZiResult
  annotation: AnnotationResult
  messages: ChatMessage[]
  reportSummary?: string
}

/** Orchestrator 输出：路由决策 + 对应领域的 System Prompt */
export interface OrchestrateResult {
  route: RouteDecision
  systemPrompt: string
}

/**
 * 主调度函数：
 * 1. 提取最后一条用户消息
 * 2. Router 分类意图
 * 3. 根据 domain 构建对应子 Agent 的 System Prompt
 */
export async function orchestrate(input: OrchestrateInput): Promise<OrchestrateResult> {
  const lastUserMsg = input.messages.filter(m => m.role === 'user').pop()
  const question = lastUserMsg?.content ?? ''

  // 路由器分类
  const route = await classifyIntent(question)

  // 根据 domain 选择 System Prompt
  let systemPrompt: string
  switch (route.domain) {
    case 'personality':
      systemPrompt = buildPersonalityPrompt(input.chart, input.annotation)
      break
    case 'career':
      systemPrompt = buildCareerPrompt(input.chart, input.annotation)
      break
    case 'marriage':
      systemPrompt = buildMarriagePrompt(input.chart, input.annotation)
      break
    default:
      systemPrompt = buildGeneralPrompt(input.chart, input.annotation, input.reportSummary)
      break
  }

  return { route, systemPrompt }
}
