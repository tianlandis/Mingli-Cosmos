// ============================================================
// [ADR-012] 用户生辰档案 — C 端公开路由
// 文件：src/server/modules-public/birth-profiles/index.ts
// 挂载：/api/v1/app/user/birth-profiles（meta.prefix 覆盖目录名）
//
//   GET    /             我的档案列表（默认档在前）
//   POST   /             新增档案（该用户首个档案自动置为默认）
//   PATCH  /:id          修改档案（仅本人）
//   DELETE /:id          删除档案（仅本人；删掉默认档会自动补位）
//   POST   /:id/default  设为默认档案（仅本人）
//
// 产品闭环：注册时采集生辰 → 建默认档案 → 登录后据默认档自动排盘，
// 用户无需每次重复录入排盘信息。
//
// 合规：birth_profiles 为核心 PII，已纳入 GET /user/data/export
// 与 DELETE /user/data（ADR-006），本模块不改该链路。
// ============================================================

import { Hono, type Context } from 'hono'
import { z } from 'zod'
import { userAuthMiddleware, type UserEnv } from '../../core/middleware/user-auth'
import {
  listBirthProfilesByUser,
  getBirthProfile,
  createBirthProfile,
  updateBirthProfile,
  deleteBirthProfile,
  setDefaultBirthProfile,
  toBirthProfileDto,
} from '../../db'
import { birthFieldsObject, checkRealDate, relationSchema } from '../../lib/birth-input'

export const route = new Hono<UserEnv>()

/** 目录名为 birth-profiles，业务上归属用户资料，故显式覆盖为 /user/birth-profiles */
export const meta = { prefix: 'user/birth-profiles' }

// ═══════════════════════════════════════
// 校验（字段与日期规则来自 lib/birth-input，与注册入口同源）
// ═══════════════════════════════════════

const createSchema = birthFieldsObject
  .extend({
    label: z.string().max(32, '显示名最多 32 字').optional(),
    relation: relationSchema.optional(),
    isDefault: z.boolean().optional(),
  })
  .superRefine(checkRealDate)

const updateSchema = birthFieldsObject
  .extend({
    // label 必须先声明再 partial：zod 默认丢弃未声明键，
    // 漏掉会让「改标签」静默失效（测试已锁定该回归）。relation 同理。
    label: z.string().max(32, '显示名最多 32 字'),
    relation: relationSchema,
  })
  .partial()
  .superRefine((v, ctx) => {
    // 三要素齐全时才做存在性校验，避免局部更新（如仅改标签）被整段拦截
    if (v.calendarType && v.birthYear && v.birthMonth && v.birthDay) {
      checkRealDate({
        calendarType: v.calendarType,
        birthYear: v.birthYear,
        birthMonth: v.birthMonth,
        birthDay: v.birthDay,
      }, ctx)
    }
  })

// ═══════════════════════════════════════
// 输出：DTO 定义在仓储层（与 /user/me 的 defaultBirthProfile 共用同一形状）
// ═══════════════════════════════════════

function badRequest(c: Context<UserEnv>, message: string): Response {
  return c.json({ success: false, error: { code: 'VALIDATION_ERROR', message } }, 400)
}

// ═══════════════════════════════════════
// GET / — 我的档案列表
// ═══════════════════════════════════════

route.get('/', userAuthMiddleware, (c) => {
  const current = c.get('currentUser')!
  const items = listBirthProfilesByUser(current.userId).map(toBirthProfileDto)
  return c.json({ success: true, data: { items, total: items.length } })
})

// ═══════════════════════════════════════
// POST / — 新增档案
// ═══════════════════════════════════════

route.post('/', userAuthMiddleware, async (c) => {
  let body: unknown
  try { body = await c.req.json() } catch {
    return c.json({ success: false, error: { code: 'BAD_REQUEST', message: '请求体格式错误' } }, 400)
  }

  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return badRequest(c, parsed.error.issues[0]?.message || '参数错误')
  }

  const current = c.get('currentUser')!
  const d = parsed.data
  const row = createBirthProfile({
    userId: current.userId,
    label: d.label ?? null,
    relation: d.relation ?? null,
    calendarType: d.calendarType,
    birthYear: d.birthYear,
    birthMonth: d.birthMonth,
    birthDay: d.birthDay,
    birthHour: d.birthHour ?? null,
    birthMinute: d.birthMinute ?? 0,
    isLeapMonth: d.isLeapMonth ?? false,
    gender: d.gender ?? null,
    isDefault: d.isDefault ?? false,
  })

  return c.json({ success: true, data: toBirthProfileDto(row) }, 201)
})

// ═══════════════════════════════════════
// PATCH /:id — 修改档案（仅本人，他人档案一律 404）
// ═══════════════════════════════════════

route.patch('/:id', userAuthMiddleware, async (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id) || id <= 0) {
    return badRequest(c, '档案 ID 无效')
  }

  let body: unknown
  try { body = await c.req.json() } catch {
    return c.json({ success: false, error: { code: 'BAD_REQUEST', message: '请求体格式错误' } }, 400)
  }

  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return badRequest(c, parsed.error.issues[0]?.message || '参数错误')
  }

  const current = c.get('currentUser')!
  const existing = getBirthProfile(id)
  // 越权与不存在同样返回 404：不泄露"该 id 存在但不属于你"
  if (!existing || existing.userId !== current.userId) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: '档案不存在' } }, 404)
  }

  const updated = updateBirthProfile(id, parsed.data)
  if (!updated) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: '档案不存在' } }, 404)
  }
  return c.json({ success: true, data: toBirthProfileDto(updated) })
})

// ═══════════════════════════════════════
// DELETE /:id — 删除档案（仅本人）
// ═══════════════════════════════════════

route.delete('/:id', userAuthMiddleware, (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id) || id <= 0) {
    return badRequest(c, '档案 ID 无效')
  }

  const current = c.get('currentUser')!
  const existing = getBirthProfile(id)
  if (!existing || existing.userId !== current.userId) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: '档案不存在' } }, 404)
  }

  const wasDefault = existing.isDefault === 1
  const removed = deleteBirthProfile(id)
  if (!removed) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: '档案不存在' } }, 404)
  }

  // 删掉的是默认档且仍有其余档案 → 自动补位，避免出现"有档却无默认"的空档期，
  // 否则「登录自动排盘」会静默失效。
  let promoted: number | null = null
  if (wasDefault) {
    const rest = listBirthProfilesByUser(current.userId)
    if (rest.length > 0 && !rest.some(p => p.isDefault === 1)) {
      if (setDefaultBirthProfile(current.userId, rest[0].id)) promoted = rest[0].id
    }
  }

  return c.json({ success: true, data: { deleted: true, promotedDefaultId: promoted } })
})

// ═══════════════════════════════════════
// POST /:id/default — 设为默认档案（仅本人）
// ═══════════════════════════════════════

route.post('/:id/default', userAuthMiddleware, (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id) || id <= 0) {
    return badRequest(c, '档案 ID 无效')
  }

  const current = c.get('currentUser')!
  const existing = getBirthProfile(id)
  if (!existing || existing.userId !== current.userId) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: '档案不存在' } }, 404)
  }

  const ok = setDefaultBirthProfile(current.userId, id)
  if (!ok) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: '档案不存在' } }, 404)
  }
  return c.json({ success: true, data: { id, isDefault: true } })
})

export default route
