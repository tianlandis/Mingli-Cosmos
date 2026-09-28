// ============================================================
// Sessions Repository
// 文件：src/server/db/repositories/sessions.ts
// ============================================================

import { getDb } from '../index'
import { sessions } from '../schema'
import { eq, sql } from 'drizzle-orm'

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
