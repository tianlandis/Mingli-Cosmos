// ============================================================
// Phase 4.6 — 登录限流中间件（内存滑动窗口，增强版）
// 文件：src/server/core/middleware/rate-limit.ts
// ============================================================

import type { Context, Next } from 'hono'
import { z } from 'zod'

// ═══════════════════════════════════════
// 限流配置 Zod Schema
// ═══════════════════════════════════════

export const rateLimitConfigSchema = z.object({
  /** 同一 IP：N 次/窗口 */
  ipMaxAttempts: z.number().int().positive().default(5),
  /** 同一 IP 窗口(秒) */
  ipWindowSec: z.number().int().positive().default(900), // 15 分钟
  /** 同一用户名：N 次/窗口 */
  userMaxAttempts: z.number().int().positive().default(10),
  /** 同一用户名窗口(秒) */
  userWindowSec: z.number().int().positive().default(3600), // 1 小时
  /** 全局限流：并发请求上限 */
  globalMaxConcurrent: z.number().int().positive().default(20),
})

export type RateLimitConfig = z.infer<typeof rateLimitConfigSchema>

// ═══════════════════════════════════════
// IP 提取工具函数（统一提取逻辑）
// ═══════════════════════════════════════

/**
 * 从请求上下文中提取客户端真实 IP
 * 优先级：x-forwarded-for > x-real-ip > remote address
 */
export function extractClientIP(c: Context): string {
  const forwarded = c.req.header('x-forwarded-for')
  if (forwarded) {
    // x-forwarded-for 可能包含代理链，取第一个
    return forwarded.split(',')[0].trim()
  }
  return c.req.header('x-real-ip') || '127.0.0.1'
}

// ═══════════════════════════════════════
// 内存存储
// ═══════════════════════════════════════

interface AttemptRecord {
  timestamps: number[]  // Unix ms
  earliestTime: number  // 该窗口内最早的时间戳
}

const ipStore = new Map<string, AttemptRecord>()
const userStore = new Map<string, AttemptRecord>()
let activeRequests = 0

// 定期清理过期记录（每 5 分钟）
// 使用 schema 默认值：ipWindowSec=900s, userWindowSec=3600s
const DEFAULT_IP_WINDOW_MS = 900 * 1000
const DEFAULT_USER_WINDOW_MS = 3600 * 1000
const MAX_WINDOW_MS = Math.max(DEFAULT_IP_WINDOW_MS, DEFAULT_USER_WINDOW_MS)

setInterval(() => {
  const now = Date.now()

  for (const store of [ipStore, userStore]) {
    for (const [key, record] of store) {
      record.timestamps = record.timestamps.filter(t => now - t < MAX_WINDOW_MS)
      if (record.timestamps.length === 0) store.delete(key)
      else record.earliestTime = record.timestamps[0]
    }
  }
}, 300_000)

// ═══════════════════════════════════════
// 中间件工厂
// ═══════════════════════════════════════

export function loginRateLimit(config?: Partial<RateLimitConfig>) {
  const cfg = rateLimitConfigSchema.parse(config ?? {})

  return async (c: Context, next: Next) => {
    // 全局并发检查
    if (activeRequests >= cfg.globalMaxConcurrent) {
      c.header('Retry-After', '30')
      return c.json({
        success: false,
        error: { code: 'RATE_LIMITED', message: '服务繁忙，请稍后重试' },
      }, 429)
    }

    activeRequests++
    try {
      // IP 限流
      const ip = extractClientIP(c)
      const ipWindowMs = cfg.ipWindowSec * 1000
      if (!checkRate(ipStore, ip, cfg.ipMaxAttempts, ipWindowMs)) {
        const retryAfter = Math.ceil(ipWindowMs / 1000 / 60)
        c.header('Retry-After', String(retryAfter * 60))
        return c.json({
          success: false,
          error: {
            code: 'RATE_LIMITED',
            message: `登录尝试过于频繁，请 ${retryAfter} 分钟后重试`,
          },
        }, 429)
      }

      await next()
    } finally {
      activeRequests--
    }
  }
}

// ═══════════════════════════════════════
// 通用限流检查
// ═══════════════════════════════════════

interface CheckRateResult {
  allowed: boolean
  retryAfterMs: number  // 如果被限流，还需等待多少毫秒
}

function checkRateWithInfo(
  store: Map<string, AttemptRecord>,
  key: string,
  maxAttempts: number,
  windowMs: number,
): CheckRateResult {
  const now = Date.now()
  let record = store.get(key)

  if (!record) {
    store.set(key, { timestamps: [now], earliestTime: now })
    return { allowed: true, retryAfterMs: 0 }
  }

  // 清理过期
  record.timestamps = record.timestamps.filter(t => now - t < windowMs)

  if (record.timestamps.length >= maxAttempts) {
    // 计算还需等待的时间
    const retryAfterMs = record.timestamps[0] + windowMs - now
    return { allowed: false, retryAfterMs: Math.max(0, retryAfterMs) }
  }

  record.timestamps.push(now)
  record.earliestTime = record.timestamps[0]
  return { allowed: true, retryAfterMs: 0 }
}

function checkRate(
  store: Map<string, AttemptRecord>,
  key: string,
  maxAttempts: number,
  windowMs: number,
): boolean {
  return checkRateWithInfo(store, key, maxAttempts, windowMs).allowed
}

/**
 * 按用户名检查限流（在解析 body 后调用）
 */
export function checkUserRate(
  username: string,
  maxAttempts = 10,
  windowMs = 3600_000,
): boolean {
  return checkRate(userStore, username, maxAttempts, windowMs)
}

/**
 * 获取限流统计数据（用于仪表盘展示）
 */
export function getRateLimitStats() {
  return {
    ipTracked: ipStore.size,
    userTracked: userStore.size,
    activeRequests,
  }
}
