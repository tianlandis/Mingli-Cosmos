// ============================================================
// API Keys Repository
// 文件：src/server/db/repositories/api-keys.ts
// ============================================================

import { getDb } from '../index'
import { apiKeys } from '../schema'
import { eq, and, desc } from 'drizzle-orm'

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

/**
 * 获取全局默认 API Key（isDefault=1 且 isActive=1）
 * 用于 AI 引擎动态路由：每次实际调用 LLM 前，读取后台配置的最新默认供应商
 * @returns 默认供应商行，若无则返回 undefined
 */
export function getDefaultApiKey(): ApiKeyRow | undefined {
  return getDb()
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.isDefault, 1), eq(apiKeys.isActive, 1)))
    .get()
}

/**
 * 获取全局默认 API Key（放宽为 isDefault=1，不要求 isActive=1）
 * 兜底查询 —— 避免管理员误下线导致引擎无可用配置
 */
export function getDefaultApiKeyFallback(): ApiKeyRow | undefined {
  return getDb()
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.isDefault, 1))
    .get()
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
