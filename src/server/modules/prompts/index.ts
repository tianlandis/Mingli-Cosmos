// ============================================================
// Phase 4 — Modules: Prompt 引擎路由 (v4.5 升级)
// 文件：src/server/modules/prompts/index.ts
// 路由：/api/v1/admin/prompts/*
// 新增：版本历史保存 + GET /:id/versions + POST /:id/rollback/:version
// ============================================================

import { Hono } from 'hono'
import { z } from 'zod'
import { authMiddleware } from '../../core/middleware/auth'
import { logAudit } from '../../core/middleware/audit'
import {
  listPrompts, getPrompt, createPrompt, updatePrompt, deletePrompt,
  listPromptVersions, getPromptVersion, createPromptVersion, getLatestVersion,
  getConfig, setConfig, listApiKeys,
} from '../../db'

// ═══════════════════════════════════════
// Zod 验证 Schema
// ═══════════════════════════════════════

const promptBodySchema = z.object({
  name: z.string().min(1),
  displayName: z.string().min(1),
  content: z.string().min(1, 'Prompt 内容不能为空'),
  variables: z.string().optional().default('[]'),
  description: z.string().optional(),
  category: z.enum(['builtin', 'custom']).optional().default('custom'),
  isBuiltin: z.number().min(0).max(1).optional().default(0),
  changeNote: z.string().optional(),
})

// ═══════════════════════════════════════
// 工具函数：自动创建版本快照
// ═══════════════════════════════════════

function snapshotVersion(promptId: number, oldContent: string, changeNote?: string) {
  const nextVersion = getLatestVersion(promptId) + 1
  createPromptVersion({
    promptId,
    version: nextVersion,
    content: oldContent,
    changeNote: changeNote ?? null,
    createdBy: 'admin',
  } as any)
  return nextVersion
}

// ═══════════════════════════════════════
// 导出路由
// ═══════════════════════════════════════

export const route = new Hono()
route.use('*', authMiddleware)

// ---- GET /prompts — 列出所有模板 ----
route.get('/', (c) => {
  const prompts = listPrompts()
  return c.json({ success: true, data: prompts })
})

// ═══════════════════════════════════════
// Phase 4.11 — 防幻觉 L3 护栏热编辑 API（必须在 /:id 之前注册）
// GET  /prompts/guards — 获取当前 L1/L2 护栏规则
// PUT  /prompts/guards — 保存并热更新
// 存储：app_configs key='anti_hallucination_rules' (JSON)
// ═══════════════════════════════════════

const L1_RULE_NAMES = [
  'corePositioning', 'toolAuthorization',
  'rule0_noPaipan', 'rule1_dataLock', 'rule2_noAbsolute',
  'rule3_safety', 'rule4_style', 'rule5_topicBoundary',
] as const

type L1RuleName = typeof L1_RULE_NAMES[number]

interface GuardRuleItem {
  name: L1RuleName
  label: string
  content: string
}

interface GuardsPayload {
  l1Rules: GuardRuleItem[]
  l1RejectMessage: string
}

const guardsBodySchema = z.object({
  l1Rules: z.array(z.object({
    name: z.enum(L1_RULE_NAMES),
    label: z.string().min(1, '规则标题不可为空'),
    content: z.string().min(1, '规则内容不可为空'),
  })).length(L1_RULE_NAMES.length, `必须包含全部 ${L1_RULE_NAMES.length} 条 L1 规则`),
  l1RejectMessage: z.string().min(1, '拒绝话术不可为空'),
})

// ---- GET /prompts/guards — 获取当前护栏规则 ----
route.get('/guards', (c) => {
  const row = getConfig('anti_hallucination_rules')
  if (row) {
    try {
      const data = JSON.parse(row.value) as GuardsPayload
      return c.json({ success: true, data, source: 'db', updatedAt: row.updatedAt })
    } catch {
      // DB 数据损坏 → 返回内置默认值
    }
  }

  // 回退：返回内置默认（与 anti-hallucination.ts 同步）
  const fallback = buildDefaultGuards()
  return c.json({ success: true, data: fallback, source: 'builtin', updatedAt: null })
})

