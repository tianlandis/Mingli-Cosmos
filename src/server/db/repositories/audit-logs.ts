// ============================================================
// Audit Logs Repository
// 文件：src/server/db/repositories/audit-logs.ts
// ============================================================

import { getDb } from '../index'
import { auditLogs } from '../schema'
import { desc } from 'drizzle-orm'

type AuditRow = typeof auditLogs.$inferSelect
type AuditInsert = typeof auditLogs.$inferInsert

export function listAuditLogs(limit = 50): AuditRow[] {
  return getDb().select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(limit).all()
}

export function createAuditLog(data: AuditInsert): AuditRow {
  return getDb().insert(auditLogs).values(data).returning().get()
}
