// ============================================================
// @deprecated — Phase 4 旧配置路由，30天过渡期 (2026-07-19 移除)
// 请使用 /api/v1/admin/config
// 文件：src/server/api/admin/config.ts
// ============================================================

import { Hono } from 'hono'
import { authMiddleware } from './auth'
import { setConfig, getConfigValue, listConfigs, deleteConfig } from '../../db'
import { reloadConfig, isUsingDbConfig } from '../../config'
import { createAuditLog } from '../../db'

interface SetConfigBody {
  key: string
  value: string
  displayName?: string
  description?: string
}

export const configRoute = new Hono()
configRoute.use('*', authMiddleware)

// 列出所有配置
configRoute.get('/config', (c) => {
  const configs = listConfigs()
  return c.json({ configs, usingDb: isUsingDbConfig() })
})

// 设置/更新配置
configRoute.post('/config', async (c) => {
  const body = await c.req.json() as SetConfigBody
  const result = setConfig(body.key, body.value, body.displayName, body.description)
  createAuditLog({ action: 'update', resource: 'config', detail: JSON.stringify(body) })
  return c.json(result)
})

// 删除配置
configRoute.delete('/config/:key', (c) => {
  const key = c.req.param('key')
  deleteConfig(key)
  createAuditLog({ action: 'delete', resource: 'config', detail: key })
  return c.json({ ok: true })
})

// 强制刷新配置
configRoute.post('/config/reload', (c) => {
  const config = reloadConfig()
  return c.json({ ok: true, source: config.source })
})
