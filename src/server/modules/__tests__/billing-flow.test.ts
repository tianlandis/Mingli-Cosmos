// ============================================================
// Phase 4b M-7 / M-8 — 订单订阅与运营埋点端到端测试
// 文件：src/server/modules/__tests__/billing-flow.test.ts
//
// 覆盖链路：
//   套餐种子 → 下单 → 模拟支付 → 订阅续期 → 退款回收 → 后台确认收款
//   埋点写入 → 白名单拦截 → 看板聚合
//
// 隔离约定：singleFork 共享进程，本文件自建 :memory: 库
// ============================================================

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { route as billingRoute } from '@/server/modules-public/billing'
import { route as trackRoute } from '@/server/modules-public/track'
import { route as userRoute } from '@/server/modules-public/user'
import { route as adminOrdersRoute } from '@/server/modules/orders'
import { route as adminAnalyticsRoute } from '@/server/modules/analytics'
import { initDb, closeDb, getDb, schema } from '@/server/db'
import { signToken, createSession } from '@/server/core/middleware/auth'

let app: Hono
let adminHeaders: Record<string, string>
let userHeaders: Record<string, string>
let userId = 0

/** 注册默认额度（与 createUser 的 quotaTotal 默认值一致） */
const INITIAL_QUOTA = 5

beforeAll(async () => {
  process.env.DB_PATH = ':memory:'
  initDb()

  // 管理员会话
  const admin = signToken('billing-admin')
  createSession({ tokenJti: admin.jti, username: 'billing-admin', expiresAt: admin.expiresAt })
  adminHeaders = { Authorization: `Bearer ${admin.token}`, 'Content-Type': 'application/json' }

  app = new Hono()
  app.route('/api/v1/app/billing', billingRoute)
  app.route('/api/v1/app/user', userRoute)
  app.route('/api/v1/app/track', trackRoute)
  app.route('/api/v1/admin/orders', adminOrdersRoute)
  app.route('/api/v1/admin/analytics', adminAnalyticsRoute)

  // C 端用户：走真实注册接口（避免绕过业务校验）
  const reg = await app.request('/api/v1/app/user/register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': '10.20.0.1',
    },
    body: JSON.stringify({ username: 'buyer', password: 'secret123' }),
  })
  const regBody = await reg.json() as any
  userHeaders = {
    Authorization: `Bearer ${regBody.data.token}`,
    'Content-Type': 'application/json',
  }
  userId = regBody.data.user.id
})

afterAll(() => {
  closeDb()
  delete process.env.DB_PATH
})

// ═══════════════════════════════════════
// A. 套餐
// ═══════════════════════════════════════

let monthlyPlanId = 0

describe('M-7 A — 套餐管理', () => {
  it('initDb 种子写入 3 个默认套餐', async () => {
    const res = await app.request('/api/v1/app/billing/plans')
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.data.length).toBe(3)
    const codes = body.data.map((p: any) => p.code)
    expect(codes).toContain('trial')
    expect(codes).toContain('monthly')
    expect(codes).toContain('yearly')
    monthlyPlanId = body.data.find((p: any) => p.code === 'monthly').id
    // 价格换算：3900 分 = 39 元
    expect(body.data.find((p: any) => p.code === 'monthly').priceYuan).toBe(39)
  })

  it('套餐重复初始化不会重复写入（幂等）', async () => {
    const { seedDefaultPlans } = await import('@/server/db/seed')
    seedDefaultPlans()
    const res = await app.request('/api/v1/admin/orders/plans', { headers: adminHeaders })
    const body = await res.json() as any
    expect(body.data.length).toBe(3)
  })

  it('后台新建套餐 → 201', async () => {
    const res = await app.request('/api/v1/admin/orders/plans', {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        code: 'quarterly',
        name: '季度会员',
        priceCents: 9900,
        durationDays: 90,
        quotaGrant: 200,
        vipLevel: 'basic',
        features: ['200 次 AI 深度解读'],
      }),
    })
    expect(res.status).toBe(201)
  })

  it('套餐编码重复 → 409', async () => {
    const res = await app.request('/api/v1/admin/orders/plans', {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        code: 'quarterly', name: '重复', priceCents: 100, durationDays: 1,
      }),
    })
    expect(res.status).toBe(409)
  })

  it('非法编码（大写）→ 400', async () => {
    const res = await app.request('/api/v1/admin/orders/plans', {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        code: 'BAD_CODE', name: 'x', priceCents: 100, durationDays: 1,
      }),
    })
    expect(res.status).toBe(400)
  })

  it('修改套餐价格 → 生效', async () => {
    const list = await (await app.request('/api/v1/admin/orders/plans', { headers: adminHeaders })).json() as any
    const target = list.data.find((p: any) => p.code === 'quarterly')
    const res = await app.request(`/api/v1/admin/orders/plans/${target.id}`, {
      method: 'PUT',
      headers: adminHeaders,
      body: JSON.stringify({ priceCents: 8900 }),
    })
    expect(res.status).toBe(200)
    expect((await res.json() as any).data.priceCents).toBe(8900)
  })
})

