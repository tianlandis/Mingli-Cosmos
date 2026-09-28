// ============================================================
// Phase 5 P5-4 — 额度幂等台账 Repository（ADR-004）
// 文件：src/server/db/repositories/quota.ts
// 职责：以 (idempotencyKey) 为唯一约束的**追加式**额度消费
//
// 语义（两阶段）：
//   reserve  → pending   （预留即扣减，防止并发超卖）
//   commit   → committed （AI 成功，落定）
//   refund   → refunded  （AI 失败，退回额度）
//
// 不变量：
//   - 同一 key 二次提交**直接返回首次结果**，绝不重复扣减；
//   - 余额与台账在同一事务内变更，二者恒等（balanceAfter = 变更后剩余）；
//   - refund 幂等（已 refunded 再调无副作用）。
// ============================================================

import { getDb, schema } from '../index'
import { eq, desc, sql } from 'drizzle-orm'

const { quotaLedger, users } = schema

export type QuotaLedgerRow = typeof quotaLedger.$inferSelect
export type QuotaLedgerStatus = 'pending' | 'committed' | 'refunded'

export type ReserveFailReason =
  | 'QUOTA_EXHAUSTED'
  | 'ACCOUNT_DISABLED'
  | 'USER_NOT_FOUND'
  | 'KEY_REFUNDED'

export interface ReserveResult {
  ok: boolean
  /** true = 命中已有台账（幂等复用），未发生新的扣减 */
  reused: boolean
  status: QuotaLedgerStatus | null
  /** 记账后剩余额度 */
  balanceAfter: number
  reason?: ReserveFailReason
}

export function getLedgerByKey(key: string): QuotaLedgerRow | undefined {
  return getDb().select().from(quotaLedger)
    .where(eq(quotaLedger.idempotencyKey, key))
    .get()
}

/**
 * 预留（消费）额度 —— 幂等
 * @param cost 正整数，默认 1
 */
export function reserveQuota(params: {
  userId: number
  idempotencyKey: string
  cost?: number
  reason?: string
  refKey?: string | null
}): ReserveResult {
  const cost = params.cost ?? 1
  if (cost <= 0) throw new Error('cost 必须为正整数')

  const db = getDb()
  return db.transaction((tx) => {
    // 1) 幂等命中 → 直接返回首次结果
    const existing = tx.select().from(quotaLedger)
      .where(eq(quotaLedger.idempotencyKey, params.idempotencyKey))
      .get()
    if (existing) {
      if (existing.status === 'refunded') {
        return {
          ok: false, reused: true, status: 'refunded' as QuotaLedgerStatus,
          balanceAfter: existing.balanceAfter, reason: 'KEY_REFUNDED' as ReserveFailReason,
        }
      }
      return {
        ok: true, reused: true,
        status: existing.status as QuotaLedgerStatus,
        balanceAfter: existing.balanceAfter,
      }
    }

    // 2) 校验用户与余额
    const user = tx.select().from(users).where(eq(users.id, params.userId)).get()
    if (!user) {
      return { ok: false, reused: false, status: null, balanceAfter: 0, reason: 'USER_NOT_FOUND' as ReserveFailReason }
    }
    if (user.status !== 'active') {
      return { ok: false, reused: false, status: null, balanceAfter: 0, reason: 'ACCOUNT_DISABLED' as ReserveFailReason }
    }
    const remaining = user.quotaTotal - user.quotaUsed
    if (remaining < cost) {
      return { ok: false, reused: false, status: null, balanceAfter: remaining, reason: 'QUOTA_EXHAUSTED' as ReserveFailReason }
    }

    // 3) 扣减 + 记账（同事务）
    const balanceAfter = remaining - cost
    const nowIso = new Date().toISOString()
    tx.update(users)
      .set({ quotaUsed: sql`${users.quotaUsed} + ${cost}`, updatedAt: nowIso })
      .where(eq(users.id, params.userId))
      .run()
    tx.insert(quotaLedger).values({
      idempotencyKey: params.idempotencyKey,
      userId: params.userId,
      delta: -cost,
      balanceAfter,
      reason: params.reason ?? 'chat',
      status: 'pending',
      refKey: params.refKey ?? null,
      createdAt: nowIso,
      updatedAt: nowIso,
    }).run()

    return { ok: true, reused: false, status: 'pending' as QuotaLedgerStatus, balanceAfter }
  })
}

/** 落定（AI 成功）—— 幂等 */
export function commitQuota(key: string): boolean {
  const res = getDb().update(quotaLedger)
    .set({ status: 'committed', updatedAt: new Date().toISOString() })
    .where(sql`${quotaLedger.idempotencyKey} = ${key} AND ${quotaLedger.status} = 'pending'`)
    .run()
  return res.changes > 0
}

/**
 * 退款（AI 失败 / 用户主动取消）—— 幂等
 * 仅对 pending / committed 生效，且**只退一次**。
 */
export function refundQuota(key: string): { refunded: boolean; amount: number } {
  const db = getDb()
  return db.transaction((tx) => {
    const row = tx.select().from(quotaLedger)
      .where(eq(quotaLedger.idempotencyKey, key))
      .get()
    if (!row || row.status === 'refunded') return { refunded: false, amount: 0 }
    const amount = Math.abs(row.delta)
    const nowIso = new Date().toISOString()
    tx.update(quotaLedger)
      .set({ status: 'refunded', balanceAfter: row.balanceAfter + amount, updatedAt: nowIso })
      .where(eq(quotaLedger.id, row.id))
      .run()
    tx.update(users)
      .set({ quotaUsed: sql`max(0, ${users.quotaUsed} - ${amount})`, updatedAt: nowIso })
      .where(eq(users.id, row.userId))
      .run()
    return { refunded: true, amount }
  })
}

/** 追加式台账查询（对账 / 导出） */
export function listLedgerByUser(userId: number, limit = 200): QuotaLedgerRow[] {
  return getDb().select().from(quotaLedger)
    .where(eq(quotaLedger.userId, userId))
    .orderBy(desc(quotaLedger.id))
    .limit(limit)
    .all()
}

/** 台账净额（应等于 quotaUsed 的相反数，用于一致性对账） */
export function sumLedgerDelta(userId: number): number {
  return getDb().select({ total: sql<number>`coalesce(sum(${quotaLedger.delta}), 0)` })
    .from(quotaLedger)
    .where(sql`${quotaLedger.userId} = ${userId} AND ${quotaLedger.status} <> 'refunded'`)
    .get()?.total ?? 0
}
