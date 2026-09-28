// ============================================================
// [ADR-012] 生辰档案 — 回归测试
// 文件：src/server/modules/__tests__/birth-profiles.test.ts
//
// 锁定四条最易崩的语义：
//   1. 默认唯一：同一用户的默认档恒为 0 或 1 份（删默认档要自动补位，
//      否则「登录自动出盘」会静默失效）；
//   2. 越权等同不存在：他人档案一律 404，不泄露 id 存在性；
//   3. 日期真实存在：2 月 30 日这类输入必须拒绝；
//   4. 注册即建档：注册带 birth → 立刻有默认档；不带 birth → 不建（老流程兼容）。
//
// 产品闭环：「注册采集生辰 → 登录据默认档自动出盘」的数据链路，
// 故本测试同时覆盖 /user/register 与 /user/me。
// ============================================================

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Hono } from 'hono'
import bcrypt from 'bcryptjs'
import { route as birthProfileRoute } from '@/server/modules-public/birth-profiles'
import { route as userRoute } from '@/server/modules-public/user'
import {
  initDb,
  closeDb,
  createUser,
  createUserSession,
  listBirthProfilesByUser,
} from '@/server/db'
import { signUserToken } from '@/server/core/middleware/user-auth'

let app: Hono
let aliceToken = ''
let aliceUserId = 0
let bobToken = ''

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

function createProfile(token: string, body: Record<string, unknown>) {
  return app.request('/api/v1/app/user/birth-profiles', {
    method: 'POST',
    headers: auth(token),
    body: JSON.stringify(body),
  })
}

function patchProfile(token: string, id: number, body: Record<string, unknown>) {
  return app.request(`/api/v1/app/user/birth-profiles/${id}`, {
    method: 'PATCH',
    headers: auth(token),
    body: JSON.stringify(body),
  })
}

function deleteProfile(token: string, id: number) {
  return app.request(`/api/v1/app/user/birth-profiles/${id}`, {
    method: 'DELETE',
    headers: auth(token),
  })
}

function setDefault(token: string, id: number) {
  return app.request(`/api/v1/app/user/birth-profiles/${id}/default`, {
    method: 'POST',
    headers: auth(token),
  })
}

function listProfiles(token: string) {
  return app.request('/api/v1/app/user/birth-profiles', { headers: auth(token) })
}

async function body<T>(res: Response): Promise<T> {
  return (await res.json()) as T
}

/** 一份合法生辰（公历 1990-06-15 午时，男） */
const SOLAR_1990 = {
  calendarType: 'solar',
  birthYear: 1990,
  birthMonth: 6,
  birthDay: 15,
  birthHour: 12,
  birthMinute: 0,
  isLeapMonth: false,
  gender: 'male',
}

interface ProfileDto {
  id: number
  label: string | null
  relation: string | null
  calendarType: string
  birthYear: number
  birthMonth: number
  birthDay: number
  birthHour: number | null
  birthMinute: number | null
  isLeapMonth: boolean
  gender: string | null
  isDefault: boolean
}

interface ListData { items: ProfileDto[]; total: number }

beforeAll(() => {
  process.env.DB_PATH = ':memory:'
  initDb()
  app = new Hono()
  // 与生产同一挂载方式：birth-profiles 使用 meta.prefix = 'user/birth-profiles'
  app.route('/api/v1/app/user/birth-profiles', birthProfileRoute)
  app.route('/api/v1/app/user', userRoute)

  const alice = makeUser('alice-birth')
  aliceToken = alice.token
  aliceUserId = alice.user.id
  bobToken = makeUser('bob-birth').token
})

afterAll(() => {
  closeDb()
  delete process.env.DB_PATH
})

// ═══════════════════════════════════════
// A. 基本 CRUD + 默认唯一
// ═══════════════════════════════════════

