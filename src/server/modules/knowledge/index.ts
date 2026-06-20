// ============================================================
// Phase 7 — Modules: 知识资产字典 CRUD 路由
// 文件：src/server/modules/knowledge/index.ts
// 路由：/api/v1/admin/knowledge/*
// ============================================================

import { Hono } from 'hono'
import { z } from 'zod'
import { authMiddleware } from '../../core/middleware/auth'
import { logAudit } from '../../core/middleware/audit'
import {
  listKnowledgeAssets,
  getKnowledgeAsset,
  getKnowledgeAssetByKey,
  createKnowledgeAsset,
  updateKnowledgeAsset,
  deleteKnowledgeAsset,
} from '../../db'

// ═══════════════════════════════════════
// Zod 验证
// ═══════════════════════════════════════

const VALID_CATEGORIES = ['classics', 'shensha', 'personality', 'bazi', 'pattern']

const createBodySchema = z.object({
  category: z.enum(['classics', 'shensha', 'personality', 'bazi', 'pattern']),
  key: z.string().min(1).max(128),
  value: z.string().min(1),
  description: z.string().optional(),
  sortOrder: z.number().int().optional().default(0),
})

const updateBodySchema = z.object({
  key: z.string().min(1).max(128).optional(),
  value: z.string().min(1).optional(),
  description: z.string().optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.number().min(0).max(1).optional(),
})

// ═══════════════════════════════════════
// 路由
// ═══════════════════════════════════════

export const route = new Hono()
route.use('*', authMiddleware)

// ── GET /knowledge — 列出所有（支持 ?category=xxx）──
route.get('/', (c) => {
  const category = c.req.query('category') as string | undefined
  const data = listKnowledgeAssets(category || undefined)
  return c.json({ success: true, data })
})

// ── GET /knowledge/category/:category — 按分类路径参数获取 ──
route.get('/category/:category', (c) => {
  const category = c.req.param('category')
  if (!VALID_CATEGORIES.includes(category as typeof VALID_CATEGORIES[number])) {
    return c.json({
      success: false,
      error: { code: 'INVALID_CATEGORY', message: `无效分类: ${category}，有效值: ${VALID_CATEGORIES.join(', ')}` },
    }, 400)
  }
  const data = listKnowledgeAssets(category)
  return c.json({ success: true, data, category, count: data.length })
})

// ── GET /knowledge/:id — 获取单个 ──
route.get('/:id', (c) => {
  const id = Number(c.req.param('id'))
  const item = getKnowledgeAsset(id)
  if (!item) return c.json({ success: false, error: { code: 'NOT_FOUND', message: '资产不存在' } }, 404)
  return c.json({ success: true, data: item })
})

// ── POST /knowledge — 新增资产 ──
route.post('/', async (c) => {
  let body: unknown
  try { body = await c.req.json() } catch {
    return c.json({ success: false, error: { code: 'BAD_REQUEST', message: '请求体格式错误' } }, 400)
  }

  const parsed = createBodySchema.safeParse(body)
  if (!parsed.success) {
    return c.json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message },
    }, 400)
  }

  // 检查 category+key 唯一
  const existing = getKnowledgeAssetByKey(parsed.data.category, parsed.data.key)
  if (existing) {
    return c.json({
      success: false,
      error: { code: 'DUPLICATE_KEY', message: `该分类下 key="${parsed.data.key}" 已存在` },
    }, 409)
  }

  const result = createKnowledgeAsset(parsed.data)
  logAudit(c, { action: 'create', resource: 'knowledge_asset', resourceId: result.id,
    detail: JSON.stringify({ category: result.category, key: result.key }) })
  return c.json({ success: true, data: result })
})

// ── PUT /knowledge/:id — 更新资产 ──
route.put('/:id', async (c) => {
  const id = Number(c.req.param('id'))

  let body: unknown
  try { body = await c.req.json() } catch {
    return c.json({ success: false, error: { code: 'BAD_REQUEST' } }, 400)
  }

  const parsed = updateBodySchema.safeParse(body)
  if (!parsed.success) {
    return c.json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message },
    }, 400)
  }

  const result = updateKnowledgeAsset(id, parsed.data)
  if (!result) return c.json({ success: false, error: { code: 'NOT_FOUND', message: '资产不存在' } }, 404)

  logAudit(c, { action: 'update', resource: 'knowledge_asset', resourceId: id,
    detail: JSON.stringify({ category: result.category, key: result.key }) })
  return c.json({ success: true, data: result })
})

// ── DELETE /knowledge/:id — 删除资产 ──
route.delete('/:id', (c) => {
  const id = Number(c.req.param('id'))
  const item = getKnowledgeAsset(id)
  if (!item) return c.json({ success: false, error: { code: 'NOT_FOUND', message: '资产不存在' } }, 404)

  const ok = deleteKnowledgeAsset(id)
  logAudit(c, { action: 'delete', resource: 'knowledge_asset', resourceId: id,
    detail: JSON.stringify({ category: item.category, key: item.key }) })
  return c.json({ success: true, data: { ok } })
})

export default route