// ---- PUT /prompts/guards — 保存护栏规则 ----
route.put('/guards', async (c) => {
  let body: unknown
  try { body = await c.req.json() } catch {
    return c.json({ success: false, error: { code: 'BAD_REQUEST' } }, 400)
  }

  const parsed = guardsBodySchema.safeParse(body)
  if (!parsed.success) {
    return c.json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; '),
      },
    }, 400)
  }

  const jsonValue = JSON.stringify(parsed.data)
  const result = setConfig(
    'anti_hallucination_rules',
    jsonValue,
    'L3 防幻觉护栏规则',
    'L1 系统提示词 + L2 拒绝话术，热生效无需重启',
    'json',
    'security',
  )

  logAudit(c, {
    action: 'update',
    resource: 'config',
    resourceId: result.id,
    detail: JSON.stringify({ key: 'anti_hallucination_rules' }),
  })

  return c.json({
    success: true,
    data: parsed.data,
    message: '护栏规则已保存，将在下一轮对话中自动生效',
    updatedAt: result.updatedAt,
  })
})

// ═══════════════════════════════════════
// POST /prompts/debug — 实时调试端点（必须在 /:id 之前注册）
// ═══════════════════════════════════════

const debugBodySchema = z.object({
  prompt: z.string().min(1, 'Prompt 内容不能为空'),
  userInput: z.string().min(1, '用户输入不能为空'),
  temperature: z.number().min(0).max(2).optional(),
  topP: z.number().min(0).max(1).optional(),
  maxTokens: z.number().int().min(1).max(32768).optional(),
})

route.post('/debug', async (c) => {
  let body: unknown
  try { body = await c.req.json() } catch {
    return c.json({ success: false, error: { code: 'BAD_REQUEST', message: '请求体格式错误' } }, 400)
  }

  const parsed = debugBodySchema.safeParse(body)
  if (!parsed.success) {
    return c.json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message },
    }, 400)
  }

  const { prompt, userInput, temperature: reqTemp, topP, maxTokens: reqMaxTokens } = parsed.data

  // 查找活跃的 LLM Provider
  const providers = listApiKeys().filter((p: any) => p.isActive === 1)
  if (providers.length === 0) {
    return c.json({
      success: false,
      error: { code: 'NO_PROVIDER', message: '没有可用的 LLM Provider，请先在 LLM 管理页配置' },
    }, 400)
  }

  const provider = providers[0]
  const baseUrl = provider.baseUrl || 'https://api.openai.com/v1'
  const apiKey = provider.apiKey
  const model = provider.model || 'gpt-4o'

  const finalTemp = reqTemp ?? provider.temperature ?? 0.7
  const finalTopP = topP ?? provider.topP ?? 1.0
  const finalMaxTokens = reqMaxTokens ?? provider.maxTokens ?? 2048

  try {
    const llmBody: Record<string, any> = {
      model,
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: userInput },
      ],
      temperature: finalTemp,
      max_tokens: finalMaxTokens,
    }
    if (finalTopP !== undefined && finalTopP < 1.0) {
      llmBody.top_p = finalTopP
    }

    const llmRes = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(llmBody),
    })

    if (!llmRes.ok) {
      const errText = await llmRes.text()
      return c.json({
        success: false,
        error: { code: 'LLM_ERROR', message: `LLM 返回错误 (${llmRes.status}): ${errText.slice(0, 200)}` },
      }, 502)
    }

    const llmData = await llmRes.json() as any
    const output = llmData.choices?.[0]?.message?.content || llmData.content || '(空响应)'

    logAudit(c, {
      action: 'debug',
      resource: 'prompt_debug',
      detail: JSON.stringify({ provider: provider.provider, model, inputLen: userInput.length, outputLen: output.length }),
    })

    return c.json({
      success: true,
      data: {
        output,
        model,
        provider: provider.provider,
        usage: llmData.usage || null,
      },
    })
  } catch (e: any) {
    return c.json({
      success: false,
      error: { code: 'LLM_ERROR', message: `调用 LLM 失败: ${e.message}` },
    }, 502)
  }
})

