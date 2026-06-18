// ============================================================
// Phase 4C — 管理后台：审计日志 API
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
