// ============================================================
// Sessions Repository
// 文件：src/server/db/repositories/sessions.ts
// ============================================================

import { getDb } from '../index'
import { sessions } from '../schema'
import { eq, desc, sql } from 'drizzle-orm'

type SessionRow = typeof sessions.$inferSelect
type SessionInsert = typeof sessions.$inferInsert

export function getSession(id: string): SessionRow | undefined {
  return getDb().select().from(sessions).where(eq(sessions.id, id)).get()
}

export function upsertSession(data: SessionInsert): SessionRow {
  const existing = getSession(data.id)
  if (existing) {
    return getDb().update(sessions)
      .set({
        messageCount: data.messageCount ?? existing.messageCount,
        lastActive: new Date().toISOString(),
      })
      .where(eq(sessions.id, data.id))
      .returning().get()
  }
  return getDb().insert(sessions)
    .values({ ...data, lastActive: new Date().toISOString() })
    .returning().get()
}

/**
 * [P5-3 ADR-005] 写入 / 覆盖一份权威排盘快照
 * 与 upsertSession 的区别：本函数会**整体替换** chart / annotation / 指纹，
 * 用于服务端权威计算后的落库（upsertSession 只更新活跃度，保持既有语义不变）。
 */
export function saveChartSession(data: {
  id: string
  chart: string
  annotation: string
  chartHash: string
  engineVersion: string
  userId?: number | null
}): SessionRow {
  const existing = getSession(data.id)
  if (existing) {
    return getDb().update(sessions)
      .set({
        chart: data.chart,
        annotation: data.annotation,
        chartHash: data.chartHash,
        engineVersion: data.engineVersion,
        userId: data.userId ?? existing.userId,
        lastActive: new Date().toISOString(),
      })
      .where(eq(sessions.id, data.id))
      .returning().get()
  }
  return getDb().insert(sessions).values({
    id: data.id,
    chart: data.chart,
    annotation: data.annotation,
    chartHash: data.chartHash,
    engineVersion: data.engineVersion,
    userId: data.userId ?? null,
    messageCount: 0,
    lastActive: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  }).returning().get()
}

/** 按归属用户列出排盘快照（PII 导出用） */
export function listSessionsByUser(userId: number, limit = 200): SessionRow[] {
  return getDb().select().from(sessions)
    .where(eq(sessions.userId, userId))
    .limit(limit)
    .all()
}

/**
 * [P1] 列出某用户的命盘历史（轻量摘要，供「我的 · 历史命盘」）
 * 只取列表所需列，避免把整份 chart/annotation JSON 拉回（单条约 10KB）。
 * @param userId 归属用户
 * @param limit  最大返回条数（默认 20）
 */
export function listChartSummariesByUser(userId: number, limit = 20): Array<{
  id: string
  chartHash: string | null
  engineVersion: string | null
  lastActive: string | null
  createdAt: string | null
  chart: string
}> {
  return getDb().select({
    id: sessions.id,
    chartHash: sessions.chartHash,
    engineVersion: sessions.engineVersion,
    lastActive: sessions.lastActive,
    createdAt: sessions.createdAt,
    chart: sessions.chart,
  })
    .from(sessions)
    .where(eq(sessions.userId, userId))
    .orderBy(desc(sessions.lastActive))
    .limit(limit)
    .all()
}

/** [P1] 取某用户自己的命盘快照（越权防护：非本人返回 undefined） */
export function getChartSessionForUser(id: string, userId: number): SessionRow | undefined {
  const row = getSession(id)
  if (!row || row.userId !== userId) return undefined
  return row
}

/** [P5-6 ADR-006] 删除某用户全部排盘快照（删除权 → 硬删 PII） */
export function deleteSessionsByUser(userId: number): number {
  const res = getDb().delete(sessions).where(eq(sessions.userId, userId)).run()
  return res.changes
}

export function deleteSession(id: string): void {
  getDb().delete(sessions).where(eq(sessions.id, id)).run()
}

/** 清理 30 天前的旧会话 */
export function cleanOldSessions(): number {
  const threshold = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const result = getDb()
    .delete(sessions)
    .where(sql`${sessions.lastActive} < ${threshold}`)
    .run()
  return result.changes
}
