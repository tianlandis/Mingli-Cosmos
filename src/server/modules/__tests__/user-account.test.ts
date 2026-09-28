// ============================================================
// Phase 4b M-6 — C 端用户体系端到端测试
// 文件：src/server/modules/__tests__/user-account.test.ts
//
// 覆盖链路：
//   注册 → 登录 → 会话 → 额度 → 后台管理（停用/改额度/重置密码）
//
// 隔离约定：singleFork 共享进程，本文件自建 :memory: 库
// ⚠️ 登录接口带 IP 限流（5 次/15 分钟），故每个登录请求使用不同的
//    x-forwarded-for，避免用例间互相干扰
// ============================================================

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Hono } from 'hono'
import { route as userRoute } from '@/server/modules-public/user'
import { route as adminUsersRoute } from '@/server/modules/users'
import { initDb, closeDb } from '@/server/db'
import { signToken, createSession } from '@/server/core/middleware/auth'

let app: Hono
let adminHeaders: Record<string, string>
let ipSeq = 0

/** 每个请求一个独立来源 IP，绕开登录限流 */
function jsonHeaders(extra: Record<string, string> = {}): Record<string, string> {
  ipSeq++
  return {
    'Content-Type': 'application/json',
    'x-forwarded-for': `10.10.0.${ipSeq}`,
    ...extra,
  }
}

beforeAll(() => {
  process.env.DB_PATH = ':memory:'
  initDb()

  const { token, jti, expiresAt } = signToken('phase4b-admin')
  createSession({ tokenJti: jti, username: 'phase4b-admin', expiresAt })
  adminHeaders = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

  app = new Hono()
  app.route('/api/v1/app/user', userRoute)
  app.route('/api/v1/admin/users', adminUsersRoute)
})

afterAll(() => {
  closeDb()
  delete process.env.DB_PATH
})

// ═══════════════════════════════════════
// 共享状态（用例按书写顺序执行）
// ═══════════════════════════════════════

let userToken = ''
let userId = 0

// ═══════════════════════════════════════
// A. 注册
// ═══════════════════════════════════════

describe('M-6 A — 注册与校验', () => {
  it('注册成功：返回 token + 默认 5 次额度', async () => {
    const res = await app.request('/api/v1/app/user/register', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ username: 'alice', password: 'secret123', nickname: '爱丽丝' }),
    })
    expect(res.status).toBe(201)
    const body = await res.json() as any
    expect(body.success).toBe(true)
    expect(body.data.token).toBeTruthy()
    expect(body.data.user.username).toBe('alice')
    expect(body.data.user.quotaTotal).toBe(5)
    expect(body.data.user.quotaRemaining).toBe(5)
    // 绝不能外泄密码哈希
    expect(JSON.stringify(body)).not.toContain('passwordHash')
    expect(JSON.stringify(body)).not.toContain('$2')

    userToken = body.data.token
    userId = body.data.user.id
  })

  it('重复用户名 → 409', async () => {
    const res = await app.request('/api/v1/app/user/register', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ username: 'alice', password: 'secret123' }),
    })
    expect(res.status).toBe(409)
    const body = await res.json() as any
    expect(body.error.code).toBe('CONFLICT')
  })

  it('密码过短 → 400', async () => {
    const res = await app.request('/api/v1/app/user/register', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ username: 'bob', password: '123' }),
    })
    expect(res.status).toBe(400)
    const body = await res.json() as any
    expect(body.error.message).toContain('6')
  })

  it('账号含非法字符 → 400', async () => {
    const res = await app.request('/api/v1/app/user/register', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ username: 'bad name!', password: 'secret123' }),
    })
    expect(res.status).toBe(400)
  })

  it('邮箱格式错误 → 400', async () => {
    const res = await app.request('/api/v1/app/user/register', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ username: 'carol', password: 'secret123', email: 'not-an-email' }),
    })
    expect(res.status).toBe(400)
  })

  it('手机号重复 → 409', async () => {
    await app.request('/api/v1/app/user/register', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ username: 'dave', password: 'secret123', phone: '13800001111' }),
    })
    const res = await app.request('/api/v1/app/user/register', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ username: 'erin', password: 'secret123', phone: '13800001111' }),
    })
    expect(res.status).toBe(409)
  })
})

