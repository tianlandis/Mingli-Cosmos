// ============================================================
// Phase 4 — Modules: LLM & Skills 管理路由
// 文件：src/server/modules/llm/index.ts
// 路由：/api/v1/admin/llm/*
// 更新：2026-06-24 — Ping/Export/SetDefault/Tools 字段
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
  tools: z.array(z.string()).optional().default([]),
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

// ── Tool Calling 配置更新 Schema ──
const VALID_TC_TOOLS = new Set(['bazi_calculator', 'knowledge_dict_lookup', 'feishu_bot_notifier'])

const toolCallingUpdateSchema = z.object({
  tools: z.array(z.string()),
}).refine(
  (data) => {
    const invalid = data.tools.filter(t => !VALID_TC_TOOLS.has(t))
    return invalid.length === 0
  },
  {
    message: '包含未注册的 Tool Calling Key，仅支持: bazi_calculator, knowledge_dict_lookup, feishu_bot_notifier',
    path: ['tools'],
  },
)

// ═══════════════════════════════════════
// 厂商模型提取工具函数
// ═══════════════════════════════════════

interface FetchModelsResult {
  success: boolean
  models?: string[]
  error?: string
  provider?: string  // 检测到的厂商格式
}

/**
 * 从厂商 API 提取模型列表
 * 策略：优先标准 OpenAI /v1/models，失败回退 Google Gemini 格式
 */
async function fetchModelsFromProvider(baseUrl: string, apiKey: string, timeoutMs = 15000): Promise<FetchModelsResult> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  // 清理 baseUrl 末尾斜杠
  const cleanBase = baseUrl.replace(/\/+$/, '')

  // 安全 JSON 解析辅助函数（容错非 JSON 响应）
  const safeJson = async (res: Response): Promise<any | null> => {
    try {
      const text = await res.text()
      if (!text || text.trim().length === 0) return null
      return JSON.parse(text)
    } catch {
      return null
    }
  }

  try {
    // ── 策略 A：标准 OpenAI 兼容 /v1/models ──
    const openAiUrl = `${cleanBase}/models`
    const res = await fetch(openAiUrl, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    })

    if (res.ok) {
      const json = await safeJson(res)
      // OpenAI 格式: { data: [{ id: "model-name" }] }
      if (json?.data && Array.isArray(json.data)) {
        const models = json.data
          .map((m: any) => m.id ?? m.name)
          .filter((id: string) => typeof id === 'string' && id.length > 0)
        if (models.length > 0) {
          return { success: true, models, provider: 'openai-compatible' }
        }
      }
      // 其他格式：直接返回数组
      if (Array.isArray(json)) {
        const models = json
          .map((m: any) => m.id ?? m.name ?? m)
          .filter((id: any) => typeof id === 'string' && id.length > 0)
        if (models.length > 0) {
          return { success: true, models, provider: 'array' }
        }
      }
      // 200 但无法解析模型列表（如返回空对象或非标准结构）
      if (!json) {
        return { success: false, error: '厂商返回了空响应或非 JSON 内容，请检查 Base URL' }
      }
    }

    // ── 策略 B：Google Gemini 格式 ──
    // URL: https://generativelanguage.googleapis.com/v1beta/openai/models?key=xxx
    // 或: https://generativelanguage.googleapis.com/v1beta/models?key=xxx
    const geminiUrl = cleanBase.includes('generativelanguage.googleapis.com')
      ? `${cleanBase}/models?key=${apiKey}`
      : null

    if (geminiUrl) {
      const geminiRes = await fetch(geminiUrl, {
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
      })
      if (geminiRes.ok) {
        const json = await safeJson(geminiRes)
        // Gemini 格式: { models: [{ name: "models/gemini-2.0-flash" }] }
        if (json?.models && Array.isArray(json.models)) {
          const models = json.models
            .map((m: any) => m.name?.replace(/^models\//, '') ?? m.id)
            .filter((id: string) => typeof id === 'string' && id.length > 0)
          if (models.length > 0) {
            return { success: true, models, provider: 'google-gemini' }
          }
        }
      }
    }

    // ── 策略 C：策略 A 返回非 200 但非 401/403 时，尝试去除 /v1 前缀的裸 /models ──
    // 某些非标准 OpenAI 兼容端点（如部分反向代理）不遵循 /v1/models 路径
    if (res.status !== 401 && res.status !== 403) {
      // 如果 cleanBase 已包含 /v1，尝试替换为裸路径
      const bareUrl = cleanBase.replace(/\/v1\/?$/, '') + '/models'
      if (bareUrl !== `${cleanBase}/models`) {
        try {
          const fbRes = await fetch(bareUrl, {
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            signal: controller.signal,
          })
          if (fbRes.ok) {
            const json = await safeJson(fbRes)
            if (json?.data && Array.isArray(json.data)) {
              const models = json.data
                .map((m: any) => m.id ?? m.name)
                .filter((id: string) => typeof id === 'string' && id.length > 0)
              if (models.length > 0) {
                return { success: true, models, provider: 'openai-compatible-bare' }
              }
            }
          }
        } catch { /* 静默失败，继续报错 */ }
      }
    }

    // 区分不同 HTTP 状态码给出针对性错误
    if (res.status === 401 || res.status === 403) {
      return { success: false, error: `认证失败 (HTTP ${res.status})，请检查 API Key 是否正确` }
    }
    if (res.status === 404) {
      return { success: false, error: `端点不存在 (HTTP 404)，请检查 Base URL 是否正确（需包含 /v1 前缀？）` }
    }
    return { success: false, error: `厂商返回非标准响应 (HTTP ${res.status})，请手动输入模型名` }
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return { success: false, error: `请求超时 (${timeoutMs / 1000}s)，请检查 Base URL 是否正确` }
    }
    return { success: false, error: `请求失败: ${err.message || '未知网络错误'}` }
  } finally {
    clearTimeout(timer)
  }
}

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
    // 安全解析 tools (Tool Calling)
    tools: parseSupportedTools((p as any).tools),
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
    tools: JSON.stringify(parsed.data.tools ?? []),
  } as any)

  logAudit(c, { action: 'create', resource: 'llm_provider', resourceId: result.id })
  return c.json({ success: true, data: result })
})

