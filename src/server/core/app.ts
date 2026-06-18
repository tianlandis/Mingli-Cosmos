// ============================================================
// Phase 4 — Hono 应用工厂（核心底座）
// 文件：src/server/core/app.ts
// 职责：组装全局中间件 + 注册 v1 API 路由 + 健康检查 + 静态服务
// ============================================================

import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { Hono } from 'hono'
import { serveStatic } from '@hono/node-server/serve-static'
import { createAdminRouter } from './router'
import {
  configureLogger,
  requestLogger,
  logger,
  rotateLogs,
} from '../lib/logger'

export interface AppOptions {
  isProduction: boolean
  logEnabled: boolean
}

/**
 * 创建并配置 Hono 应用实例
 */
export async function createApp(options: AppOptions): Promise<Hono> {
  const app = new Hono()
  const { isProduction, logEnabled } = options

  // ═══════════════════════════════════════
  // 日志中间件
  // ═══════════════════════════════════════
  if (logEnabled) {
    configureLogger({
      level: (process.env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error') ||
             (isProduction ? 'info' : 'debug'),
      logDir: process.env.LOG_DIR || join(process.cwd(), 'logs'),
    })
    if (isProduction) rotateLogs(7)
    app.use('*', requestLogger())
  }

  // ═══════════════════════════════════════
  // 健康检查（含运行指标）
  // ═══════════════════════════════════════
  const startTime = Date.now()
  app.get('/api/health', (c) => {
    const uptime = Math.floor((Date.now() - startTime) / 1000)
    const mem = process.memoryUsage()
    return c.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime_seconds: uptime,
      memory_mb: Math.round(mem.heapUsed / 1024 / 1024 * 100) / 100,
      memory_total_mb: Math.round(mem.heapTotal / 1024 / 1024 * 100) / 100,
      node_version: process.version,
      env: isProduction ? 'production' : 'development',
    })
  })

  // ═══════════════════════════════════════
  // [兼容] 旧路由 @deprecated — 30天过渡
  // 在 /api/admin/* 上注入 deprecation 头
  // ═══════════════════════════════════════
  const { deprecationMiddleware, versionHeaderMiddleware } = await import('../api/admin-compat')
  app.use('/api/admin/*', deprecationMiddleware)
  const { adminRoute } = await import('../api/admin')
  app.route('/api/admin', adminRoute)

  // ═══════════════════════════════════════
  // API v1 管理路由（自动扫描 modules/）— 主力路由
  // ═══════════════════════════════════════
  app.use('/api/v1/admin/*', versionHeaderMiddleware)
  const adminRouterV1 = await createAdminRouter()
  app.route('/api/v1/admin', adminRouterV1)

  // ═══════════════════════════════════════
  // 核心业务 API 路由（不受版本化影响）
  // ═══════════════════════════════════════
  const { reportRoute } = await import('../api/report')
  const { chatRoute } = await import('../api/chat')
  app.route('/', reportRoute)
  app.route('/', chatRoute)

  // ═══════════════════════════════════════
  // 生产模式：静态文件服务 + SPA 回退
  // ═══════════════════════════════════════
  if (isProduction) {
    const distDir = join(process.cwd(), 'dist')

    if (!existsSync(distDir)) {
      console.warn('[Server] ⚠ dist/ 不存在，请先执行 npm run build')
    }

    // 静态资源
    app.use('/assets/*', serveStatic({ root: distDir }))
    app.use('/admin/assets/*', serveStatic({ root: distDir }))

    // 管理后台 HTML
    app.get('/admin', (c) => {
      try {
        return c.html(readFileSync(join(distDir, 'admin/index.html'), 'utf-8'))
      } catch {
        return c.json({ success: false, error: { code: 'ADMIN_NOT_BUILT', message: '管理后台未构建' } }, 500)
      }
    })

    // Favicon
    app.get('/favicon.svg', serveStatic({ root: distDir }))

    // SPA 兜底（非 API 请求 → index.html）
    app.get('/*', (c) => {
      try {
        const html = readFileSync(join(distDir, 'index.html'), 'utf-8')
        c.header('Cache-Control', 'no-store, no-cache, must-revalidate')
        c.header('Pragma', 'no-cache')
        return c.html(html)
      } catch {
        return c.json(
          { success: false, error: { code: 'FRONTEND_NOT_BUILT', message: '前端未构建。请先执行: npm run build' } },
          500,
        )
      }
    })
  }

  // ═══════════════════════════════════════
  // 全局错误处理
  // ═══════════════════════════════════════
  app.onError((err, c) => {
    // 输出完整错误栈到 console + 结构化日志
    console.error('[Server] 未捕获异常:', err instanceof Error ? err.message : String(err))
    if (err instanceof Error && err.stack) {
      console.error(err.stack)
    }
    logger.error('server', '未捕获异常', err instanceof Error ? err : String(err))
    return c.json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: '服务暂不可用，请稍后重试' },
    }, 500)
  })

  return app
}
