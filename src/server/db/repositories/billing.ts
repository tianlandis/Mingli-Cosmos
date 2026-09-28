// ============================================================
// Phase 4b M-7 — 订单与订阅 Repository
// 文件：src/server/db/repositories/billing.ts
// 职责：套餐 CRUD / 订单流转 / 订阅生命周期
// ============================================================

import { getDb, schema } from '../index'
import { eq, and, desc, sql, gte, lt } from 'drizzle-orm'

const { plans, orders, subscriptions, users } = schema

export type PlanRow = typeof plans.$inferSelect
export type OrderRow = typeof orders.$inferSelect
export type SubscriptionRow = typeof subscriptions.$inferSelect

// ═══════════════════════════════════════
// 套餐 plans
// ═══════════════════════════════════════

export function listPlans(includeInactive = false): PlanRow[] {
  const db = getDb()
  const query = db.select().from(plans)
    .orderBy(plans.sortOrder, plans.id)
  return includeInactive ? query.all() : query.where(eq(plans.isActive, 1)).all()
}

export function getPlanById(id: number): PlanRow | undefined {
  return getDb().select().from(plans).where(eq(plans.id, id)).get()
}

export function getPlanByCode(code: string): PlanRow | undefined {
  return getDb().select().from(plans).where(eq(plans.code, code)).get()
}

export interface CreatePlanInput {
  code: string
  name: string
  priceCents: number
  durationDays: number
  quotaGrant?: number
  vipLevel?: string
  features?: string[]
  description?: string
  sortOrder?: number
  isActive?: number
}

export function createPlan(input: CreatePlanInput): PlanRow {
  return getDb().insert(plans).values({
    code: input.code,
    name: input.name,
    priceCents: input.priceCents,
    durationDays: input.durationDays,
    quotaGrant: input.quotaGrant ?? 0,
    vipLevel: input.vipLevel ?? 'basic',
    features: JSON.stringify(input.features ?? []),
    description: input.description ?? null,
    sortOrder: input.sortOrder ?? 0,
    isActive: input.isActive ?? 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }).returning().get()
}

export function updatePlan(id: number, patch: Partial<CreatePlanInput>): PlanRow | undefined {
  const data: Record<string, unknown> = { updatedAt: new Date().toISOString() }
  if (patch.code !== undefined) data.code = patch.code
  if (patch.name !== undefined) data.name = patch.name
  if (patch.priceCents !== undefined) data.priceCents = patch.priceCents
  if (patch.durationDays !== undefined) data.durationDays = patch.durationDays
  if (patch.quotaGrant !== undefined) data.quotaGrant = patch.quotaGrant
  if (patch.vipLevel !== undefined) data.vipLevel = patch.vipLevel
  if (patch.features !== undefined) data.features = JSON.stringify(patch.features)
  if (patch.description !== undefined) data.description = patch.description
  if (patch.sortOrder !== undefined) data.sortOrder = patch.sortOrder
  if (patch.isActive !== undefined) data.isActive = patch.isActive

  return getDb().update(plans).set(data).where(eq(plans.id, id)).returning().get()
}

export function deletePlan(id: number): boolean {
  const res = getDb().delete(plans).where(eq(plans.id, id)).run()
  return res.changes > 0
}

// ═══════════════════════════════════════
// 订单 orders
// ═══════════════════════════════════════