// ═══════════════════════════════════════
// B. 登录与会话
// ═══════════════════════════════════════

describe('M-6 B — 登录与会话', () => {
  it('账号密码正确 → 返回 token', async () => {
    const res = await app.request('/api/v1/app/user/login', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ account: 'alice', password: 'secret123' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.data.token).toBeTruthy()
    expect(body.data.user.lastLoginAt).toBeTruthy()  // 登录时间已回写
  })

  it('密码错误 → 401', async () => {
    const res = await app.request('/api/v1/app/user/login', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ account: 'alice', password: 'wrong-pass' }),
    })
    expect(res.status).toBe(401)
    const body = await res.json() as any
    expect(body.error.code).toBe('UNAUTHORIZED')
  })

  it('账号不存在 → 401（不泄露是否存在该用户）', async () => {
    const res = await app.request('/api/v1/app/user/login', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ account: 'nobody', password: 'secret123' }),
    })
    expect(res.status).toBe(401)
  })

  it('可用手机号登录', async () => {
    const res = await app.request('/api/v1/app/user/login', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ account: '13800001111', password: 'secret123' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.data.user.username).toBe('dave')
  })

  it('未登录访问 /me → 401', async () => {
    const res = await app.request('/api/v1/app/user/me', { headers: jsonHeaders() })
    expect(res.status).toBe(401)
  })

  it('携带 token 访问 /me → 返回用户与额度', async () => {
    const res = await app.request('/api/v1/app/user/me', {
      headers: jsonHeaders({ Authorization: `Bearer ${userToken}` }),
    })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.data.user.id).toBe(userId)
    expect(body.data.quotaRemaining).toBe(5)
    expect(body.data.subscription).toBeNull()
  })

  it('/status 未登录 → authenticated=false', async () => {
    const res = await app.request('/api/v1/app/user/status', { headers: jsonHeaders() })
    const body = await res.json() as any
    expect(body.data.authenticated).toBe(false)
  })

  it('登出后原 token 立即失效', async () => {
    const logout = await app.request('/api/v1/app/user/logout', {
      method: 'POST',
      headers: jsonHeaders({ Authorization: `Bearer ${userToken}` }),
    })
    expect(logout.status).toBe(200)

    const res = await app.request('/api/v1/app/user/me', {
      headers: jsonHeaders({ Authorization: `Bearer ${userToken}` }),
    })
    expect(res.status).toBe(401)
    const body = await res.json() as any
    expect(body.error.code).toBe('SESSION_TERMINATED')
  })

  it('重新登录恢复可用（新 token）', async () => {
    const res = await app.request('/api/v1/app/user/login', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ account: 'alice', password: 'secret123' }),
    })
    const body = await res.json() as any
    userToken = body.data.token
    expect(res.status).toBe(200)
  })
})

// ═══════════════════════════════════════
// C. 额度
// ═══════════════════════════════════════

describe('M-6 C — 额度扣减（原子性）', () => {
  it('连续扣减 5 次成功，第 6 次失败（额度耗尽）', async () => {
    const { consumeQuota, getRemainingQuota } = await import('@/server/db')
    for (let i = 0; i < 5; i++) {
      expect(consumeQuota(userId)).toBe(true)
    }
    expect(getRemainingQuota(userId)).toBe(0)
    expect(consumeQuota(userId)).toBe(false)  // 不会扣成负数
  })

  it('/quota 接口反映剩余额度为 0', async () => {
    const res = await app.request('/api/v1/app/user/quota', {
      headers: jsonHeaders({ Authorization: `Bearer ${userToken}` }),
    })
    const body = await res.json() as any
    expect(body.data.quotaRemaining).toBe(0)
    expect(body.data.quotaUsed).toBe(5)
  })
})

// ═══════════════════════════════════════
// D. 后台用户管理
// ═══════════════════════════════════════

