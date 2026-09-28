// ============================================================
// Phase 4b M-6 — C 端用户 API（公开路由）
// 文件：src/server/modules-public/user/index.ts
// 路由：/api/v1/app/user/*
//   POST /register | /login | /logout
//   GET  /me | /quota
//   PUT  /profile
// ============================================================

import { Hono, type Context } from 'hono'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { birthInputSchema } from '../../lib/birth-input'
import {
  userAuthMiddleware,
  signUserToken,
  optionalUserAuth,
  type UserEnv,
} from '../../core/middleware/user-auth'
import {
  loginRateLimit,
  checkUserRate,
  recordLoginFailure,
  clearLoginAttempts,
} from '../../core/middleware/rate-limit'
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
  invalidateAllUserSessions,
  getRemainingQuota,
  listUserSessions,
  softDeleteUser,
  listSessionsByUser,
  listChartSummariesByUser,
  getChartSessionForUser,
  deleteSessionsByUser,
  listLedgerByUser,
  listSubscriptions,
  listOrders,
  listEventsByUser,
  anonymizeEventsByUser,
  recordConsent,
  listConsentsByUser,
  CONSENT_TYPES,
  createAuditLog,
  getConfig,
  // [ADR-012] 生辰档案（用户身份域 · 核心 PII）
  listBirthProfilesByUser,
  deleteBirthProfilesByUser,
  createBirthProfile,
  getDefaultBirthProfile,
  toBirthProfileDto,
  // [ADR-013] 增长域：推介绑定
  bindReferralByCode,
  listReferralsByReferrer,
  listRewardsByUser,
  purgeReferralsForUser,
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
  /** [ADR-013] 推介邀请码（选填，注册后即绑定） */
  referralCode: z.string().max(32).optional(),
  /**
   * 生辰（前端注册表单必填）。
   * 采到即建「默认生辰档案」，实现「注册一次、此后登录直接出盘」——
   * 这是 login 后无需重复录入排盘信息的唯一数据来源。
   */
  birth: birthInputSchema.optional(),
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

function clientIp(c: Context): string {
  return c.req.header('x-forwarded-for')?.split(',')[0].trim()
    || c.req.header('x-real-ip')
    || '127.0.0.1'
}

