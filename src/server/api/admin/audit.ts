// ============================================================
// @deprecated — Phase 4 旧审计路由，30天过渡期 (2026-07-19 移除)
// 请使用 /api/v1/admin/audit
// 文件：src/server/api/admin/audit.ts
// ============================================================

import { Hono } from 'hono'
import { authMiddleware } from './auth'
import { listAuditLogs } from '../../db'

export const auditRoute = new Hono()
auditRoute.use('*', authMiddleware)

auditRoute.get('/audit', (c) => {
  const logs = listAuditLogs(50)
  return c.json({ logs })
})