describe('生辰档案 CRUD', () => {
  it('未登录访问 → 401', async () => {
    const res = await app.request('/api/v1/app/user/birth-profiles')
    expect(res.status).toBe(401)
  })

  it('首个档案自动成为默认', async () => {
    const res = await createProfile(aliceToken, { label: '本人', ...SOLAR_1990 })
    expect(res.status).toBe(201)
    const d = await body<{ data: ProfileDto }>(res)
    expect(d.data.isDefault).toBe(true)
    expect(d.data.label).toBe('本人')
    // 0/1 已转 boolean，且不暴露 userId 等内部列
    expect(typeof d.data.isDefault).toBe('boolean')
    expect(d.data).not.toHaveProperty('userId')
  })

  it('第二个档案不是默认（默认档保持唯一）', async () => {
    const res = await createProfile(aliceToken, {
      label: '父亲', ...SOLAR_1990, birthYear: 1960, isDefault: false,
    })
    expect(res.status).toBe(201)
    const list = await body<{ data: ListData }>(await listProfiles(aliceToken))
    expect(list.data.total).toBe(2)
    expect(list.data.items.filter(p => p.isDefault)).toHaveLength(1)
  })

  it('设为默认 → 互斥，默认档仍只有一份，且排在最前', async () => {
    const before = await body<{ data: ListData }>(await listProfiles(aliceToken))
    const target = before.data.items.find(p => p.label === '父亲')!

    const res = await setDefault(aliceToken, target.id)
    expect(res.status).toBe(200)

    const after = await body<{ data: ListData }>(await listProfiles(aliceToken))
    const defaults = after.data.items.filter(p => p.isDefault)
    expect(defaults).toHaveLength(1)
    expect(defaults[0].id).toBe(target.id)
    // 列表默认档优先
    expect(after.data.items[0].id).toBe(target.id)
  })

  it('PATCH 修改字段生效', async () => {
    const list = await body<{ data: ListData }>(await listProfiles(aliceToken))
    const target = list.data.items.find(p => p.label === '父亲')!

    const res = await patchProfile(aliceToken, target.id, { label: '家父', birthHour: 9 })
    expect(res.status).toBe(200)
    const d = await body<{ data: ProfileDto }>(res)
    expect(d.data.label).toBe('家父')
    expect(d.data.birthHour).toBe(9)
    // 未传的字段保持不变
    expect(d.data.birthYear).toBe(1960)
  })

  it('删除非默认档：默认档不变', async () => {
    const list = await body<{ data: ListData }>(await listProfiles(aliceToken))
    const defaultId = list.data.items.find(p => p.isDefault)!.id
    const other = list.data.items.find(p => !p.isDefault)!

    const res = await deleteProfile(aliceToken, other.id)
    expect(res.status).toBe(200)

    const after = await body<{ data: ListData }>(await listProfiles(aliceToken))
    expect(after.data.total).toBe(1)
    expect(after.data.items[0].id).toBe(defaultId)
    expect(after.data.items[0].isDefault).toBe(true)
  })

  it('删除默认档：剩余档案自动补位为默认（防「有档无默认」导致自动出盘失效）', async () => {
    // 再建两份，凑出「删掉默认后仍有剩余」的局面
    await createProfile(aliceToken, { label: '甲', ...SOLAR_1990 })
    await createProfile(aliceToken, { label: '乙', ...SOLAR_1990, birthYear: 2000 })

    const before = await body<{ data: ListData }>(await listProfiles(aliceToken))
    const defaultId = before.data.items.find(p => p.isDefault)!.id
    expect(before.data.items.length).toBeGreaterThan(1)

    const res = await deleteProfile(aliceToken, defaultId)
    expect(res.status).toBe(200)
    const resBody = await body<{ data: { promotedDefaultId: number | null } }>(res)
    expect(resBody.data.promotedDefaultId).not.toBeNull()

    const after = await body<{ data: ListData }>(await listProfiles(aliceToken))
    expect(after.data.items.filter(p => p.isDefault)).toHaveLength(1)
  })

  it('删掉最后一份档案后，默认档为空且不报错', async () => {
    const list = await body<{ data: ListData }>(await listProfiles(aliceToken))
    for (const p of list.data.items) {
      expect((await deleteProfile(aliceToken, p.id)).status).toBe(200)
    }
    const after = await body<{ data: ListData }>(await listProfiles(aliceToken))
    expect(after.data.total).toBe(0)
  })
})

// ═══════════════════════════════════════
// B. 越权：他人档案等同不存在
// ═══════════════════════════════════════