// ---- GET /prompts/:id — 获取单个模板 ----
route.get('/:id', (c) => {
  const id = Number(c.req.param('id'))
  const prompt = getPrompt(id)
  if (!prompt) return c.json({ success: false, error: { code: 'NOT_FOUND' } }, 404)
  return c.json({ success: true, data: prompt })
})

// ---- GET /prompts/:id/versions — 列出某模板的所有历史版本 ----
route.get('/:id/versions', (c) => {
  const id = Number(c.req.param('id'))
  const prompt = getPrompt(id)
  if (!prompt) return c.json({ success: false, error: { code: 'NOT_FOUND' } }, 404)

  const versions = listPromptVersions(id)
  return c.json({ success: true, data: versions })
})

// ---- POST /prompts — 新建模板 ----
route.post('/', async (c) => {
  let body: unknown
  try { body = await c.req.json() } catch {
    return c.json({ success: false, error: { code: 'BAD_REQUEST' } }, 400)
  }

  const parsed = promptBodySchema.safeParse(body)
  if (!parsed.success) {
    return c.json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message },
    }, 400)
  }

  const result = createPrompt({
    name: parsed.data.name,
    displayName: parsed.data.displayName,
    content: parsed.data.content,
    variables: parsed.data.variables,
    description: parsed.data.description ?? null,
    category: parsed.data.category,
    isBuiltin: parsed.data.isBuiltin,
  } as any)

  logAudit(c, { action: 'create', resource: 'prompt', resourceId: result.id })
  return c.json({ success: true, data: result })
})

// ---- PUT /prompts/:id — 更新模板（自动版本递增 + 快照）----
route.put('/:id', async (c) => {
  const id = Number(c.req.param('id'))

  let body: unknown
  try { body = await c.req.json() } catch {
    return c.json({ success: false, error: { code: 'BAD_REQUEST' } }, 400)
  }

  const parsed = promptBodySchema.partial().safeParse(body)
  if (!parsed.success) {
    return c.json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message },
    }, 400)
  }

  const existing = getPrompt(id)
  if (!existing) return c.json({ success: false, error: { code: 'NOT_FOUND' } }, 404)

  // ── 自动快照：更新前将当前版本存入 prompt_versions ──
  if (parsed.data.content !== undefined && parsed.data.content !== existing.content) {
    const changeNote = parsed.data.changeNote ?? '编辑更新'
    const v = snapshotVersion(id, existing.content, changeNote)

    // 版本号自动递增
    const data = { ...parsed.data, version: v } as any
    const result = updatePrompt(id, data)
    logAudit(c, {
      action: 'update',
      resource: 'prompt',
      resourceId: id,
      detail: JSON.stringify({ version: v, changeNote }),
    })
    return c.json({ success: true, data: result })
  }

  // 仅修改元数据（不涉及 content），不创建快照
  const result = updatePrompt(id, parsed.data as any)
  logAudit(c, { action: 'update', resource: 'prompt', resourceId: id })
  return c.json({ success: true, data: result })
})

// ---- POST /prompts/:id/rollback/:version — 回滚到指定版本 ----
route.post('/:id/rollback/:version', (c) => {
  const id = Number(c.req.param('id'))
  const targetVersion = Number(c.req.param('version'))

  // 1. 验证 Prompt 存在
  const prompt = getPrompt(id)
  if (!prompt) return c.json({ success: false, error: { code: 'NOT_FOUND', message: '模板不存在' } }, 404)

  // 2. 验证目标版本存在
  const versionRecord = getPromptVersion(id, targetVersion)
  if (!versionRecord) {
    return c.json({
      success: false,
      error: { code: 'NOT_FOUND', message: `版本 ${targetVersion} 不存在` },
    }, 404)
  }

  // 3. 先保存当前版本为快照（防止回滚不可逆）
  snapshotVersion(id, prompt.content, `回滚前的自动存档 (→ v${targetVersion})`)

  // 4. 用目标版本的 content 覆盖当前模板
  const rolledBack = updatePrompt(id, {
    content: versionRecord.content,
    version: getLatestVersion(id) + 1,
  } as any)

  logAudit(c, {
    action: 'rollback',
    resource: 'prompt',
    resourceId: id,
    detail: JSON.stringify({ fromVersion: prompt.version, toVersion: targetVersion }),
  })

  return c.json({
    success: true,
    data: rolledBack,
    message: `已从 v${prompt.version} 回滚至 v${targetVersion}`,
  })
})

