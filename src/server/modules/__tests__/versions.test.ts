// ============================================================
// Phase 4a-R6 — Prompt 版本回滚演练
// 文件：src/server/modules/__tests__/versions.test.ts
//
// 演练路径：创建模板 → 连续修改产生版本 → 查看历史
//           → 回滚到旧版本 → 内容恢复 + 回滚动作本身被存档（可再回滚）
// 隔离约定：singleFork 共享进程，本文件自建 :memory: 库
// ============================================================

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Hono } from 'hono'
import { route as promptsRoute } from '@/server/modules/prompts'
import { initDb, closeDb, deletePrompt } from '@/server/db'
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

  const { token, jti, expiresAt } = signToken('version-tester')
  createSession({ tokenJti: jti, username: 'version-tester', expiresAt })
  authHeaders = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
})

afterAll(() => {
  closeDb()
  delete process.env.DB_PATH
})

const V1 = '第一版：简洁指令。'
const V2 = '第二版：加入详细要求。'

describe('R6 — Prompt 版本回滚演练', () => {
  let promptId = 0
  let versionAfterFirstEdit = 0

  it('① 创建模板 → v1', async () => {
    const res = await makeApp().request('/api/v1/admin/prompts', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        name: 'r6_rollback_demo',
        displayName: 'R6 回滚演练',
        content: V1,
        description: '用于版本回滚演练',
        category: 'custom',
      }),
    })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    promptId = body.data.id
    expect(body.data.version).toBe(1)
  })

  it('② 修改内容 → 自动生成旧版本快照', async () => {
    const res = await makeApp().request(`/api/v1/admin/prompts/${promptId}`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({ content: V2, changeNote: '加入详细要求' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    versionAfterFirstEdit = body.data.version
    expect(versionAfterFirstEdit).toBeGreaterThan(1)

    const list = await makeApp().request(`/api/v1/admin/prompts/${promptId}/versions`, {
      headers: authHeaders,
    })
    const listBody = await list.json() as any
    expect(Array.isArray(listBody.data)).toBe(true)
    expect(listBody.data.length).toBeGreaterThanOrEqual(1)
    // 快照保存的是修改前的内容
    expect(listBody.data.some((v: any) => v.content === V1)).toBe(true)
  })

  it('③ 回滚到 v1 → 内容恢复为第一版', async () => {
    const res = await makeApp().request(`/api/v1/admin/prompts/${promptId}/rollback/1`, {
      method: 'POST',
      headers: authHeaders,
    })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.message).toContain('回滚')

    const detail = await makeApp().request(`/api/v1/admin/prompts/${promptId}`, {
      headers: authHeaders,
    })
    const detailBody = await detail.json() as any
    expect(detailBody.data.content).toBe(V1)
  })

  it('④ 回滚动作本身被存档（可再次回滚）', async () => {
    const list = await makeApp().request(`/api/v1/admin/prompts/${promptId}/versions`, {
      headers: authHeaders,
    })
    const listBody = await list.json() as any
    // 回滚前的 V2 内容应被自动存档
    expect(listBody.data.some((v: any) => v.content === V2)).toBe(true)

    // 再次回滚到 V2 所在版本，验证可逆
    const target = listBody.data.find((v: any) => v.content === V2)
    const res = await makeApp().request(`/api/v1/admin/prompts/${promptId}/rollback/${target.version}`, {
      method: 'POST',
      headers: authHeaders,
    })
    expect(res.status).toBe(200)

    const detail = await makeApp().request(`/api/v1/admin/prompts/${promptId}`, {
      headers: authHeaders,
    })
    const detailBody = await detail.json() as any
    expect(detailBody.data.content).toBe(V2)
  })

  it('⑤ 回滚到不存在的版本 → 404', async () => {
    const res = await makeApp().request(`/api/v1/admin/prompts/${promptId}/rollback/9999`, {
      method: 'POST',
      headers: authHeaders,
    })
    expect(res.status).toBe(404)
    const body = await res.json() as any
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('⑥ 回滚不存在的模板 → 404', async () => {
    const res = await makeApp().request('/api/v1/admin/prompts/424242/rollback/1', {
      method: 'POST',
      headers: authHeaders,
    })
    expect(res.status).toBe(404)
  })

  it('⑦ 清理演练数据', () => {
    deletePrompt(promptId)
    expect(true).toBe(true)
  })
})
