// ============================================================
// Phase 4 — Modules: Audit 审计日志路由
// 文件：src/server/modules/audit/index.ts
// 路由：GET /api/v1/admin/audit
// ============================================================

import { Hono } from 'hono'
import { authMiddleware } from '../../core/middleware/auth'
import { listAuditLogs } from '../../db'

export const route = new Hono()
route.use('*', authMiddleware)

route.get('/', (c) => {
  const logs = listAuditLogs(50)
  return c.json({ success: true, data: logs })
})

export default route
