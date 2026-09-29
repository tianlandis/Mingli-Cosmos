// ============================================================
// C 端模块 — 双人合盘（/api/v1/app/synastry）
// 文件：src/server/modules-public/synastry/index.ts
//
// 设计要点：
//   1. **不调大模型** —— 事实判断（日干合不合、宫位冲不冲、五行补不补）
//      全由规则层算出，零模型成本、可复现、可逐条解释。
//      这符合田哥定调：库里能算的不烧钱，AI 只做后置润滑。
//   2. **两边都能给** —— 既可以传已存档案 id（家人/亲友），也可以现场填生辰。
//      前者是"一人管全家"的落点：档案存过一次，以后合盘不用再打字。
//   3. **越权即 404** —— 他人档案一律当作不存在，不泄露 id。
//   4. **同组合缓存** —— 同一对命盘 + 同一关系，重复请求不扣额度。
// ============================================================

import { Hono, type Context } from 'hono'
import { z } from 'zod'
import { userAuthMiddleware, type UserEnv } from '../../core/middleware/user-auth'
import { birthInputSchema } from '../../lib/birth-input'
import type { BirthInput } from '../../lib/types'
import {
  computeSynastry,
  isRelationKey,
  RELATION_LABELS,
  type RelationKey,
} from '../../lib/synastry'
import { baziEngine } from '../../systems/bazi'
import { getBirthProfile } from '../../db'
import {
  isDbReady,
  getConfig,
  reserveQuota,
  commitQuota,
  refundQuota,
} from '../../db'
import { createTtlCache } from '../../lib/ttl-cache'
import { newTraceId } from '../../lib/trace'
import type { BaZiResult, AnnotationResult } from '../../../engine'

export const route = new Hono<UserEnv>()
export const meta = { prefix: 'synastry' }

/** 合盘结果缓存（同一对命盘 + 同一关系） */
const cache = createTtlCache(500)

/** 默认消耗额度（与前端点券模型 synastry=20 对齐） */
const DEFAULT_COST = 20

const bodySchema = z.object({
  /** 甲方：档案 id 或现场生辰，二选一 */
  aProfileId: z.number().int().positive().optional(),
  a: birthInputSchema.optional(),
  /** 乙方 */
  bProfileId: z.number().int().positive().optional(),
  b: birthInputSchema.optional(),
  /** 关系类型（决定各维度权重） */
  relation: z.string().default('other'),
  /** 显示名（档案自带时可不传） */
  labelA: z.string().max(32).optional(),
  labelB: z.string().max(32).optional(),
})

function fail(c: Context<UserEnv>, status: 400 | 401 | 402 | 404, code: string, message: string) {
  return c.json({ success: false, error: { code, message } }, status)
}

/** 档案行 → 引擎入参（字段映射集中此处，避免散落） */
function profileToBirthInput(p: {
  calendarType: string
  birthYear: number
  birthMonth: number
  birthDay: number
  birthHour: number | null
  birthMinute: number | null
  gender: string | null
  isLeapMonth: number | null
  label: string | null
}, fallbackLabel: string): { input: BirthInput; label: string } {
  return {
    input: {
      year: p.birthYear,
      month: p.birthMonth,
      day: p.birthDay,
      hour: p.birthHour ?? 0,
      minute: p.birthMinute ?? 0,
      // 档案存 male/female，引擎要 男/女
      gender: p.gender === 'female' ? '女' : '男',
      calendarType: p.calendarType === 'lunar' ? 'lunar' : 'solar',
      isLeapMonth: p.isLeapMonth === 1,
    },
    label: p.label || fallbackLabel,
  }
}

/** 现场生辰 → 引擎入参 */
function payloadToBirthInput(v: {
  calendarType?: string
  birthYear: number
  birthMonth: number
  birthDay: number
  birthHour?: number | null
  birthMinute?: number | null
  gender?: string | null
  isLeapMonth?: boolean
}, fallbackLabel: string): { input: BirthInput; label: string } {
  return {
    input: {
      year: v.birthYear,
      month: v.birthMonth,
      day: v.birthDay,
      hour: v.birthHour ?? 0,
      minute: v.birthMinute ?? 0,
      gender: v.gender === 'female' ? '女' : '男',
      calendarType: v.calendarType === 'lunar' ? 'lunar' : 'solar',
      isLeapMonth: v.isLeapMonth ?? false,
    },
    label: fallbackLabel,
  }
}

