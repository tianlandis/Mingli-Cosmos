// ============================================================
// Phase 4b M-7 — C 端订单与订阅 API（公开路由）
// 文件：src/server/modules-public/billing/index.ts
// 路由：/api/v1/app/billing/*
//   GET  /plans
//   POST /orders          下单
//   GET  /orders          我的订单
//   POST /orders/:id/pay  模拟支付（真实支付渠道接入前使用）
//   GET  /subscription    我的订阅
// ============================================================

import { Hono } from 'hono'
import { z } from 'zod'
import { userAuthMiddleware, type UserEnv } from '../../core/middleware/user-auth'
import {
  listPlans,
  getPlanById,
  createOrder,
  getOrderById,
  listOrders,
  updateOrderStatus,
  createSubscription,
  getActiveSubscription,
  listSubscriptions,
  grantQuota,
  updateUser,
  getUserById,
} from '../../db'
import { trackEvent } from '../../db'
import type { PlanRow } from '../../db'

export const route = new Hono<UserEnv>()

// ═══════════════════════════════════════
// Zod 校验
// ═══════════════════════════════════════

const createOrderSchema = z.object({
  planId: z.number().int().positive('套餐 ID 无效'),
  payMethod: z.string().max(20).optional(),
  remark: z.string().max(200).optional(),
})

const paySchema = z.object({
  payMethod: z.string().max(20).default('mock'),
  tradeNo: z.string().max(64).optional(),
})

// ═══════════════════════════════════════
// 工具
// ═══════════════════════════════════════

function clientIp(c: any): string {
  return c.req.header('x-forwarded-for')?.split(',')[0].trim()
    || c.req.header('x-real-ip')
    || '127.0.0.1'
}

/** 套餐对外展示结构（价格换算为元） */
function formatPlan(p: PlanRow) {
  let features: string[] = []
  try { features = JSON.parse(p.features || '[]') } catch { features = [] }
  return {
    id: p.id,
    code: p.code,
    name: p.name,
    priceCents: p.priceCents,
    priceYuan: Math.round(p.priceCents / 100 * 100) / 100,
    durationDays: p.durationDays,
    quotaGrant: p.quotaGrant,
    vipLevel: p.vipLevel,
    features,
    description: p.description,
  }
}

/**
 * 激活 / 续期订阅：
 * - 已有有效订阅 → 在原到期时间上顺延
 * - 无有效订阅或已过期 → 从当前时间起算
 * 同时发放套餐额度并提升会员等级
 */
function activateSubscription(userId: number, plan: PlanRow, orderId: number) {
  const nowIso = new Date().toISOString()
  const existing = getActiveSubscription(userId)
  const startsAt = existing && existing.endsAt > nowIso ? existing.endsAt : nowIso
  const endsAt = new Date(
    new Date(startsAt).getTime() + plan.durationDays * 86_400_000,
  ).toISOString()

  const sub = createSubscription({
    userId,
    planId: plan.id,
    orderId,
    vipLevel: plan.vipLevel || 'basic',
    startsAt,
    endsAt,
    quotaGranted: plan.quotaGrant ?? 0,
  })

  if (plan.quotaGrant > 0) grantQuota(userId, plan.quotaGrant)
  updateUser(userId, { vipLevel: plan.vipLevel || 'basic', vipExpiresAt: endsAt })

  return sub
}

// ═══════════════════════════════════════
// GET /plans — 套餐列表（公开）
// ═══════════════════════════════════════

route.get('/plans', (c) => {
  const plans = listPlans(false).map(formatPlan)
  return c.json({ success: true, data: plans })
})

// ═══════════════════════════════════════
// POST /orders — 下单
// ═══════════════════════════════════════

route.post('/orders', userAuthMiddleware, async (c) => {
  let body: unknown
  try { body = await c.req.json() } catch {
    return c.json({ success: false, error: { code: 'BAD_REQUEST', message: '请求体格式错误' } }, 400)
  }

  const parsed = createOrderSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message || '参数错误' },
    }, 400)
  }

  const current = c.get('currentUser')!
  const plan = getPlanById(parsed.data.planId)
  if (!plan || plan.isActive !== 1) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: '套餐不存在或已下架' } }, 404)
  }

  const user = getUserById(current.userId)
  if (!user || user.status !== 'active') {
    return c.json({ success: false, error: { code: 'ACCOUNT_DISABLED', message: '账号不可用' } }, 403)
  }

  const order = createOrder({
    userId: current.userId,
    planId: plan.id,
    planName: plan.name,
    amountCents: plan.priceCents,
    remark: parsed.data.remark ?? null,
  })

  trackEvent({
    event: 'order_create',
    userId: current.userId,
    payload: { orderNo: order.orderNo, planCode: plan.code, amountCents: order.amountCents },
    ip: clientIp(c),
  })

  return c.json({
    success: true,
    data: {
      id: order.id,
      orderNo: order.orderNo,
      planName: order.planName,
      amountCents: order.amountCents,
      amountYuan: Math.round(order.amountCents / 100 * 100) / 100,
      status: order.status,
      expiredAt: order.expiredAt,
      createdAt: order.createdAt,
    },
  }, 201)
})

