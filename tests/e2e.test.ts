// ============================================================
// 端到端测试 — e2e.test.ts
// 文件：tests/e2e.test.ts
// 测试 /api/report 和 /api/chat 两个 API 端点
// ============================================================
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Hono } from 'hono'
import bcrypt from 'bcryptjs'
import { reportRoute } from '@/server/api/report'
import { chatRoute } from '@/server/api/chat'
import { initDb, closeDb, createUser, createUserSession } from '@/server/db'
import { signUserToken, verifyUserToken } from '@/server/core/middleware/user-auth'

/**
 * 命书接口已要求登录（2026-09-29 止血：原为匿名可刷，内部 4 次大模型调用）。
 * 本文件的用例测的是**入参校验**，故统一以一个已登录身份发起。
 */
let testToken = ''

function authHeaders(): Record<string, string> {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${testToken}` }
}

// ─── 创建 Hono 测试 App ───
function createTestApp(): Hono {
  const app = new Hono()
  // 注入登录态（等价于生产鉴权中间件写入 currentUser）
  app.use('/api/report', async (c, next) => {
    const payload = verifyUserToken(testToken)
    if (payload) c.set('currentUser', payload as never)
    await next()
  })
  app.route('/', reportRoute)
  app.route('/', chatRoute)

  app.onError((err, c) => {
    console.error('[E2E Error]', err.message)
    return c.json({ error: 'INTERNAL_ERROR', message: '服务暂不可用' }, 500)
  })

  return app
}

// ─── Mock LLM 环境 + 独立内存库 ───
// singleFork 下同进程串行，需自建表避免受其它测试文件 DB_PATH 影响
beforeAll(() => {
  process.env.DB_PATH = ':memory:'
  initDb()
  process.env.LLM_PROVIDER = 'local'
  process.env.LLM_API_KEY = 'mock-key'
  process.env.LLM_BASE_URL = 'http://localhost:11434/v1'
  process.env.LLM_MODEL = 'mock-model'

  const u = createUser({ username: 'e2e-report-user', passwordHash: bcrypt.hashSync('x', 10) })
  const { token, jti, expiresAt } = signUserToken(u.id, u.username)
  createUserSession({ userId: u.id, tokenJti: jti, expiresAt, ip: '127.0.0.1', userAgent: 'test' })
  testToken = token
})

afterAll(() => {
  closeDb()
  delete process.env.DB_PATH
  delete process.env.LLM_PROVIDER
  delete process.env.LLM_API_KEY
})

// ═══════════════════════════════════════════
// POST /api/report
// ═══════════════════════════════════════════
describe('POST /api/report', () => {
  it('未登录 → 401（命书需登录，止血后新增）', async () => {
    const app = createTestApp()
    const res = await app.request('/api/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(401)
  })

  it('缺少 chart → 400', async () => {
    const app = createTestApp()
    const res = await app.request('/api/report', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ chart: null, annotation: {} }),
    })

    expect(res.status).toBe(400)
    const body = await res.json() as { error?: string }
    expect(body.error).toBe('BAD_REQUEST')
  })

  it('缺少 annotation → 400', async () => {
    const app = createTestApp()
    const res = await app.request('/api/report', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ chart: {}, annotation: null }),
    })

    expect(res.status).toBe(400)
    const body = await res.json() as { error?: string }
    expect(body.error).toBe('BAD_REQUEST')
  })

  it('空 body → 500 (Hono error handler)', async () => {
    const app = createTestApp()
    const res = await app.request('/api/report', {
      method: 'POST',
      headers: authHeaders(),
      body: '',
    })

    expect(res.status).toBe(500)
  })
})

// ═══════════════════════════════════════════
// POST /api/chat
// ═══════════════════════════════════════════
describe('POST /api/chat', () => {
  it('缺少 chart → 400', async () => {
    const app = createTestApp()
    const res = await app.request('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chart: null, annotation: {}, messages: [{ role: 'user', content: '你好' }] }),
    })

    expect(res.status).toBe(400)
    const body = await res.json() as { error?: string }
    expect(body.error).toBe('BAD_REQUEST')
  })

  it('缺少 messages → 400', async () => {
    const app = createTestApp()
    const res = await app.request('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chart: {}, annotation: {}, messages: [] }),
    })

    expect(res.status).toBe(400)
    const body = await res.json() as { error?: string }
    expect(body.error).toBe('BAD_REQUEST')
  })

  it('空 body → 500 (Hono error handler)', async () => {
    const app = createTestApp()
    const res = await app.request('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '',
    })

    expect(res.status).toBe(500)
  })
})

// ═══════════════════════════════════════════
// 滑动窗口
// ═══════════════════════════════════════════
describe('Chat 滑动窗口', () => {
  it('超过 MAX_MESSAGES 时自动截断', async () => {
    const app = createTestApp()

    const longMessages = Array.from({ length: 12 }, (_, i) => ({
      role: 'user' as const,
      content: `问题 ${i + 1}`,
    }))

    const minimalAnnotation = {
      strengthAnalysis: { strength: '偏旺' as const, score: 72 },
      patternAnalysis: { patternName: '建禄格', quality: '中和' as const },
      shiShenProfile: [{ name: '比肩' as const, count: 3 }],
      luckAnalysis: { daYunList: [] },
      shenSha: { items: [] },
      specialTopics: {},
    }

    const res = await app.request('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chart: { dayMaster: '甲', yearPillar: { ganZhi: '甲子' }, monthPillar: { ganZhi: '丙寅' }, dayPillar: { ganZhi: '甲辰' }, hourPillar: { ganZhi: '壬申' } },
        annotation: minimalAnnotation,
        messages: longMessages,
      }),
    })

    expect(res.status).not.toBe(400)
  })
})