/** 登录成功后统一：更新登录信息 + 建会话 + 埋点 */
function issueLogin(c: Context, user: { id: number; username: string }) {
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

  const { username, password, nickname, phone, email, referralCode, birth } = parsed.data

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

  // [ADR-013] 推介绑定：失败**不影响注册**（仅告警）
  if (referralCode) {
    try {
      const bind = bindReferralByCode(user.id, referralCode)
      if (!bind.ok) console.warn(`[Referral] 注册绑定未生效（ignored）：${bind.reason}`)
    } catch (e) {
      console.error('[Referral] 注册绑定异常（ignored）:', e)
    }
  }

  // [ADR-012] 生辰建档：注册即写入「默认档案」。
  // 这是「登录后无需重复录入排盘信息」的数据来源 —— 失败虽不影响注册，
  // 但会让该用户失去自动出盘能力，故必须告警而不能静默吞掉。
  if (birth) {
    try {
      createBirthProfile({
        userId: user.id,
        label: '本人',
        calendarType: birth.calendarType,
        birthYear: birth.birthYear,
        birthMonth: birth.birthMonth,
        birthDay: birth.birthDay,
        birthHour: birth.birthHour ?? null,
        birthMinute: birth.birthMinute ?? 0,
        isLeapMonth: birth.isLeapMonth ?? false,
        gender: birth.gender ?? null,
        isDefault: true,
      })
    } catch (e) {
      console.error('[BirthProfile] 注册建档异常（ignored）:', e)
    }
  }

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
    recordLoginFailure(clientIp(c), account)
    return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: '账号或密码错误' } }, 401)
  }

  if (user.status !== 'active') {
    return c.json({ success: false, error: { code: 'ACCOUNT_DISABLED', message: '账号已被停用，请联系客服' } }, 403)
  }

  // 登录成功：清空失败计数，避免正常多设备登录被误锁
  clearLoginAttempts(clientIp(c), account)

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
  // [ADR-012] 默认生辰档案：前端据此在登录后自动出盘，用户无需重复录入
  // （排盘不消耗额度，故自动出盘对用户无成本）
  const defaultProfile = getDefaultBirthProfile(user.id)
  return c.json({
    success: true,
    data: {
      user: sanitize(user),
      quotaRemaining: getRemainingQuota(user.id),
      subscription: sub
        ? { vipLevel: sub.vipLevel, startsAt: sub.startsAt, endsAt: sub.endsAt, status: sub.status }
        : null,
      defaultBirthProfile: defaultProfile ? toBirthProfileDto(defaultProfile) : null,
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
// GET /charts — 我的历史命盘（近 20 条，轻量摘要）
// 数据来源：sessions（服务端权威排盘落库，见 P5-3 ADR-005）
// ═══════════════════════════════════════

route.get('/charts', userAuthMiddleware, (c) => {
  const current = c.get('currentUser')!
  const rows = listChartSummariesByUser(current.userId, 20)
  const items = rows.map(r => {
    // 从权威 chart JSON 中抽取生辰摘要（列表仅需展示，不返回整份图表）
    let birth: { birthDate?: string; birthTime?: string; gender?: string } = {}
    try {
      birth = JSON.parse(r.chart) as typeof birth
    } catch { /* chart 异常时降级为无生辰信息，不影响列表 */ }
    return {
      id: r.id,
      chartHash: r.chartHash,
      engineVersion: r.engineVersion,
      system: r.system,
      createdAt: r.createdAt,
      lastActive: r.lastActive,
      birthDate: birth.birthDate ?? null,
      birthTime: birth.birthTime ?? null,
      gender: birth.gender ?? null,
    }
  })
  return c.json({ success: true, data: { items, total: items.length } })
})

// ═══════════════════════════════════════
// GET /charts/:id — 载入某份历史命盘（权威快照，仅限本人）
// ═══════════════════════════════════════

route.get('/charts/:id', userAuthMiddleware, (c) => {
  const current = c.get('currentUser')!
  const id = c.req.param('id')
  const row = id ? getChartSessionForUser(id, current.userId) : undefined
  if (!row) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: '命盘不存在或无权访问' } }, 404)
  }
  let chart: unknown = null
  let annotation: unknown = null
  try { chart = JSON.parse(row.chart) } catch { /* 损坏时返回 null，由前端提示 */ }
  try { annotation = JSON.parse(row.annotation) } catch { /* 同上 */ }
  return c.json({
    success: true,
    data: {
      id: row.id,
      chartHash: row.chartHash,
      engineVersion: row.engineVersion,
      system: row.system,
      lastActive: row.lastActive,
      chart,
      annotation,
    },
  })
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

// ═══════════════════════════════════════
// [P5-6 ADR-006] 合规底座
//   POST   /consent        告知同意留痕
//   GET    /data/export    数据导出（机读 JSON）
//   DELETE /data           数据删除（软删 + 硬删 PII + 审计）
// ═══════════════════════════════════════

const consentSchema = z.object({
  type: z.enum(['privacy_policy', 'user_agreement']),
  version: z.string().max(32).optional(),
  agreed: z.boolean().optional(),
})

route.post('/consent', userAuthMiddleware, async (c) => {
  let body: unknown
  try { body = await c.req.json() } catch {
    return c.json({ success: false, error: { code: 'BAD_REQUEST', message: '请求体格式错误' } }, 400)
  }

  const parsed = consentSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message || '参数错误' },
    }, 400)
  }

  const { type, agreed } = parsed.data
  // 版本号：请求优先 → 后台配置兜底
  const configKey = type === 'privacy_policy' ? 'consent_privacy_version' : 'consent_agreement_version'
  let version = parsed.data.version
  if (!version) {
    try { version = getConfig(configKey)?.value || 'v1.0' } catch { version = 'v1.0' }
  }

  const current = c.get('currentUser')!
  const row = recordConsent({
    userId: current.userId,
    type,
    version,
    agreed: agreed !== false,
    ip: clientIp(c),
    userAgent: c.req.header('user-agent') ?? null,
  })

  return c.json({
    success: true,
    data: { id: row.id, type: row.type, version: row.version, agreed: row.agreed === 1, createdAt: row.createdAt },
  }, 201)
})

route.get('/consent', userAuthMiddleware, (c) => {
  const current = c.get('currentUser')!
  return c.json({
    success: true,
    data: {
      types: CONSENT_TYPES,
      records: listConsentsByUser(current.userId).map(r => ({
        id: r.id,
        type: r.type,
        version: r.version,
        agreed: r.agreed === 1,
        createdAt: r.createdAt,
      })),
    },
  })
})

