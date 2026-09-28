// ============================================================
// Phase 5 P5-3 — 服务端权威排盘端点（ADR-005）
// 文件：src/server/modules-public/chart/index.ts
// 挂载：/api/v1/app/chart
//
//   POST /   生辰 → 服务端引擎计算 chart + annotation → 落库（权威锚点）
//
// 意义：
//   - 把「事实源」从浏览器搬到服务端，堵住伪造 chart 操纵 AI 输出的完整性缺口；
//   - 返回 sessionId，后续 /api/chat、/api/report 只认 sessionId 即可取权威数据；
//   - 计算为纯函数，代价可控（ADR-005）。
// ============================================================

import { Hono } from 'hono'
import { z } from 'zod'
import { randomUUID } from 'node:crypto'
import { saveChartSession } from '../../db'
import { requireSystemEngine, isKnownSystem, DEFAULT_SYSTEM } from '../../systems/registry'
import type { BaziBundle } from '../../systems/bazi'
import { optionalUserAuth, type UserEnv } from '../../core/middleware/user-auth'
import { newTraceId } from '../../lib/trace'

export const route = new Hono<UserEnv>()

const chartSchema = z.object({
  year: z.number().int().min(1900).max(2100),
  month: z.number().int().min(1).max(12),
  day: z.number().int().min(1).max(31),
  hour: z.number().int().min(0).max(23),
  minute: z.number().int().min(0).max(59).default(0),
  gender: z.enum(['男', '女']),
  calendarType: z.enum(['solar', 'lunar']).default('solar'),
  isLeapMonth: z.boolean().optional(),
  /** 复用已有会话（同一盘面续聊） */
  sessionId: z.string().max(64).optional(),
  /** [ADR-011] 体系 id，缺省 'bazi'（当前仅支持 bazi） */
  system: z.string().max(32).optional(),
})

route.post('/', optionalUserAuth, async (c) => {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ success: false, error: { code: 'BAD_REQUEST', message: '请求体格式错误' } }, 400)
  }

  const parsed = chartSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message || '参数错误' },
    }, 400)
  }

  const d = parsed.data

  // [ADR-011] 体系路由：缺省 bazi；未注册体系直接拒绝，杜绝走到不存在的引擎
  const system = d.system ?? DEFAULT_SYSTEM
  if (!isKnownSystem(system)) {
    return c.json({
      success: false,
      error: { code: 'UNKNOWN_SYSTEM', message: `未知体系：${system}（当前仅支持 ${DEFAULT_SYSTEM}）` },
    }, 400)
  }
  const engine = requireSystemEngine(system)

  let bundle: BaziBundle
  try {
    // 计算委托体系引擎（bazi 引擎内部即 calculateBazi*/calculateBaziFromLunar + generateAnnotation）
    bundle = (await engine.compute({
      year: d.year,
      month: d.month,
      day: d.day,
      hour: d.hour,
      minute: d.minute,
      gender: d.gender,
      calendarType: d.calendarType,
      isLeapMonth: d.isLeapMonth,
    })) as BaziBundle
  } catch (e) {
    return c.json({
      success: false,
      error: {
        code: 'CALCULATION_FAILED',
        message: e instanceof Error ? e.message : '排盘计算失败，请检查输入',
      },
    }, 400)
  }

  const { chart, annotation } = bundle
  const hash = engine.hash(bundle)
  const sessionId = d.sessionId ?? `sess_${newTraceId()}_${randomUUID().slice(0, 8)}`
  const current = c.get('currentUser')

  // 权威落库（PII 归属用户，供删除权清除）
  saveChartSession({
    id: sessionId,
    chart: JSON.stringify(chart),
    annotation: JSON.stringify(annotation),
    chartHash: hash,
    engineVersion: engine.version,
    userId: current?.userId ?? null,
    system,
  })

  return c.json({
    success: true,
    data: {
      sessionId,
      chartHash: hash,
      engineVersion: engine.version,
      system,
      chart,
      annotation,
    },
  })
})

export default route
