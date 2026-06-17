// ============================================================
// Hono 服务器入口 — Phase 2 AI 后端 → MVP 生产模式
// 文件：src/server/index.ts
// 职责：
//   - 开发模式：纯 API 服务 (port 3001)，前端由 Vite dev server 代理
//   - 生产模式：API + 静态文件服务 (port 3001)，自托管前后端
// ============================================================

import 'dotenv/config'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'

const app = new Hono()

// ═══════════════════════════════════════
// 环境判定（--prod 标志 或 NODE_ENV=production）
// ═══════════════════════════════════════

const isProduction = process.argv.includes('--prod') || process.env.NODE_ENV === 'production'

// ═══════════════════════════════════════
// 健康检查
// ═══════════════════════════════════════

app.get('/api/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// ═══════════════════════════════════════
// API 路由
// ═══════════════════════════════════════

import { reportRoute } from './api/report'
import { chatRoute } from './api/chat'

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

  // 静态资源（JS / CSS / 图片 / 字体）
  app.use('/assets/*', serveStatic({ root: distDir }))

  // Favicon
  app.get('/favicon.svg', serveStatic({ root: distDir }))

  // SPA 兜底：所有非 API 请求返回 index.html
  app.get('/*', (c) => {
    try {
      const html = readFileSync(join(distDir, 'index.html'), 'utf-8')
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
// 全局错误处理
// ═══════════════════════════════════════

app.onError((err, c) => {
  console.error('[API Error]', err.message)
  return c.json(
    { error: 'INTERNAL_ERROR', message: '服务暂不可用，请稍后重试' },
    500,
  )
})

// ═══════════════════════════════════════
// 启动服务
// ═══════════════════════════════════════

const port = Number(process.env.SERVER_PORT) || 3001

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`[Server] Hono listening on http://localhost:${info.port}`)
  console.log(`[Server] Mode: ${isProduction ? 'production' : 'development'}`)
  console.log(`[Server] Health: http://localhost:${info.port}/api/health`)
  if (isProduction) {
    console.log(`[Server] Frontend: http://localhost:${info.port}`)
  }
})