// 合盘耗 20 额度，必须登录；中间件会写入 currentUser（未登录直接 401）
route.post('/', userAuthMiddleware, async (c) => {
  const current = c.get('currentUser')
  if (!current) return fail(c, 401, 'UNAUTHORIZED', '请先登录')

  const parsed = bodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) {
    return fail(c, 400, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? '参数不合法')
  }
  const d = parsed.data

  const relation: RelationKey = isRelationKey(d.relation) ? d.relation : 'other'

  // ── 解析甲方 ──
  let sideA: { input: BirthInput; label: string }
  if (d.aProfileId !== undefined) {
    const p = getBirthProfile(d.aProfileId)
    if (!p || p.userId !== current.userId) {
      return fail(c, 404, 'NOT_FOUND', '生辰档案不存在')
    }
    sideA = profileToBirthInput(p, d.labelA ?? '甲方')
  } else if (d.a) {
    sideA = payloadToBirthInput(d.a, d.labelA ?? '甲方')
  } else {
    return fail(c, 400, 'VALIDATION_ERROR', '甲方需要提供档案 id 或生辰')
  }

  // ── 解析乙方 ──
  let sideB: { input: BirthInput; label: string }
  if (d.bProfileId !== undefined) {
    const p = getBirthProfile(d.bProfileId)
    if (!p || p.userId !== current.userId) {
      return fail(c, 404, 'NOT_FOUND', '生辰档案不存在')
    }
    sideB = profileToBirthInput(p, d.labelB ?? '乙方')
  } else if (d.b) {
    sideB = payloadToBirthInput(d.b, d.labelB ?? '乙方')
  } else {
    return fail(c, 400, 'VALIDATION_ERROR', '乙方需要提供档案 id 或生辰')
  }

  // ── 排盘（走 ADR-011 体系注册表，不直连引擎内部）──
  const bundleA = await baziEngine.compute(sideA.input)
  const bundleB = await baziEngine.compute(sideB.input)

  const result = computeSynastry(
    {
      chart: bundleA.chart as BaZiResult,
      annotation: bundleA.annotation as AnnotationResult,
      label: d.labelA ?? sideA.label,
    },
    {
      chart: bundleB.chart as BaZiResult,
      annotation: bundleB.annotation as AnnotationResult,
      label: d.labelB ?? sideB.label,
    },
    relation,
  )

  // ── 缓存命中：不扣额度 ──
  const ck = `synastry:${result.fingerprint}`
  const cached = cache.get(ck)
  if (cached !== undefined) {
    c.header('X-Synastry-Cache', 'hit')
    return c.json({ success: true, data: { ...(cached as object), cached: true } })
  }
  c.header('X-Synastry-Cache', 'miss')

  // ── 额度预留 ──
  let reserveKey: string | null = null
  if (isDbReady() && getConfig('quota_enforce_synastry')?.value !== 'false') {
    const headerKey = c.req.header('x-idempotency-key')
    const key = headerKey && /^[\w.:-]{8,128}$/.test(headerKey)
      ? headerKey
      : `synastry_${current.userId}_${newTraceId()}`
    const res = reserveQuota({
      userId: current.userId,
      idempotencyKey: key,
      cost: DEFAULT_COST,
      reason: 'synastry',
      refKey: null,
    })
    if (!res.ok) {
      return c.json({
        success: false,
        error: {
          code: res.reason ?? 'QUOTA_EXHAUSTED',
          message: res.reason === 'QUOTA_EXHAUSTED'
            ? `合盘需要 ${DEFAULT_COST} 额度，当前余额不足，请充值或订阅套餐`
            : '无法完成本次合盘',
        },
        quotaRemaining: res.balanceAfter ?? 0,
      }, 402)
    }
    reserveKey = key
  }

  try {
    cache.set(ck, result)
    if (reserveKey) commitQuota(reserveKey)
    return c.json({ success: true, data: { ...result, cached: false } })
  } catch (e) {
    if (reserveKey) refundQuota(reserveKey)
    console.error('[Synastry] 处理异常', e)
    return fail(c, 400, 'INTERNAL_ERROR', '合盘计算失败，请稍后重试')
  }
})

/** 供前端下拉：关系选项（与服务端枚举同源，避免前后端漂移） */
route.get('/relations', (c) => {
  return c.json({
    success: true,
    data: Object.entries(RELATION_LABELS).map(([key, label]) => ({ key, label })),
  })
})
