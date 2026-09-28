// ============================================================
// [ADR-013] 推介奖励 Repository（增长域）
// 文件：src/server/db/repositories/referrals.ts
//
// 设计要点：
//   - 邀请码 **无存储、可逆编码**：由 userId 经仿射变换生成，避免为发码加列/加表；
//   - 绑定关系一次一行，双唯一约束防重复归因（referee 唯一 + (referrer,referee) 唯一）；
//   - 奖励发放以 growth_referral_rewards.idempotency_key 唯一约束**幂等**，
//     与 quota_ledger 同一范式（同一 key 二次调用直接返回首次结果）；
//   - 加额度走 users.quota_total 增量（与 grantQuota 同口径），
//     **不写 quota_ledger** —— 后者是消费台账，须保持 sumLedgerDelta 不变量。
// ============================================================

import { getDb, schema, getConfig, isDbReady } from '../index'
import { eq, desc, sql } from 'drizzle-orm'

const { growthReferrals, growthReferralRewards, users } = schema

export type GrowthReferralRow = typeof growthReferrals.$inferSelect
export type GrowthReferralRewardRow = typeof growthReferralRewards.$inferSelect

/** 奖励额度默认值（次）；可由后台配置 referral_reward_quota 覆盖 */
export const DEFAULT_REFERRAL_REWARD_QUOTA = 10

// ── 邀请码：可逆编码（不落库）──
// userId=1 → n = 7919+104729 = 112648 → base36。解码为其逆运算。
const CODE_SALT = 104729
const CODE_MULT = 7919
const CODE_RE = /^[0-9A-Z]+$/

/** 由 userId 生成邀请码（确定性、可逆、非连续，降低枚举价值） */
export function encodeReferralCode(userId: number): string {
  return (userId * CODE_MULT + CODE_SALT).toString(36).toUpperCase()
}

/** 由邀请码还原 userId；非法返回 null */
export function decodeReferralCode(code: string): number | null {
  const c = (code ?? '').trim().toUpperCase()
  if (!CODE_RE.test(c)) return null
  const n = Number.parseInt(c, 36)
  if (!Number.isFinite(n)) return null
  const v = (n - CODE_SALT) / CODE_MULT
  if (!Number.isInteger(v) || v <= 0) return null
  return v
}

/** 读取推介奖励额度（DB 配置 > 默认值） */
export function getReferralRewardQuota(): number {
  try {
    if (isDbReady()) {
      const raw = getConfig('referral_reward_quota')?.value
      const n = raw ? Number.parseInt(raw, 10) : Number.NaN
      if (Number.isFinite(n) && n >= 0) return n
    }
  } catch { /* ignore → 默认值 */ }
  return DEFAULT_REFERRAL_REWARD_QUOTA
}

// ── 查询 ──

export function getReferralById(id: number): GrowthReferralRow | undefined {
  return getDb().select().from(growthReferrals).where(eq(growthReferrals.id, id)).get()
}

export function getReferralByReferee(refereeUserId: number): GrowthReferralRow | undefined {
  return getDb().select().from(growthReferrals)
    .where(eq(growthReferrals.refereeUserId, refereeUserId))
    .get()
}

export function listReferralsByReferrer(referrerUserId: number, limit = 200): GrowthReferralRow[] {
  return getDb().select().from(growthReferrals)
    .where(eq(growthReferrals.referrerUserId, referrerUserId))
    .orderBy(desc(growthReferrals.id))
    .limit(limit)
    .all()
}

export interface ReferralStats {
  /** 已绑定（登记）的推介数 */
  invited: number
  /** 已达标（被推介人已付费） */
  qualified: number
  /** 已发放奖励 */
  rewarded: number
}

export function getReferralStats(referrerUserId: number): ReferralStats {
  const rows = listReferralsByReferrer(referrerUserId)
  return {
    invited: rows.length,
    qualified: rows.filter(r => r.status === 'qualified' || r.status === 'rewarded').length,
    rewarded: rows.filter(r => r.status === 'rewarded').length,
  }
}

// ── 绑定 ──

export type BindFailReason =
  | 'INVALID_CODE'
  | 'SELF_REFERRAL'
  | 'REFERRER_NOT_FOUND'
  | 'ALREADY_BOUND'

export interface BindResult {
  ok: boolean
  reason?: BindFailReason
  referral?: GrowthReferralRow
}

/**
 * 绑定推介关系（幂等：同一被推介人只会成功一次）
 * @param refereeUserId 新用户（被推介人）
 * @param code          邀请码
 */
export function bindReferralByCode(refereeUserId: number, code: string): BindResult {
  const referrerUserId = decodeReferralCode(code)
  if (referrerUserId === null) return { ok: false, reason: 'INVALID_CODE' }
  return bindReferral({ referrerUserId, refereeUserId, code: code.trim().toUpperCase() })
}

export function bindReferral(params: {
  referrerUserId: number
  refereeUserId: number
  code?: string
}): BindResult {
  const { referrerUserId, refereeUserId } = params
  // 自邀防护
  if (referrerUserId === refereeUserId) return { ok: false, reason: 'SELF_REFERRAL' }

  const db = getDb()
  return db.transaction((tx) => {
    // 已被绑定（一个被推介人只归属一个推介人）
    const existing = tx.select().from(growthReferrals)
      .where(eq(growthReferrals.refereeUserId, refereeUserId))
      .get()
    if (existing) return { ok: false, reason: 'ALREADY_BOUND' as BindFailReason }

    const referrer = tx.select({ id: users.id }).from(users)
      .where(eq(users.id, referrerUserId)).get()
    if (!referrer) return { ok: false, reason: 'REFERRER_NOT_FOUND' as BindFailReason }

    const nowIso = new Date().toISOString()
    const row = tx.insert(growthReferrals).values({
      referrerUserId,
      refereeUserId,
      code: params.code ?? encodeReferralCode(referrerUserId),
      status: 'pending',
      createdAt: nowIso,
    }).returning().get()

    return { ok: true, referral: row }
  })
}

