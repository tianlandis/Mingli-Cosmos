// ============================================================
// Phase 4b M-6 — 管理后台：C 端用户管理
// 文件：src/server/modules/users/index.ts
// 路由：/api/v1/admin/users/*
//   GET    /              用户列表（分页 + 关键词 + 状态筛选）
//   GET    /stats         用户统计
//   GET    /:id           用户详情（含订阅 / 最近订单）
//   PATCH  /:id           修改状态 / 资料 / 等级
//   POST   /:id/quota     调整额度
//   POST   /:id/reset-password  重置密码
//   DELETE /:id           删除用户
// ============================================================

import { Hono } from 'hono'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { authMiddleware } from '../../core/middleware/auth'
import { logAudit, type AdminEnv } from '../../core/middleware/audit'
import {
  getDb,
  schema,
  listUsers,
  countUsers,
  countUsersSince,
  getUserById,
  updateUser,
  deleteUser,
  grantQuota,
  consumeQuota,
  invalidateAllUserSessions,
  listOrders,
  listSubscriptions,
} from '../../db'

const { users } = schema

export const route = new Hono<AdminEnv>()
route.use('*', authMiddleware)

// ═══════════════════════════════════════
// Zod 校验
// ═══════════════════════════════════════

const patchUserSchema = z.object({
  nickname: z.string().min(1).max(32).optional(),
  status: z.enum(['active', 'disabled']).optional(),
  vipLevel: z.enum(['free', 'basic', 'pro']).optional(),
  vipExpiresAt: z.string().nullable().optional(),
  quotaTotal: z.number().int().min(0).max(100000).optional(),
})

const quotaSchema = z.object({
  /** 正数=赠送，负数=扣减；与 setTotal 二选一 */
  delta: z.number().int().optional(),
  /** 直接设定总量 */
  setTotal: z.number().int().min(0).max(100000).optional(),
  reason: z.string().max(200).optional(),
}).refine(v => v.delta !== undefined || v.setTotal !== undefined, {
  message: 'delta 或 setTotal 必填其一',
})

const resetPasswordSchema = z.object({
  newPassword: z.string().min(6, '新密码至少 6 位').max(64),
})

// ═══════════════════════════════════════
// GET / — 用户列表
// ═══════════════════════════════════════

route.get('/', (c) => {
  const keyword = c.req.query('keyword') || undefined
  const status = c.req.query('status') || undefined
  const vipLevel = c.req.query('vipLevel') || undefined
  const page = Number(c.req.query('page') || 1)
  const pageSize = Number(c.req.query('pageSize') || 20)

  const res = listUsers({ keyword, status, vipLevel, page, pageSize })
  return c.json({
    success: true,
    data: {
      items: res.items.map(u => ({
        id: u.id,
        username: u.username,
        nickname: u.nickname,
        phone: u.phone,
        email: u.email,
        status: u.status,
        role: u.role,
        vipLevel: u.vipLevel,
        vipExpiresAt: u.vipExpiresAt,
        quotaTotal: u.quotaTotal,
        quotaUsed: u.quotaUsed,
        quotaRemaining: Math.max(0, u.quotaTotal - u.quotaUsed),
        lastLoginAt: u.lastLoginAt,
        lastLoginIp: u.lastLoginIp,
        createdAt: u.createdAt,
      })),
      total: res.total,
      page: res.page,
      pageSize: res.pageSize,
    },
  })
})

// ═══════════════════════════════════════
// GET /stats — 用户统计
// ═══════════════════════════════════════

route.get('/stats', (c) => {
  const db = getDb()
  // 简单统计：总量 / 启用 / 禁用 / 各等级
  const rows = db.select({
    status: users.status,
    vipLevel: users.vipLevel,
  }).from(users).all()

  const total = rows.length
  const active = rows.filter(r => r.status === 'active').length
  const disabled = rows.filter(r => r.status === 'disabled').length
  const vipBreakdown = rows.reduce<Record<string, number>>((acc, r) => {
    const key = r.vipLevel || 'free'
    acc[key] = (acc[key] ?? 0) + 1
    return acc
  }, {})

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayIso = today.toISOString()

  return c.json({
    success: true,
    data: {
      total,
      active,
      disabled,
      vipBreakdown,
      newToday: countUsersSince(todayIso),
      newThisWeek: countUsersSince(
        new Date(Date.now() - 7 * 86_400_000).toISOString(),
      ),
      grandTotal: countUsers(),
    },
  })
})

// ═══════════════════════════════════════
// GET /:id — 用户详情
// ═══════════════════════════════════════

route.get('/:id', (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id) || id <= 0) {
    return c.json({ success: false, error: { code: 'VALIDATION_ERROR', message: '用户 ID 无效' } }, 400)
  }

  const user = getUserById(id)
  if (!user) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: '用户不存在' } }, 404)
  }

  const { passwordHash: _ph, ...safe } = user
  const orders = listOrders({ userId: id, pageSize: 10 })
  const subs = listSubscriptions(id)

  return c.json({
    success: true,
    data: {
      user: safe,
      quotaRemaining: Math.max(0, user.quotaTotal - user.quotaUsed),
      orders: orders.items,
      subscriptions: subs,
    },
  })
})