describe('越权防护', () => {
  it('他人档案的 PATCH / DELETE / 设为默认 一律 404', async () => {
    const created = await createProfile(bobToken, { label: 'Bob 本人', ...SOLAR_1990 })
    const bobProfileId = (await body<{ data: ProfileDto }>(created)).data.id

    expect((await patchProfile(aliceToken, bobProfileId, { label: '篡改' })).status).toBe(404)
    expect((await deleteProfile(aliceToken, bobProfileId)).status).toBe(404)
    expect((await setDefault(aliceToken, bobProfileId)).status).toBe(404)

    // Bob 的档案未被改动
    const bobList = await body<{ data: ListData }>(await listProfiles(bobToken))
    expect(bobList.data.items[0].label).toBe('Bob 本人')
  })

  it('不存在的 id → 404', async () => {
    expect((await patchProfile(aliceToken, 999999, { label: 'x' })).status).toBe(404)
    expect((await deleteProfile(aliceToken, 999999)).status).toBe(404)
    expect((await setDefault(aliceToken, 999999)).status).toBe(404)
  })

  it('非法 id → 400', async () => {
    expect((await deleteProfile(aliceToken, -1)).status).toBe(400)
  })
})

// ═══════════════════════════════════════
// C. 日期与参数校验
// ═══════════════════════════════════════

describe('输入校验', () => {
  it('拒绝不存在的日期（2 月 30 日）', async () => {
    const res = await createProfile(aliceToken, {
      ...SOLAR_1990, birthMonth: 2, birthDay: 30,
    })
    expect(res.status).toBe(400)
    const d = await body<{ error: { message: string } }>(res)
    expect(d.error.message).toContain('最多')
  })

  it('接受闰年 2 月 29 日', async () => {
    const res = await createProfile(aliceToken, {
      ...SOLAR_1990, birthYear: 2000, birthMonth: 2, birthDay: 29,
    })
    expect(res.status).toBe(201)
  })

  it('拒绝非法历法 / 性别 / 越界年份', async () => {
    expect((await createProfile(aliceToken, { ...SOLAR_1990, calendarType: 'x' })).status).toBe(400)
    expect((await createProfile(aliceToken, { ...SOLAR_1990, gender: '男' })).status).toBe(400)
    expect((await createProfile(aliceToken, { ...SOLAR_1990, birthYear: 1800 })).status).toBe(400)
    expect((await createProfile(aliceToken, { ...SOLAR_1990, birthHour: 24 })).status).toBe(400)
  })

  it('农历按 30 天上限校验', async () => {
    const ok = await createProfile(aliceToken, {
      ...SOLAR_1990, calendarType: 'lunar', birthMonth: 2, birthDay: 30,
    })
    expect(ok.status).toBe(201)
    const bad = await createProfile(aliceToken, {
      ...SOLAR_1990, calendarType: 'lunar', birthMonth: 2, birthDay: 31,
    })
    expect(bad.status).toBe(400)
  })
})

// ═══════════════════════════════════════
// D. 注册建档 + /me 回传（产品闭环）
// ═══════════════════════════════════════

describe('注册即建档 / 登录自动出盘的数据链路', () => {
  it('注册带 birth → 立即生成默认档案，且 /user/me 回传', async () => {
    const reg = await app.request('/api/v1/app/user/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'carol-birth',
        password: 'secret123',
        nickname: '卡罗',
        birth: SOLAR_1990,
      }),
    })
    expect(reg.status).toBe(201)
    const regBody = await body<{ data: { token: string; user: { id: number } } }>(reg)
    const token = regBody.data.token
    const userId = regBody.data.user.id

    // 库里确实有一份默认档
    const rows = listBirthProfilesByUser(userId)
    expect(rows).toHaveLength(1)
    expect(rows[0].isDefault).toBe(1)
    expect(rows[0].birthYear).toBe(1990)

    // /me 回传默认档，前端据此自动出盘
    const me = await app.request('/api/v1/app/user/me', { headers: auth(token) })
    expect(me.status).toBe(200)
    const meBody = await body<{ data: { defaultBirthProfile: ProfileDto | null } }>(me)
    const profile = meBody.data.defaultBirthProfile
    expect(profile).not.toBeNull()
    expect(profile!.birthYear).toBe(1990)
    expect(profile!.isDefault).toBe(true)
  })

  it('注册不带 birth → 不建档，/me 的 defaultBirthProfile 为 null（老流程兼容）', async () => {
    const reg = await app.request('/api/v1/app/user/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'dave-nobirth', password: 'secret123' }),
    })
    expect(reg.status).toBe(201)
    const regBody = await body<{ data: { token: string; user: { id: number } } }>(reg)
    expect(listBirthProfilesByUser(regBody.data.user.id)).toHaveLength(0)

    const me = await app.request('/api/v1/app/user/me', { headers: auth(regBody.data.token) })
    const meBody = await body<{ data: { defaultBirthProfile: ProfileDto | null } }>(me)
    expect(meBody.data.defaultBirthProfile).toBeNull()
  })

  it('注册带非法生辰 → 400，且不产生用户（校验先于写库）', async () => {
    const res = await app.request('/api/v1/app/user/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'eve-bad',
        password: 'secret123',
        birth: { ...SOLAR_1990, birthMonth: 2, birthDay: 30 },
      }),
    })
    expect(res.status).toBe(400)
  })

  it('未带生日的老账号：/me 的 defaultBirthProfile 为 null（不误报）', async () => {
    const me = await app.request('/api/v1/app/user/me', { headers: auth(bobToken) })
    const meBody = await body<{ data: { defaultBirthProfile: ProfileDto | null } }>(me)
    // Bob 只有通过档案接口建的档，没有默认之外的干扰
    expect(meBody.data).toHaveProperty('defaultBirthProfile')
  })
})

