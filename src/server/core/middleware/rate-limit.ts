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
const DEFAULT_IP_MAX = 5
const DEFAULT_USER_MAX = 10
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

/**
 * 登录路由中间件：全局并发保护 + IP 维度预检
 *
 * ⚠️ 语义（2026-09-28 修正）：本中间件**不计数**。
 * 计数只在登录失败时由路由显式调用 `recordLoginFailure()` 累加，
 * 登录成功时调用 `clearLoginAttempts()` 清零。
 * 旧实现「每次请求都计数」会导致正常多设备/多次登录 5 次即被锁 15 分钟。
 */
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
      // IP 维度预检（只读，不计数）
      const ip = extractClientIP(c)
      const ipWindowMs = cfg.ipWindowSec * 1000
      const ipCheck = peek(ipStore, ip, cfg.ipMaxAttempts, ipWindowMs)
      if (!ipCheck.allowed) {
        const retryAfter = Math.ceil(ipCheck.retryAfterMs / 1000 / 60)
        c.header('Retry-After', String(retryAfter * 60))
        return c.json({
          success: false,
          error: {
            code: 'RATE_LIMITED',
            message: `登录尝试过于频繁，请 ${Math.max(1, retryAfter)} 分钟后重试`,
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

/**
 * 只检查不计数：窗口内失败次数是否已达上限
 * （计数只在「登录失败」时发生，见 recordFailure）
 */
function peek(
  store: Map<string, AttemptRecord>,
  key: string,
  maxAttempts: number,
  windowMs: number,
): CheckRateResult {
  const now = Date.now()
  const record = store.get(key)
  if (!record) return { allowed: true, retryAfterMs: 0 }

  // 清理过期
  record.timestamps = record.timestamps.filter(t => now - t < windowMs)
  if (record.timestamps.length === 0) {
    store.delete(key)
    return { allowed: true, retryAfterMs: 0 }
  }

  if (record.timestamps.length >= maxAttempts) {
    return { allowed: false, retryAfterMs: Math.max(0, record.timestamps[0] + windowMs - now) }
  }
  return { allowed: true, retryAfterMs: 0 }
}

function recordFailure(
  store: Map<string, AttemptRecord>,
  key: string,
  windowMs: number,
): void {
  const now = Date.now()
  let record = store.get(key)
  if (!record) {
    record = { timestamps: [], earliestTime: now }
    store.set(key, record)
  }
  record.timestamps = record.timestamps.filter(t => now - t < windowMs)
  record.timestamps.push(now)
  record.earliestTime = record.timestamps[0]
}

function clearAttempts(store: Map<string, AttemptRecord>, key: string): void {
  store.delete(key)
}

// ═══════════════════════════════════════
// IP 维度（默认 5 次失败 / 15 分钟）
// ═══════════════════════════════════════

export function isIpBlocked(ip: string): CheckRateResult {
  return peek(ipStore, ip, DEFAULT_IP_MAX, DEFAULT_IP_WINDOW_MS)
}

export function recordIpFailure(ip: string): void {
  recordFailure(ipStore, ip, DEFAULT_IP_WINDOW_MS)
}

export function clearIpAttempts(ip: string): void {
  clearAttempts(ipStore, ip)
}

// ═══════════════════════════════════════
// 账号维度（默认 10 次失败 / 1 小时）
// ═══════════════════════════════════════

/**
 * 按账号检查是否已被限流（不计数）
 * 兼容旧名 checkUserRate：语义已从「检查并计数」改为「仅检查」
 */
export function checkUserRate(
  username: string,
  maxAttempts = DEFAULT_USER_MAX,
  windowMs = DEFAULT_USER_WINDOW_MS,
): boolean {
  return peek(userStore, username, maxAttempts, windowMs).allowed
}

export function recordUserFailure(
  username: string,
  windowMs = DEFAULT_USER_WINDOW_MS,
): void {
  recordFailure(userStore, username, windowMs)
}

export function clearUserAttempts(username: string): void {
  clearAttempts(userStore, username)
}

/** 登录成功：清空该 IP + 账号的失败计数（避免正常多设备登录被误锁） */
export function clearLoginAttempts(ip: string, username?: string): void {
  clearIpAttempts(ip)
  if (username) clearUserAttempts(username)
}

/** 登录失败：同时记录 IP 与账号两个维度 */
export function recordLoginFailure(ip: string, username?: string): void {
  recordIpFailure(ip)
  if (username) recordUserFailure(username)
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
