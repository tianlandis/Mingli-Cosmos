// ============================================================
// Phase 4b M-6 — C 端用户 API（公开路由）
// 文件：src/server/modules-public/user/index.ts
// 路由：/api/v1/app/user/*
//   POST /register | /login | /logout
//   GET  /me | /quota
//   PUT  /profile
// ============================================================

import { Hono } from 'hono'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import {
  userAuthMiddleware,
  signUserToken,
  optionalUserAuth,
  type UserEnv,
} from '../../core/middleware/user-auth'
import { loginRateLimit, checkUserRate } from '../../core/middleware/rate-limit'
import {
  getUserById,
  getUserByAccount,
  getUserByUsername,
  getUserByPhone,
  getUserByEmail,
  createUser,
  updateUser,
  createUserSession,
  invalidateUserSession,
  getRemainingQuota,
  listUserSessions,
} from '../../db'
import { getActiveSubscription } from '../../db'
import { trackEvent, type UserRow } from '../../db'

export const route = new Hono<UserEnv>()

// ═══════════════════════════════════════
// Zod 校验
// ═══════════════════════════════════════

const usernameSchema = z.string()
  .min(3, '账号至少 3 个字符')
  .max(32, '账号最多 32 个字符')
  .regex(/^[a-zA-Z0-9_-]+$/, '账号仅支持字母、数字、下划线和连字符')

const registerSchema = z.object({
  username: usernameSchema,
  password: z.string().min(6, '密码至少 6 位').max(64, '密码最多 64 位'),
  nickname: z.string().max(32).optional(),
  phone: z.string().max(20).optional(),
  email: z.string().email('邮箱格式不正确').optional(),
})

const loginSchema = z.object({
  account: z.string().min(1, '请输入账号'),
  password: z.string().min(1, '请输入密码'),
})

const profileSchema = z.object({
  nickname: z.string().min(1).max(32).optional(),
  avatarUrl: z.string().max(500).optional(),
  phone: z.string().max(20).optional(),
  email: z.string().email('邮箱格式不正确').optional(),
})

// ═══════════════════════════════════════
// 工具
// ═══════════════════════════════════════

/** 脱敏：永不外泄 passwordHash */
function sanitize(u: UserRow) {
  return {
    id: u.id,
    username: u.username,
    nickname: u.nickname,
    avatarUrl: u.avatarUrl,
    phone: u.phone,
    email: u.email,
    status: u.status,
    vipLevel: u.vipLevel,
    vipExpiresAt: u.vipExpiresAt,
    quotaTotal: u.quotaTotal,
    quotaUsed: u.quotaUsed,
    quotaRemaining: Math.max(0, u.quotaTotal - u.quotaUsed),
    lastLoginAt: u.lastLoginAt,
    createdAt: u.createdAt,
  }
}

function clientIp(c: any): string {
  return c.req.header('x-forwarded-for')?.split(',')[0].trim()
    || c.req.header('x-real-ip')
    || '127.0.0.1'
}

/** 登录成功后统一：更新登录信息 + 建会话 + 埋点 */
function issueLogin(c: any, user: { id: number; username: string }) {
  const { token, jti, expiresAt } = signUserToken(user.id, user.username)
  const ip = clientIp(c)
  createUserSession({
    userId: user.id,
    tokenJti: jti,
    ip,
    userAgent: c.req.header('user-agent') || '',
    expiresAt,
  })
  updateUser(user.id, { lastLoginAt: new Date().toISOString(), lastLoginIp: ip })
  trackEvent({ event: 'login', userId: user.id, ip })
  return { token, expiresAt }
}

// ═══════════════════════════════════════
// POST /register
// ═══════════════════════════════════════

route.post('/register', async (c) => {
  let body: unknown
  try { body = await c.req.json() } catch {
    return c.json({ success: false, error: { code: 'BAD_REQUEST', message: '请求体格式错误' } }, 400)
  }

  const parsed = registerSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message || '参数错误' },
    }, 400)
  }

  const { username, password, nickname, phone, email } = parsed.data

  // 唯一性校验（用户名 / 手机 / 邮箱三者均不可重复）
  if (getUserByUsername(username)) {
    return c.json({ success: false, error: { code: 'CONFLICT', message: '该账号已被注册' } }, 409)
  }
  if (phone && getUserByPhone(phone)) {
    return c.json({ success: false, error: { code: 'CONFLICT', message: '该手机号已被注册' } }, 409)
  }
  if (email && getUserByEmail(email)) {
    return c.json({ success: false, error: { code: 'CONFLICT', message: '该邮箱已被注册' } }, 409)
  }

  const user = createUser({
    username,
    passwordHash: bcrypt.hashSync(password, 10),
    phone: phone ?? null,
    email: email ?? null,
    nickname: nickname ?? username,
    registerIp: clientIp(c),
  })

  trackEvent({ event: 'register', userId: user.id, ip: clientIp(c) })
  const session = issueLogin(c, user)

  return c.json({
    success: true,
    data: { token: session.token, expiresAt: session.expiresAt, user: sanitize(user) },
  }, 201)
})