// ═══════════════════════════════════════
// GET /orders — 我的订单
// ═══════════════════════════════════════

route.get('/orders', userAuthMiddleware, (c) => {
  const current = c.get('currentUser')!
  const page = Number(c.req.query('page') || 1)
  const pageSize = Number(c.req.query('pageSize') || 20)
  const status = c.req.query('status') || undefined

  const res = listOrders({ userId: current.userId, status, page, pageSize })
  return c.json({
    success: true,
    data: {
      items: res.items.map(o => ({
        id: o.id,
        orderNo: o.orderNo,
        planName: o.planName,
        amountCents: o.amountCents,
        amountYuan: Math.round(o.amountCents / 100 * 100) / 100,
        status: o.status,
        payMethod: o.payMethod,
        paidAt: o.paidAt,
        createdAt: o.createdAt,
      })),
      total: res.total,
      page: res.page,
      pageSize: res.pageSize,
    },
  })
})

// ═══════════════════════════════════════
// POST /orders/:id/pay — 模拟支付
// ⚠️ 真实支付渠道接入前使用；接入后应改为校验支付回调签名
// ═══════════════════════════════════════

route.post('/orders/:id/pay', userAuthMiddleware, async (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id) || id <= 0) {
    return c.json({ success: false, error: { code: 'VALIDATION_ERROR', message: '订单 ID 无效' } }, 400)
  }

  let body: unknown = {}
  try { body = await c.req.json() } catch { /* 允许空 body */ }
  const parsed = paySchema.safeParse(body ?? {})
  const payMethod = parsed.success ? parsed.data.payMethod : 'mock'
  const tradeNo = parsed.success ? parsed.data.tradeNo : undefined

  const current = c.get('currentUser')!
  const order = getOrderById(id)

  if (!order) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: '订单不存在' } }, 404)
  }
  if (order.userId !== current.userId) {
    return c.json({ success: false, error: { code: 'FORBIDDEN', message: '无权操作他人订单' } }, 403)
  }
  if (order.status === 'paid') {
    return c.json({ success: false, error: { code: 'CONFLICT', message: '订单已支付' } }, 409)
  }
  if (order.status !== 'pending') {
    return c.json({ success: false, error: { code: 'CONFLICT', message: `订单当前状态为 ${order.status}，无法支付` } }, 409)
  }
  if (order.expiredAt && order.expiredAt < new Date().toISOString()) {
    updateOrderStatus(id, { status: 'cancelled', remark: '超时未支付自动关闭' })
    return c.json({ success: false, error: { code: 'ORDER_EXPIRED', message: '订单已超时关闭，请重新下单' } }, 410)
  }

  const nowIso = new Date().toISOString()
  const paid = updateOrderStatus(id, {
    status: 'paid',
    payMethod,
    tradeNo: tradeNo ?? `MOCK-${Date.now()}`,
    paidAt: nowIso,
  })

  // 发放权益
  let subscription = null
  if (order.planId) {
    const plan = getPlanById(order.planId)
    if (plan) {
      const sub = activateSubscription(order.userId, plan, order.id)
      subscription = {
        vipLevel: sub.vipLevel,
        startsAt: sub.startsAt,
        endsAt: sub.endsAt,
        quotaGranted: sub.quotaGranted,
      }
    }
  }

  trackEvent({
    event: 'order_pay',
    userId: order.userId,
    payload: { orderNo: order.orderNo, amountCents: order.amountCents, payMethod },
    ip: clientIp(c),
  })

  const user = getUserById(order.userId)
  return c.json({
    success: true,
    data: {
      order: paid ? {
        id: paid.id,
        orderNo: paid.orderNo,
        status: paid.status,
        amountCents: paid.amountCents,
        paidAt: paid.paidAt,
      } : null,
      subscription,
      quotaRemaining: user ? Math.max(0, user.quotaTotal - user.quotaUsed) : 0,
    },
  })
})

// ═══════════════════════════════════════
// GET /subscription — 我的订阅
// ═══════════════════════════════════════

route.get('/subscription', userAuthMiddleware, (c) => {
  const current = c.get('currentUser')!
  const active = getActiveSubscription(current.userId)
  const history = listSubscriptions(current.userId)
  return c.json({
    success: true,
    data: {
      active: active
        ? { id: active.id, vipLevel: active.vipLevel, startsAt: active.startsAt, endsAt: active.endsAt, quotaGranted: active.quotaGranted }
        : null,
      history: history.map(s => ({
        id: s.id,
        vipLevel: s.vipLevel,
        startsAt: s.startsAt,
        endsAt: s.endsAt,
        status: s.status,
        createdAt: s.createdAt,
      })),
    },
  })
})

export default route
