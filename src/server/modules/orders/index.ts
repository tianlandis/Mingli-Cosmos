// ============================================================
// Phase 4b M-7 — 管理后台：订单与套餐管理
// 文件：src/server/modules/orders/index.ts
// 路由：/api/v1/admin/orders/*
//   GET    /              订单列表（分页 + 状态 + 关键词）
//   GET    /stats         订单统计（收入 / 各状态数）
//   GET    /plans         套餐列表（含下架）
//   POST   /plans         新建套餐
//   PUT    /plans/:id     修改套餐
//   DELETE /plans/:id     删除套餐
//   GET    /:id           订单详情
//   POST   /:id/confirm   后台确认收款（离线转账场景）
//   POST   /:id/refund    退款并回收权益
//   POST   /maintenance   清理超时订单 + 过期订阅
// ============================================================

import { Hono } from 'hono'
import { z } from 'zod'
import { authMiddleware } from '../../core/middleware/auth'
import { logAudit, type AdminEnv } from '../../core/middleware/audit'
import {
  listOrders,
  getOrderById,
  updateOrderStatus,
  countOrdersByStatus,
  sumPaidAmountCents,
  expirePendingOrders,
  listPlans,
  getPlanById,
  createPlan,
  updatePlan,
  deletePlan,
  getActiveSubscription,
  grantQuota,
  updateUser,
  getUserById,
  expireStaleSubscriptions,
  countActiveSubscriptions,
} from '../../db'
import { settleOrderPaid } from '../../services/order-settlement'
import { eq } from 'drizzle-orm'
import { getDb, schema } from '../../db'

const { subscriptions } = schema

export const route = new Hono<AdminEnv>()
route.use('*', authMiddleware)

// ═══════════════════════════════════════
// Zod 校验
// ═══════════════════════════════════════

const planSchema = z.object({
  code: z.string().min(2, '套餐编码至少 2 个字符').max(32)
    .regex(/^[a-z0-9_-]+$/, '编码仅支持小写字母、数字、下划线和连字符'),
  name: z.string().min(1, '套餐名称不能为空').max(64),
  priceCents: z.number().int().min(0, '价格不能为负'),
  durationDays: z.number().int().positive('订阅时长必须大于 0'),
  quotaGrant: z.number().int().min(0).max(100000).default(0),
  vipLevel: z.enum(['free', 'basic', 'pro']).default('basic'),
  features: z.array(z.string().max(100)).max(20).default([]),
  description: z.string().max(500).optional(),
  sortOrder: z.number().int().min(0).default(0),
  isActive: z.number().int().min(0).max(1).default(1),
})

const planPatchSchema = planSchema.partial()

const confirmSchema = z.object({
  payMethod: z.string().max(20).default('offline'),
  tradeNo: z.string().max(64).optional(),
  remark: z.string().max(200).optional(),
})

const refundSchema = z.object({
  reason: z.string().max(200).optional(),
})

// ═══════════════════════════════════════
// GET / — 订单列表
// ═══════════════════════════════════════

route.get('/', (c) => {
  const status = c.req.query('status') || undefined
  const keyword = c.req.query('keyword') || undefined
  const userId = c.req.query('userId') ? Number(c.req.query('userId')) : undefined
  const page = Number(c.req.query('page') || 1)
  const pageSize = Number(c.req.query('pageSize') || 20)

  const res = listOrders({
    status,
    keyword,
    userId: Number.isInteger(userId) && (userId as number) > 0 ? userId : undefined,
    page,
    pageSize,
  })

  return c.json({
    success: true,
    data: {
      items: res.items.map(o => ({
        ...o,
        amountYuan: Math.round(o.amountCents / 100 * 100) / 100,
      })),
      total: res.total,
      page: res.page,
      pageSize: res.pageSize,
    },
  })
})

// ═══════════════════════════════════════
// GET /stats — 订单统计
// ═══════════════════════════════════════

