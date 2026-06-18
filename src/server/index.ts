// ============================================================
// Hono 服务器入口 — Phase 4 模块化底座
// 文件：src/server/index.ts
// 职责：
//   - 使用 core/app.ts 创建模块化应用
//   - 开发模式：纯 API 服务 (port 3001)，前端由 Vite dev server 代理
//   - 生产模式：API + 静态文件服务 (port 3001)，自托管前后端
// ============================================================

import 'dotenv/config'
import { serve } from '@hono/node-server'
import { createApp } from './core/app'
import { initDb, closeDb } from './db'
import { logger, closeLogger } from './lib/logger'

// ═══════════════════════════════════════
// 环境判定
// ═══════════════════════════════════════

const isProduction = process.argv.includes('--prod') || process.env.NODE_ENV === 'production'
const logEnabled = process.env.LOG_ENABLED !== 'false'

// ═══════════════════════════════════════
// 数据库初始化
// ═══════════════════════════════════════

if (process.env.DB_ENABLED !== 'false') {
  initDb()
}

// ═══════════════════════════════════════
// 创建应用 & 启动
// ═══════════════════════════════════════

const port = Number(process.env.SERVER_PORT) || 3001

createApp({ isProduction, logEnabled }).then((app) => {
  serve({ fetch: app.fetch, port }, (info) => {
    const mode = isProduction ? 'production' : 'development'
    logger.info('server', '服务器启动', {
      port: info.port,
      mode,
      nodeVersion: process.version,
      logEnabled,
    })
    console.log(`[Server] Hono listening on http://localhost:${info.port}`)
    console.log(`[Server] Mode: ${mode}`)
    console.log(`[Server] Health:   http://localhost:${info.port}/api/health`)
    console.log(`[Server] Admin V1: http://localhost:${info.port}/api/v1/admin/*`)
    console.log(`[Server] Admin V0: http://localhost:${info.port}/api/admin/*  (DEPRECATED)`)
    if (isProduction) {
      console.log(`[Server] Frontend: http://localhost:${info.port}`)
    }
  })
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
