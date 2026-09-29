// ============================================================
// 双人合盘 — 回归测试
// 文件：src/server/modules/__tests__/synastry.test.ts
//
// 锁定五条最易崩的语义：
//   1. 未登录 → 401（合盘耗 20 额度，不能匿名白嫖）
//   2. 越权档案 → 404（他人档案等同不存在）
//   3. 同一对命盘 + 同一关系 → 结果稳定可复现（规则层，非随机）
//   4. 关系权重真实生效：同一对命盘，夫妻档与亲子档得分/侧重不同
//   5. 缓存命中不扣额度（重复看不烧钱）
//
// 规则层另测两条命理正确性的底线：
//   - 日干五合（如甲己）应显著优于日干相克
//   - 日支六冲（如子午）应显著劣于日支六合（如子丑）
// ============================================================

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Hono } from 'hono'
import bcrypt from 'bcryptjs'
import { route as synastryRoute, meta as synastryMeta } from '@/server/modules-public/synastry'
import { route as birthProfileRoute } from '@/server/modules-public/birth-profiles'
import {
  initDb,
  closeDb,
  createUser,
  createUserSession,
  sumLedgerDelta,
  getDb,
  schema,
} from '@/server/db'
import { eq } from 'drizzle-orm'
import { signUserToken, extractBearerToken, verifyUserToken } from '@/server/core/middleware/user-auth'
import { computeSynastry } from '@/server/lib/synastry'
import { calculateBazi, generateAnnotation } from '@/engine'

process.env.DB_PATH = ':memory:'

let app: Hono
let aliceToken = ''
let aliceId = 0
let bobToken = ''

/** 甲方生辰（阳历 1990-03-08 14:00 女） */
const A = {
  calendarType: 'solar', birthYear: 1990, birthMonth: 3, birthDay: 8,
  birthHour: 14, birthMinute: 0, gender: 'female',
}
/** 乙方生辰（阳历 1991-07-20 09:00 男） */
const B = {
  calendarType: 'solar', birthYear: 1991, birthMonth: 7, birthDay: 20,
  birthHour: 9, birthMinute: 0, gender: 'male',
}

function makeUser(username: string) {
  const user = createUser({
    username,
    passwordHash: bcrypt.hashSync('secret123', 10),
  })
  const { token, jti, expiresAt } = signUserToken(user.id, user.username)
  createUserSession({ userId: user.id, tokenJti: jti, expiresAt, ip: '127.0.0.1', userAgent: 'test' })
  return { user, token }
}

function auth(token: string): Record<string, string> {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
}

function post(token: string, body: Record<string, unknown>) {
  return app.request(`/api/v1/app/${synastryMeta.prefix}`, {
    method: 'POST',
    headers: auth(token),
    body: JSON.stringify(body),
  })
}

beforeAll(() => {
  initDb()
  app = new Hono()

  // 注入登录态（与生产一致：由鉴权中间件写入 currentUser）
  // 注意：精确路径与通配路径都要挂，否则 POST /synastry（无尾斜杠）匹配不到
  const inject = async (c: { req: { header: (n: string) => string | undefined }; set: (k: string, v: unknown) => void }, next: () => Promise<void>) => {
    const token = extractBearerToken(c as never)
    const payload = token ? verifyUserToken(token) : null
    if (payload) c.set('currentUser', payload as never)
    await next()
  }
  app.use(`/api/v1/app/${synastryMeta.prefix}`, inject as never)
  app.use(`/api/v1/app/${synastryMeta.prefix}/*`, inject as never)

  app.route(`/api/v1/app/${synastryMeta.prefix}`, synastryRoute)
  app.route('/api/v1/app/user/birth-profiles', birthProfileRoute)

  const alice = makeUser('alice-syn')
  aliceToken = alice.token
  aliceId = alice.user.id
  bobToken = makeUser('bob-syn').token

  // 合盘 cost=20，初始额度不够 —— 补足以便覆盖"扣费/缓存"路径
  getDb().update(schema.users).set({ quotaTotal: 1000 }).where(eq(schema.users.id, aliceId)).run()
})

afterAll(() => {
  closeDb()
})

