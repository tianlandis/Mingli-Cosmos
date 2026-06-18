// ============================================================
// Phase 4.6 — Modules: Auth 路由（安全升级版）
// 文件：src/server/modules/auth/index.ts
// 路由：POST /api/v1/admin/auth/auth/login | logout | password |
//       GET sessions + POST sessions/revoke
// ============================================================

import { Hono } from 'hono'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import {
  authMiddleware,
  signToken,
  createSession,
  invalidateSession,
  invalidateAllSessions,
  listActiveSessions,
  getSessionById,
  revokeSessionById,
  listActiveSessionsByUser,
} from '../../core/middleware/auth'
import { loginRateLimit, checkUserRate } from '../../core/middleware/rate-limit'
import { logAudit } from '../../core/middleware/audit'
import { getDb, schema } from '../../db'

const { appConfigs } = schema

// ═══════════════════════════════════════
// Zod 验证 Schema
// ═══════════════════════════════════════

const loginBodySchema = z.object({
  username: z.string().min(1, '用户名不能为空'),
  password: z.string().min(1, '密码不能为空'),
})

const passwordBodySchema = z.object({
  oldPassword: z.string().min(1, '旧密码不能为空'),
  newPassword: z.string().min(6, '新密码至少6位'),
})

const revokeBodySchema = z.object({
  sessionId: z.number().int().positive('会话ID无效'),
})

// ═══════════════════════════════════════
// 管理员密码管理（DB 持久化）
// ═══════════════════════════════════════

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin'
const DEFAULT_PASSWORD = process.env.ADMIN_PASSWORD || 'mingli2026'

/**
 * 获取当前生效的管理员密码 hash
 * 优先级：app_configs (key='admin_password_hash') > env ADMIN_PASSWORD > 默认
 */
function getAdminPasswordHash(): string {
  try {
    const row = getDb().select({ value: appConfigs.value })
      .from(appConfigs)
      .where(eq(appConfigs.key, 'admin_password_hash'))
      .get()
    if (row) return row.value
  } catch { /* DB 未就绪时回退 */ }

  // 回退：使用环境变量，并自动写入 DB
  const hash = bcrypt.hashSync(DEFAULT_PASSWORD, 10)
  try {
    getDb().insert(appConfigs).values({
      key: 'admin_password_hash',
      value: hash,
      displayName: '管理员密码哈希',
      description: 'BCrypt hash of the admin password',
      valueType: 'string',
      category: 'security',
    }).onConflictDoUpdate({
      target: appConfigs.key,
      set: { value: hash },
    }).run()
  } catch { /* 写入失败不阻塞 */ }
  return hash
}

/** 验证管理员密码 */
function verifyAdminPassword(password: string): boolean {
  const hash = getAdminPasswordHash()
  return bcrypt.compareSync(password, hash)
}

/** 更新管理员密码（持久化到 DB） */
function updateAdminPasswordHash(newHash: string): void {
  getDb().insert(appConfigs).values({
    key: 'admin_password_hash',
    value: newHash,
    displayName: '管理员密码哈希',
    description: 'BCrypt hash of the admin password',
    valueType: 'string',
    category: 'security',
  }).onConflictDoUpdate({
    target: appConfigs.key,
    set: { value: newHash },
  }).run()
}

// ═══════════════════════════════════════
// 导出路由
// ═══════════════════════════════════════

export const route = new Hono()

// ---- POST /login ----
route.post('/login', loginRateLimit(), async (c) => {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ success: false, error: { code: 'BAD_REQUEST', message: '请求体格式错误' } }, 400)
  }

  // Zod 验证
  const parsed = loginBodySchema.safeParse(body)
  if (!parsed.success) {
    return c.json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message || '参数错误' },
    }, 400)
  }

  const { username, password } = parsed.data

  // 用户名限流
  if (!checkUserRate(username)) {
    return c.json({
      success: false,
      error: { code: 'RATE_LIMITED', message: '该账户登录尝试过于频繁，请1小时后重试' },
    }, 429)
  }

  // 验证凭据
  if (username !== ADMIN_USERNAME || !verifyAdminPassword(password)) {
    return c.json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: '用户名或密码错误' },
    }, 401)
  }

  // 签发 JWT + 创建 session（记录 IP/UA）
  const { token, jti, expiresAt } = signToken(username)
  const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || '127.0.0.1'
  const userAgent = c.req.header('user-agent') || ''

  createSession({ tokenJti: jti, username, ip, userAgent, expiresAt })
  logAudit(c, { action: 'login', resource: 'auth', detail: `用户 ${username} 登录 IP=${ip}` })

  return c.json({
    success: true,
    data: { token, expiresIn: '24h' },
  })
})

