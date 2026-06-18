// ============================================================
// Phase 4 — Modules: Config 配置管理路由
// 文件：src/server/modules/config/index.ts
// 路由：/api/v1/admin/config/*
// 关键：module_settings 使用 Zod 进行 Schema 验证
// ============================================================

import { Hono } from 'hono'
import { z } from 'zod'
import { authMiddleware } from '../../core/middleware/auth'
import { logAudit } from '../../core/middleware/audit'
import { listConfigs, setConfig, deleteConfig } from '../../db'
import { reloadConfig, isUsingDbConfig } from '../../config'
import { moduleSettingsSchema, type ModuleSettings } from './schema'

// ═══════════════════════════════════════
// Zod 验证
// ═══════════════════════════════════════

const setConfigBodySchema = z.object({
  key: z.string().min(1),
  value: z.string(),
  displayName: z.string().optional(),
  description: z.string().optional(),
  valueType: z.enum(['string', 'json', 'number', 'boolean']).optional().default('string'),
  category: z.enum(['general', 'llm', 'security', 'ui']).optional().default('general'),
})

// ═══════════════════════════════════════
// 导出路由
// ═══════════════════════════════════════

export const route = new Hono()
route.use('*', authMiddleware)

// ---- GET /config — 列出所有配置 ----
route.get('/', (c) => {
  const configs = listConfigs()
  return c.json({ success: true, data: { configs, usingDb: isUsingDbConfig() } })
})

// ---- GET /config/module-settings — 泛型功能开关（Zod 验证） ----
route.get('/module-settings', (c) => {
  const row = (listConfigs() as any[]).find((c: any) => c.key === 'module_settings')
  let settings: ModuleSettings

  if (row?.value) {
    try {
      const raw = JSON.parse(row.value)
      settings = moduleSettingsSchema.parse(raw)
    } catch {
      // JSON 损坏时返回默认值
      settings = moduleSettingsSchema.parse({})
    }
  } else {
    settings = moduleSettingsSchema.parse({})
  }

  return c.json({ success: true, data: settings })
})

// ---- PUT /config/module-settings — 更新功能开关（Zod 验证） ----
route.put('/module-settings', async (c) => {
  let body: unknown
  try { body = await c.req.json() } catch {
    return c.json({ success: false, error: { code: 'BAD_REQUEST' } }, 400)
  }

  // ⭐ 关键：使用 Zod 验证，防止 JSON.parse 报错 + 非法值注入
  const parsed = moduleSettingsSchema.partial().safeParse(body)
  if (!parsed.success) {
    return c.json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: '模块配置格式错误',
        details: parsed.error.issues,
      },
    }, 400)
  }

  // 合并现有设置（partial update）
  const existing = (() => {
    const row = (listConfigs() as any[]).find((c: any) => c.key === 'module_settings')
    if (row?.value) {
      try { return moduleSettingsSchema.parse(JSON.parse(row.value)) }
      catch { return moduleSettingsSchema.parse({}) }
    }
    return moduleSettingsSchema.parse({})
  })()

  const merged = moduleSettingsSchema.parse({ ...existing, ...parsed.data })
  const value = JSON.stringify(merged)

  setConfig('module_settings', value, '模块功能开关', '控制各业务模块的启用/禁用及参数限制', 'json', 'general')
  reloadConfig()
  logAudit(c, { action: 'update', resource: 'config', detail: 'module_settings' })

  return c.json({ success: true, data: merged })
})

// ---- POST /config — 设置/更新配置 ----
route.post('/', async (c) => {
  let body: unknown
  try { body = await c.req.json() } catch {
    return c.json({ success: false, error: { code: 'BAD_REQUEST' } }, 400)
  }

  const parsed = setConfigBodySchema.safeParse(body)
  if (!parsed.success) {
    return c.json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message },
    }, 400)
  }

  const result = setConfig(
    parsed.data.key,
    parsed.data.value,
    parsed.data.displayName,
    parsed.data.description,
    parsed.data.valueType,
    parsed.data.category,
  )

  logAudit(c, { action: 'update', resource: 'config', detail: parsed.data.key })
  return c.json({ success: true, data: result })
})

// ---- DELETE /config/:key — 删除配置 ----
route.delete('/:key', (c) => {
  const key = c.req.param('key')
  deleteConfig(key)
  logAudit(c, { action: 'delete', resource: 'config', detail: key })
  return c.json({ success: true, data: { ok: true } })
})

// ---- POST /config/reload — 强制刷新 ----
route.post('/reload', (c) => {
  const config = reloadConfig()
  return c.json({ success: true, data: { source: config.source } })
})

export default route
