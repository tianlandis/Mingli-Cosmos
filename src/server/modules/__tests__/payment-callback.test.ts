// ============================================================
// Phase 5 P5-5 — 支付回调幂等测试（ADR-009）
// 文件：src/server/modules/__tests__/payment-callback.test.ts
//
// 覆盖：
//   未配置密钥 → 503（默认安全，不暴露无签名发货端点）
//   缺签名 / 错签名 → 401
//   合法签名 → 结算成功 + 发放订阅
//   重复通知 → alreadySettled，不重复发货 / 不重复加额度
//   金额不一致 → 400（防篡改）
//   未知订单 → 404
// ============================================================

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Hono } from 'hono'
import { createHmac } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { route as paymentRoute } from '@/server/modules-public/payment'
import {
  initDb,
  closeDb,
  createUser,
  createOrder,
  getOrderById,
  getPlanByCode,
  setConfig,
  deleteConfig,
  getUserById,
  getSubscriptionByOrder,
} from '@/server/db'

const SECRET_KEY = 'payment_notify_secret'
const SECRET = 'test-notify-secret-1234567890'

let app: Hono
let userId = 0
let orderId = 0
let orderNo = ''

function sign(body: string, secret = SECRET): string {
  return createHmac('sha256', secret).update(body, 'utf8').digest('hex')
}

async function notify(payload: Record<string, unknown>, opts?: { secret?: string; omitSign?: boolean; raw?: string }) {
  const raw = opts?.raw ?? JSON.stringify(payload)
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (!opts?.omitSign) headers['x-pay-signature'] = sign(raw, opts?.secret ?? SECRET)
  return app.request('/api/v1/app/payment/notify/wechat', { method: 'POST', headers, body: raw })
}

beforeAll(() => {
  process.env.DB_PATH = ':memory:'
  initDb()
  app = new Hono()
  app.route('/api/v1/app/payment', paymentRoute)

  const u = createUser({ username: 'payer', passwordHash: bcrypt.hashSync('secret123', 10) })
  userId = u.id

  const plan = getPlanByCode('monthly')!
  const order = createOrder({
    userId,
    planId: plan.id,
    planName: plan.name,
    amountCents: plan.priceCents,
  })
  orderId = order.id
  orderNo = order.orderNo
})

afterAll(() => {
  deleteConfig(SECRET_KEY)
  closeDb()
  delete process.env.DB_PATH
})

describe('P5-5 — 支付回调幂等', () => {
  it('未配置签名密钥 → 503（默认关闭，避免裸奔发货）', async () => {
    deleteConfig(SECRET_KEY)
    const res = await notify({ orderNo })
    expect(res.status).toBe(503)
    const body = await res.json() as any
    expect(body.error.code).toBe('PAYMENT_CHANNEL_DISABLED')
  })

  it('已配置密钥但缺签名 → 401', async () => {
    setConfig(SECRET_KEY, SECRET)
    const res = await notify({ orderNo }, { omitSign: true })
    expect(res.status).toBe(401)
    expect(((await res.json()) as any).error.code).toBe('SIGNATURE_MISSING')
  })

  it('错误签名 → 401', async () => {
    const res = await notify({ orderNo }, { secret: 'wrong-secret' })
    expect(res.status).toBe(401)
    expect(((await res.json()) as any).error.code).toBe('SIGNATURE_INVALID')
  })

  it('金额与订单不一致 → 400 AMOUNT_MISMATCH', async () => {
    const res = await notify({ orderNo, tradeNo: 'TX-1', amountCents: 1 })
    expect(res.status).toBe(400)
    expect(((await res.json()) as any).error.code).toBe('AMOUNT_MISMATCH')
    // 订单仍为 pending（未误发货）
    expect(getOrderById(orderId)!.status).toBe('pending')
  })

  it('未知订单 → 404', async () => {
    const res = await notify({ orderNo: 'ML00000000000000XXXX' })
    expect(res.status).toBe(404)
  })

  it('合法回调 → 结算成功 + 订阅 + 额度发放', async () => {
    const amount = getOrderById(orderId)!.amountCents
    const res = await notify({ orderNo, tradeNo: 'WX-TX-001', amountCents: amount, status: 'SUCCESS' })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.success).toBe(true)
    expect(body.data.status).toBe('paid')
    expect(body.data.alreadySettled).toBe(false)
    expect(body.data.subscription).toBeTruthy()

    expect(getOrderById(orderId)!.status).toBe('paid')
    expect(getSubscriptionByOrder(orderId)).toBeTruthy()
  })

  it('重复通知 → alreadySettled，不重复发货 / 不重复加额度', async () => {
    const quotaBefore = getUserById(userId)!.quotaTotal
    const subsBefore = getSubscriptionByOrder(orderId)!.id

    const res = await notify({ orderNo, tradeNo: 'WX-TX-001', status: 'SUCCESS' })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.data.alreadySettled).toBe(true)

    expect(getUserById(userId)!.quotaTotal).toBe(quotaBefore) // 未重复赠送
    expect(getSubscriptionByOrder(orderId)!.id).toBe(subsBefore) // 未重复建订阅
  })

  it('第三方声明失败状态 → 不结算', async () => {
    const plan = getPlanByCode('monthly')!
    const o = createOrder({ userId, planId: plan.id, planName: plan.name, amountCents: plan.priceCents })
    const res = await notify({ orderNo: o.orderNo, status: 'CLOSED' })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.data.settled).toBe(false)
    expect(getOrderById(o.id)!.status).toBe('pending')
  })

  it('非法 JSON（签名正确）→ 400', async () => {
    const res = await notify({}, { raw: 'not-json{' })
    expect(res.status).toBe(400)
  })
})