// ---- POST /logout ----
route.post('/logout', authMiddleware, (c) => {
  const user = c.get('adminUser')
  if (user?.jti) invalidateSession(user.jti)
  logAudit(c, { action: 'logout', resource: 'auth' })
  return c.json({ success: true, data: { message: '已退出登录' } })
})

// ---- PUT /password —— 完整实现（DB 持久化）----
route.put('/password', authMiddleware, async (c) => {
  let body: unknown
  try { body = await c.req.json() } catch {
    return c.json({ success: false, error: { code: 'BAD_REQUEST', message: '请求体格式错误' } }, 400)
  }

  const parsed = passwordBodySchema.safeParse(body)
  if (!parsed.success) {
    return c.json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message || '参数错误' },
    }, 400)
  }

  const { oldPassword, newPassword } = parsed.data

  // 验证旧密码
  if (!verifyAdminPassword(oldPassword)) {
    return c.json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: '旧密码错误' },
    }, 401)
  }

  // 新旧密码不能相同
  if (oldPassword === newPassword) {
    return c.json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: '新密码不能与旧密码相同' },
    }, 400)
  }

  // 生成新 hash 并持久化
  const newHash = bcrypt.hashSync(newPassword, 10)
  updateAdminPasswordHash(newHash)

  // 强制所有会话下线（安全措施）
  const user = c.get('adminUser')
  const username = user?.username || ADMIN_USERNAME
  invalidateAllSessions(username)

  logAudit(c, { action: 'update', resource: 'auth', detail: `管理员 ${username} 修改了密码，所有会话已强制下线` })

  return c.json({
    success: true,
    data: { message: '密码已修改，所有设备已强制下线，请重新登录' },
  })
})

// ---- GET /sessions —— 列出所有活跃会话 ----
route.get('/sessions', authMiddleware, (c) => {
  const sessions = listActiveSessions()
  return c.json({ success: true, data: sessions })
})

// ---- POST /sessions/revoke —— 强制下线指定会话 ----
route.post('/sessions/revoke', authMiddleware, async (c) => {
  let body: unknown
  try { body = await c.req.json() } catch {
    return c.json({ success: false, error: { code: 'BAD_REQUEST', message: '请求体格式错误' } }, 400)
  }

  const parsed = revokeBodySchema.safeParse(body)
  if (!parsed.success) {
    return c.json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message || '参数错误' },
    }, 400)
  }

  const { sessionId } = parsed.data

  // 查询目标会话
  const target = getSessionById(sessionId)
  if (!target) {
    return c.json({
      success: false,
      error: { code: 'NOT_FOUND', message: '会话不存在' },
    }, 404)
  }

  if (target.isActive === 0) {
    return c.json({
      success: false,
      error: { code: 'CONFLICT', message: '该会话已处于下线状态' },
    }, 409)
  }

  // 防止管理员撤销自己的当前会话（允许但警告）
  const currentUser = c.get('adminUser')
  const isSelfRevoke = currentUser?.jti === target.tokenJti

  // 执行撤销
  revokeSessionById(sessionId)

  const operatorName = currentUser?.username || 'admin'
  logAudit(c, {
    action: 'update',
    resource: 'auth',
    detail: `${operatorName} 强制下线会话: id=${sessionId} user=${target.username} jti=${target.tokenJti.slice(0, 16)}...${isSelfRevoke ? ' (自身会话)' : ''}`,
  })

  return c.json({
    success: true,
    data: {
      message: isSelfRevoke
        ? '已强制下线当前会话（请保存好数据后重新登录）'
        : `已强制下线 ${target.username} 的会话`,
      revokedSessionId: sessionId,
      isSelfRevoke,
    },
  })
})

export default route