route.get('/stats', (c) => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayIso = today.toISOString()

  const paidCents = sumPaidAmountCents()
  const todayCents = sumPaidAmountCents(todayIso)

  return c.json({
    success: true,
    data: {
      total: countOrdersByStatus('pending') + countOrdersByStatus('paid') +
             countOrdersByStatus('cancelled') + countOrdersByStatus('refunded'),
      pending: countOrdersByStatus('pending'),
      paid: countOrdersByStatus('paid'),
      cancelled: countOrdersByStatus('cancelled'),
      refunded: countOrdersByStatus('refunded'),
      revenueCents: paidCents,
      revenueYuan: Math.round(paidCents / 100 * 100) / 100,
      revenueTodayCents: todayCents,
      revenueTodayYuan: Math.round(todayCents / 100 * 100) / 100,
      activeSubscriptions: countActiveSubscriptions(),
    },
  })
})

// ═══════════════════════════════════════
// 套餐管理（必须注册在 /:id 之前）
// ═══════════════════════════════════════

route.get('/plans', (c) => {
  const plans = listPlans(true).map(p => {
    let features: string[] = []
    try { features = JSON.parse(p.features || '[]') } catch { features = [] }
    return { ...p, features, priceYuan: Math.round(p.priceCents / 100 * 100) / 100 }
  })
  return c.json({ success: true, data: plans })
})

route.post('/plans', async (c) => {
  let body: unknown
  try { body = await c.req.json() } catch {
    return c.json({ success: false, error: { code: 'BAD_REQUEST', message: '请求体格式错误' } }, 400)
  }

  const parsed = planSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message || '参数错误' },
    }, 400)
  }

  const existing = listPlans(true).find(p => p.code === parsed.data.code)
  if (existing) {
    return c.json({ success: false, error: { code: 'CONFLICT', message: '套餐编码已存在' } }, 409)
  }

  const plan = createPlan(parsed.data)
  logAudit(c, {
    action: 'create',
    resource: 'plan',
    resourceId: plan.id,
    detail: `新建套餐 ${plan.code} (${plan.name}) ¥${plan.priceCents / 100} / ${plan.durationDays}天`,
  })

  return c.json({ success: true, data: plan }, 201)
})

route.put('/plans/:id', async (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id) || id <= 0) {
    return c.json({ success: false, error: { code: 'VALIDATION_ERROR', message: '套餐 ID 无效' } }, 400)
  }

  let body: unknown
  try { body = await c.req.json() } catch {
    return c.json({ success: false, error: { code: 'BAD_REQUEST', message: '请求体格式错误' } }, 400)
  }

  const parsed = planPatchSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message || '参数错误' },
    }, 400)
  }

  if (!getPlanById(id)) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: '套餐不存在' } }, 404)
  }

  const updated = updatePlan(id, parsed.data)
  logAudit(c, {
    action: 'update',
    resource: 'plan',
    resourceId: id,
    detail: `修改套餐 #${id}: ${JSON.stringify(parsed.data)}`,
  })

  return c.json({ success: true, data: updated })
})

route.delete('/plans/:id', (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id) || id <= 0) {
    return c.json({ success: false, error: { code: 'VALIDATION_ERROR', message: '套餐 ID 无效' } }, 400)
  }

  const plan = getPlanById(id)
  if (!plan) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: '套餐不存在' } }, 404)
  }

  const ok = deletePlan(id)
  logAudit(c, {
    action: 'delete',
    resource: 'plan',
    resourceId: id,
    detail: `删除套餐 ${plan.code} (${plan.name})`,
  })

  return c.json({ success: ok, data: { deleted: ok } })
})

// ═══════════════════════════════════════
// GET /:id — 订单详情
// ═══════════════════════════════════════

route.get('/:id', (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id) || id <= 0) {
    return c.json({ success: false, error: { code: 'VALIDATION_ERROR', message: '订单 ID 无效' } }, 400)
  }

  const order = getOrderById(id)
  if (!order) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: '订单不存在' } }, 404)
  }

  const user = getUserById(order.userId)
  return c.json({
    success: true,
    data: {
      ...order,
      amountYuan: Math.round(order.amountCents / 100 * 100) / 100,
      username: user?.username ?? null,
    },
  })
})

// ═══════════════════════════════════════
// POST /:id/confirm — 后台确认收款
// ═══════════════════════════════════════