route.get('/data/export', userAuthMiddleware, (c) => {
  const current = c.get('currentUser')!
  const user = getUserById(current.userId)
  if (!user) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: '用户不存在' } }, 404)
  }

  const parse = <T>(raw: string | null): T | null => {
    if (!raw) return null
    try { return JSON.parse(raw) as T } catch { return null }
  }

  const charts = listSessionsByUser(user.id).map(s => ({
    sessionId: s.id,
    chartHash: s.chartHash,
    engineVersion: s.engineVersion,
    system: s.system,
    chart: parse<unknown>(s.chart),
    annotation: parse<unknown>(s.annotation),
    createdAt: s.createdAt,
  }))

  return c.json({
    success: true,
    data: {
      exportedAt: new Date().toISOString(),
      notice: '本文件包含您的个人信息（含生辰），请妥善保管',
      user: sanitize(user),
      // [ADR-012] 生辰档案（含核心 PII，随导出一并交付）
      birthProfiles: listBirthProfilesByUser(user.id).map(p => ({
        id: p.id, label: p.label, calendarType: p.calendarType,
        birthYear: p.birthYear, birthMonth: p.birthMonth, birthDay: p.birthDay,
        birthHour: p.birthHour, birthMinute: p.birthMinute, isLeapMonth: p.isLeapMonth === 1,
        gender: p.gender, isDefault: p.isDefault === 1, createdAt: p.createdAt,
      })),
      consents: listConsentsByUser(user.id).map(r => ({
        type: r.type, version: r.version, agreed: r.agreed === 1, createdAt: r.createdAt,
      })),
      subscriptions: listSubscriptions(user.id),
      orders: listOrders({ userId: user.id, pageSize: 100 }).items,
      quotaLedger: listLedgerByUser(user.id).map(l => ({
        key: l.idempotencyKey, delta: l.delta, balanceAfter: l.balanceAfter,
        reason: l.reason, status: l.status, createdAt: l.createdAt,
      })),
      charts,
      events: listEventsByUser(user.id).map(e => ({
        event: e.event, payload: parse<unknown>(e.payload), createdAt: e.createdAt,
      })),
      // [ADR-013] 增长域：我作为推介人的绑定关系 + 我收到的奖励
      referrals: listReferralsByReferrer(user.id).map(r => ({
        id: r.id, refereeUserId: r.refereeUserId, code: r.code, status: r.status,
        qualifiedAt: r.qualifiedAt, rewardedAt: r.rewardedAt, createdAt: r.createdAt,
      })),
      referralRewards: listRewardsByUser(user.id).map(r => ({
        id: r.id, type: r.type, amount: r.amount, status: r.status, grantedAt: r.grantedAt, createdAt: r.createdAt,
      })),
    },
  })
})

const deleteSchema = z.object({
  confirm: z.literal('DELETE', { message: '请输入 DELETE 以确认删除' }),
  password: z.string().min(1, '请输入密码以验证身份'),
})

route.delete('/data', userAuthMiddleware, async (c) => {
  let body: unknown
  try { body = await c.req.json() } catch {
    return c.json({ success: false, error: { code: 'BAD_REQUEST', message: '请求体格式错误' } }, 400)
  }

  const parsed = deleteSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message || '参数错误' },
    }, 400)
  }

  const current = c.get('currentUser')!
  const user = getUserById(current.userId)
  if (!user) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: '用户不存在' } }, 404)
  }
  if (!bcrypt.compareSync(parsed.data.password, user.passwordHash)) {
    return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: '密码错误，删除未执行' } }, 401)
  }

  // 1) 硬删 PII：排盘快照（含生辰）
  const purgedCharts = deleteSessionsByUser(user.id)
  // 1b) [ADR-012] 硬删 PII：生辰档案
  const purgedProfiles = deleteBirthProfilesByUser(user.id)
  // 1c) [ADR-013] 清除与该用户相关的推介数据（作为推介人或被推介人）
  const purgedReferrals = purgeReferralsForUser(user.id)
  // 2) 匿名化埋点（保留统计价值，抹除身份关联）
  const anonymizedEvents = anonymizeEventsByUser(user.id)
  // 3) 软删用户（状态置 deleted + 清空可识别字段）
  softDeleteUser(user.id)
  // 4) 立即失效所有登录会话
  const revokedSessions = invalidateAllUserSessions(user.id)

  // 5) 审计（只留操作元数据，不留原始 PII）
  createAuditLog({
    action: 'delete',
    resource: 'user_data',
    resourceId: user.id,
    detail: JSON.stringify({ purgedCharts, purgedProfiles, purgedReferrals, anonymizedEvents, revokedSessions, self: true }),
    operator: `user:${user.id}`,
    ip: clientIp(c),
    createdAt: new Date().toISOString(),
  })

  return c.json({
    success: true,
    data: {
      deleted: true,
      purgedCharts,
      purgedProfiles,
      purgedReferrals,
      anonymizedEvents,
      revokedSessions,
      message: '账号数据已删除，登录会话已失效',
    },
  })
})

export default route
