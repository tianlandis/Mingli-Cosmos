// ============================================================
// Phase 5 P5-2 — 请求追踪 + 分维度指标中间件（ADR-007）
// 文件：src/server/lib/trace.ts
// 职责：
//   1. 为每个请求贯穿 traceId（入口生成 / 上游透传，回写响应头）
//   2. 按 scope（admin / app / core）记录延迟直方图与状态码计数
//
// 口径说明：traceId 只做**进程内贯穿**（单实例部署，ADR-001）；
// 将来引入多实例时改为 W3C Trace Context（traceparent）即可，调用方无需改动。
// ============================================================

import { randomUUID } from 'node:crypto'
import type { Context, MiddlewareHandler, Next } from 'hono'
import { incCounter, observeHistogram, type MetricScope } from './metrics'

export const TRACE_HEADER = 'x-trace-id'

/** 注入 Context 的追踪上下文 */
export type TraceEnv = { Variables: { traceId: string } }

/** 生成短 traceId（时间前缀 + 随机，便于人工按时间粗筛） */
export function newTraceId(): string {
  const ts = Date.now().toString(36)
  return `${ts}-${randomUUID().slice(0, 8)}`
}

/**
 * 路径 → 观测维度
 * 关键：admin 与 app **分开统计**，用于回答「admin 是否拖慢 C 端」（REVIEW §R-3）
 */
export function scopeOfPath(path: string): MetricScope {
  if (path.startsWith('/api/v1/admin') || path.startsWith('/api/admin')) return 'admin'
  if (
    path.startsWith('/api/v1/app') ||
    path.startsWith('/api/chat') ||
    path.startsWith('/api/report')
  ) {
    return 'app'
  }
  if (path.startsWith('/api/')) return 'core'
  return 'other'
}

function statusClass(status: number): string {
  return `${Math.floor(status / 100)}xx`
}

/**
 * 追踪 + 指标中间件（全局注册，必须早于业务路由）
 */
export function observabilityMiddleware(): MiddlewareHandler<TraceEnv> {
  return async (c: Context<TraceEnv>, next: Next) => {
    const incoming = c.req.header(TRACE_HEADER)
    const traceId = incoming && /^[\w.-]{1,64}$/.test(incoming) ? incoming : newTraceId()

    c.set('traceId', traceId)
    // 提前写入，保证正常 / 异常响应都带上
    c.header('X-Trace-Id', traceId)

    const start = Date.now()
    const scope = scopeOfPath(c.req.path)
    const method = c.req.method

    try {
      await next()
    } finally {
      const duration = Date.now() - start
      const status = c.res?.status ?? 500

      incCounter(
        'mingli_http_requests_total',
        { scope, method, status: String(status), class: statusClass(status) },
        1,
        'HTTP 请求总数（按观测维度 / 方法 / 状态码）',
      )
      observeHistogram(
        'mingli_http_request_duration_ms',
        duration,
        { scope },
        'HTTP 请求耗时（毫秒，按观测维度）',
      )
      observeHistogram(
        'mingli_http_request_duration_ms_by_route',
        duration,
        { scope, method },
        'HTTP 请求耗时（毫秒，按维度与方法）',
      )
    }
  }
}

/** 从 Context 读取当前 traceId（业务代码落库 / 打日志用） */
export function currentTraceId(c: Context<TraceEnv>): string {
  return c.get('traceId') ?? '-'
}