// ═══════════════════════════════════════
// B. 下单与支付
// ═══════════════════════════════════════

let orderId = 0
let firstEndsAt = ''

describe('M-7 B — 下单与模拟支付', () => {
  it('未登录下单 → 401', async () => {
    const res = await app.request('/api/v1/app/billing/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planId: monthlyPlanId }),
    })
    expect(res.status).toBe(401)
  })

  it('不存在的套餐 → 404', async () => {
    const res = await app.request('/api/v1/app/billing/orders', {
      method: 'POST',
      headers: userHeaders,
      body: JSON.stringify({ planId: 999999 }),
    })
    expect(res.status).toBe(404)
  })

  it('下单成功 → pending + 金额与套餐一致', async () => {
    const res = await app.request('/api/v1/app/billing/orders', {
      method: 'POST',
      headers: userHeaders,
      body: JSON.stringify({ planId: monthlyPlanId }),
    })
    expect(res.status).toBe(201)
    const body = await res.json() as any
    expect(body.data.status).toBe('pending')
    expect(body.data.amountCents).toBe(3900)
    expect(body.data.amountYuan).toBe(39)
    expect(body.data.orderNo).toMatch(/^ML\d{14}[A-Z0-9]{4}$/)
    orderId = body.data.id
  })

  it('模拟支付 → paid + 订阅生效 + 额度发放', async () => {
    const res = await app.request(`/api/v1/app/billing/orders/${orderId}/pay`, {
      method: 'POST',
      headers: userHeaders,
      body: JSON.stringify({ payMethod: 'mock' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.data.order.status).toBe('paid')
    expect(body.data.subscription.vipLevel).toBe('basic')
    expect(body.data.subscription.quotaGranted).toBe(60)
    // 注册赠送 5 次 + 套餐赠送 60
    expect(body.data.quotaRemaining).toBe(INITIAL_QUOTA + 60)
    firstEndsAt = body.data.subscription.endsAt
  })

  it('重复支付 → 409', async () => {
    const res = await app.request(`/api/v1/app/billing/orders/${orderId}/pay`, {
      method: 'POST',
      headers: userHeaders,
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(409)
  })

  it('GET /subscription → 返回有效订阅', async () => {
    const res = await app.request('/api/v1/app/billing/subscription', { headers: userHeaders })
    const body = await res.json() as any
    expect(body.data.active).toBeTruthy()
    expect(body.data.active.endsAt).toBe(firstEndsAt)
    expect(body.data.history.length).toBe(1)
  })

  it('再次购买 → 订阅在原到期时间上顺延', async () => {
    const created = await app.request('/api/v1/app/billing/orders', {
      method: 'POST',
      headers: userHeaders,
      body: JSON.stringify({ planId: monthlyPlanId }),
    })
    const secondId = (await created.json() as any).data.id

    const paid = await app.request(`/api/v1/app/billing/orders/${secondId}/pay`, {
      method: 'POST',
      headers: userHeaders,
      body: JSON.stringify({}),
    })
    const body = await paid.json() as any
    expect(body.data.subscription.startsAt).toBe(firstEndsAt)
    expect(new Date(body.data.subscription.endsAt).getTime())
      .toBeGreaterThan(new Date(firstEndsAt).getTime())
    expect(body.data.quotaRemaining).toBe(INITIAL_QUOTA + 120)  // 5 + 60 + 60
  })

  it('我的订单列表 → 2 笔已支付', async () => {
    const res = await app.request('/api/v1/app/billing/orders', { headers: userHeaders })
    const body = await res.json() as any
    expect(body.data.total).toBe(2)
    expect(body.data.items.every((o: any) => o.status === 'paid')).toBe(true)
  })
})

// ═══════════════════════════════════════
// C. 后台确认收款 / 退款
// ═══════════════════════════════════════

describe('M-7 C — 后台订单处理', () => {
  let offlineOrderId = 0

  it('后台确认收款（离线转账）→ paid', async () => {
    const created = await app.request('/api/v1/app/billing/orders', {
      method: 'POST',
      headers: userHeaders,
      body: JSON.stringify({ planId: monthlyPlanId }),
    })
    offlineOrderId = (await created.json() as any).data.id

    const res = await app.request(`/api/v1/admin/orders/${offlineOrderId}/confirm`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ payMethod: 'offline', tradeNo: 'OFFLINE-001' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.data.order.status).toBe('paid')
    expect(body.data.subscription).toBeTruthy()
  })

  it('重复确认 → 409', async () => {
    const res = await app.request(`/api/v1/admin/orders/${offlineOrderId}/confirm`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(409)
  })

  it('退款 → 订单 refunded + 订阅撤销 + 额度回收', async () => {
    const before = await (await app.request('/api/v1/app/billing/subscription', { headers: userHeaders })).json() as any
    expect(before.data.active).toBeTruthy()

    const res = await app.request(`/api/v1/admin/orders/${offlineOrderId}/refund`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ reason: '用户申请' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.data.order.status).toBe('refunded')
    expect(body.data.revokedSubscriptions).toBe(1)
    expect(body.data.quotaRevoked).toBe(60)
  })

  it('退款后未过期订阅仍存在时等级保持 basic', async () => {
    const { getUserById } = await import('@/server/db')
    const user = getUserById(userId)
    expect(user?.vipLevel).toBe('basic')
    // 5（注册）+ 60 ×3（三次订阅）- 60（退款回收）= 125
    expect(user!.quotaTotal - user!.quotaUsed).toBe(INITIAL_QUOTA + 120)
  })

  it('GET /orders/stats → 统计口径正确', async () => {
    const res = await app.request('/api/v1/admin/orders/stats', { headers: adminHeaders })
    const body = await res.json() as any
    expect(body.data.paid).toBe(2)
    expect(body.data.refunded).toBe(1)
    // 收入只统计 paid：39 * 2 = 78 元
    expect(body.data.revenueYuan).toBe(78)
  })

  it('POST /maintenance → 关闭超时订单', async () => {
    // 手动把一笔 pending 订单改为已超时
    const created = await app.request('/api/v1/app/billing/orders', {
      method: 'POST',
      headers: userHeaders,
      body: JSON.stringify({ planId: monthlyPlanId }),
    })
    const id = (await created.json() as any).data.id
    getDb().update(schema.orders)
      .set({ expiredAt: new Date(Date.now() - 1000).toISOString() })
      .where(eq(schema.orders.id, id))
      .run()

    // 支付时检测到超时 → 410 并自动关闭订单
    const pay = await app.request(`/api/v1/app/billing/orders/${id}/pay`, {
      method: 'POST',
      headers: userHeaders,
      body: JSON.stringify({}),
    })
    expect(pay.status).toBe(410)

    // 维护任务扫描其余超时订单
    const res = await app.request('/api/v1/admin/orders/maintenance', {
      method: 'POST',
      headers: adminHeaders,
    })
    const body = await res.json() as any
    expect(body.data.expiredOrders).toBeGreaterThanOrEqual(0)
  })
})

// ═══════════════════════════════════════
// D. 运营埋点（M-8）
// ═══════════════════════════════════════

describe('M-8 D — 埋点与看板聚合', () => {
  it('白名单外事件 → 400', async () => {
    const res = await app.request('/api/v1/app/track', {
      method: 'POST',
      headers: userHeaders,
      body: JSON.stringify({ event: 'evil_event' }),
    })
    expect(res.status).toBe(400)
    const body = await res.json() as any
    expect(body.error.code).toBe('UNSUPPORTED_EVENT')
  })

  it('合法事件写入 → 201（含登录用户 ID）', async () => {
    const res = await app.request('/api/v1/app/track', {
      method: 'POST',
      headers: userHeaders,
      body: JSON.stringify({ event: 'paipan', payload: { source: 'test' } }),
    })
    expect(res.status).toBe(201)
  })

  it('匿名埋点（无 token）也能记录', async () => {
    const res = await app.request('/api/v1/app/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'page_view', sessionId: 'anon-1' }),
    })
    expect(res.status).toBe(201)
  })

  it('GET /analytics/overview → 聚合指标齐全', async () => {
    const res = await app.request('/api/v1/admin/analytics/overview?days=7', { headers: adminHeaders })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    const d = body.data
    expect(d.activity.paipanTotal).toBe(1)
    expect(d.business.paidOrders).toBe(2)
    expect(d.business.revenueYuan).toBe(78)
    expect(Array.isArray(d.charts.paipanTrend)).toBe(true)
    expect(d.charts.paipanTrend.length).toBe(7)   // 7 天含 0 值补全
    expect(d.charts.registerTrend.length).toBe(7)
  })

  it('GET /analytics/series → 返回指定事件趋势', async () => {
    const res = await app.request('/api/v1/admin/analytics/series?event=paipan&days=3', { headers: adminHeaders })
    const body = await res.json() as any
    expect(body.data.points.length).toBe(3)
    expect(body.data.event).toBe('paipan')
  })

  it('GET /analytics/series → 非法事件 400', async () => {
    const res = await app.request('/api/v1/admin/analytics/series?event=hack', { headers: adminHeaders })
    expect(res.status).toBe(400)
  })

  it('GET /analytics/events → 最近事件流水', async () => {
    const res = await app.request('/api/v1/admin/analytics/events?limit=5', { headers: adminHeaders })
    const body = await res.json() as any
    expect(body.data.length).toBeLessThanOrEqual(5)
    // 事件流水含支付埋点（下单/支付均会埋点）
    expect(body.data.some((e: any) => ['order_pay', 'order_create'].includes(e.event))).toBe(true)
  })
})
