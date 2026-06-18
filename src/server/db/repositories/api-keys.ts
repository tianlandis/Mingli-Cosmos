// ============================================================
// API Keys Repository
// 文件：src/server/db/repositories/api-keys.ts
// ============================================================

import { getDb } from '../index'
import { apiKeys } from '../schema'
import { eq, desc } from 'drizzle-orm'

type ApiKeyRow = typeof apiKeys.$inferSelect
type ApiKeyInsert = typeof apiKeys.$inferInsert

export function listApiKeys(): ApiKeyRow[] {
  return getDb().select().from(apiKeys).orderBy(desc(apiKeys.sortOrder)).all()
}

export function getActiveApiKeys(): ApiKeyRow[] {
  return getDb().select().from(apiKeys).where(eq(apiKeys.isActive, 1)).orderBy(desc(apiKeys.sortOrder)).all()
}

export function getApiKey(id: number): ApiKeyRow | undefined {
  return getDb().select().from(apiKeys).where(eq(apiKeys.id, id)).get()
}

export function createApiKey(data: ApiKeyInsert): ApiKeyRow {
  const result = getDb().insert(apiKeys).values(data).returning().get()
  return result
}

export function updateApiKey(id: number, data: Partial<ApiKeyInsert>): ApiKeyRow | undefined {
  return getDb().update(apiKeys).set(data).where(eq(apiKeys.id, id)).returning().get()
}

export function deleteApiKey(id: number): void {
  getDb().delete(apiKeys).where(eq(apiKeys.id, id)).run()
}