describe('合盘接口 · 鉴权与越权', () => {
  it('未登录 → 401', async () => {
    const res = await app.request(`/api/v1/app/${synastryMeta.prefix}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ a: A, b: B, relation: 'spouse' }),
    })
    expect(res.status).toBe(401)
  })

  it('用他人的生辰档案 id → 404（不泄露 id 存在性）', async () => {
    // Bob 建一份档案
    const created = await app.request('/api/v1/app/user/birth-profiles', {
      method: 'POST',
      headers: auth(bobToken),
      body: JSON.stringify({ ...B, label: 'Bob 本人', relation: 'self' }),
    })
    const createdBody = await created.json() as { data?: { id: number } }
    const bobProfileId = createdBody.data?.id
    expect(bobProfileId).toBeTruthy()

    // Alice 拿 Bob 的档案合盘
    const res = await post(aliceToken, { aProfileId: bobProfileId, b: B, relation: 'spouse' })
    expect(res.status).toBe(404)
  })

  it('缺少一方入参 → 400，且说明是哪一方', async () => {
    const res = await post(aliceToken, { a: A, relation: 'spouse' })
    expect(res.status).toBe(400)
    const body = await res.json() as { error?: { message?: string } }
    expect(body.error?.message).toContain('乙方')
  })
})

describe('合盘接口 · 结果与缓存', () => {
  it('正常合盘：返回总分、档位与五个维度', async () => {
    const res = await post(aliceToken, { a: A, b: B, relation: 'spouse' })
    expect(res.status).toBe(200)
    const body = await res.json() as {
      success: boolean
      data?: {
        score: number
        grade: string
        dimensions: Array<{ key: string; label: string; score: number; comment: string }>
        sides: Array<{ dayMaster: string }>
        cached: boolean
      }
    }
    expect(body.success).toBe(true)
    const d = body.data
    expect(d?.score).toBeGreaterThanOrEqual(0)
    expect(d?.score).toBeLessThanOrEqual(100)
    expect(d?.grade).toBeTruthy()
    expect(d?.dimensions).toHaveLength(5)
    expect(d?.sides).toHaveLength(2)
    expect(d?.cached).toBe(false)
    // 每个维度都要有解释文字（可解释性是本项目的定位）
    for (const dim of d?.dimensions ?? []) {
      expect(dim.comment.length).toBeGreaterThan(5)
    }
  })

  it('同一对命盘重复请求 → 命中缓存且不重复扣额度', async () => {
    // 首次（新关系）必然扣费；基准取在首次之后，验证的是"第二次不再扣"
    const first = await post(aliceToken, { a: A, b: B, relation: 'friend' })
    const firstBody = await first.json() as { data?: { cached: boolean; score: number } }
    expect(firstBody.data?.cached).toBe(false)

    const before = sumLedgerDelta(aliceId)
    const second = await post(aliceToken, { a: A, b: B, relation: 'friend' })
    const secondBody = await second.json() as { data?: { cached: boolean; score: number } }

    expect(second.headers.get('X-Synastry-Cache')).toBe('hit')
    expect(secondBody.data?.cached).toBe(true)
    // 结果必须一致（规则层确定性）
    expect(secondBody.data?.score).toBe(firstBody.data?.score)
    // 第二次不产生新的额度台账
    expect(sumLedgerDelta(aliceId)).toBe(before)
  })

  it('关系不同 → 得分不同（权重真实生效）', async () => {
    const spouse = await post(aliceToken, { a: A, b: B, relation: 'spouse' })
    const parent = await post(aliceToken, { a: A, b: B, relation: 'parent' })
    const sb = await spouse.json() as { data?: { score: number } }
    const pb = await parent.json() as { data?: { score: number } }
    // 权重不同，几乎必然导致总分不同（同一对命盘、同一规则层）
    expect(sb.data?.score).not.toBe(pb.data?.score)
  })

  it('/relations 返回关系选项', async () => {
    const res = await app.request(`/api/v1/app/${synastryMeta.prefix}/relations`)
    const body = await res.json() as { data?: Array<{ key: string; label: string }> }
    expect(body.data?.length).toBeGreaterThanOrEqual(9)
    expect(body.data?.some(r => r.key === 'spouse')).toBe(true)
  })
})

describe('合盘规则层 · 命理底线', () => {
  it('日干五合（甲己）显著优于日干相克（甲庚）', async () => {
    // 直接构造两个 bundle，控制日干：甲子日 vs 己丑日 / 庚午日
    const mk = async (dayGanZhi: string) => {
      // 借真实排盘拿到完整结构，再覆写日柱以控制变量
      const chart = await calculateBazi(1990, 3, 8, 14, 0, '女')
      // branch 必须一起覆写：规则层读的是 dayPillar.branch，不是 ganZhi
      const dayPillar = { ...chart.dayPillar, ganZhi: dayGanZhi, branch: dayGanZhi[1] }
      const patched = { ...chart, dayPillar, dayMaster: dayGanZhi[0] }
      return { chart: patched, annotation: generateAnnotation(chart), label: dayGanZhi }
    }
    const jia = await mk('甲子')
    const ji = await mk('己丑')
    const geng = await mk('庚午')

    const he = computeSynastry(jia, ji, 'spouse')
    const ke = computeSynastry(jia, geng, 'spouse')

    const heDim = he.dimensions.find(d => d.key === 'dayGan')
    const keDim = ke.dimensions.find(d => d.key === 'dayGan')
    expect(heDim?.ratio).toBe(1)
    expect(keDim?.ratio ?? 0).toBeLessThan(heDim?.ratio ?? 0)
  })

  it('日支六合（子丑）显著优于日支六冲（子午）', async () => {
    const mk = async (dayGanZhi: string) => {
      const chart = await calculateBazi(1990, 3, 8, 14, 0, '女')
      // branch 必须一起覆写：规则层读的是 dayPillar.branch，不是 ganZhi
      const dayPillar = { ...chart.dayPillar, ganZhi: dayGanZhi, branch: dayGanZhi[1] }
      const patched = { ...chart, dayPillar, dayMaster: dayGanZhi[0] }
      return { chart: patched, annotation: generateAnnotation(chart), label: dayGanZhi }
    }
    const zi = await mk('甲子')
    const chou = await mk('乙丑')
    const wu = await mk('丙午')

    const he = computeSynastry(zi, chou, 'spouse')
    const chong = computeSynastry(zi, wu, 'spouse')

    const heDim = he.dimensions.find(d => d.key === 'dayZhi')
    const chongDim = chong.dimensions.find(d => d.key === 'dayZhi')
    expect(heDim?.ratio).toBe(1)
    expect(chongDim?.ratio ?? 1).toBeLessThan(heDim?.ratio ?? 0)
  })

  it('指纹只含命理特征，不含出生时刻（同类命盘可共享缓存）', async () => {
    const mk = async (y: number) => {
      const chart = await calculateBazi(y, 3, 8, 14, 0, '女')
      return { chart, annotation: generateAnnotation(chart), label: `${y}` }
    }
    const r = computeSynastry(await mk(1990), await mk(1991), 'spouse')
    expect(r.fingerprint).toContain('|')
    // 不应泄漏具体生日（仅干支）
    expect(r.fingerprint).not.toContain('1990')
  })
})
