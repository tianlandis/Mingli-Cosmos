// ============================================================
// Phase 7 — 知识资产字典 Repository
// 文件：src/server/db/repositories/knowledge-assets.ts
// 表：knowledge_assets (category + key → JSON value)
// ============================================================

import { getDb } from '../index'
import { knowledgeAssets } from '../schema'
import { eq, and, desc, sql } from 'drizzle-orm'

export interface KnowledgeAsset {
  id: number
  category: string       // 'classics' | 'shensha' | 'personality' | 'bazi' | 'pattern'
  key: string            // 唯一键名
  value: string          // JSON
  description: string | null
  sortOrder: number
  version: number
  isActive: number
  createdAt: string
  updatedAt: string
}

export interface CreateKnowledgeAsset {
  category: string
  key: string
  value: string
  description?: string
  sortOrder?: number
}

export interface UpdateKnowledgeAsset {
  key?: string
  value?: string
  description?: string
  sortOrder?: number
  isActive?: number
}

/** 按分类列出所有资产 */
export function listKnowledgeAssets(category?: string): KnowledgeAsset[] {
  const db = getDb()
  const q = db.select().from(knowledgeAssets).orderBy(desc(knowledgeAssets.sortOrder), desc(knowledgeAssets.updatedAt))
  if (category) {
    return q.where(eq(knowledgeAssets.category, category)).all() as KnowledgeAsset[]
  }
  return q.all() as KnowledgeAsset[]
}

/** 获取单个资产 */
export function getKnowledgeAsset(id: number): KnowledgeAsset | undefined {
  const db = getDb()
  return db.select().from(knowledgeAssets).where(eq(knowledgeAssets.id, id)).get() as KnowledgeAsset | undefined
}

/** 按 category + key 查询 */
export function getKnowledgeAssetByKey(category: string, key: string): KnowledgeAsset | undefined {
  const db = getDb()
  return db.select().from(knowledgeAssets).where(
    and(eq(knowledgeAssets.category, category), eq(knowledgeAssets.key, key))
  ).get() as KnowledgeAsset | undefined
}

/** 新增资产 */
export function createKnowledgeAsset(data: CreateKnowledgeAsset): KnowledgeAsset {
  const db = getDb()
  const result = db.insert(knowledgeAssets).values({
    category: data.category,
    key: data.key,
    value: data.value,
    description: data.description ?? null,
    sortOrder: data.sortOrder ?? 0,
    version: 1,
    isActive: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }).returning().get() as KnowledgeAsset
  return result
}

/** 更新资产 */
export function updateKnowledgeAsset(id: number, data: UpdateKnowledgeAsset): KnowledgeAsset | undefined {
  const db = getDb()
  const existing = getKnowledgeAsset(id)
  if (!existing) return undefined

  const updates: Record<string, unknown> = {
    updatedAt: new Date().toISOString(),
    version: existing.version + 1,
  }
  if (data.key !== undefined) updates.key = data.key
  if (data.value !== undefined) updates.value = data.value
  if (data.description !== undefined) updates.description = data.description
  if (data.sortOrder !== undefined) updates.sortOrder = data.sortOrder
  if (data.isActive !== undefined) updates.isActive = data.isActive

  const result = db.update(knowledgeAssets).set(updates).where(eq(knowledgeAssets.id, id)).returning().get() as KnowledgeAsset
  return result
}

/** 删除资产 */
export function deleteKnowledgeAsset(id: number): boolean {
  const db = getDb()
  const result = db.delete(knowledgeAssets).where(eq(knowledgeAssets.id, id)).run()
  return result.changes > 0
}