// ═══════════════════════════════════════
// PATCH /:id — 修改用户
// ═══════════════════════════════════════

route.patch('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id) || id <= 0) {
    return c.json({ success: false, error: { code: 'VALIDATION_ERROR', message: '用户 ID 无效' } }, 400)
  }

  let body: unknown
  try { body = await c.req.json() } catch {
    return c.json({ success: false, error: { code: 'BAD_REQUEST', message: '请求体格式错误' } }, 400)
  }

  const parsed = patchUserSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message || '参数错误' },
    }, 400)
  }

  if (!getUserById(id)) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: '用户不存在' } }, 404)
  }

  const updated = updateUser(id, parsed.data)
  logAudit(c, {
    action: 'update',
    resource: 'user',
    resourceId: id,
    detail: `更新用户 #${id}: ${JSON.stringify(parsed.data)}`,
  })

  // 停用账号 → 强制所有登录会话下线
  if (parsed.data.status === 'disabled') {
    invalidateAllUserSessions(id)
  }

  return c.json({
    success: true,
    data: {
      id: updated?.id,
      username: updated?.username,
      status: updated?.status,
      vipLevel: updated?.vipLevel,
      quotaTotal: updated?.quotaTotal,
      quotaUsed: updated?.quotaUsed,
    },
  })
})

// ═══════════════════════════════════════
// POST /:id/quota — 调整额度
// ═══════════════════════════════════════

route.post('/:id/quota', async (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id) || id <= 0) {
    return c.json({ success: false, error: { code: 'VALIDATION_ERROR', message: '用户 ID 无效' } }, 400)
  }

  let body: unknown
  try { body = await c.req.json() } catch {
    return c.json({ success: false, error: { code: 'BAD_REQUEST', message: '请求体格式错误' } }, 400)
  }

  const parsed = quotaSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message || '参数错误' },
    }, 400)
  }

  const before = getUserById(id)
  if (!before) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: '用户不存在' } }, 404)
  }

  let updated
  if (parsed.data.setTotal !== undefined) {
    const delta = parsed.data.setTotal - before.quotaTotal
    updated = grantQuota(id, delta)
  } else {
    updated = grantQuota(id, parsed.data.delta!)
  }

  logAudit(c, {
    action: 'update',
    resource: 'user',
    resourceId: id,
    detail: `调整额度 #${id}: ${before.quotaTotal} → ${updated?.quotaTotal} ` +
            `(已用 ${updated?.quotaUsed})，原因：${parsed.data.reason ?? '未填写'}`,
  })

  return c.json({
    success: true,
    data: {
      quotaTotal: updated?.quotaTotal,
      quotaUsed: updated?.quotaUsed,
      quotaRemaining: updated ? Math.max(0, updated.quotaTotal - updated.quotaUsed) : 0,
    },
  })
})

// ═══════════════════════════════════════
// POST /:id/reset-password — 重置密码
// ═══════════════════════════════════════

route.post('/:id/reset-password', async (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id) || id <= 0) {
    return c.json({ success: false, error: { code: 'VALIDATION_ERROR', message: '用户 ID 无效' } }, 400)
  }

  let body: unknown
  try { body = await c.req.json() } catch {
    return c.json({ success: false, error: { code: 'BAD_REQUEST', message: '请求体格式错误' } }, 400)
  }

  const parsed = resetPasswordSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message || '参数错误' },
    }, 400)
  }

  if (!getUserById(id)) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: '用户不存在' } }, 404)
  }

  updateUser(id, { passwordHash: bcrypt.hashSync(parsed.data.newPassword, 10) })
  invalidateAllUserSessions(id)  // 重置密码后强制重新登录

  logAudit(c, {
    action: 'update',
    resource: 'user',
    resourceId: id,
    detail: `重置用户 #${id} 密码，已强制其所有会话下线`,
  })

  return c.json({ success: true, data: { message: '密码已重置，该用户需重新登录' } })
})

// ═══════════════════════════════════════
// DELETE /:id — 删除用户
// ═══════════════════════════════════════

route.delete('/:id', (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id) || id <= 0) {
    return c.json({ success: false, error: { code: 'VALIDATION_ERROR', message: '用户 ID 无效' } }, 400)
  }

  const user = getUserById(id)
  if (!user) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: '用户不存在' } }, 404)
  }

  const ok = deleteUser(id)
  logAudit(c, {
    action: 'delete',
    resource: 'user',
    resourceId: id,
    detail: `删除用户 #${id} (${user.username})`,
  })

  return c.json({ success: ok, data: { deleted: ok } })
})

// ═══════════════════════════════════════
// POST /:id/consume-quota — 后台代扣额度（运营补偿/测试用）
// ═══════════════════════════════════════

route.post('/:id/consume-quota', (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id) || id <= 0) {
    return c.json({ success: false, error: { code: 'VALIDATION_ERROR', message: '用户 ID 无效' } }, 400)
  }
  const ok = consumeQuota(id)
  return c.json({
    success: ok,
    data: ok ? { message: '已扣减 1 次额度' } : { message: '额度不足或账号不可用' },
  }, ok ? 200 : 409)
})

export default route
