// ============================================================
// Phase 4b M-6 — C 端用户 Repository
// 文件：src/server/db/repositories/users.ts
// 职责：用户 CRUD / 状态与配额 / 登录会话管理
// ============================================================

import { getDb, schema } from '../index'
import { eq, and, desc, sql, like, or, gte } from 'drizzle-orm'

const { users, userSessions } = schema

export type UserRow = typeof users.$inferSelect
export type UserSessionRow = typeof userSessions.$inferSelect

// ═══════════════════════════════════════
// 查询
// ═══════════════════════════════════════

export function getUserById(id: number): UserRow | undefined {
  return getDb().select().from(users).where(eq(users.id, id)).get()
}

export function getUserByUsername(username: string): UserRow | undefined {
  return getDb().select().from(users).where(eq(users.username, username)).get()
}

export function getUserByPhone(phone: string): UserRow | undefined {
  return getDb().select().from(users).where(eq(users.phone, phone)).get()
}

export function getUserByEmail(email: string): UserRow | undefined {
  return getDb().select().from(users).where(eq(users.email, email)).get()
}

/**
 * 按「用户名 / 手机号 / 邮箱」任一命中查询（登录用）
 */
export function getUserByAccount(account: string): UserRow | undefined {
  return getDb().select().from(users)
    .where(
      or(
        eq(users.username, account),
        eq(users.phone, account),
        eq(users.email, account),
      ),
    )
    .get()
}

export interface ListUsersParams {
  keyword?: string
  status?: string
  vipLevel?: string
  page?: number
  pageSize?: number
}

export interface ListUsersResult {
  items: UserRow[]
  total: number
  page: number
  pageSize: number
}

export function listUsers(params: ListUsersParams = {}): ListUsersResult {
  const page = Math.max(1, params.page ?? 1)
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20))

  const conditions = []
  if (params.keyword) {
    const kw = `%${params.keyword}%`
    conditions.push(
      or(
        like(users.username, kw),
        like(users.nickname, kw),
        like(users.phone, kw),
        like(users.email, kw),
      ),
    )
  }
  if (params.status) conditions.push(eq(users.status, params.status))
  if (params.vipLevel) conditions.push(eq(users.vipLevel, params.vipLevel))

  const where = conditions.length > 0 ? and(...conditions) : undefined

  const items = getDb().select().from(users)
    .where(where)
    .orderBy(desc(users.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize)
    .all()

  const total = getDb().select({ count: sql<number>`count(*)` })
    .from(users)
    .where(where)
    .get()?.count ?? 0

  return { items, total, page, pageSize }
}

export function countUsers(): number {
  return getDb().select({ count: sql<number>`count(*)` })
    .from(users)
    .get()?.count ?? 0
}

/** 统计自指定日期（ISO）起的新增用户数 */
export function countUsersSince(sinceIso: string): number {
  return getDb().select({ count: sql<number>`count(*)` })
    .from(users)
    .where(gte(users.createdAt, sinceIso))
    .get()?.count ?? 0
}

// ═══════════════════════════════════════
// 写入
// ═══════════════════════════════════════

export interface CreateUserInput {
  username: string
  passwordHash: string
  phone?: string | null
  email?: string | null
  nickname?: string | null
  avatarUrl?: string | null
  registerIp?: string | null
  quotaTotal?: number
}

export function createUser(input: CreateUserInput): UserRow {
  return getDb().insert(users).values({
    username: input.username,
    passwordHash: input.passwordHash,
    phone: input.phone ?? null,
    email: input.email ?? null,
    nickname: input.nickname ?? input.username,
    avatarUrl: input.avatarUrl ?? null,
    registerIp: input.registerIp ?? null,
    quotaTotal: input.quotaTotal ?? 5,
    quotaUsed: 0,
    status: 'active',
    role: 'user',
    vipLevel: 'free',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }).returning().get()
}

export function updateUser(id: number, patch: Partial<{
  nickname: string
  avatarUrl: string
  phone: string
  email: string
  status: string
  role: string
  vipLevel: string
  vipExpiresAt: string | null
  quotaTotal: number
  quotaUsed: number
  passwordHash: string
  lastLoginAt: string
  lastLoginIp: string
}>): UserRow | undefined {
  return getDb().update(users)
    .set({ ...patch, updatedAt: new Date().toISOString() })
    .where(eq(users.id, id))
    .returning()
    .get()
}

export function deleteUser(id: number): boolean {
  const res = getDb().delete(users).where(eq(users.id, id)).run()
  return res.changes > 0
}

// ═══════════════════════════════════════
// 配额
// ═══════════════════════════════════════

/**
 * 原子扣减 1 次额度
 * 使用 SQL 条件更新避免并发超卖：quota_used < quota_total 才扣减
 * @returns 是否扣减成功（false = 额度不足或用户不存在/已禁用）
 */
export function consumeQuota(userId: number): boolean {
  const res = getDb().update(users)
    .set({
      quotaUsed: sql`${users.quotaUsed} + 1`,
      updatedAt: new Date().toISOString(),
    })
    .where(
      and(
        eq(users.id, userId),
        eq(users.status, 'active'),
        sql`${users.quotaUsed} < ${users.quotaTotal}`,
      ),
    )
    .run()
  return res.changes > 0
}

/** 追加额度（订阅发放 / 管理员赠送），amount 可为负 */
export function grantQuota(userId: number, amount: number): UserRow | undefined {
  return getDb().update(users)
    .set({
      quotaTotal: sql`max(0, ${users.quotaTotal} + ${amount})`,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(users.id, userId))
    .returning()
    .get()
}

/** 返回剩余额度（禁用用户返回 0） */
export function getRemainingQuota(userId: number): number {
  const u = getUserById(userId)
  if (!u || u.status !== 'active') return 0
  return Math.max(0, u.quotaTotal - u.quotaUsed)
}

// ═══════════════════════════════════════
// C 端登录会话
// ═══════════════════════════════════════

export function createUserSession(params: {
  userId: number
  tokenJti: string
  ip?: string | null
  userAgent?: string | null
  expiresAt: string
}): UserSessionRow {
  return getDb().insert(userSessions).values({
    userId: params.userId,
    tokenJti: params.tokenJti,
    ip: params.ip ?? null,
    userAgent: params.userAgent ?? null,
    expiresAt: params.expiresAt,
    isActive: 1,
    createdAt: new Date().toISOString(),
  }).returning().get()
}

export function getActiveUserSession(jti: string): UserSessionRow | undefined {
  return getDb().select().from(userSessions)
    .where(and(eq(userSessions.tokenJti, jti), eq(userSessions.isActive, 1)))
    .get()
}

export function invalidateUserSession(jti: string): boolean {
  const res = getDb().update(userSessions)
    .set({ isActive: 0, logoutAt: new Date().toISOString() })
    .where(eq(userSessions.tokenJti, jti))
    .run()
  return res.changes > 0
}

export function invalidateAllUserSessions(userId: number): number {
  const res = getDb().update(userSessions)
    .set({ isActive: 0, logoutAt: new Date().toISOString() })
    .where(and(eq(userSessions.userId, userId), eq(userSessions.isActive, 1)))
    .run()
  return res.changes
}

export function listUserSessions(userId: number): UserSessionRow[] {
  return getDb().select().from(userSessions)
    .where(eq(userSessions.userId, userId))
    .orderBy(desc(userSessions.createdAt))
    .limit(20)
    .all()
}