// ---- PUT /llm/:id — 更新 Provider（含 supported_tools + tools + set-default）----
route.put('/:id', async (c) => {
  const id = Number(c.req.param('id'))

  let body: Record<string, unknown>
  try { body = await c.req.json() as Record<string, unknown> } catch {
    return c.json({ success: false, error: { code: 'BAD_REQUEST' } }, 400)
  }

  // ── 修复：编辑模式下前端传 apiKey: ""，需移除该字段以免命中 min(1) 校验 ──
  if (body.apiKey === '' || body.apiKey === null || body.apiKey === undefined) {
    delete body.apiKey
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
  if (data.tools !== undefined) {
    (data as any).tools = JSON.stringify(data.tools)
  }

  // ── 设为默认：确保全局只有一个 Default ──
  if (body.isDefault === 1 || body.isDefault === true) {
    const all = listApiKeys()
    for (const p of all) {
      if (p.id !== id && (p as any).isDefault === 1) {
        updateApiKey(p.id, { isDefault: 0 } as any)
      }
    }
    (data as any).isDefault = 1
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

// ---- POST /llm/fetch-models — 代理请求厂商 /v1/models（解决跨域）----
route.post('/fetch-models', async (c) => {
  let body: { baseUrl?: string; apiKey?: string; providerId?: number }
  try { body = await c.req.json() } catch {
    return c.json({ success: false, error: { code: 'BAD_REQUEST', message: '请求体格式错误' } }, 400)
  }

  let { baseUrl, apiKey, providerId } = body

  // 如果未传 apiKey 但传了 providerId，从数据库读取已存储的 Key
  if (!apiKey && providerId) {
    const existing = getApiKey(providerId)
    if (!existing) {
      return c.json({
        success: false,
        error: { code: 'NOT_FOUND', message: `Provider ID ${providerId} 不存在` },
      }, 404)
    }
    apiKey = (existing as any).apiKey
    // 如果数据库里也没有 baseUrl，用 Provider 已存储的
    if (!baseUrl) {
      baseUrl = (existing as any).baseUrl
    }
  }

  if (!baseUrl || !apiKey) {
    return c.json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'baseUrl 和 apiKey 为必填参数（或提供有效的 providerId 以读取已存储配置）' },
    }, 400)
  }

  const result = await fetchModelsFromProvider(baseUrl, apiKey)

  logAudit(c, {
    action: 'fetch_models',
    resource: 'llm_provider',
    detail: JSON.stringify({ baseUrl, modelCount: result.models?.length ?? 0, provider: result.provider }),
  })

  if (!result.success) {
    return c.json({
      success: false,
      error: { code: 'FETCH_MODELS_FAILED', message: result.error },
    }, 502)
  }

  return c.json({
    success: true,
    data: {
      models: result.models,
      count: result.models!.length,
      provider: result.provider,
    },
  })
})

// ---- POST /llm/migrate — 存量数据迁移：从 .env / app_configs 导入旧配置到 api_keys ----
route.post('/migrate', async (c) => {
  // 读取当前 .env 中的 LLM 配置（通过 app_configs 或环境变量）
  const { getAppConfig } = await import('../../config/index')
  const config = getAppConfig()

  if (config.source !== 'env' && config.source !== 'db') {
    return c.json({
      success: false,
      error: { code: 'NO_LEGACY_CONFIG', message: '未检测到旧配置数据' },
    }, 404)
  }

  // 检查是否已有同名 Provider（去重）
  const existing = listApiKeys()
  const label = `迁移-${config.provider}-${config.model?.split('/')?.pop() ?? 'default'}`
  const duplicate = existing.find(p => p.label === label)
  if (duplicate) {
    return c.json({
      success: false,
      error: {
        code: 'DUPLICATE',
        message: `已存在同名 Provider "${label}" (ID: ${duplicate.id})，无需重复导入`,
      },
    }, 409)
  }

  // 创建新 Provider
  const result = createApiKey({
    provider: config.provider || 'custom',
    label,
    apiKey: config.apiKey || '',
    baseUrl: config.baseUrl || '',
    model: config.model || '',
    temperature: config.temperature ?? 0.7,
    maxTokens: config.maxTokens ?? 2048,
    isActive: 1,
    sortOrder: existing.length,
    supportedTools: '[]',
    testStatus: 'untested',
  } as any)

  logAudit(c, {
    action: 'migrate',
    resource: 'llm_provider',
    resourceId: result.id,
    detail: JSON.stringify({ source: config.source, provider: config.provider, model: config.model }),
  })

  return c.json({
    success: true,
    data: {
      id: result.id,
      label: result.label,
      provider: result.provider,
      model: result.model,
      source: config.source,
    },
    message: `已从 ${config.source === 'env' ? '.env 环境变量' : '数据库配置'} 导入为 "${label}"`,
  })
})

// ---- PUT /llm/:id/tool-calling — 更新 Tool Calling 配置（Agent 工具）----
route.put('/:id/tool-calling', async (c) => {
  const id = Number(c.req.param('id'))

  const existing = getApiKey(id)
  if (!existing) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Provider 不存在' } }, 404)
  }

  let body: unknown
  try { body = await c.req.json() } catch {
    return c.json({ success: false, error: { code: 'BAD_REQUEST', message: '请求体格式错误' } }, 400)
  }

  const parsed = toolCallingUpdateSchema.safeParse(body)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return c.json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: issue?.message ?? '数据校验失败',
        details: {
          path: issue?.path?.join('.'),
          invalidKeys: body && typeof body === 'object' && 'tools' in body
            ? (body as any).tools?.filter((t: string) => !VALID_TC_TOOLS.has(t))
            : [],
        },
      },
    }, 400)
  }

  const result = updateApiKey(id, {
    tools: JSON.stringify(parsed.data.tools),
  } as any)

  logAudit(c, {
    action: 'update_tool_calling',
    resource: 'llm_provider',
    resourceId: id,
    detail: JSON.stringify({ tools: parsed.data.tools }),
  })

  return c.json({ success: true, data: result })
})