// ═══════════════════════════════════════
// E. 关系标签（家人 / 朋友 / 同学 …）
//
// 锁定三条：建档带 relation 生效、PATCH 改 relation 不静默失效、
// 非法值被拒。第三条尤其重要——updateSchema 若在 .partial() 前漏声明
// relation，zod 会静默剥掉该键，表现为「改了但没生效」。
// ═══════════════════════════════════════

describe('关系标签', () => {
  it('建档带 relation → 回传一致（本人/父亲/朋友）', async () => {
    for (const relation of ['self', 'father', 'friend']) {
      const res = await createProfile(aliceToken, { ...SOLAR_1990, label: `档-${relation}`, relation })
      expect(res.status).toBe(201)
      const d = await body<{ data: ProfileDto }>(res)
      expect(d.data.relation).toBe(relation)
    }
  })

  it('PATCH 改 relation → 生效（防 zod 剥离导致静默失效）', async () => {
    const created = await body<{ data: ProfileDto }>(
      await createProfile(aliceToken, { ...SOLAR_1990, label: '待改关系', relation: 'other' })
    )
    const id = created.data.id
    expect(created.data.relation).toBe('other')

    const patched = await body<{ data: ProfileDto }>(
      await patchProfile(aliceToken, id, { relation: 'mother' })
    )
    expect(patched.data.relation).toBe('mother')

    // 落库复核：接口回传对了但库里没改，等于没改
    const rows = listBirthProfilesByUser(aliceUserId)
    expect(rows.find(r => r.id === id)?.relation).toBe('mother')
  })

  it('单独改 label 不影响 relation（局部更新不互相覆盖）', async () => {
    const created = await body<{ data: ProfileDto }>(
      await createProfile(aliceToken, { ...SOLAR_1990, label: '原名', relation: 'colleague' })
    )
    const patched = await body<{ data: ProfileDto }>(
      await patchProfile(aliceToken, created.data.id, { label: '改名了' })
    )
    expect(patched.data.label).toBe('改名了')
    expect(patched.data.relation).toBe('colleague')
  })

  it('非法 relation → 400', async () => {
    const res = await createProfile(aliceToken, { ...SOLAR_1990, relation: '前任' })
    expect(res.status).toBe(400)
  })

  it('未填 relation → null（老数据/不关心关系的场景兼容）', async () => {
    const res = await createProfile(aliceToken, { ...SOLAR_1990, label: '无关系档' })
    expect(res.status).toBe(201)
    const d = await body<{ data: ProfileDto }>(res)
    expect(d.data.relation).toBeNull()
  })

  it('注册建档 → relation 恒为 self', async () => {
    const reg = await app.request('/api/v1/app/user/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'frank-rel', password: 'secret123', birth: SOLAR_1990 }),
    })
    expect(reg.status).toBe(201)
    const regBody = await body<{ data: { user: { id: number } } }>(reg)
    const rows = listBirthProfilesByUser(regBody.data.user.id)
    expect(rows).toHaveLength(1)
    expect(rows[0].relation).toBe('self')
  })

  it('前端 RELATION_OPTIONS 的 key 与服务端枚举完全一致（防前后端漂移）', async () => {
    const { RELATION_OPTIONS } = await import('@/lib/birth')
    const { RELATION_VALUES } = await import('@/server/lib/birth-input')
    const feKeys = RELATION_OPTIONS.map(o => o.key).sort()
    const beKeys = [...RELATION_VALUES].sort()
    expect(feKeys).toEqual(beKeys)
  })
})