describe('M-6 D — 后台用户管理', () => {
  it('GET /users → 列表 + 分页', async () => {
    const res = await app.request('/api/v1/admin/users?page=1&pageSize=10', { headers: adminHeaders })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    // 注册成功的账号：alice、dave（bob/carol/erin 被校验拦截）
    expect(body.data.total).toBeGreaterThanOrEqual(2)
    expect(body.data.items.length).toBeLessThanOrEqual(10)
  })

  it('关键词搜索命中 alice', async () => {
    const res = await app.request('/api/v1/admin/users?keyword=alice', { headers: adminHeaders })
    const body = await res.json() as any
    expect(body.data.total).toBe(1)
    expect(body.data.items[0].username).toBe('alice')
  })

  it('GET /users/stats → 统计口径一致', async () => {
    const res = await app.request('/api/v1/admin/users/stats', { headers: adminHeaders })
    const body = await res.json() as any
    expect(body.data.total).toBe(body.data.active + body.data.disabled)
    expect(body.data.newToday).toBeGreaterThanOrEqual(0)
  })

  it('未带管理员 token → 401', async () => {
    const res = await app.request('/api/v1/admin/users', { headers: jsonHeaders() })
    expect(res.status).toBe(401)
  })

  it('POST /users/:id/quota → 赠送额度生效', async () => {
    const res = await app.request(`/api/v1/admin/users/${userId}/quota`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ delta: 20, reason: '补偿测试' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.data.quotaTotal).toBe(25)
    expect(body.data.quotaRemaining).toBe(20)
  })

  it('POST /users/:id/quota → setTotal 直接设定总量', async () => {
    const res = await app.request(`/api/v1/admin/users/${userId}/quota`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ setTotal: 8 }),
    })
    const body = await res.json() as any
    expect(body.data.quotaTotal).toBe(8)
  })

  it('PATCH /users/:id → 停用账号后无法登录', async () => {
    const res = await app.request(`/api/v1/admin/users/${userId}`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ status: 'disabled' }),
    })
    expect(res.status).toBe(200)

    const login = await app.request('/api/v1/app/user/login', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ account: 'alice', password: 'secret123' }),
    })
    expect(login.status).toBe(403)
  })

  it('恢复启用后可正常登录', async () => {
    await app.request(`/api/v1/admin/users/${userId}`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ status: 'active' }),
    })
    const login = await app.request('/api/v1/app/user/login', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ account: 'alice', password: 'secret123' }),
    })
    expect(login.status).toBe(200)
    const body = await login.json() as any
    userToken = body.data.token
  })

  it('重置密码 → 旧密码失效 + 新密码可用', async () => {
    const reset = await app.request(`/api/v1/admin/users/${userId}/reset-password`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ newPassword: 'newpass888' }),
    })
    expect(reset.status).toBe(200)

    // 旧密码
    const old = await app.request('/api/v1/app/user/login', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ account: 'alice', password: 'secret123' }),
    })
    expect(old.status).toBe(401)

    // 新密码
    const fresh = await app.request('/api/v1/app/user/login', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ account: 'alice', password: 'newpass888' }),
    })
    expect(fresh.status).toBe(200)
  })

  it('重置密码会强制已有会话下线', async () => {
    const res = await app.request('/api/v1/app/user/me', {
      headers: jsonHeaders({ Authorization: `Bearer ${userToken}` }),
    })
    expect(res.status).toBe(401)
  })

  it('GET /users/:id → 详情含订阅与订单字段', async () => {
    const res = await app.request(`/api/v1/admin/users/${userId}`, { headers: adminHeaders })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.data.user.username).toBe('alice')
    expect(Array.isArray(body.data.orders)).toBe(true)
    expect(Array.isArray(body.data.subscriptions)).toBe(true)
    expect(body.data.user.passwordHash).toBeUndefined()
  })

  it('DELETE /users/:id → 删除成功', async () => {
    const create = await app.request('/api/v1/app/user/register', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ username: 'temp_user', password: 'secret123' }),
    })
    const id = (await create.json() as any).data.user.id
    const res = await app.request(`/api/v1/admin/users/${id}`, {
      method: 'DELETE',
      headers: adminHeaders,
    })
    expect(res.status).toBe(200)
    const again = await app.request(`/api/v1/admin/users/${id}`, { headers: adminHeaders })
    expect(again.status).toBe(404)
  })
})
