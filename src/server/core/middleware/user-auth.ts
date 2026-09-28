// ============================================================
// Phase 4b M-6 — C 端用户 JWT 认证中间件
// 文件：src/server/core/middleware/user-auth.ts
// 与 admin 的 auth.ts 完全隔离：不同密钥、不同会话表
// ============================================================

import type { Context, Next } from 'hono'
import jwt from 'jsonwebtoken'

const USER_JWT_SECRET = process.env.USER_JWT_SECRET || 'mingli-user-secret-change-me'
const USER_TOKEN_EXPIRY = '7d'

/** 注入到 Context 的当前登录用户 */
export interface CurrentUser {
  userId: number
  username: string
  jti: string
  exp: number
}

/** C 端路由 Env */
export type UserEnv = { Variables: { currentUser?: CurrentUser } }

// ═══════════════════════════════════════
// 令牌签发 / 校验
// ═══════════════════════════════════════

export function signUserToken(
  userId: number,
  username: string,
): { token: string; jti: string; expiresAt: string } {
  const jti = `ujti_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
  const expiresAt = new Date(Date.now() + 7 * 86_400_000).toISOString()

  const token = jwt.sign(
    { userId, username, role: 'user' },
    USER_JWT_SECRET,
    { expiresIn: USER_TOKEN_EXPIRY, jwtid: jti },
  )

  return { token, jti, expiresAt }
}

/** 解析 token，失败返回 null（不抛错） */
export function verifyUserToken(token: string): CurrentUser | null {
  try {
    return jwt.verify(token, USER_JWT_SECRET) as CurrentUser
  } catch {
    return null
  }
}

/** 从请求头提取 Bearer token */
export function extractBearerToken(c: Context): string | null {
  const header = c.req.header('Authorization')
  if (!header?.startsWith('Bearer ')) return null
  return header.slice(7)
}

// ═══════════════════════════════════════
// 中间件
// ═══════════════════════════════════════

/** 必须登录：未登录 / 令牌失效 / 会话已下线 → 401 */
export const userAuthMiddleware = async (c: Context<UserEnv>, next: Next) => {
  const token = extractBearerToken(c)
  if (!token) {
    return c.json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: '请先登录' },
    }, 401)
  }

  const payload = verifyUserToken(token)
  if (!payload) {
    return c.json({
      success: false,
      error: { code: 'TOKEN_INVALID', message: '登录状态已失效，请重新登录' },
    }, 401)
  }

  // 会话是否被踢下线（登出 / 管理员强制下线）
  const { getActiveUserSession } = await import('../../db')
  const session = getActiveUserSession(payload.jti)
  if (!session) {
    return c.json({
      success: false,
      error: { code: 'SESSION_TERMINATED', message: '登录状态已终止，请重新登录' },
    }, 401)
  }

  c.set('currentUser', payload)
  await next()
}

/** 可选登录：有 token 且有效则注入 currentUser，否则放行（埋点/公开接口用） */
export const optionalUserAuth = async (c: Context<UserEnv>, next: Next) => {
  const token = extractBearerToken(c)
  if (token) {
    const payload = verifyUserToken(token)
    if (payload) {
      const { getActiveUserSession } = await import('../../db')
      if (getActiveUserSession(payload.jti)) {
        c.set('currentUser', payload)
      }
    }
  }
  await next()
}

export { USER_JWT_SECRET, USER_TOKEN_EXPIRY }