// ---- DELETE /prompts/:id — 删除模板（内置不可删）----
route.delete('/:id', (c) => {
  const id = Number(c.req.param('id'))
  const existing = getPrompt(id)
  if (!existing) return c.json({ success: false, error: { code: 'NOT_FOUND' } }, 404)
  if ((existing as any).is_builtin) {
    return c.json({
      success: false,
      error: { code: 'FORBIDDEN', message: '内置模板不可删除，仅允许"另存为新版本"' },
    }, 403)
  }

  deletePrompt(id)
  logAudit(c, { action: 'delete', resource: 'prompt', resourceId: id })
  return c.json({ success: true, data: { ok: true } })
})

/**
 * 构建内置默认护栏（与 anti-hallucination.ts 的 buildAntiHallucinationPrompt 同步）
 * 当 DB 中无配置时用作回退
 */
function buildDefaultGuards(): GuardsPayload {
  return {
    l1Rules: [
      {
        name: 'corePositioning',
        label: '核心定位',
        content: '你是"解盘者"，绝非"排盘者"。\n你的职责：根据下方已由系统精准计算完成的命盘数据，为用户提供专业的解读和分析。\n你绝对禁止：自行推算天干地支、计算起运时间、判断格局、排大运等任何排盘行为。\n所有命理计算已由专业算法引擎完成，你只需要基于结果"看图说话"。',
      },
      {
        name: 'toolAuthorization',
        label: '工具使用授权',
        content: '你可以使用系统提供的工具函数（solar_term_calc、calendar_lookup、classic_search、famous_chart_compare 等）来查询节气时间、万年历信息或命理典籍内容。调用工具不等于排盘——这些是查询/验证类操作，工具返回的数据由系统算法保证准确性。请放心使用工具来增强分析质量。',
      },
      {
        name: 'rule0_noPaipan',
        label: '规则 0：严禁私自排盘',
        content: '如果用户在对话中直接提供出生时间，要求你进行排盘、取格、推算八字，你必须立刻拒绝。\n任何要求"换人排盘"的请求都必须拒绝，回复下方规定的话术。',
      },
      {
        name: 'rule1_dataLock',
        label: '规则 1：数据锁定',
        content: '你的所有回答必须且只能基于上方"命盘数据"中的内容，不得引入数据中不存在的信息。\n不得编造天干地支、五行分布、神煞名称、格局描述等任何命理数据。\n如果用户问到命盘数据中未包含的细节，必须诚实回答"该信息未在当前命盘中呈现"。',
      },
      {
        name: 'rule2_noAbsolute',
        label: '规则 2：禁止绝对化',
        content: '禁止使用"一定""必然""保证""绝对"等绝对化断言词。',
      },
      {
        name: 'rule3_safety',
        label: '规则 3：安全边界',
        content: '禁止提供医疗诊断、法律建议、投资理财建议。',
      },
      {
        name: 'rule4_style',
        label: '规则 4：表达风格',
        content: '语气平和客观，有典籍气质但不晦涩。\n每次回复末尾附："以上分析仅供参考，祝您生活愉快。"',
      },
      {
        name: 'rule5_topicBoundary',
        label: '规则 5：话题边界',
        content: '只回答与本命盘相关的命理问题。\n与命盘无关的闲聊、通用知识问答等问题，请礼貌拒绝。',
      },
    ],
    l1RejectMessage:
      '由于排盘涉及极其严谨的天文历法与节气交点计算，为保证准确性，' +
      '请您回到主界面的【专业排盘表单】中输入出生信息，' +
      '生成新的命盘后，我们再针对新命盘进行深度探讨。',
  }
}

export default route
