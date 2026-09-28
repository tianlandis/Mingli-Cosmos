// ============================================================
// Phase 4b M-8 — 运营埋点 Repository
// 文件：src/server/db/repositories/analytics.ts
// 职责：事件写入 + 看板聚合（趋势 / 计数 / 活跃用户）
// ============================================================

import { getDb, schema } from '../index'
import { eq, and, sql, gte, desc } from 'drizzle-orm'

const { analyticsEvents } = schema

export type AnalyticsEventRow = typeof analyticsEvents.$inferSelect

/** 埋点事件白名单（防止任意字符串污染看板） */
export const TRACKABLE_EVENTS = [
  'page_view',
  'register',
  'login',
  'paipan',       // 排盘
  'chat',         // AI 对话
  'report_view',  // 命书查看
  'order_create',
  'order_pay',
  'share',
] as const

export type TrackableEvent = typeof TRACKABLE_EVENTS[number]

export function isTrackableEvent(v: string): v is TrackableEvent {
  return (TRACKABLE_EVENTS as readonly string[]).includes(v)
}

// ═══════════════════════════════════════
// 写入
// ═══════════════════════════════════════

export interface TrackInput {
  event: string
  userId?: number | null
  sessionId?: string | null
  payload?: Record<string, unknown>
  ip?: string | null
  userAgent?: string | null
}

export function trackEvent(input: TrackInput): AnalyticsEventRow {
  return getDb().insert(analyticsEvents).values({
    event: input.event,
    userId: input.userId ?? null,
    sessionId: input.sessionId ?? null,
    payload: JSON.stringify(input.payload ?? {}),
    ip: input.ip ?? null,
    userAgent: input.userAgent ?? null,
    createdAt: new Date().toISOString(),
  }).returning().get()
}

// ═══════════════════════════════════════
// 聚合
// ═══════════════════════════════════════

export function countEvents(event: string, sinceIso?: string): number {
  const where = sinceIso
    ? and(eq(analyticsEvents.event, event), gte(analyticsEvents.createdAt, sinceIso))
    : eq(analyticsEvents.event, event)

  return getDb().select({ count: sql<number>`count(*)` })
    .from(analyticsEvents)
    .where(where)
    .get()?.count ?? 0
}

export function countAllEvents(): number {
  return getDb().select({ count: sql<number>`count(*)` })
    .from(analyticsEvents)
    .get()?.count ?? 0
}

export interface DailyPoint {
  date: string   // YYYY-MM-DD
  count: number
}

/**
 * 指定事件的近 N 天日粒度趋势（含 0 值补全）
 * 注意：createdAt 存的是 ISO 字符串，substr(1,10) 取日期部分
 */
export function dailySeries(event: string, days = 7): DailyPoint[] {
  const since = new Date(Date.now() - (days - 1) * 86_400_000)
  const sinceIso = since.toISOString()

  const rows = getDb().select({
    date: sql<string>`substr(${analyticsEvents.createdAt}, 1, 10)`,
    count: sql<number>`count(*)`,
  })
    .from(analyticsEvents)
    .where(and(eq(analyticsEvents.event, event), gte(analyticsEvents.createdAt, sinceIso)))
    .groupBy(sql`substr(${analyticsEvents.createdAt}, 1, 10)`)
    .all()

  const map = new Map<string, number>()
  for (const r of rows) map.set(r.date, r.count)

  const points: DailyPoint[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86_400_000)
      .toISOString()
      .slice(0, 10)
    points.push({ date: d, count: map.get(d) ?? 0 })
  }
  return points
}

/** 近 N 天有行为的去重用户数（匿名会话不计） */
export function activeUserCount(days = 7): number {
  const sinceIso = new Date(Date.now() - days * 86_400_000).toISOString()
  return getDb().select({
    count: sql<number>`count(distinct ${analyticsEvents.userId})`,
  })
    .from(analyticsEvents)
    .where(
      and(
        gte(analyticsEvents.createdAt, sinceIso),
        sql`${analyticsEvents.userId} is not null`,
      ),
    )
    .get()?.count ?? 0
}

/** 按事件类型统计总量（看板「事件分布」） */
export function eventBreakdown(): Array<{ event: string; count: number }> {
  return getDb().select({
    event: analyticsEvents.event,
    count: sql<number>`count(*)`,
  })
    .from(analyticsEvents)
    .groupBy(analyticsEvents.event)
    .orderBy(desc(sql`count(*)`))
    .all()
}

/** 最近 N 条事件（后台实时流水） */
export function recentEvents(limit = 20): AnalyticsEventRow[] {
  return getDb().select().from(analyticsEvents)
    .orderBy(desc(analyticsEvents.id))
    .limit(limit)
    .all()
}

/** [P5-6 ADR-006] 某用户的事件流水（数据导出用） */
export function listEventsByUser(userId: number, limit = 500): AnalyticsEventRow[] {
  return getDb().select().from(analyticsEvents)
    .where(eq(analyticsEvents.userId, userId))
    .orderBy(desc(analyticsEvents.id))
    .limit(limit)
    .all()
}

/** [P5-6 ADR-006] 匿名化某用户的埋点（保留统计价值，抹除身份关联） */
export function anonymizeEventsByUser(userId: number): number {
  const res = getDb().update(analyticsEvents)
    .set({ userId: null, ip: null, userAgent: null })
    .where(eq(analyticsEvents.userId, userId))
    .run()
  return res.changes
}