// ── 达标与奖励 ──

/** 达标：被推介人首次付费（幂等） */
export function qualifyReferral(referralId: number): void {
  const nowIso = new Date().toISOString()
  getDb().update(growthReferrals)
    .set({ status: 'qualified', qualifiedAt: nowIso })
    .where(sql`${growthReferrals.id} = ${referralId} AND ${growthReferrals.status} = 'pending'`)
    .run()
}

/** 标记奖励已发放（幂等） */
export function markReferralRewarded(referralId: number): void {
  const nowIso = new Date().toISOString()
  getDb().update(growthReferrals)
    .set({ status: 'rewarded', rewardedAt: nowIso })
    .where(sql`${growthReferrals.id} = ${referralId} AND ${growthReferrals.status} <> 'void'`)
    .run()
}

export interface GrantResult {
  granted: boolean
  amount: number
  reason?: 'ALREADY_GRANTED' | 'ZERO_AMOUNT' | 'USER_NOT_FOUND'
}

/**
 * 发放推介奖励（幂等）—— 增加受益人 quota_total
 * 幂等键 = `referral:reward:{referralId}`，二次调用直接返回首次结果。
 */
export function grantReferralReward(params: {
  referralId: number
  userId: number
  amount: number
}): GrantResult {
  const key = `referral:reward:${params.referralId}`
  const db = getDb()
  return db.transaction((tx) => {
    const existing = tx.select().from(growthReferralRewards)
      .where(eq(growthReferralRewards.idempotencyKey, key))
      .get()
    if (existing) {
      return { granted: false, amount: existing.amount, reason: 'ALREADY_GRANTED' as const }
    }
    if (params.amount <= 0) {
      return { granted: false, amount: 0, reason: 'ZERO_AMOUNT' as const }
    }
    const receiver = tx.select({ id: users.id }).from(users)
      .where(eq(users.id, params.userId)).get()
    if (!receiver) {
      return { granted: false, amount: 0, reason: 'USER_NOT_FOUND' as const }
    }

    const nowIso = new Date().toISOString()
    // 加额度（与 grantQuota 同口径：仅增 quota_total，不写消费台账）
    tx.update(users)
      .set({ quotaTotal: sql`${users.quotaTotal} + ${params.amount}`, updatedAt: nowIso })
      .where(eq(users.id, params.userId))
      .run()
    tx.insert(growthReferralRewards).values({
      referralId: params.referralId,
      userId: params.userId,
      type: 'quota',
      amount: params.amount,
      status: 'granted',
      idempotencyKey: key,
      ledgerRef: null,
      grantedAt: nowIso,
      createdAt: nowIso,
    }).run()

    return { granted: true, amount: params.amount }
  })
}

/**
 * 编排：被推介人付费成功后触发（由 order-settlement 调用）
 * 幂等：重复调用只会命中一次发放；无推介关系时静默返回。
 */
export function onRefereePaid(refereeUserId: number): void {
  const ref = getReferralByReferee(refereeUserId)
  if (!ref) return
  if (ref.status === 'rewarded' || ref.status === 'void') return

  if (ref.status === 'pending') qualifyReferral(ref.id)

  const amount = getReferralRewardQuota()
  const res = grantReferralReward({ referralId: ref.id, userId: ref.referrerUserId, amount })
  if (res.granted) markReferralRewarded(ref.id)
}

/** 列出某用户收到的奖励发放记录（对账 / 展示） */
export function listRewardsByUser(userId: number, limit = 200): GrowthReferralRewardRow[] {
  return getDb().select().from(growthReferralRewards)
    .where(eq(growthReferralRewards.userId, userId))
    .orderBy(desc(growthReferralRewards.id))
    .limit(limit)
    .all()
}

/**
 * [P5-6 ADR-006] 删除权：清除与该用户相关的全部推介数据
 *   - 作为推介人 或 被推介人 的推介关系行；
 *   - 该用户收到的奖励；以及**这些推介关系衍生的奖励**（避免 referral_id 悬空）。
 * 注：被推介人注销时，推介人已得的奖励会一并清除 —— 关系既已作废，奖励失去依据。
 */
export function purgeReferralsForUser(userId: number): { referrals: number; rewards: number } {
  const db = getDb()
  return db.transaction((tx) => {
    const affected = tx.select({ id: growthReferrals.id }).from(growthReferrals)
      .where(sql`${growthReferrals.refereeUserId} = ${userId} OR ${growthReferrals.referrerUserId} = ${userId}`)
      .all()
      .map(r => r.id)

    // 该用户作为受益人收到的奖励
    let rewards = tx.delete(growthReferralRewards)
      .where(eq(growthReferralRewards.userId, userId))
      .run().changes
    // 上述推介关系衍生的奖励（含发给对方的）
    for (const id of affected) {
      rewards += tx.delete(growthReferralRewards)
        .where(eq(growthReferralRewards.referralId, id))
        .run().changes
    }

    const referrals = tx.delete(growthReferrals)
      .where(sql`${growthReferrals.refereeUserId} = ${userId} OR ${growthReferrals.referrerUserId} = ${userId}`)
      .run().changes

    return { referrals, rewards }
  })
}
