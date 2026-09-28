// ============================================================
// Phase 5 P5-4 — 对话计费安全回归测试（ADR-004）
// 文件：src/server/modules/__tests__/chat-billing-safety.test.ts
//
// 背景：上游 LLM 失败（402 余额不足 / 429 限流 / 5xx）在 AI SDK v6 中是以
//       **error chunk** 的形式流入 fullStream 的，而不是同步抛错。
//       旧实现会把 error chunk 当"未知 chunk"吞掉，随后仍 commitQuota，
//       导致「用户没拿到任何回复却被扣额度」。
//
// 本测试用 mock 的 streamText 精确复现该缺陷场景，锁定修复：
//   - 流内 error  → 台账 refunded + quotaUsed 不增长 + SSE 回传 LLM_STREAM_FAILED
//   - 正常产出    → 台账 committed + quotaUsed +1（计费语义未被削弱）
// ============================================================

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { Hono } from 'hono'

// 只替换 streamText，保留 'ai' 其余导出（tool 类型等，避免误伤其他模块）
vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ai')>()
  return { ...actual, streamText: vi.fn() }
})

import { streamText } from 'ai'
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
  getLedgerByKey,
} from '@/server/db'
import { signUserToken } from '@/server/core/middleware/user-auth'
import bcrypt from 'bcryptjs'

const ENFORCE_KEY = 'quota_enforce_chat'

const mockedStreamText = streamText as unknown as {
  mockReset: () => void
  mockReturnValue: (v: unknown) => void
}

let app: Hono
let userId = 0
let userToken = ''
let sessionId = ''

/** 构造一个最小可用的 streamText 返回值（fullStream 异步可迭代 + text Promise） */
function fakeResult(chunks: unknown[], text: string | (() => Promise<string>)) {
  return {
    fullStream: (async function* () {
      for (const c of chunks) yield c
    })(),
    text: typeof text === 'function' ? text() : Promise.resolve(text),
  }
}

beforeAll(async () => {
  process.env.DB_PATH = ':memory:'
  initDb()
  setConfig(ENFORCE_KEY, 'true')

  app = new Hono()
  app.route('/api/v1/app/chart', chartRoute)
  app.route('/', chatRoute)

  const u = createUser({
    username: 'billing-safety-user',
    passwordHash: bcrypt.hashSync('secret123', 10),
    quotaTotal: 5,
  })
  userId = u.id
  const { token, jti, expiresAt } = signUserToken(u.id, u.username)
  createUserSession({ userId: u.id, tokenJti: jti, expiresAt, ip: '127.0.0.1', userAgent: 'test' })
  userToken = token

  const created = await app.request('/api/v1/app/chart', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ year: 1991, month: 7, day: 7, hour: 7, gender: '男' }),
  })
  sessionId = ((await created.json()) as any).data.sessionId
})

afterAll(() => {
  deleteConfig(ENFORCE_KEY)
  closeDb()
  delete process.env.DB_PATH
})

beforeEach(() => {
  mockedStreamText.mockReset()
})

// ═══════════════════════════════════════
// A. 上游失败 → 不计费
// ═══════════════════════════════════════

describe('P5-4 — 对话计费安全', () => {
  it('上游 error chunk → 退款 + SSE 回传 LLM_STREAM_FAILED + quotaUsed 不变', async () => {
    const key = 'chat-fail-case-001'
    mockedStreamText.mockReturnValue(
      fakeResult(
        [{ type: 'error', error: new Error('Sorry, your account balance is insufficient') }],
        () => Promise.reject(new Error('No output generated')),
      ),
    )

    const usedBefore = getUserById(userId)!.quotaUsed

    const res = await app.request('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
        'x-idempotency-key': key,
      },
      body: JSON.stringify({
        sessionId,
        messages: [{ role: 'user', content: '你好' }],
      }),
    })

    expect(res.status).toBe(200) // SSE 通道已建立，错误在流内回传
    const body = await res.text()
    expect(body).toContain('LLM_STREAM_FAILED')
    expect(body).toContain('[DONE]')

    // 台账被标记退款，额度未消耗
    expect(getLedgerByKey(key)!.status).toBe('refunded')
    expect(getUserById(userId)!.quotaUsed).toBe(usedBefore)
  })

  it('零输出（无 error 也无文本）→ 同样退款', async () => {
    const key = 'chat-empty-case-002'
    mockedStreamText.mockReturnValue(
      fakeResult([{ type: 'finish', finishReason: 'stop' }], ''),
    )

    const usedBefore = getUserById(userId)!.quotaUsed

    const res = await app.request('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
        'x-idempotency-key': key,
      },
      body: JSON.stringify({ sessionId, messages: [{ role: 'user', content: '你好' }] }),
    })

    const body = await res.text()
    expect(body).toContain('LLM_STREAM_FAILED')
    expect(getLedgerByKey(key)!.status).toBe('refunded')
    expect(getUserById(userId)!.quotaUsed).toBe(usedBefore)
  })

  it('正常产出 → 计费成立（committed + quotaUsed +1）', async () => {
    const key = 'chat-ok-case-003'
    mockedStreamText.mockReturnValue(
      fakeResult(
        [
          { type: 'text-delta', textDelta: '你好，' },
          { type: 'text-delta', textDelta: '有什么可以帮你？' },
          { type: 'finish', finishReason: 'stop' },
        ],
        '你好，有什么可以帮你？',
      ),
    )

    const usedBefore = getUserById(userId)!.quotaUsed

    const res = await app.request('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
        'x-idempotency-key': key,
      },
      body: JSON.stringify({ sessionId, messages: [{ role: 'user', content: '你好' }] }),
    })

    const body = await res.text()
    expect(body).toContain('text-delta')
    expect(body).not.toContain('LLM_STREAM_FAILED')

    expect(getLedgerByKey(key)!.status).toBe('committed')
    expect(getUserById(userId)!.quotaUsed).toBe(usedBefore + 1)
  })
})
