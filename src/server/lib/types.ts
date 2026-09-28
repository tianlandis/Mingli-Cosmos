// ============================================================
// 全链路类型契约 — Phase 2 AI Agent
// 文件：src/server/lib/types.ts
// 职责：B/A/C 三模式共享的类型定义，前后端跨层消费
// ============================================================

import type { BaZiResult, AnnotationResult } from '../../engine/index'

// ═══════════════════════════════════════
// 通用工具类型
// ═══════════════════════════════════════

/** 熔断包装：每个 step 返回 Try<T>，失败短路 */
export type Try<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; step: string }

// ═══════════════════════════════════════
// B 模式：命书生成
// ═══════════════════════════════════════

export interface PersonalityOutput {
  /** 格局总评 (~250字) */
  overview: string
  /** 人格画像 (~150字) */
  mbtiProfile: string
}

export interface LuckOutput {
  /** 近三年趋势 (~200字) */
  trend: string
  /** 重点关注 (~100字) */
  highlights: string
}

export interface ReportSection {
  /** 'seal' | 'personality' | 'luck' | 'topics' | 'disclaimer' */
  id: string
  title: string
  /** Markdown 内容 */
  content: string
}

export interface ReportResult {
  /** 完整命书 Markdown */
  markdown: string
  sections: ReportSection[]
}

export interface ReportRequest {
  /** [P5-3] 权威排盘会话 ID（推荐；提供后忽略 chart/annotation） */
  sessionId?: string
  /** 兼容旧客户端：客户端计算的排盘结果 */
  chart?: BaZiResult
  annotation?: AnnotationResult
  /** [P5-3] 生辰：提供后服务端重算并比对 chartHash */
  birth?: BirthInput
}

// ═══════════════════════════════════════
// A 模式：对话
// ═══════════════════════════════════════

export interface ChatRequest {
  /** [P5-3] 权威排盘会话 ID（推荐；提供后忽略 chart/annotation） */
  sessionId?: string
  chart?: BaZiResult
  annotation?: AnnotationResult
  /** [P5-3] 生辰：提供后服务端重算并比对 chartHash */
  birth?: BirthInput
  messages: ChatMessage[]
  /** 如果已生成命书，注入摘要 */
  reportSummary?: string
}

/**
 * [P5-3 ADR-005] 排盘生辰输入（重算校验用）
 * 放在纯类型层，供前端与各 API 复用，不引入 server/db 依赖。
 */
export interface BirthInput {
  year: number
  month: number
  day: number
  hour: number
  minute?: number
  gender: '男' | '女'
  calendarType?: 'solar' | 'lunar'
  isLeapMonth?: boolean
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

// ═══════════════════════════════════════
// 护栏
// ═══════════════════════════════════════

export interface GuardResult {
  passed: boolean
  reason?: string
  sanitized?: string
}

// ═══════════════════════════════════════
// LLM Provider
// ═══════════════════════════════════════

export type ModelProvider = 'deepseek' | 'siliconflow' | 'claude' | 'openai' | 'local'

export interface LLMConfig {
  provider: ModelProvider
  apiKey: string
  /** Ollama/vLLM 等本地模型 */
  baseUrl?: string
  /** 模型名，不填用 provider 默认 */
  model?: string
  /** 默认 0.7 */
  temperature?: number
  /** 默认 1024 */
  maxTokens?: number
}

// ═══════════════════════════════════════
// C 模式预留
// ═══════════════════════════════════════

/** 未来 Multi-Agent 的调度器接口 */
export interface AgentRouter {
  route(question: string): string
}

export interface AgentCapability {
  agentId: string
  /** 能力域 */
  domain: string[]
  analyze(context: AgentContext): Promise<Try<string>>
}

export interface AgentContext {
  annotation: AnnotationResult
  personalitySummary?: string
  history?: ChatMessage[]
}
