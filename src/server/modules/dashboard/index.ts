// ============================================================
// Phase 4 — Modules: Dashboard 路由
// 文件：src/server/modules/dashboard/index.ts
// 路由：GET /api/v1/admin/dashboard/stats
// 返回：系统运行时长 / 内存占用 / SQLite 连接状态 / 审计日志统计
// ============================================================

import { Hono } from 'hono'
import { authMiddleware } from '../../core/middleware/auth'
import { getDb, schema } from '../../db'
import { desc, eq, sql } from 'drizzle-orm'

const { auditLogs, adminSessions } = schema

export const route = new Hono()
route.use('*', authMiddleware)

// 系统启动时间（进程级单例）
const SERVER_START_TIME = Date.now()

/**
 * 格式化 uptime 为人类可读字符串
 */
function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  const parts: string[] = []
  if (d > 0) parts.push(`${d}天`)
  if (h > 0) parts.push(`${h}时`)
  if (m > 0) parts.push(`${m}分`)
  if (parts.length === 0) parts.push(`${s}秒`)
  return parts.join(' ')
}

/**
 * GET /api/v1/admin/dashboard/stats
 *
 * 返回：
 *   uptimeSeconds    — 进程连续运行秒数
 *   uptimeHuman      — 中文友好格式
 *   memory            — process.memoryUsage() 快照 { heapUsed, heapTotal, external, rss } 均为 Bytes
 *   memoryPercent     — heapUsed / heapTotal 百分比
 *   dbType            — 数据库类型
 *   dbStatus          — SQLite 连接状态
 *   dbSizeBytes       — SQLite 文件大小
 *   auditCount        — 审计日志总数
 *   auditToday        — 今日审计条数
 *   activeSessions    — 当前活跃管理会话数
 *   nodeVersion       — Node.js 版本
 *   pid               — 进程 PID
 *   timestamp         — 当前服务器时间 ISO
 */
route.get('/stats', (c) => {
  const uptimeSeconds = Math.floor((Date.now() - SERVER_START_TIME) / 1000)
  const mem = process.memoryUsage()
  const heapPercent = Math.round((mem.heapUsed / mem.heapTotal) * 10000) / 100

  // ── SQLite 连接状态 ──
  let dbStatus: 'connected' | 'disconnected' | 'unavailable' = 'unavailable'
  let dbSizeBytes = 0
  let auditCount = 0
  let auditToday = 0
  let activeSessions = 0

  try {
    const db = getDb()

    // 连接测试：执行一条简单查询
    const row = db.get<{ one: number }>(
      sql`SELECT 1 AS one`.as('test'),
    )
    dbStatus = row ? 'connected' : 'disconnected'

    // 数据库文件大小
    try {
      const page = db.get<{ page_count: number; page_size: number }>(
        sql`PRAGMA page_count`.as('pc'),
      ) as any
      const size = db.get<{ page_size: number }>(
        sql`PRAGMA page_size`.as('ps'),
      ) as any
      if (page && size) {
        dbSizeBytes = Number(page.page_count) * Number(size.page_size)
      }
    } catch { /* PRAGMA 失败，忽略 */ }

    // 审计日志统计
    auditCount = db.select({ count: sql<number>`count(*)` })
      .from(auditLogs)
      .get()
      ?.count ?? 0

    auditToday = db.select({ count: sql<number>`count(*)` })
      .from(auditLogs)
      .where(
        sql`date(${auditLogs.createdAt}) = date('now')`
      )
      .get()
      ?.count ?? 0

    // 活跃会话数
    activeSessions = db.select({ count: sql<number>`count(*)` })
      .from(adminSessions)
      .where(eq(adminSessions.isActive, 1))
      .get()
      ?.count ?? 0
  } catch {
    dbStatus = 'disconnected'
  }

  return c.json({
    success: true,
    data: {
      uptimeSeconds,
      uptimeHuman: formatUptime(uptimeSeconds),
      serverStartTime: new Date(SERVER_START_TIME).toISOString(),
      memory: {
        heapUsed: mem.heapUsed,
        heapTotal: mem.heapTotal,
        external: mem.external,
        rss: mem.rss,
        heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024 * 100) / 100,
        heapTotalMb: Math.round(mem.heapTotal / 1024 / 1024 * 100) / 100,
        rssMb: Math.round(mem.rss / 1024 / 1024 * 100) / 100,
      },
      memoryPercent: heapPercent,
      dbType: 'SQLite (better-sqlite3)',
      dbStatus,
      dbSizeBytes,
      dbSizeMb: Math.round(dbSizeBytes / 1024 / 1024 * 100) / 100,
      auditCount,
      auditToday,
      activeSessions,
      nodeVersion: process.version,
      pid: process.pid,
      timestamp: new Date().toISOString(),
    },
  })
})

export default route