// ═══════════════════════════════════════
// POST /login（含限流）
// ═══════════════════════════════════════

route.post('/login', loginRateLimit(), async (c) => {
  let body: unknown
  try { body = await c.req.json() } catch {
    return c.json({ success: false, error: { code: 'BAD_REQUEST', message: '请求体格式错误' } }, 400)
  }

  const parsed = loginSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message || '参数错误' },
    }, 400)
  }

  const { account, password } = parsed.data

  if (!checkUserRate(account)) {
    return c.json({
      success: false,
      error: { code: 'RATE_LIMITED', message: '登录尝试过于频繁，请 1 小时后重试' },
    }, 429)
  }

  const user = getUserByAccount(account)
  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: '账号或密码错误' } }, 401)
  }

  if (user.status !== 'active') {
    return c.json({ success: false, error: { code: 'ACCOUNT_DISABLED', message: '账号已被停用，请联系客服' } }, 403)
  }

  const session = issueLogin(c, user)
  return c.json({
    success: true,
    data: { token: session.token, expiresAt: session.expiresAt, user: sanitize(user) },
  })
})

// ═══════════════════════════════════════
// POST /logout
// ═══════════════════════════════════════

route.post('/logout', userAuthMiddleware, (c) => {
  const user = c.get('currentUser')
  if (user?.jti) invalidateUserSession(user.jti)
  return c.json({ success: true, data: { message: '已退出登录' } })
})

// ═══════════════════════════════════════
// GET /me
// ═══════════════════════════════════════

route.get('/me', userAuthMiddleware, (c) => {
  const current = c.get('currentUser')!
  const user = getUserById(current.userId)
  if (!user) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: '用户不存在' } }, 404)
  }
  const sub = getActiveSubscription(user.id)
  return c.json({
    success: true,
    data: {
      user: sanitize(user),
      quotaRemaining: getRemainingQuota(user.id),
      subscription: sub
        ? { vipLevel: sub.vipLevel, startsAt: sub.startsAt, endsAt: sub.endsAt, status: sub.status }
        : null,
    },
  })
})

// ═══════════════════════════════════════
// GET /quota — 轻量额度查询
// ═══════════════════════════════════════

route.get('/quota', userAuthMiddleware, (c) => {
  const current = c.get('currentUser')!
  const user = getUserById(current.userId)
  if (!user) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: '用户不存在' } }, 404)
  }
  return c.json({
    success: true,
    data: {
      quotaTotal: user.quotaTotal,
      quotaUsed: user.quotaUsed,
      quotaRemaining: getRemainingQuota(user.id),
      vipLevel: user.vipLevel,
    },
  })
})

// ═══════════════════════════════════════
// PUT /profile — 修改个人资料
// ═══════════════════════════════════════

route.put('/profile', userAuthMiddleware, async (c) => {
  let body: unknown
  try { body = await c.req.json() } catch {
    return c.json({ success: false, error: { code: 'BAD_REQUEST', message: '请求体格式错误' } }, 400)
  }

  const parsed = profileSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message || '参数错误' },
    }, 400)
  }

  const current = c.get('currentUser')!

  // 手机号 / 邮箱唯一性（排除自身）
  if (parsed.data.phone) {
    const exist = getUserByPhone(parsed.data.phone)
    if (exist && exist.id !== current.userId) {
      return c.json({ success: false, error: { code: 'CONFLICT', message: '该手机号已被使用' } }, 409)
    }
  }
  if (parsed.data.email) {
    const exist = getUserByEmail(parsed.data.email)
    if (exist && exist.id !== current.userId) {
      return c.json({ success: false, error: { code: 'CONFLICT', message: '该邮箱已被使用' } }, 409)
    }
  }

  const updated = updateUser(current.userId, parsed.data)
  if (!updated) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: '用户不存在' } }, 404)
  }
  return c.json({ success: true, data: { user: sanitize(updated) } })
})

// ═══════════════════════════════════════
// GET /sessions — 我的登录设备（近 20 条）
// ═══════════════════════════════════════

route.get('/sessions', userAuthMiddleware, (c) => {
  const current = c.get('currentUser')!
  const sessions = listUserSessions(current.userId).map(s => ({
    id: s.id,
    ip: s.ip,
    userAgent: s.userAgent,
    isActive: s.isActive,
    createdAt: s.createdAt,
    logoutAt: s.logoutAt,
    isCurrent: s.tokenJti === current.jti,
  }))
  return c.json({ success: true, data: sessions })
})

// ═══════════════════════════════════════
// GET /status — 未登录也可调用，返回当前登录态（可选鉴权）
// ═══════════════════════════════════════

route.get('/status', optionalUserAuth, (c) => {
  const current = c.get('currentUser')
  if (!current) {
    return c.json({ success: true, data: { authenticated: false } })
  }
  const user = getUserById(current.userId)
  return c.json({
    success: true,
    data: {
      authenticated: true,
      user: user ? sanitize(user) : null,
      quotaRemaining: user ? getRemainingQuota(user.id) : 0,
    },
  })
})

export default route