route.post('/:id/confirm', async (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id) || id <= 0) {
    return c.json({ success: false, error: { code: 'VALIDATION_ERROR', message: '订单 ID 无效' } }, 400)
  }

  let body: unknown = {}
  try { body = await c.req.json() } catch { /* 允许空 body */ }
  const parsed = confirmSchema.safeParse(body ?? {})

  const order = getOrderById(id)
  if (!order) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: '订单不存在' } }, 404)
  }
  if (order.status === 'paid') {
    return c.json({ success: false, error: { code: 'CONFLICT', message: '订单已支付' } }, 409)
  }
  if (order.status !== 'pending') {
    return c.json({ success: false, error: { code: 'CONFLICT', message: `订单状态为 ${order.status}，无法确认` } }, 409)
  }

  // [P5-5] 走统一结算入口（幂等）；后台人工确认允许结算已超时订单
  const outcome = settleOrderPaid({
    orderId: id,
    tradeNo: (parsed.success ? parsed.data.tradeNo : undefined) ?? `ADMIN-${Date.now()}`,
    channel: parsed.success ? parsed.data.payMethod : 'offline',
    allowExpired: true,
  })
  if (!outcome.ok) {
    return c.json({ success: false, error: { code: 'CONFLICT', message: outcome.message } }, 409)
  }
  const paid = outcome.order
  const subscription = outcome.subscription

  logAudit(c, {
    action: 'update',
    resource: 'order',
    resourceId: id,
    detail: `后台确认收款：订单 ${order.orderNo} ¥${order.amountCents / 100}` +
            (parsed.success && parsed.data.remark ? `，备注：${parsed.data.remark}` : '') +
            (subscription ? `，订阅生效至 ${subscription.endsAt}` : ''),
  })

  return c.json({ success: true, data: { order: paid, subscription } })
})

// ═══════════════════════════════════════
// POST /:id/refund — 退款（回收订阅与额度）
// ═══════════════════════════════════════

route.post('/:id/refund', async (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id) || id <= 0) {
    return c.json({ success: false, error: { code: 'VALIDATION_ERROR', message: '订单 ID 无效' } }, 400)
  }

  let body: unknown = {}
  try { body = await c.req.json() } catch { /* 允许空 body */ }
  const parsed = refundSchema.safeParse(body ?? {})

  const order = getOrderById(id)
  if (!order) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: '订单不存在' } }, 404)
  }
  if (order.status !== 'paid') {
    return c.json({ success: false, error: { code: 'CONFLICT', message: '仅已支付订单可退款' } }, 409)
  }

  const refunded = updateOrderStatus(id, {
    status: 'refunded',
    refundedAt: new Date().toISOString(),
    remark: parsed.success ? parsed.data.reason ?? undefined : undefined,
  })

  // 回收权益：撤销该订单关联的订阅 + 扣回赠送额度
  const related = getDb().select().from(subscriptions)
    .where(eq(subscriptions.orderId, id))
    .all()

  let quotaRevoked = 0
  for (const sub of related) {
    getDb().update(subscriptions)
      .set({ status: 'cancelled' })
      .where(eq(subscriptions.id, sub.id))
      .run()
    if (sub.quotaGranted > 0) {
      grantQuota(sub.userId, -sub.quotaGranted)
      quotaRevoked += sub.quotaGranted
    }
  }

  // 若无其它有效订阅 → 降级为 free
  const stillActive = getActiveSubscription(order.userId)
  if (!stillActive) {
    updateUser(order.userId, { vipLevel: 'free', vipExpiresAt: null })
  }

  logAudit(c, {
    action: 'update',
    resource: 'order',
    resourceId: id,
    detail: `退款：订单 ${order.orderNo} ¥${order.amountCents / 100}` +
            `，撤销订阅 ${related.length} 条，回收额度 ${quotaRevoked}` +
            (parsed.success && parsed.data.reason ? `，原因：${parsed.data.reason}` : ''),
  })

  return c.json({
    success: true,
    data: { order: refunded, revokedSubscriptions: related.length, quotaRevoked },
  })
})

// ═══════════════════════════════════════
// POST /maintenance — 清理超时订单 + 过期订阅
// ═══════════════════════════════════════

route.post('/maintenance', (c) => {
  const expiredOrders = expirePendingOrders()
  const expiredSubs = expireStaleSubscriptions()

  logAudit(c, {
    action: 'update',
    resource: 'order',
    detail: `执行维护：关闭超时订单 ${expiredOrders} 笔，标记过期订阅 ${expiredSubs} 条`,
  })

  return c.json({
    success: true,
    data: { expiredOrders, expiredSubscriptions: expiredSubs },
  })
})

export default route
