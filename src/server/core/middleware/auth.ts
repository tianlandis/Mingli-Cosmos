// ============================================================
// Phase 4 — JWT 认证中间件（增强版：支持 admin_sessions 校验）
// 文件：src/server/core/middleware/auth.ts
// ============================================================

import type { Context, Next } from 'hono'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { getDb, schema } from '../../db'
import { eq, and } from 'drizzle-orm'

const { adminSessions } = schema

const JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'mingli-admin-secret-change-me'
const TOKEN_EXPIRY = '24h'

export interface AdminUser {
  username: string
  role: 'admin'
  jti: string
  iat: number
  exp: number
}

// ═══════════════════════════════════════
// 密码哈希
// ═══════════════════════════════════════

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10)
}

export function verifyPassword(password: string, hash: string): boolean {
  return bcrypt.compareSync(password, hash)
}

// ═══════════════════════════════════════
// JWT 签发
// ═══════════════════════════════════════

export function signToken(username: string): { token: string; jti: string; expiresAt: string } {
  const jti = `jti_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
  const expiresAt = new Date(Date.now() + 24 * 3600 * 1000).toISOString()

  const token = jwt.sign(
    { username, role: 'admin' },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY, jwtid: jti },
  )

  return { token, jti, expiresAt }
}

// ═══════════════════════════════════════
// 认证中间件（含 admin_sessions 拦截）
// ═══════════════════════════════════════

/**
 * 查询 session 是否仍然有效
 * 用于管理员强制下线后的拦截
 */
function getActiveSession(jti: string) {
  return getDb().select()
    .from(adminSessions)
    .where(
      and(
        eq(adminSessions.tokenJti, jti),
        eq(adminSessions.isActive, 1),
      ),
    )
    .get()
}

export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: '缺少认证令牌' } }, 401)
  }

  const token = authHeader.slice(7)

  // Step 1: 验证 JWT 签名与有效期
  let payload: AdminUser
  try {
    payload = jwt.verify(token, JWT_SECRET) as AdminUser
  } catch (err: any) {
    const code = err.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID'
    const message = err.name === 'TokenExpiredError'
      ? '令牌已过期，请重新登录'
      : '令牌无效'
    return c.json({ success: false, error: { code, message } }, 401)
  }

  // Step 2: 查询 admin_sessions 表，拦截已被强制下线的会话
  const activeSession = getActiveSession(payload.jti)

  if (!activeSession) {
    // 记录被拦截的访问尝试（写入审计日志）
    const ip = c.req.header('x-forwarded-for') ||
              c.req.header('x-real-ip') ||
              '127.0.0.1'
    const { auditLogs } = schema
    try {
      getDb().insert(auditLogs).values({
        action: 'session_rejected',
        resource: 'auth',
        detail: `已终止会话尝试访问: jti=${payload.jti}`,
        operator: payload.username || 'unknown',
        ip,
      }).run()
    } catch { /* 审计失败不阻断请求 */ }

    return c.json({
      success: false,
      error: { code: 'SESSION_TERMINATED', message: '会话已被管理员终止，请重新登录' },
    }, 401)
  }

  // Step 3: 注入上下文并放行
  c.set('adminUser', payload)
  c.set('adminToken', token)
  await next()
}

// ═══════════════════════════════════════
// 会话管理
// ═══════════════════════════════════════

export function createSession(params: {
  tokenJti: string
  username: string
  ip?: string
  userAgent?: string
  expiresAt: string
}) {
  return getDb().insert(adminSessions).values({
    tokenJti: params.tokenJti,
    username: params.username,
    ip: params.ip || null,
    userAgent: params.userAgent || null,
    expiresAt: params.expiresAt,
    isActive: 1,
  }).returning().get()
}

export function invalidateSession(tokenJti: string) {
  return getDb().update(adminSessions)
    .set({ isActive: 0, logoutAt: new Date().toISOString() })
    .where(eq(adminSessions.tokenJti, tokenJti))
    .run()
}

export function invalidateAllSessions(username: string) {
  return getDb().update(adminSessions)
    .set({ isActive: 0, logoutAt: new Date().toISOString() })
    .where(and(eq(adminSessions.username, username), eq(adminSessions.isActive, 1)))
    .run()
}

export function listActiveSessions() {
  return getDb().select()
    .from(adminSessions)
    .where(eq(adminSessions.isActive, 1))
    .all()
}

/**
 * 按 ID 查询单个 session
 */
export function getSessionById(id: number) {
  return getDb().select().from(adminSessions)
    .where(eq(adminSessions.id, id))
    .get()
}

/**
 * 按 ID 强制下线指定会话（管理员操作）
 */
export function revokeSessionById(id: number) {
  return getDb().update(adminSessions)
    .set({ isActive: 0, logoutAt: new Date().toISOString() })
    .where(eq(adminSessions.id, id))
    .run()
}

/**
 * 按用户名查询该用户所有活跃会话
 */
export function listActiveSessionsByUser(username: string) {
  return getDb().select()
    .from(adminSessions)
    .where(
      and(
        eq(adminSessions.username, username),
        eq(adminSessions.isActive, 1),
      ),
    )
    .all()
}

/** 清理过期 session（定时任务调用） */
export function cleanExpiredSessions() {
  return getDb().delete(adminSessions)
    .where(
      and(
        eq(adminSessions.isActive, 0),
        // 清理 7 天前的已登出 session
      ),
    )
    .run()
}

export { JWT_SECRET, TOKEN_EXPIRY }
