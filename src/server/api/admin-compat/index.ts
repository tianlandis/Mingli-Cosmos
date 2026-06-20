// ============================================================
// Phase 4.7 — 旧路由兼容层（@deprecated，增强版）
// 文件：src/server/api/admin-compat/index.ts
// 职责：为 /api/admin/* 旧路由注入 Deprecation/Sunset 响应头
//       过渡期 30 天，2026-07-19 后移除
//       确立 /api/v1/admin/* 为系统绝对主力路由
// ============================================================

import type { Context, Next } from 'hono'

const SUNSET_DATE = 'Sat, 19 Jul 2026 00:00:00 GMT'
const API_VERSION = '1'

/**
 * 旧路由兼容中间件
 * - 注入 Deprecation / Sunset / Link 响应头
 * - 注入 X-API-Version 标记
 * - 记录弃用警告日志
 */
export async function deprecationMiddleware(c: Context, next: Next) {
  // 注入弃用警告头
  c.header('Deprecation', 'true')
  c.header('Sunset', SUNSET_DATE)
  c.header(
    'Link',
    '</api/v1/admin>; rel="alternate"; type="application/json",' +
    '</docs/api-migration>; rel="help"',
  )

  // 标记当前 API 版本
  c.header('X-API-Version', API_VERSION)
  c.header('X-Deprecated-API', 'true')

  // 记录弃用日志
  console.warn(
    `[Deprecated] ${c.req.method} ${c.req.path} — 旧路由调用，将在 ${SUNSET_DATE} 移除。` +
    `请迁移至 /api/v1/admin/*`,
  )

  await next()

  // 在响应后也追加头（确保即使后续中间件设置了其他头，这些也保留）
  c.header('X-Deprecated-API', 'true')
}

/**
 * 新路由版本标记中间件
 * 用于 /api/v1/admin/* 路由，标记当前 API 版本
 */
export async function versionHeaderMiddleware(c: Context, next: Next) {
  c.header('X-API-Version', API_VERSION)
  c.header('X-API-Deprecated', 'false')
  await next()
}
