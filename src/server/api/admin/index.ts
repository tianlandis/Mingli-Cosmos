// ============================================================
// Phase 4C — 管理后台 API 路由注册
// 文件：src/server/api/admin/index.ts
// ============================================================

import { Hono } from 'hono'
import { authRoute } from './auth'
import { configRoute } from './config'
import { promptRoute } from './prompts'
import { auditRoute } from './audit'

export const adminRoute = new Hono()

// 路由前缀 /api/admin
adminRoute.route('/', authRoute)
adminRoute.route('/', configRoute)
adminRoute.route('/', promptRoute)
adminRoute.route('/', auditRoute)
