// ============================================================
// [ADR-013] 推介奖励域 — 回归测试
// 文件：src/server/modules/__tests__/referral-rewards.test.ts
//
// 锁定三条不变量（推介奖励最容易崩的地方）：
//   1. 归因唯一：一个被推介人只能绑定一次；拒绝自邀；
//   2. 发奖幂等：同一推介关系只发一次奖励（重复结算/新订单都不放大）；
//   3. 合规：删除权清除该用户相关的全部推介数据。
//
// 关键路径走**真实** settleOrderPaid（ADR-009 单一结算入口），
// 确保「支付成功 → 达标 → 发奖」整链被覆盖，而非只测孤立函数。
// ============================================================

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Hono } from 'hono'
import bcrypt from 'bcryptjs'
import { route as referralRoute } from '@/server/modules-public/referral'
import {
  initDb,
  closeDb,
  createUser,
  createUserSession,
  getUserById,
  getPlanByCode,
  createOrder,
  encodeReferralCode,
  decodeReferralCode,
  getReferralByReferee,
  listRewardsByUser,
  purgeReferralsForUser,
  DEFAULT_REFERRAL_REWARD_QUOTA,
} from '@/server/db'
import { signUserToken } from '@/server/core/middleware/user-auth'
import { settleOrderPaid } from '@/server/services/order-settlement'

let app: Hono
let referrerId = 0
let refereeId = 0
let referrerToken = ''
let refereeToken = ''

function makeUser(username: string, quotaTotal = 5) {
  const user = createUser({
    username,
    passwordHash: bcrypt.hashSync('secret123', 10),
    quotaTotal,
  })
  const { token, jti, expiresAt } = signUserToken(user.id, user.username)
  createUserSession({ userId: user.id, tokenJti: jti, expiresAt, ip: '127.0.0.1', userAgent: 'test' })
  return { user, token }
}

function bind(token: string, code: string) {
  return app.request('/api/v1/app/referral/bind', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ code }),
  })
}

/** 提取错误码（避免在测试里用 any） */
async function errCode(res: Response): Promise<string | undefined> {
  const body = (await res.json()) as { error?: { code?: string } }
  return body.error?.code
}

interface MeData {
  code?: string
  rewardQuota?: number
  invited?: number
  qualified?: number
  rewarded?: number
}

async function meData(res: Response): Promise<MeData> {
  const body = (await res.json()) as { data?: MeData }
  return body.data ?? {}
}

beforeAll(() => {
  process.env.DB_PATH = ':memory:'
  initDb()
  app = new Hono()
  app.route('/api/v1/app/referral', referralRoute)

  const a = makeUser('referrer-user')
  referrerId = a.user.id
  referrerToken = a.token
  const b = makeUser('referee-user')
  refereeId = b.user.id
  refereeToken = b.token
})

afterAll(() => {
  closeDb()
  delete process.env.DB_PATH
})

// ═══════════════════════════════════════
// A. 邀请码：可逆、非连续
// ═══════════════════════════════════════

describe('邀请码编解码', () => {
  it('encode → decode 往返一致，且相邻 id 码不相同', () => {
    for (const id of [1, 2, 42, 1000, 123456]) {
      expect(decodeReferralCode(encodeReferralCode(id))).toBe(id)
    }
    expect(encodeReferralCode(1)).not.toBe(encodeReferralCode(2))
  })

  it('非法码返回 null', () => {
    expect(decodeReferralCode('')).toBeNull()
    expect(decodeReferralCode('!!')).toBeNull()
    expect(decodeReferralCode('ZZZZZZZZZZ')).toBeNull()
  })
})

// ═══════════════════════════════════════
// B. 绑定：唯一归因
// ═══════════════════════════════════════

describe('推介绑定', () => {
  it('合法邀请码 → 绑定成功（pending）', async () => {
    const res = await bind(refereeToken, encodeReferralCode(referrerId))
    expect(res.status).toBe(201)
    const row = getReferralByReferee(refereeId)
    expect(row?.referrerUserId).toBe(referrerId)
    expect(row?.status).toBe('pending')
  })

  it('重复绑定 → 409 ALREADY_BOUND', async () => {
    const res = await bind(refereeToken, encodeReferralCode(referrerId))
    expect(res.status).toBe(409)
    expect(await errCode(res)).toBe('ALREADY_BOUND')
  })

  it('自邀 → 400 SELF_REFERRAL', async () => {
    const res = await bind(referrerToken, encodeReferralCode(referrerId))
    expect(res.status).toBe(400)
    expect(await errCode(res)).toBe('SELF_REFERRAL')
  })

  it('非法码 → 400 INVALID_CODE', async () => {
    const res = await bind(referrerToken, '!!!not-a-code!!!')
    expect(res.status).toBe(400)
    expect(await errCode(res)).toBe('INVALID_CODE')
  })
})

