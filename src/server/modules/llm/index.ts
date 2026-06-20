// ============================================================
// Phase 4 — Modules: LLM & Skills 管理路由
// 文件：src/server/modules/llm/index.ts
// 路由：/api/v1/admin/llm/*
// ============================================================

import { Hono } from 'hono'
import { z } from 'zod'
import { authMiddleware } from '../../core/middleware/auth'
import { logAudit } from '../../core/middleware/audit'
import { listApiKeys, getApiKey, createApiKey, updateApiKey, deleteApiKey } from '../../db'
import { AVAILABLE_TOOLS, parseSupportedTools, serializeSupportedTools } from './tools-registry'
import { generateToolSchemaDocs } from './tools-executor'

// ═══════════════════════════════════════
// Zod 验证 Schema
// ═══════════════════════════════════════

const providerBodySchema = z.object({
  provider: z.string().min(1),
  label: z.string().min(1),
  apiKey: z.string().min(1),
  baseUrl: z.string().optional(),
  model: z.string().optional(),
  temperature: z.number().min(0).max(2).optional().default(0.7),
  maxTokens: z.number().int().positive().optional().default(2048),
  isActive: z.number().min(0).max(1).optional().default(1),  // 0=禁用, 1=启用
  supportedTools: z.array(z.string()).optional().default([]),
})

// ── 工具更新专用 Schema（含注册表交叉校验）──
const VALID_TOOL_IDS = new Set(AVAILABLE_TOOLS.map(t => t.id))

const toolsUpdateSchema = z.object({
  supportedTools: z.array(z.string()),
}).refine(
  (data) => {
    const invalid = data.supportedTools.filter(t => !VALID_TOOL_IDS.has(t))
    return invalid.length === 0
  },
  {
    message: '包含未注册的工具 Key，请检查 tools-registry',
    path: ['supportedTools'],
  },
)

// ═══════════════════════════════════════
// 导出路由
// ═══════════════════════════════════════

export const route = new Hono()
route.use('*', authMiddleware)

// ---- GET /llm — 列出所有 Provider ----
route.get('/', (c) => {
  const providers = listApiKeys().map(p => ({
    ...p,
    // 安全解析 supported_tools
    supportedTools: parseSupportedTools((p as any).supported_tools),
  }))
  return c.json({ success: true, data: providers })
})

// ---- GET /llm/tools — 获取可用工具清单 ----
route.get('/tools', (c) => {
  return c.json({ success: true, data: { tools: AVAILABLE_TOOLS, schemas: generateToolSchemaDocs() } })
})

// ---- POST /llm — 新增 Provider ----
route.post('/', async (c) => {
  let body: unknown
  try { body = await c.req.json() } catch {
    return c.json({ success: false, error: { code: 'BAD_REQUEST', message: '请求体格式错误' } }, 400)
  }

  const parsed = providerBodySchema.safeParse(body)
  if (!parsed.success) {
    return c.json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message },
    }, 400)
  }

  const result = createApiKey({
    ...parsed.data,
    supportedTools: serializeSupportedTools(parsed.data.supportedTools ?? []),
  } as any)

  logAudit(c, { action: 'create', resource: 'llm_provider', resourceId: result.id })
  return c.json({ success: true, data: result })
})

// ---- PUT /llm/:id — 更新 Provider（含 supported_tools） ----
route.put('/:id', async (c) => {
  const id = Number(c.req.param('id'))

  let body: unknown
  try { body = await c.req.json() } catch {
    return c.json({ success: false, error: { code: 'BAD_REQUEST' } }, 400)
  }

  const parsed = providerBodySchema.partial().safeParse(body)
  if (!parsed.success) {
    return c.json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message },
    }, 400)
  }

  const data = { ...parsed.data }
  if (data.supportedTools !== undefined) {
    (data as any).supportedTools = serializeSupportedTools(data.supportedTools)
  }

  const result = updateApiKey(id, data as any)
  if (!result) return c.json({ success: false, error: { code: 'NOT_FOUND' } }, 404)

  logAudit(c, { action: 'update', resource: 'llm_provider', resourceId: id })
  return c.json({ success: true, data: result })
})

// ---- PUT /llm/:id/tools — 专门更新 supported_tools（含 Zod 越权校验）----
route.put('/:id/tools', async (c) => {
  const id = Number(c.req.param('id'))

  // 1. 验证 Provider 存在
  const existing = getApiKey(id)
  if (!existing) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Provider 不存在' } }, 404)
  }

  // 2. 解析并校验请求体
  let body: unknown
  try { body = await c.req.json() } catch {
    return c.json({ success: false, error: { code: 'BAD_REQUEST', message: '请求体格式错误' } }, 400)
  }

  const parsed = toolsUpdateSchema.safeParse(body)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return c.json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: issue?.message ?? '数据校验失败',
        details: {
          path: issue?.path?.join('.'),
          invalidKeys: body && typeof body === 'object' && 'supportedTools' in body
            ? (body as any).supportedTools?.filter((t: string) => !VALID_TOOL_IDS.has(t))
            : [],
        },
      },
    }, 400)
  }

  // 3. 仅更新 supported_tools 字段
  const result = updateApiKey(id, {
    supportedTools: serializeSupportedTools(parsed.data.supportedTools),
  } as any)

  const updated = {
    ...result,
    supportedTools: parsed.data.supportedTools,
  }

  logAudit(c, {
    action: 'update_tools',
    resource: 'llm_provider',
    resourceId: id,
    detail: JSON.stringify({ tools: parsed.data.supportedTools }),
  })

  return c.json({ success: true, data: updated })
})

// ---- DELETE /llm/:id — 删除 Provider ----
route.delete('/:id', (c) => {
  const id = Number(c.req.param('id'))
  deleteApiKey(id)
  logAudit(c, { action: 'delete', resource: 'llm_provider', resourceId: id })
  return c.json({ success: true, data: { ok: true } })
})

export default route
