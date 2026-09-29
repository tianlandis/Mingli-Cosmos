// ============================================================
// 命书接口止血 — 回归测试
// 文件：src/server/modules/__tests__/report-quota.test.ts
//
// 背景：POST /api/report 内部有 4 次大模型调用，原本**无鉴权 + 零额度 + 无缓存**，
// 任何人可匿名无限刷。本次锁定三条不变量：
//   1. 未登录 / 令牌无效 → 401（原为匿名可刷）
//   2. 同命盘命中缓存 → 返回 cached:true 且**不产生任何额度台账**（不扣券）
//   3. 缓存模块自身：写入可读、过期失效、超容量淘汰
//
// 只覆盖"止血"语义，不触碰真实 LLM（缓存命中路径不进 pipeline）。
// ============================================================

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Hono } from 'hono'
import bcrypt from 'bcryptjs'
import { reportRoute } from '@/server/api/report'
import {
  initDb,
  closeDb,
  createUser,
  createUserSession,
  sumLedgerDelta,
  reserveQuota,
} from '@/server/db'
import { signUserToken } from '@/server/core/middleware/user-auth'
import { chartHash } from '@/server/lib/chart-hash'
import {
  setCachedReport,
  getCachedReport,
  resetReportCache,
  reportCacheSize,
} from '@/server/lib/report-cache'
import { calculateBazi, generateAnnotation } from '@/engine'

process.env.DB_PATH = ':memory:'

let app: Hono
let token = ''
let userId = 0

/** 一张固定命盘（1990-03-08 14:00 女） */
let fp = ''
let chart: unknown = null
let annotation: unknown = null

beforeAll(async () => {
  initDb()
  resetReportCache()

  const user = createUser({
    username: 'report-user',
    passwordHash: bcrypt.hashSync('secret123', 10),
  })
  userId = user.id
  const { token: tk, jti, expiresAt } = signUserToken(user.id, user.username)
  createUserSession({ userId: user.id, tokenJti: jti, expiresAt, ip: '127.0.0.1', userAgent: 'test' })
  token = tk

  app = new Hono()
  app.route('/', reportRoute)

  const c = await calculateBazi(1990, 3, 8, 14, 0, '女')
  chart = c
  annotation = generateAnnotation(c)
  fp = chartHash(c)
})

afterAll(() => {
  closeDb()
})

function auth(tk: string): Record<string, string> {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${tk}` }
}

describe('命书接口 · 鉴权', () => {
  it('未登录 → 401（原本匿名可刷，这是本次止血的核心）', async () => {
    const res = await app.request('/api/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(401)
    const body = await res.json() as { code?: string }
    expect(body.code).toBe('UNAUTHORIZED')
  })

  it('无效令牌 → 401', async () => {
    const res = await app.request('/api/report', {
      method: 'POST',
      headers: auth('not-a-real-token'),
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(401)
  })
})

describe('命书接口 · 缓存命中不扣额度', () => {
  it('命中缓存：返回 cached=true，且不产生额度台账', async () => {
    // 预填缓存（模拟此前已生成过）
    setCachedReport(fp, { sections: [{ title: '命书', content: '预置' }] })

    const before = sumLedgerDelta(userId)

    const res = await app.request('/api/report', {
      method: 'POST',
      headers: auth(token),
      body: JSON.stringify({ chart, annotation }),
    })

    expect(res.status).toBe(200)
    expect(res.headers.get('X-Report-Cache')).toBe('hit')

    const body = await res.json() as { ok: boolean; cached?: boolean; data?: { sections: unknown[] } }
    expect(body.ok).toBe(true)
    expect(body.cached).toBe(true)
    expect(body.data?.sections).toHaveLength(1)

    // 关键：缓存命中不得扣任何额度
    expect(sumLedgerDelta(userId)).toBe(before)
  })

  it('未命中缓存且额度不足 → 402 且不进 pipeline（不再免费白嫖）', async () => {
    resetReportCache()

    // 先把额度耗光（命书 cost=5，初始额度正好 5）
    const burn = reserveQuota({
      userId,
      idempotencyKey: 'burn-all-quota',
      cost: 5,
      reason: 'test-burn',
      refKey: null,
    })
    expect(burn.ok).toBe(true)

    const res = await app.request('/api/report', {
      method: 'POST',
      headers: auth(token),
      body: JSON.stringify({ chart, annotation }),
    })

    expect(res.status).toBe(402)
    const body = await res.json() as { code?: string; message?: string }
    expect(body.code).toBe('QUOTA_EXHAUSTED')
    // 必须说明要多少额度，别让用户猜
    expect(body.message).toContain('5')
  })
})

describe('命书缓存模块', () => {
  it('写入后可读，且按指纹隔离', async () => {
    resetReportCache()
    const other = await calculateBazi(2000, 1, 1, 0, 0, '男')
    const otherFp = chartHash(other)

    setCachedReport(fp, { v: 'A' })
    expect(getCachedReport(fp)).toEqual({ v: 'A' })
    expect(getCachedReport(otherFp)).toBeUndefined()
  })

  it('TTL 过期后不可读', () => {
    resetReportCache({ ttlMs: 1 })
    setCachedReport('k1', { v: 'x' })
    // 同步睡眠，确保超过 1ms TTL
    const until = Date.now() + 3
    while (Date.now() < until) { /* busy wait */ }
    expect(getCachedReport('k1')).toBeUndefined()
  })

  it('超容量时淘汰最久未用（LRU）', () => {
    resetReportCache({ max: 2 })
    setCachedReport('a', 1)
    setCachedReport('b', 2)
    setCachedReport('c', 3)
    expect(reportCacheSize()).toBe(2)
    expect(getCachedReport('a')).toBeUndefined()
    expect(getCachedReport('c')).toBe(3)
    // 复位，避免影响其他用例
    resetReportCache()
  })
})
