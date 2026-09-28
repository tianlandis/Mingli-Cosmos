// ============================================================
// Phase 4 — 操作审计中间件
// 文件：src/server/core/middleware/audit.ts
// ============================================================

import type { Context, Next } from 'hono'
import { getDb, schema } from '../../db'

const { auditLogs } = schema

/** 审计动作全集（新增动作时同步扩展此联合类型） */
export type AuditAction =
  | 'create' | 'update' | 'delete'
  | 'login' | 'logout'
  | 'export' | 'import' | 'migrate'
  | 'debug' | 'rollback'
  | 'fetch_models' | 'update_tools' | 'update_tool_calling'

/** 后台管理上下文变量 */
export interface AdminUserPayload {
  username: string
  jti: string
  exp: number
}

/**
 * 后台管理路由统一 Env（authMiddleware 注入 adminUser）
 * 各 admin 模块路由应声明为 `new Hono<AdminEnv>()`，
 * 以使其 Context 变量类型与 logAudit / authMiddleware 匹配。
 */
export type AdminEnv = { Variables: { adminUser?: AdminUserPayload } }

interface AuditEntry {
  action: AuditAction
  resource: string
  resourceId?: number
  detail?: string
}

/**
 * 记录审计日志（可在路由中直接调用）
 */
export function logAudit(c: Context<AdminEnv>, entry: AuditEntry) {
  try {
    const operator = c.get('adminUser')?.username || 'admin'
    const ip = c.req.header('x-forwarded-for') ||
               c.req.header('x-real-ip') ||
               '127.0.0.1'

    getDb().insert(auditLogs).values({
      action: entry.action,
      resource: entry.resource,
      resourceId: entry.resourceId ?? null,
      detail: entry.detail ?? null,
      operator,
      ip,
    }).run()
  } catch (e) {
    console.warn('[Audit] 写入审计日志失败:', e)
  }
}

/**
 * 审计中间件工厂（按 resource 自动记录）
 * 用法：router.use('/config', auditMiddleware('config'))
 */
export function auditMiddleware(resource: string) {
  return async (c: Context, next: Next) => {
    const method = c.req.method
    await next()

    // 只记录写操作
    let action: AuditEntry['action'] | null = null
    if (method === 'POST') action = 'create'
    else if (method === 'PUT' || method === 'PATCH') action = 'update'
    else if (method === 'DELETE') action = 'delete'

    if (action) {
      logAudit(c, { action, resource })
    }
  }
}
