// ============================================================
// [ADR-012] AI 调用明细 Repository（运营分析域）
// 文件：src/server/db/repositories/llm-call-logs.ts
// 职责：记录每次 LLM 调用的模型/token/延迟/成本/成败
//
// 设计：追加式、只增不改。与 quota_ledger（财务）互补 ——
//   本表回答「花了多少算力」，台账回答「扣不扣钱」。
// 写入点：src/server/api/chat.ts 流结束判定处（成功与失败都要记）。
// ============================================================

import { getDb, schema } from '../index'
import { eq, and, desc, gte, sql } from 'drizzle-orm'

const { obsLlmCallLogs } = schema

export type LlmCallLogRow = typeof obsLlmCallLogs.$inferSelect

export interface RecordLlmCallInput {
  userId?: number | null
  sessionId?: string | null
  provider: string
  model?: string | null
  promptTokens?: number | null
  completionTokens?: number | null
  totalTokens?: number | null
  latencyMs?: number | null
  status: 'ok' | 'error'
  errorCode?: string | null
  costCents?: number | null
  traceId?: string | null
}

/**
 * 记录一次 LLM 调用。
 * ⚠️ 此函数**不得抛出**影响主流程：调用方须用 try/catch 包裹（审计日志非关键路径）。
 */
export function recordLlmCall(input: RecordLlmCallInput): LlmCallLogRow {
  return getDb().insert(obsLlmCallLogs).values({
    userId: input.userId ?? null,
    sessionId: input.sessionId ?? null,
    provider: input.provider,
    model: input.model ?? null,
    promptTokens: input.promptTokens ?? null,
    completionTokens: input.completionTokens ?? null,
    totalTokens: input.totalTokens ?? null,
    latencyMs: input.latencyMs ?? null,
    status: input.status,
    errorCode: input.errorCode ?? null,
    costCents: input.costCents ?? null,
    traceId: input.traceId ?? null,
    createdAt: new Date().toISOString(),
  }).returning().get()
}

export interface ListLlmCallParams {
  userId?: number
  status?: 'ok' | 'error'
  sinceIso?: string
  limit?: number
  offset?: number
}

export function listLlmCallLogs(params: ListLlmCallParams = {}): LlmCallLogRow[] {
  const { userId, status, sinceIso, limit = 50, offset = 0 } = params
  const conds = []
  if (userId !== undefined) conds.push(eq(obsLlmCallLogs.userId, userId))
  if (status) conds.push(eq(obsLlmCallLogs.status, status))
  if (sinceIso) conds.push(gte(obsLlmCallLogs.createdAt, sinceIso))

  const q = getDb().select().from(obsLlmCallLogs)
  const filtered = conds.length > 0 ? q.where(and(...conds)) : q
  return filtered.orderBy(desc(obsLlmCallLogs.id)).limit(limit).offset(offset).all()
}

export interface LlmCallStats {
  total: number
  ok: number
  error: number
  totalTokens: number
  avgLatencyMs: number
  totalCostCents: number
}

/** 指定时间点之后的调用聚合（admin 看板用） */
export function llmCallStats(sinceIso?: string): LlmCallStats {
  const base = getDb().select({
    total: sql<number>`count(*)`,
    ok: sql<number>`sum(case when ${obsLlmCallLogs.status} = 'ok' then 1 else 0 end)`,
    error: sql<number>`sum(case when ${obsLlmCallLogs.status} = 'error' then 1 else 0 end)`,
    totalTokens: sql<number>`coalesce(sum(${obsLlmCallLogs.totalTokens}), 0)`,
    avgLatencyMs: sql<number>`coalesce(avg(${obsLlmCallLogs.latencyMs}), 0)`,
    totalCostCents: sql<number>`coalesce(sum(${obsLlmCallLogs.costCents}), 0)`,
  }).from(obsLlmCallLogs)

  const row = (sinceIso ? base.where(gte(obsLlmCallLogs.createdAt, sinceIso)) : base).get()
  return {
    total: row?.total ?? 0,
    ok: row?.ok ?? 0,
    error: row?.error ?? 0,
    totalTokens: row?.totalTokens ?? 0,
    avgLatencyMs: Math.round(row?.avgLatencyMs ?? 0),
    totalCostCents: row?.totalCostCents ?? 0,
  }
}