/** 生成业务订单号：ML + yyyyMMddHHmmss + 4 位随机 */
export function generateOrderNo(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
                `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `ML${stamp}${rand}`
}

export interface CreateOrderInput {
  userId: number
  planId: number | null
  planName: string
  amountCents: number
  remark?: string | null
  expireMinutes?: number
}

export function createOrder(input: CreateOrderInput): OrderRow {
  const expireMinutes = input.expireMinutes ?? 30
  return getDb().insert(orders).values({
    orderNo: generateOrderNo(),
    userId: input.userId,
    planId: input.planId,
    planName: input.planName,
    amountCents: input.amountCents,
    status: 'pending',
    remark: input.remark ?? null,
    expiredAt: new Date(Date.now() + expireMinutes * 60_000).toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }).returning().get()
}

export function getOrderById(id: number): OrderRow | undefined {
  return getDb().select().from(orders).where(eq(orders.id, id)).get()
}

export function getOrderByNo(orderNo: string): OrderRow | undefined {
  return getDb().select().from(orders).where(eq(orders.orderNo, orderNo)).get()
}

export interface ListOrdersParams {
  userId?: number
  status?: string
  keyword?: string
  page?: number
  pageSize?: number
}

export interface ListOrdersResult {
  items: Array<OrderRow & { username: string | null }>
  total: number
  page: number
  pageSize: number
}

export function listOrders(params: ListOrdersParams = {}): ListOrdersResult {
  const page = Math.max(1, params.page ?? 1)
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20))

  const conditions = []
  if (params.userId) conditions.push(eq(orders.userId, params.userId))
  if (params.status) conditions.push(eq(orders.status, params.status))
  if (params.keyword) conditions.push(sql`(${orders.orderNo} LIKE ${'%' + params.keyword + '%'} OR ${orders.planName} LIKE ${'%' + params.keyword + '%'})`)
  const where = conditions.length > 0 ? and(...conditions) : undefined

  const items = getDb().select({
    id: orders.id,
    orderNo: orders.orderNo,
    userId: orders.userId,
    planId: orders.planId,
    planName: orders.planName,
    amountCents: orders.amountCents,
    status: orders.status,
    payMethod: orders.payMethod,
    tradeNo: orders.tradeNo,
    paidAt: orders.paidAt,
    refundedAt: orders.refundedAt,
    expiredAt: orders.expiredAt,
    remark: orders.remark,
    createdAt: orders.createdAt,
    updatedAt: orders.updatedAt,
    username: users.username,
  })
    .from(orders)
    .leftJoin(users, eq(orders.userId, users.id))
    .where(where)
    .orderBy(desc(orders.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize)
    .all()

  const total = getDb().select({ count: sql<number>`count(*)` })
    .from(orders)
    .where(where)
    .get()?.count ?? 0

  return { items, total, page, pageSize }
}

export function updateOrderStatus(id: number, patch: Partial<{
  status: string
  payMethod: string
  tradeNo: string
  paidAt: string
  refundedAt: string
  remark: string
}>): OrderRow | undefined {
  return getDb().update(orders)
    .set({ ...patch, updatedAt: new Date().toISOString() })
    .where(eq(orders.id, id))
    .returning()
    .get()
}

/** 已支付订单总金额（分） */
export function sumPaidAmountCents(sinceIso?: string): number {
  const where = sinceIso
    ? and(eq(orders.status, 'paid'), gte(orders.paidAt, sinceIso))
    : eq(orders.status, 'paid')
  return getDb().select({ total: sql<number>`coalesce(sum(${orders.amountCents}), 0)` })
    .from(orders)
    .where(where)
    .get()?.total ?? 0
}

export function countOrdersByStatus(status: string): number {
  return getDb().select({ count: sql<number>`count(*)` })
    .from(orders)
    .where(eq(orders.status, status))
    .get()?.count ?? 0
}

/** 关闭超时未支付订单（返回关闭数量） */
export function expirePendingOrders(): number {
  const res = getDb().update(orders)
    .set({ status: 'cancelled', updatedAt: new Date().toISOString() })
    .where(
      and(
        eq(orders.status, 'pending'),
        lt(orders.expiredAt, new Date().toISOString()),
      ),
    )
    .run()
  return res.changes
}

// ═══════════════════════════════════════
// 订阅 subscriptions
// ═══════════════════════════════════════

export function createSubscription(params: {
  userId: number
  planId: number | null
  orderId: number | null
  vipLevel: string
  startsAt: string
  endsAt: string
  quotaGranted: number
}): SubscriptionRow {
  return getDb().insert(subscriptions).values({
    userId: params.userId,
    planId: params.planId,
    orderId: params.orderId,
    vipLevel: params.vipLevel,
    startsAt: params.startsAt,
    endsAt: params.endsAt,
    quotaGranted: params.quotaGranted,
    status: 'active',
    createdAt: new Date().toISOString(),
  }).returning().get()
}

/** 查询用户当前有效订阅（未过期且 active） */
export function getActiveSubscription(userId: number): SubscriptionRow | undefined {
  const now = new Date().toISOString()
  return getDb().select().from(subscriptions)
    .where(
      and(
        eq(subscriptions.userId, userId),
        eq(subscriptions.status, 'active'),
        gte(subscriptions.endsAt, now),
      ),
    )
    .orderBy(desc(subscriptions.endsAt))
    .get()
}

export function listSubscriptions(userId: number): SubscriptionRow[] {
  return getDb().select().from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .orderBy(desc(subscriptions.createdAt))
    .all()
}

/** [P5-5 ADR-009] 某订单已发放的订阅（回调幂等时回读已结算结果） */
export function getSubscriptionByOrder(orderId: number): SubscriptionRow | undefined {
  return getDb().select().from(subscriptions)
    .where(eq(subscriptions.orderId, orderId))
    .orderBy(desc(subscriptions.id))
    .get()
}

export function countActiveSubscriptions(): number {
  const now = new Date().toISOString()
  return getDb().select({ count: sql<number>`count(*)` })
    .from(subscriptions)
    .where(and(eq(subscriptions.status, 'active'), gte(subscriptions.endsAt, now)))
    .get()?.count ?? 0
}

/**
 * 将已到期但状态仍为 active 的订阅标记为 expired
 * 返回被标记的数量
 */
export function expireStaleSubscriptions(): number {
  const now = new Date().toISOString()
  const res = getDb().update(subscriptions)
    .set({ status: 'expired' })
    .where(and(eq(subscriptions.status, 'active'), lt(subscriptions.endsAt, now)))
    .run()
  return res.changes
}
