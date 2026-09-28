// ============================================================
// Phase 4a-R3 — Prompt 调试闭环测试
// 文件：src/server/modules/__tests__/debug-loop.test.ts
//
// 闭环链路：
//   ① GET  /prompts/samples        — 沙盒可选调试命例
//   ② POST /prompts/render         — 渲染「运行时真实 System Prompt」
//   ③ 管理员保存自定义模板          — 写入 prompt_templates
//   ④ 再次 render                  — 自定义指令已进入真实对话 Prompt
//   ⑤ 停用 / 删除模板              — 真实 Prompt 同步回退
//
// 这验证了「沙盒调试 → 保存模板 → 实际对话复验」全链路无断点
// 隔离约定：singleFork 共享进程，本文件自建 :memory: 库
// ============================================================

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Hono } from 'hono'
import { route as promptsRoute } from '@/server/modules/prompts'
import { initDb, closeDb, createPrompt, updatePrompt, deletePrompt } from '@/server/db'
import { signToken, createSession } from '@/server/core/middleware/auth'

function makeApp(): Hono {
  const app = new Hono()
  app.route('/api/v1/admin/prompts', promptsRoute)
  return app
}

let authHeaders: Record<string, string>

beforeAll(() => {
  process.env.DB_PATH = ':memory:'
  initDb()

  const { token, jti, expiresAt } = signToken('debug-tester')
  createSession({ tokenJti: jti, username: 'debug-tester', expiresAt })
  authHeaders = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
})

afterAll(() => {
  closeDb()
  delete process.env.DB_PATH
})

async function render(sampleId: string) {
  const res = await makeApp().request('/api/v1/admin/prompts/render', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ sampleId }),
  })
  return { status: res.status, body: await res.json() as any }
}

// ═══════════════════════════════════════
// A. 样例清单与运行时渲染
// ═══════════════════════════════════════

describe('R3-A — 调试样例与运行时渲染', () => {
  it('GET /samples → 返回可读的样例清单', async () => {
    const res = await makeApp().request('/api/v1/admin/prompts/samples', { headers: authHeaders })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(Array.isArray(body.data)).toBe(true)
    expect(body.data.length).toBeGreaterThanOrEqual(3)
    expect(body.data[0]).toHaveProperty('label')
    expect(body.data[0]).toHaveProperty('description')
  })

  it('POST /render → 输出运行时真实 System Prompt', async () => {
    const { status, body } = await render('qianlong')
    expect(status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data.systemPrompt).toContain('## 角色')
    expect(body.data.systemPrompt).toContain('## 命盘数据（唯一数据源）')
    // 防幻觉护栏由 L3 动态构建，必须存在
    expect(body.data.systemPrompt).toContain('防越权规则')
    expect(body.data.length).toBe(body.data.systemPrompt.length)
  })

  it('POST /render 未知样例 → 404', async () => {
    const { status, body } = await render('not-exist-sample')
    expect(status).toBe(404)
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('POST /render 缺少 sampleId → 400', async () => {
    const res = await makeApp().request('/api/v1/admin/prompts/render', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(400)
  })
})

// ═══════════════════════════════════════
// B. 闭环核心：保存模板 → 真实对话生效
// ═══════════════════════════════════════

describe('R3-B — 保存自定义模板后进入真实对话 Prompt', () => {
  const MARKER = '【R3闭环标记】回答时必须先复述用户问题。'
  let promptId = 0

  it('基线：未配置自定义模板时 Prompt 不含自定义段', async () => {
    const { body } = await render('qianlong')
    expect(body.data.systemPrompt).not.toContain('管理员自定义指令')
  })

  it('创建并启用自定义模板 → render 输出包含模板内容', async () => {
    const row = createPrompt({
      name: 'r3_loop_marker',
      displayName: 'R3 闭环验证模板',
      content: MARKER,
      variables: '[]',
      description: '用于验证保存后是否进入真实对话',
      category: 'custom',
      isBuiltin: 0,
    } as any)
    promptId = row.id
    expect(row.id).toBeGreaterThan(0)

    const { body } = await render('qianlong')
    expect(body.data.systemPrompt).toContain('管理员自定义指令')
    expect(body.data.systemPrompt).toContain(MARKER)
  })

  it('自定义指令排在防幻觉护栏之前（护栏保持最高优先级）', async () => {
    const { body } = await render('qianlong')
    const p: string = body.data.systemPrompt
    expect(p.indexOf('管理员自定义指令')).toBeLessThan(p.indexOf('防越权规则'))
  })

  it('停用模板 → 真实 Prompt 同步移除自定义段', async () => {
    updatePrompt(promptId, { isActive: 0 } as any)
    const { body } = await render('qianlong')
    expect(body.data.systemPrompt).not.toContain(MARKER)
  })

  it('重新启用 → 自定义段回归', async () => {
    updatePrompt(promptId, { isActive: 1 } as any)
    const { body } = await render('qianlong')
    expect(body.data.systemPrompt).toContain(MARKER)
  })

  it('删除模板 → 自定义段消失且不报错', async () => {
    deletePrompt(promptId)
    const { status, body } = await render('qianlong')
    expect(status).toBe(200)
    expect(body.data.systemPrompt).not.toContain(MARKER)
  })
})
