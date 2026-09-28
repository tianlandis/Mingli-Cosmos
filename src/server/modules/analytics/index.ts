// ============================================================
// Phase 4b M-8 — 管理后台：运营数据看板
// 文件：src/server/modules/analytics/index.ts
// 路由：/api/v1/admin/analytics/*
//   GET /overview   综合运营指标
//   GET /series     指定事件的日粒度趋势
//   GET /events     最近事件流水
// ============================================================

import { Hono } from 'hono'
import { z } from 'zod'
import { authMiddleware } from '../../core/middleware/auth'
import type { AdminEnv } from '../../core/middleware/audit'
import {
  countUsers,
  countUsersSince,
  countEvents,
  countAllEvents,
  dailySeries,
  activeUserCount,
  eventBreakdown,
  recentEvents,
  sumPaidAmountCents,
  countOrdersByStatus,
  countActiveSubscriptions,
  isTrackableEvent,
} from '../../db'

export const route = new Hono<AdminEnv>()
route.use('*', authMiddleware)

const seriesQuerySchema = z.object({
  event: z.string().default('paipan'),
  days: z.coerce.number().int().min(1).max(90).default(7),
})

/** 今日零点 ISO */
function todayStartIso(): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

// ═══════════════════════════════════════
// GET /overview — 综合运营指标
// ═══════════════════════════════════════

route.get('/overview', (c) => {
  const days = Math.min(90, Math.max(1, Number(c.req.query('days') || 7)))
  const sinceIso = new Date(Date.now() - days * 86_400_000).toISOString()
  const today = todayStartIso()

  const revenueCents = sumPaidAmountCents()

  return c.json({
    success: true,
    data: {
      // ── 用户 ──
      users: {
        total: countUsers(),
        newToday: countUsersSince(today),
        newInRange: countUsersSince(sinceIso),
        activeInRange: activeUserCount(days),
      },
      // ── 核心行为 ──
      activity: {
        paipanTotal: countEvents('paipan'),
        paipanInRange: countEvents('paipan', sinceIso),
        chatTotal: countEvents('chat'),
        chatInRange: countEvents('chat', sinceIso),
        reportViewTotal: countEvents('report_view'),
        eventsTotal: countAllEvents(),
      },
      // ── 商业化 ──
      business: {
        revenueCents,
        revenueYuan: Math.round(revenueCents / 100 * 100) / 100,
        paidOrders: countOrdersByStatus('paid'),
        pendingOrders: countOrdersByStatus('pending'),
        activeSubscriptions: countActiveSubscriptions(),
      },
      // ── 图表数据 ──
      charts: {
        registerTrend: dailySeries('register', days),
        paipanTrend: dailySeries('paipan', days),
        chatTrend: dailySeries('chat', days),
        eventBreakdown: eventBreakdown(),
      },
      range: { days, since: sinceIso, until: new Date().toISOString() },
    },
  })
})

// ═══════════════════════════════════════
// GET /series — 单事件趋势
// ═══════════════════════════════════════

route.get('/series', (c) => {
  const parsed = seriesQuerySchema.safeParse({
    event: c.req.query('event') ?? undefined,
    days: c.req.query('days') ?? undefined,
  })

  if (!parsed.success) {
    return c.json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message || '参数错误' },
    }, 400)
  }

  const { event, days } = parsed.data
  if (!isTrackableEvent(event)) {
    return c.json({
      success: false,
      error: { code: 'UNSUPPORTED_EVENT', message: `不支持的事件类型：${event}` },
    }, 400)
  }

  return c.json({
    success: true,
    data: { event, days, points: dailySeries(event, days) },
  })
})

// ═══════════════════════════════════════
// GET /events — 最近事件流水
// ═══════════════════════════════════════

route.get('/events', (c) => {
  const limit = Math.min(100, Math.max(1, Number(c.req.query('limit') || 20)))
  const events = recentEvents(limit).map(e => {
    let payload: Record<string, unknown> = {}
    try { payload = JSON.parse(e.payload || '{}') } catch { payload = {} }
    return { ...e, payload }
  })
  return c.json({ success: true, data: events })
})

export default route
