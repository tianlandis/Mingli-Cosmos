// ============================================================
// @deprecated — Phase 4 旧路由，30天过渡期 (2026-07-19 移除)
// 请使用 /api/v1/admin/* 新路由
// 文件：src/server/api/admin/index.ts
// ============================================================

import { Hono } from 'hono'
import { authRoute } from './auth'
import { configRoute } from './config'
import { promptRoute } from './prompts'
import { auditRoute } from './audit'

/** @deprecated 使用 /api/v1/admin/* */
export const adminRoute = new Hono()

// 路由前缀 /api/admin（旧）
adminRoute.route('/', authRoute)
adminRoute.route('/', configRoute)
adminRoute.route('/', promptRoute)
adminRoute.route('/', auditRoute)
