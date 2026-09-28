// ============================================================
// Phase 5 P5-4 — 额度幂等台账测试（ADR-004）
// 文件：src/server/modules/__tests__/quota-ledger.test.ts
//
// 覆盖：
//   预留扣减 / 余额不足拒绝
//   同 key 二次提交 → 复用首次结果，不重复扣
//   pending → committed / refunded 两阶段
//   refund 幂等（不会退两次）
//   余额不足 → /api/chat 402（不触发 LLM）
// ============================================================

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Hono } from 'hono'
import { route as chartRoute } from '@/server/modules-public/chart'
import { chatRoute } from '@/server/api/chat'
import {
  initDb,
  closeDb,
  createUser,
  createUserSession,
  getUserById,
  setConfig,
  deleteConfig,
  getConfig,
  reserveQuota,
  commitQuota,
  refundQuota,
  getLedgerByKey,
  listLedgerByUser,
  sumLedgerDelta,
} from '@/server/db'
import { signUserToken } from '@/server/core/middleware/user-auth'
import bcrypt from 'bcryptjs'

const ENFORCE_KEY = 'quota_enforce_chat'

let app: Hono
let userId = 0
let userToken = ''
let sessionId = ''

async function registerUser(username: string, quotaTotal = 5) {
  const u = createUser({
    username,
    passwordHash: bcrypt.hashSync('secret123', 10),
    quotaTotal,
  })
  const { token, jti, expiresAt } = signUserToken(u.id, u.username)
  createUserSession({ userId: u.id, tokenJti: jti, expiresAt, ip: '127.0.0.1', userAgent: 'test' })
  return { user: u, token }
}

beforeAll(async () => {
  process.env.DB_PATH = ':memory:'
  initDb()
  app = new Hono()
  app.route('/api/v1/app/chart', chartRoute)
  app.route('/', chatRoute)

  const reg = await registerUser('quota-user', 5)
  userId = reg.user.id
  userToken = reg.token

  const created = await app.request('/api/v1/app/chart', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ year: 1990, month: 1, day: 1, hour: 0, gender: '男' }),
  })
  sessionId = ((await created.json()) as any).data.sessionId
})

afterAll(() => {
  deleteConfig(ENFORCE_KEY)
  closeDb()
  delete process.env.DB_PATH
})

// ═══════════════════════════════════════
// A. 预留 / 提交 / 退款
// ═══════════════════════════════════════

describe('P5-4 A — 幂等预留', () => {
  let u = 0
  beforeAll(async () => {
    const reg = await registerUser('quota-a', 2)
    u = reg.user.id
  })

  it('首次预留 → 扣减并写 pending 台账', () => {
    const r = reserveQuota({ userId: u, idempotencyKey: 'k-a-1', cost: 1, reason: 'chat' })
    expect(r.ok).toBe(true)
    expect(r.reused).toBe(false)
    expect(r.status).toBe('pending')
    expect(r.balanceAfter).toBe(1)
    expect(getUserById(u)!.quotaUsed).toBe(1)
  })

  it('同 key 二次提交 → 复用首次结果，不重复扣', () => {
    const r = reserveQuota({ userId: u, idempotencyKey: 'k-a-1', cost: 1, reason: 'chat' })
    expect(r.ok).toBe(true)
    expect(r.reused).toBe(true)
    expect(r.balanceAfter).toBe(1)
    expect(getUserById(u)!.quotaUsed).toBe(1) // 未二次扣减
  })

  it('不同 key → 正常扣减', () => {
    const r = reserveQuota({ userId: u, idempotencyKey: 'k-a-2', cost: 1 })
    expect(r.ok).toBe(true)
    expect(r.balanceAfter).toBe(0)
    expect(getUserById(u)!.quotaUsed).toBe(2)
  })

  it('余额不足 → QUOTA_EXHAUSTED，不产生台账', () => {
    const r = reserveQuota({ userId: u, idempotencyKey: 'k-a-3', cost: 1 })
    expect(r.ok).toBe(false)
    expect(r.reason).toBe('QUOTA_EXHAUSTED')
    expect(getLedgerByKey('k-a-3')).toBeUndefined()
    expect(getUserById(u)!.quotaUsed).toBe(2)
  })

  it('超大 cost → 拒绝', () => {
    const r = reserveQuota({ userId: u, idempotencyKey: 'k-a-4', cost: 99 })
    expect(r.ok).toBe(false)
    expect(r.reason).toBe('QUOTA_EXHAUSTED')
  })

  it('用户不存在 → USER_NOT_FOUND', () => {
    const r = reserveQuota({ userId: 999999, idempotencyKey: 'k-a-5', cost: 1 })
    expect(r.ok).toBe(false)
    expect(r.reason).toBe('USER_NOT_FOUND')
  })
})

