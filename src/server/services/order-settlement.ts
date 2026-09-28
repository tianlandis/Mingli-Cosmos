// ============================================================
// Phase 5 P5-5 — 订单结算服务（ADR-009 支付回调幂等）
// 文件：src/server/services/order-settlement.ts
//
// 单一结算入口：mock 支付 / 后台确认收款 / 第三方回调 **共用同一函数**，
// 保证「同一订单只会发货一次」这一不变量只有一个实现点。
//
// 幂等语义：
//   - 订单已是 paid → 不发第二次货，回读已发放订阅（alreadySettled = true）
//   - 订单非 pending → CONFLICT（cancelled / refunded 不可再结算）
//   - 金额校验：回调携带的金额必须与订单一致，否则拒绝（防篡改）
// ============================================================

import {
  getOrderById,
  getOrderByNo,
  updateOrderStatus,
  getPlanById,
  createSubscription,
  getActiveSubscription,
  getSubscriptionByOrder,
  grantQuota,
  updateUser,
  // [ADR-013] 增长域：被推介人付费达标 → 发放推介奖励
  onRefereePaid,
  type OrderRow,
  type SubscriptionRow,
} from '../db'

export interface SettlementSubscription {
  id: number
  vipLevel: string
  startsAt: string
  endsAt: string
  quotaGranted: number
  status: string
}

export type SettleErrorCode =
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'ORDER_EXPIRED'
  | 'AMOUNT_MISMATCH'

export type SettleOutcome =
  | {
      ok: true
      order: OrderRow
      subscription: SettlementSubscription | null
      alreadySettled: boolean
      quotaGranted: number
    }
  | { ok: false; code: SettleErrorCode; message: string }

function toSubscriptionView(sub: SubscriptionRow): SettlementSubscription {
  return {
    id: sub.id,
    vipLevel: sub.vipLevel,
    startsAt: sub.startsAt,
    endsAt: sub.endsAt,
    quotaGranted: sub.quotaGranted,
    status: sub.status,
  }
}

/**
 * 激活 / 续期订阅（原 billing 模块内实现上移，保持唯一实现点）
 * - 已有有效订阅 → 在其到期时间上顺延
 * - 否则从当前时间起算
 */
export function activateSubscriptionForOrder(
  userId: number,
  plan: { id: number; vipLevel: string; durationDays: number; quotaGrant: number },
  orderId: number,
): SubscriptionRow {
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

/**
 * 幂等结算订单为「已支付」并发放权益
 */
export function settleOrderPaid(params: {
  orderId?: number
  orderNo?: string
  tradeNo?: string
  channel?: string
  /** 回调携带的实付金额（分）——提供时做一致性校验 */
  amountCents?: number
  /** 是否允许结算已超时订单（后台人工确认场景） */
  allowExpired?: boolean
}): SettleOutcome {
  const order = params.orderId
    ? getOrderById(params.orderId)
    : params.orderNo
      ? getOrderByNo(params.orderNo)
      : undefined

  if (!order) return { ok: false, code: 'NOT_FOUND', message: '订单不存在' }

  // 金额一致性（防篡改 / 防错发）
  if (typeof params.amountCents === 'number' && params.amountCents !== order.amountCents) {
    return {
      ok: false,
      code: 'AMOUNT_MISMATCH',
      message: `回调金额 ${params.amountCents} 与订单金额 ${order.amountCents} 不一致`,
    }
  }

  // 幂等：已支付 → 回读已发放订阅，不重复发货
  if (order.status === 'paid') {
    const sub = getSubscriptionByOrder(order.id)
    return {
      ok: true,
      order,
      subscription: sub ? toSubscriptionView(sub) : null,
      alreadySettled: true,
      quotaGranted: 0,
    }
  }

  if (order.status !== 'pending') {
    return {
      ok: false,
      code: 'CONFLICT',
      message: `订单状态为 ${order.status}，无法结算`,
    }
  }

  const nowIso = new Date().toISOString()
  if (!params.allowExpired && order.expiredAt && order.expiredAt < nowIso) {
    updateOrderStatus(order.id, { status: 'cancelled', remark: '超时未支付自动关闭' })
    return { ok: false, code: 'ORDER_EXPIRED', message: '订单已超时关闭，请重新下单' }
  }

  const paid = updateOrderStatus(order.id, {
    status: 'paid',
    payMethod: params.channel ?? 'mock',
    tradeNo: params.tradeNo ?? `MOCK-${Date.now()}`,
    paidAt: nowIso,
  }) ?? order

  let subscription: SettlementSubscription | null = null
  let quotaGranted = 0
  if (order.planId) {
    const plan = getPlanById(order.planId)
    if (plan) {
      const sub = activateSubscriptionForOrder(order.userId, plan, order.id)
      subscription = toSubscriptionView(sub)
      quotaGranted = plan.quotaGrant ?? 0
    }
  }

  // [ADR-013] 推介达标：被推介人付费成功 → 为推介人发放奖励
  //   幂等且**失败不影响结算**（推介是增长侧收益，不能污染支付主流程）
  try {
    onRefereePaid(order.userId)
  } catch (e) {
    console.error('[Referral] 达标处理异常（不影响结算）:', e)
  }

  return { ok: true, order: paid, subscription, alreadySettled: false, quotaGranted }
}
