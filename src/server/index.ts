// ============================================================
// Hono 服务器入口 — Phase 2 AI 后端 → MVP 生产模式 → Phase 3 可观测性
// 文件：src/server/index.ts
// 职责：
//   - 开发模式：纯 API 服务 (port 3001)，前端由 Vite dev server 代理
//   - 生产模式：API + 静态文件服务 (port 3001)，自托管前后端
//   - 生产日志：结构化 JSON 日志 + 请求耗时追踪 (Phase 3 D-7)
// ============================================================

import 'dotenv/config'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { logger, requestLogger, configureLogger, rotateLogs, closeLogger } from './lib/logger'
import { initDb, closeDb } from './db'

const app = new Hono()

// ═══════════════════════════════════════
// 环境判定（--prod 标志 或 NODE_ENV=production）
// ═══════════════════════════════════════

const isProduction = process.argv.includes('--prod') || process.env.NODE_ENV === 'production'

// ═══════════════════════════════════════
// 日志系统初始化 (Phase 3 D-7)
// ═══════════════════════════════════════

const logEnabled = process.env.LOG_ENABLED !== 'false'
if (logEnabled) {
  configureLogger({
    level: (process.env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error') || (isProduction ? 'info' : 'debug'),
    logDir: process.env.LOG_DIR || join(process.cwd(), 'logs'),
  })
  if (isProduction) {
    rotateLogs(7) // 保留 7 天
  }
}

// 请求日志中间件（全局）
if (logEnabled) {
  app.use('*', requestLogger())
}

// ═══════════════════════════════════════
// 健康检查 (Phase 3 增强版：含运行指标)
// ═══════════════════════════════════════

const startTime = Date.now()

app.get('/api/health', (c) => {
  const uptime = Math.floor((Date.now() - startTime) / 1000)
  const mem = process.memoryUsage()
  const metrics = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime_seconds: uptime,
    memory_mb: Math.round(mem.heapUsed / 1024 / 1024 * 100) / 100,
    memory_total_mb: Math.round(mem.heapTotal / 1024 / 1024 * 100) / 100,
    node_version: process.version,
    env: isProduction ? 'production' : 'development',
  }
  logger.debug('health', '健康检查', { uptime, heapMB: metrics.memory_mb })
  return c.json(metrics)
})

// ═══════════════════════════════════════
// API 路由
// ═══════════════════════════════════════

import { reportRoute } from './api/report'
import { chatRoute } from './api/chat'
import { adminRoute } from './api/admin'

app.route('/', reportRoute)
app.route('/', chatRoute)
app.route('/api/admin', adminRoute)

// ═══════════════════════════════════════
// 生产模式：静态文件服务 + SPA 回退
// ═══════════════════════════════════════

if (isProduction) {
  const distDir = join(process.cwd(), 'dist')

  if (!existsSync(distDir)) {
    console.warn('[Server] ⚠ dist/ 不存在，请先执行 npm run build')
  }

  // 静态资源（JS / CSS / 图片 / 字体）
  app.use('/assets/*', serveStatic({ root: distDir }))

  // 管理后台静态文件
  app.use('/admin/assets/*', serveStatic({ root: distDir }))
  app.get('/admin', (c) => {
    try {
      const html = readFileSync(join(distDir, 'admin/index.html'), 'utf-8')
      return c.html(html)
    } catch {
      return c.json({ error: 'ADMIN_NOT_BUILT' }, 500)
    }
  })

  // Favicon
  app.get('/favicon.svg', serveStatic({ root: distDir }))

  // SPA 兜底：所有非 API 请求返回 index.html
  // ⚠️ HTML 必须 no-store：Vite 构建产物 JS/CSS 文件名含 content-hash，
  //    若浏览器缓存旧 HTML 会引用已不存在的旧 hash 文件，导致白屏或旧逻辑
  app.get('/*', (c) => {
    try {
      const html = readFileSync(join(distDir, 'index.html'), 'utf-8')
      c.header('Cache-Control', 'no-store, no-cache, must-revalidate')
      c.header('Pragma', 'no-cache')
      return c.html(html)
    } catch {
      return c.json(
        { error: 'FRONTEND_NOT_BUILT', message: '前端未构建。请先执行: npm run build' },
        500,
      )
    }
  })
}

// ═══════════════════════════════════════
// 全局错误处理（结构化日志）
// ═══════════════════════════════════════

app.onError((err, c) => {
  logger.error('server', '未捕获异常', err)
  return c.json(
    { error: 'INTERNAL_ERROR', message: '服务暂不可用，请稍后重试' },
    500,
  )
})

// ═══════════════════════════════════════
// 数据库初始化 (Phase 4A)
// ═══════════════════════════════════════

if (process.env.DB_ENABLED !== 'false') {
  initDb()
}

// ═══════════════════════════════════════
// 启动服务
// ═══════════════════════════════════════

const port = Number(process.env.SERVER_PORT) || 3001

serve({ fetch: app.fetch, port }, (info) => {
  logger.info('server', '服务器启动', {
    port: info.port,
    mode: isProduction ? 'production' : 'development',
    nodeVersion: process.version,
    logEnabled,
  })
  console.log(`[Server] Hono listening on http://localhost:${info.port}`)
  console.log(`[Server] Mode: ${isProduction ? 'production' : 'development'}`)
  console.log(`[Server] Health: http://localhost:${info.port}/api/health`)
  if (isProduction) {
    console.log(`[Server] Frontend: http://localhost:${info.port}`)
  }
})

// ═══════════════════════════════════════
// 优雅关闭
// ═══════════════════════════════════════

process.on('SIGTERM', () => {
  logger.info('server', '收到 SIGTERM，优雅关闭...')
  closeDb()
  closeLogger()
  process.exit(0)
})

process.on('SIGINT', () => {
  logger.info('server', '收到 SIGINT，优雅关闭...')
  closeDb()
  closeLogger()
  process.exit(0)
})
