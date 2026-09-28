// ============================================================
// Phase 5 P5-6 — PII 合规底座测试（ADR-006）
// 文件：src/server/modules/__tests__/pii-compliance.test.ts
//
// 覆盖：
//   告知同意留痕（时间 + 版本）
//   数据导出（机读 JSON，含排盘/台账/订阅/埋点）
//   数据删除（软删 + 硬删 PII + 会话失效 + 审计）
//   删除后无法再登录 / 访问
// ============================================================

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Hono } from 'hono'
import { route as userRoute } from '@/server/modules-public/user'
import { route as chartRoute } from '@/server/modules-public/chart'
import { initDb, closeDb, getUserById, getSession, listAuditLogs } from '@/server/db'

let app: Hono
let token = ''
let userId = 0
let sessionId = ''

const auth = () => ({ Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' })

beforeAll(async () => {
  process.env.DB_PATH = ':memory:'
  initDb()
  app = new Hono()
  app.route('/api/v1/app/user', userRoute)
  app.route('/api/v1/app/chart', chartRoute)

  const reg = await app.request('/api/v1/app/user/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'pii-user', password: 'secret123', phone: '13800000000', email: 'pii@example.com' }),
  })
  const body = await reg.json() as any
  token = body.data.token
  userId = body.data.user.id

  // 带鉴权排盘 → 快照归属该用户
  const created = await app.request('/api/v1/app/chart', {
    method: 'POST',
    headers: auth(),
    body: JSON.stringify({ year: 1991, month: 7, day: 7, hour: 7, gender: '女' }),
  })
  sessionId = ((await created.json()) as any).data.sessionId
})

afterAll(() => {
  closeDb()
  delete process.env.DB_PATH
})

describe('P5-6 — 告知同意', () => {
  it('未登录留痕 → 401', async () => {
    const res = await app.request('/api/v1/app/user/consent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'privacy_policy' }),
    })
    expect(res.status).toBe(401)
  })

  it('记录隐私政策同意 → 201（含版本号）', async () => {
    const res = await app.request('/api/v1/app/user/consent', {
      method: 'POST',
      headers: auth(),
      body: JSON.stringify({ type: 'privacy_policy' }),
    })
    expect(res.status).toBe(201)
    const body = await res.json() as any
    expect(body.data.type).toBe('privacy_policy')
    expect(body.data.version).toBeTruthy()
    expect(body.data.agreed).toBe(true)
  })

  it('非法协议类型 → 400', async () => {
    const res = await app.request('/api/v1/app/user/consent', {
      method: 'POST',
      headers: auth(),
      body: JSON.stringify({ type: 'evil_doc' }),
    })
    expect(res.status).toBe(400)
  })

  it('GET /consent → 返回留痕记录', async () => {
    await app.request('/api/v1/app/user/consent', {
      method: 'POST',
      headers: auth(),
      body: JSON.stringify({ type: 'user_agreement' }),
    })
    const res = await app.request('/api/v1/app/user/consent', { headers: auth() })
    const body = await res.json() as any
    expect(body.data.types).toContain('privacy_policy')
    expect(body.data.records.length).toBeGreaterThanOrEqual(2)
  })
})

describe('P5-6 — 数据导出', () => {
  it('导出包含用户 / 同意 / 排盘 / 台账，且不含密码哈希', async () => {
    const res = await app.request('/api/v1/app/user/data/export', { headers: auth() })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    const d = body.data

    expect(d.user.username).toBe('pii-user')
    expect(d.user).not.toHaveProperty('passwordHash')
    expect(d.consents.length).toBeGreaterThanOrEqual(1)
    expect(d.charts.some((c: any) => c.sessionId === sessionId)).toBe(true)
    expect(Array.isArray(d.quotaLedger)).toBe(true)
    expect(Array.isArray(d.orders)).toBe(true)
    expect(d.notice).toContain('个人信息')
  })

  it('未登录导出 → 401', async () => {
    const res = await app.request('/api/v1/app/user/data/export')
    expect(res.status).toBe(401)
  })
})

describe('P5-6 — 数据删除（删除权）', () => {
  it('缺少 confirm → 400', async () => {
    const res = await app.request('/api/v1/app/user/data', {
      method: 'DELETE',
      headers: auth(),
      body: JSON.stringify({ confirm: 'yes', password: 'secret123' }),
    })
    expect(res.status).toBe(400)
  })

  it('密码错误 → 401，数据不动', async () => {
    const res = await app.request('/api/v1/app/user/data', {
      method: 'DELETE',
      headers: auth(),
      body: JSON.stringify({ confirm: 'DELETE', password: 'wrong-password' }),
    })
    expect(res.status).toBe(401)
    expect(getUserById(userId)!.status).toBe('active')
  })

  it('正确确认 → 软删 + 硬删排盘 + 会话失效', async () => {
    const res = await app.request('/api/v1/app/user/data', {
      method: 'DELETE',
      headers: auth(),
      body: JSON.stringify({ confirm: 'DELETE', password: 'secret123' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.data.deleted).toBe(true)
    expect(body.data.purgedCharts).toBeGreaterThanOrEqual(1)

    // 排盘快照（含生辰）已硬删
    expect(getSession(sessionId)).toBeUndefined()

    // 用户被软删 + PII 清空
    const u = getUserById(userId)!
    expect(u.status).toBe('deleted')
    expect(u.deletedAt).toBeTruthy()
    expect(u.phone).toBeNull()
    expect(u.email).toBeNull()
  })

  it('删除后原 token 立即失效 → 401', async () => {
    const res = await app.request('/api/v1/app/user/me', { headers: auth() })
    expect(res.status).toBe(401)
  })

  it('删除后无法再次登录 → 403', async () => {
    const res = await app.request('/api/v1/app/user/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account: 'pii-user', password: 'secret123' }),
    })
    expect(res.status).toBe(403)
  })

  it('删除请求落审计（只留元数据）', () => {
    const logs = listAuditLogs(50)
    const hit = logs.find(l => l.resource === 'user_data' && l.resourceId === userId)
    expect(hit).toBeTruthy()
    expect(hit!.operator).toBe(`user:${userId}`)
    expect(hit!.detail).toContain('purgedCharts')
  })
})