// ---- POST /llm/:id/ping — 连通性测试（5 秒超时）----
route.post('/:id/ping', async (c) => {
  const id = Number(c.req.param('id'))
  const provider = getApiKey(id)
  if (!provider) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Provider 不存在' } }, 404)
  }

  const baseUrl = (provider as any).baseUrl || ''
  const apiKey = (provider as any).apiKey || ''

  if (!baseUrl) {
    return c.json({ success: false, error: { code: 'NO_BASE_URL', message: 'Provider 未配置 Base URL' } }, 400)
  }

  const cleanBase = baseUrl.replace(/\/+$/, '')
  const pingUrl = `${cleanBase}/models`

  const start = Date.now()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 5000)

  try {
    const res = await fetch(pingUrl, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    })
    clearTimeout(timer)

    const latency = Date.now() - start

    // 任何 2xx 或 401（有认证但端点可访问）都算连通
    if (res.ok || res.status === 401 || res.status === 403) {
      // 更新 testStatus + testLatency
      updateApiKey(id, {
        testStatus: 'ok',
        testLatency: latency,
        testedAt: new Date().toISOString(),
      } as any)
      return c.json({ success: true, data: { latency, status: 'ok' } })
    }

    updateApiKey(id, {
      testStatus: 'failed',
      testLatency: latency,
      testedAt: new Date().toISOString(),
    } as any)
    return c.json({ success: false, error: { code: 'PING_FAILED', message: `HTTP ${res.status}` }, data: { latency } }, 502)
  } catch (err: any) {
    clearTimeout(timer)
    const latency = Date.now() - start
    const errorMsg = err.name === 'AbortError' ? '连接超时 (5s)' : (err.message || '未知网络错误')

    updateApiKey(id, {
      testStatus: 'failed',
      testLatency: latency,
      testedAt: new Date().toISOString(),
    } as any)

    return c.json({
      success: false,
      error: { code: 'PING_FAILED', message: errorMsg },
      data: { latency },
    }, 502)
  }
})

// ---- GET /llm/export — 导出全量 Provider 配置为 JSON ----
route.get('/export', (c) => {
  const providers = listApiKeys().map(p => ({
    ...p,
    // 安全脱敏：mask API Key 中间 8 位
    apiKey: maskApiKey(p.apiKey),
    supportedTools: parseSupportedTools((p as any).supported_tools),
    tools: parseSupportedTools((p as any).tools),
  }))

  const exportData = {
    exportedAt: new Date().toISOString(),
    providerCount: providers.length,
    providers,
  }

  logAudit(c, { action: 'export', resource: 'llm_provider', detail: JSON.stringify({ count: providers.length }) })

  return c.json({ success: true, data: exportData })
})

/**
 * API Key 脱敏：保留前 4 位 + 后 4 位，中间替换为 ****
 */
function maskApiKey(key: string): string {
  if (!key || key.length <= 8) return '****'
  return key.slice(0, 4) + '*'.repeat(Math.min(8, key.length - 8)) + key.slice(-4)
}

export default route
