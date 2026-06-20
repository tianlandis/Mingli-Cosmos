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