// ═══════════════════════════════════════
// C. GET /me
// ═══════════════════════════════════════

describe('GET /me', () => {
  it('返回邀请码、奖励额度与战绩', async () => {
    const res = await app.request('/api/v1/app/referral/me', {
      headers: { Authorization: `Bearer ${referrerToken}` },
    })
    expect(res.status).toBe(200)
    const body = await meData(res)
    expect(body.code).toBe(encodeReferralCode(referrerId))
    expect(body.rewardQuota).toBe(DEFAULT_REFERRAL_REWARD_QUOTA)
    expect(body.invited).toBe(1)
    expect(body.qualified).toBe(0)
    expect(body.rewarded).toBe(0)
  })

  it('未登录 → 401', async () => {
    const res = await app.request('/api/v1/app/referral/me')
    expect(res.status).toBe(401)
  })
})

// ═══════════════════════════════════════
// D. 达标与发奖（走真实结算入口）
// ═══════════════════════════════════════

describe('达标与幂等发奖', () => {
  it('被推介人付费 → 推介人获额度（恰一次）+ 关系转 rewarded', () => {
    const plan = getPlanByCode('monthly')!
    const before = getUserById(referrerId)!.quotaTotal

    const order = createOrder({
      userId: refereeId,
      planId: plan.id,
      planName: plan.name,
      amountCents: plan.priceCents,
    })
    const r1 = settleOrderPaid({ orderId: order.id })

    expect(r1.ok).toBe(true)
    expect(getUserById(referrerId)!.quotaTotal).toBe(before + DEFAULT_REFERRAL_REWARD_QUOTA)
    expect(getReferralByReferee(refereeId)!.status).toBe('rewarded')
    expect(listRewardsByUser(referrerId)).toHaveLength(1)
  })

  it('同一订单重复结算 → 不重复发奖（订单级幂等）', () => {
    const plan = getPlanByCode('monthly')!
    const before = getUserById(referrerId)!.quotaTotal
    const order = createOrder({
      userId: refereeId, planId: plan.id, planName: plan.name, amountCents: plan.priceCents,
    })
    // 此时关系已是 rewarded：首次结算不再发奖，重复结算命中 alreadySettled
    const first = settleOrderPaid({ orderId: order.id })
    const second = settleOrderPaid({ orderId: order.id })

    expect(first.ok).toBe(true)
    expect(second.ok).toBe(true)
    expect(second.ok && second.alreadySettled).toBe(true)
    expect(getUserById(referrerId)!.quotaTotal).toBe(before)
    expect(listRewardsByUser(referrerId)).toHaveLength(1)
  })

  it('新订单再次结算 → 奖励仍不放大', () => {
    const plan = getPlanByCode('monthly')!
    const before = getUserById(referrerId)!.quotaTotal
    const order = createOrder({
      userId: refereeId, planId: plan.id, planName: plan.name, amountCents: plan.priceCents,
    })
    settleOrderPaid({ orderId: order.id })
    expect(getUserById(referrerId)!.quotaTotal).toBe(before)
    expect(listRewardsByUser(referrerId)).toHaveLength(1)
  })

  it('无推介关系的用户付费 → 不影响任何人', () => {
    const plan = getPlanByCode('monthly')!
    const lonely = makeUser('lonely-user')
    const before = getUserById(referrerId)!.quotaTotal
    const order = createOrder({
      userId: lonely.user.id, planId: plan.id, planName: plan.name, amountCents: plan.priceCents,
    })
    const r = settleOrderPaid({ orderId: order.id })
    expect(r.ok).toBe(true)
    expect(getUserById(referrerId)!.quotaTotal).toBe(before)
  })
})

// ═══════════════════════════════════════
// E. 合规：删除权
// ═══════════════════════════════════════

describe('删除权：推介数据清除', () => {
  it('purgeReferralsForUser 清除关系与奖励', () => {
    expect(getReferralByReferee(refereeId)).toBeDefined()
    const res = purgeReferralsForUser(refereeId)
    expect(res.referrals).toBeGreaterThan(0)
    expect(getReferralByReferee(refereeId)).toBeUndefined()
    expect(listRewardsByUser(referrerId)).toHaveLength(0)
  })
})