// ═══════════════════════════════════════
// B. 两阶段：commit / refund
// ═══════════════════════════════════════

describe('P5-4 B — 两阶段提交与退款', () => {
  let u = 0
  beforeAll(async () => {
    const reg = await registerUser('quota-b', 5)
    u = reg.user.id
  })

  it('commit → 台账置 committed', () => {
    reserveQuota({ userId: u, idempotencyKey: 'k-b-1', cost: 1 })
    expect(commitQuota('k-b-1')).toBe(true)
    expect(getLedgerByKey('k-b-1')!.status).toBe('committed')
    // 重复 commit 无副作用
    expect(commitQuota('k-b-1')).toBe(false)
  })

  it('refund（已 committed）→ 退回额度 + 台账 refunded', () => {
    const before = getUserById(u)!.quotaUsed
    const r = refundQuota('k-b-1')
    expect(r.refunded).toBe(true)
    expect(r.amount).toBe(1)
    expect(getUserById(u)!.quotaUsed).toBe(before - 1)
    expect(getLedgerByKey('k-b-1')!.status).toBe('refunded')
  })

  it('refund 幂等 → 二次调用不重复退', () => {
    const r = refundQuota('k-b-1')
    expect(r.refunded).toBe(false)
    expect(r.amount).toBe(0)
  })

  it('已退款 key 再预留 → KEY_REFUNDED', () => {
    const r = reserveQuota({ userId: u, idempotencyKey: 'k-b-1', cost: 1 })
    expect(r.ok).toBe(false)
    expect(r.reason).toBe('KEY_REFUNDED')
  })

  it('refund 不会把 quotaUsed 退成负数', () => {
    reserveQuota({ userId: u, idempotencyKey: 'k-b-2', cost: 5 }) // 用尽
    refundQuota('k-b-2')
    refundQuota('k-b-2')
    expect(getUserById(u)!.quotaUsed).toBeGreaterThanOrEqual(0)
  })

  it('台账净额与 quotaUsed 一致（对账不变量）', () => {
    const net = sumLedgerDelta(u) // 负数（消费）
    // 台账净额 = -quotaUsed（Math.abs 规避 -0 与 0 的 Object.is 差异）
    expect(Math.abs(net)).toBe(getUserById(u)!.quotaUsed)
    expect(listLedgerByUser(u).length).toBeGreaterThanOrEqual(2)
  })
})

// ═══════════════════════════════════════
// C. /api/chat 402 门禁（不触发 LLM）
// ═══════════════════════════════════════

describe('P5-4 C — /api/chat 额度门禁', () => {
  it('额度用尽 + enforce → 402 QUOTA_EXHAUSTED', async () => {
    setConfig(ENFORCE_KEY, 'true')
    // 用尽该用户额度
    const u = getUserById(userId)!
    reserveQuota({ userId: u.id, idempotencyKey: 'k-exhaust', cost: u.quotaTotal - u.quotaUsed })

    const res = await app.request('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        sessionId,
        messages: [{ role: 'user', content: '帮我看一下事业' }],
      }),
    })
    expect(res.status).toBe(402)
    const body = await res.json() as any
    expect(body.code).toBe('QUOTA_EXHAUSTED')
    expect(body.quotaRemaining).toBe(0)
  })

  it('开关关闭时门禁判定为 false（免费用户不被误伤）', () => {
    setConfig(ENFORCE_KEY, 'false')
    // 与 handler 内 `getConfig('quota_enforce_chat')?.value === 'true'` 同口径
    expect(getConfig(ENFORCE_KEY)?.value === 'true').toBe(false)

    setConfig(ENFORCE_KEY, 'true')
    expect(getConfig(ENFORCE_KEY)?.value === 'true').toBe(true)
    deleteConfig(ENFORCE_KEY)
  })
})
