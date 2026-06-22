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

// ── GET /knowledge/export/all — 导出全部知识资产为 JSON ──
route.get('/export/all', (c) => {
  const data = listKnowledgeAssets()
  const exportPayload = {
    exportedAt: new Date().toISOString(),
    version: 1,
    total: data.length,
    categories: [...new Set(data.map(a => a.category))],
    assets: data.map(a => ({
      category: a.category,
      key: a.key,
      value: (() => { try { return JSON.parse(a.value) } catch { return a.value } })(),
      description: a.description || '',
      sortOrder: a.sortOrder,
      isActive: a.isActive,
    })),
  }
  logAudit(c, { action: 'export', resource: 'knowledge_asset', resourceId: 0,
    detail: `Exported ${data.length} knowledge assets` })
  return c.json({ success: true, data: exportPayload })
})

// ── POST /knowledge/import — 从 JSON 批量导入知识资产 ──
const importAssetSchema = z.object({
  category: z.enum(['classics', 'shensha', 'personality', 'bazi', 'pattern']),
  key: z.string().min(1).max(128),
  value: z.union([z.string(), z.record(z.any())]),
  description: z.string().optional().default(''),
  sortOrder: z.number().int().optional().default(0),
  isActive: z.number().min(0).max(1).optional().default(1),
})

const importBodySchema = z.object({
  assets: z.array(importAssetSchema).min(1).max(500),
  mode: z.enum(['upsert', 'skip', 'overwrite']).optional().default('upsert'),
})

route.post('/import', async (c) => {
  let body: unknown
  try { body = await c.req.json() } catch {
    return c.json({ success: false, error: { code: 'BAD_REQUEST', message: '请求体格式错误' } }, 400)
  }

  const parsed = importBodySchema.safeParse(body)
  if (!parsed.success) {
    return c.json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message },
    }, 400)
  }

  const { assets: incoming, mode } = parsed.data
  let created = 0, updated = 0, skipped = 0

  for (const asset of incoming) {
    const existing = getKnowledgeAssetByKey(asset.category, asset.key)
    const valueStr = typeof asset.value === 'string' ? asset.value : JSON.stringify(asset.value)

    if (existing) {
      if (mode === 'skip') {
        skipped++
        continue
      }
      // upsert / overwrite: 更新已有资产
      updateKnowledgeAsset(existing.id, {
        value: valueStr,
        description: asset.description || undefined,
        sortOrder: asset.sortOrder,
        isActive: asset.isActive,
      })
      updated++
    } else {
      createKnowledgeAsset({
        category: asset.category,
        key: asset.key,
        value: valueStr,
        description: asset.description || undefined,
        sortOrder: asset.sortOrder,
      })
      created++
    }
  }

  logAudit(c, { action: 'import', resource: 'knowledge_asset', resourceId: 0,
    detail: JSON.stringify({ mode, created, updated, skipped, total: incoming.length }) })

  return c.json({
    success: true,
    data: { created, updated, skipped, total: incoming.length, mode },
    message: `导入完成：新增 ${created}，更新 ${updated}，跳过 ${skipped}（模式: ${mode}）`,
  })
})

export default route
