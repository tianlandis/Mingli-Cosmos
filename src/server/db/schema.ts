// ============================================================
// Phase 4 — 数据库 Schema 定义 (Drizzle ORM + SQLite)
// 文件：src/server/db/schema.ts
// 表：api_keys / prompt_templates / prompt_versions / app_configs /
//      sessions / admin_sessions / audit_logs
// ============================================================

import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

// ═══════════════════════════════════════
// api_keys — 多厂商 API Key 加密存储
// ═══════════════════════════════════════

export const apiKeys = sqliteTable('api_keys', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  provider: text('provider').notNull(),           // 'openai' | 'deepseek' | 'claude' | 'siliconflow' | 'local'
  label: text('label').notNull(),                 // 显示名称，如 "SiliconFlow-DeepSeekV3"
  apiKey: text('api_key').notNull(),              // 加密存储的 API Key
  baseUrl: text('base_url'),                      // 自定义 API 端点
  model: text('model'),                           // 默认模型
  temperature: real('temperature').default(0.7),
  maxTokens: integer('max_tokens').default(2048),
  isActive: integer('is_active').default(1),      // 0=禁用, 1=启用
  sortOrder: integer('sort_order').default(0),
  // [Phase 4 NEW] Skills/Tools 扩展字段
  supportedTools: text('supported_tools').default('[]'),  // JSON: ["solar_term_calc","calendar_lookup"]
  testedAt: text('tested_at'),                             // 最后测试时间 ISO
  testStatus: text('test_status').default('untested'),     // 'untested' | 'ok' | 'failed'
  testLatency: integer('test_latency'),                    // 测试延迟(ms)
  createdAt: text('created_at').default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').default(sql`(datetime('now'))`),
})

// ═══════════════════════════════════════
// prompt_templates — Prompt 模板管理
// ═══════════════════════════════════════

export const promptTemplates = sqliteTable('prompt_templates', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),          // 模板唯一名称，如 'anti-hallucination'
  displayName: text('display_name').notNull(),     // 显示名，如 "防幻觉指令"
  content: text('content').notNull(),              // Prompt 模板正文
  variables: text('variables').default('[]'),      // JSON 数组：['chart.dayMaster','annotation.patternName']
  version: integer('version').default(1),          // 版本号
  isActive: integer('is_active').default(1),
  // [Phase 4 NEW] 模板类别与防越权
  category: text('category').default('custom'),   // 'builtin' | 'custom'
  isBuiltin: integer('is_builtin').default(0),     // 0=用户创建, 1=系统内置（不可删除）
  description: text('description'),               // 模板用途说明
  createdAt: text('created_at').default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').default(sql`(datetime('now'))`),
})

// ═══════════════════════════════════════
// prompt_versions [Phase 4 NEW] — 版本历史
// ═══════════════════════════════════════

export const promptVersions = sqliteTable('prompt_versions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  promptId: integer('prompt_id').notNull()
    .references(() => promptTemplates.id, { onDelete: 'cascade' }),
  version: integer('version').notNull(),
  content: text('content').notNull(),
  changeNote: text('change_note'),
  createdBy: text('created_by').default('admin'),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
})

// ═══════════════════════════════════════
// app_configs — 全局 Key-Value 配置
// ═══════════════════════════════════════

export const appConfigs = sqliteTable('app_configs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  key: text('key').notNull().unique(),            // 配置键，如 'default_llm_provider'
  value: text('value').notNull(),                 // JSON 值
  displayName: text('display_name'),              // 显示名
  description: text('description'),
  // [Phase 4 NEW] 值类型标记与分类
  valueType: text('value_type').default('string'), // 'string' | 'json' | 'number' | 'boolean'
  category: text('category').default('general'),   // 'general' | 'llm' | 'security' | 'ui'
  updatedAt: text('updated_at').default(sql`(datetime('now'))`),
})

// ═══════════════════════════════════════
// sessions — 用户会话持久化
// ═══════════════════════════════════════

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),                    // UUID
  chart: text('chart').notNull(),                 // JSON: BaZiResult
  annotation: text('annotation').notNull(),       // JSON: AnnotationResult
  messageCount: integer('message_count').default(0),
  lastActive: text('last_active').default(sql`(datetime('now'))`),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
})

// ═══════════════════════════════════════
// admin_sessions [Phase 4 NEW] — 管理员会话
// ═══════════════════════════════════════

export const adminSessions = sqliteTable('admin_sessions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  tokenJti: text('token_jti').notNull().unique(), // JWT jti
  username: text('username').notNull(),
  ip: text('ip'),
  userAgent: text('user_agent'),
  isActive: integer('is_active').default(1),
  expiresAt: text('expires_at').notNull(),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
  logoutAt: text('logout_at'),
})

// ═══════════════════════════════════════
// audit_logs — 管理后台操作审计
// ═══════════════════════════════════════

export const auditLogs = sqliteTable('audit_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  action: text('action').notNull(),               // 'create' | 'update' | 'delete'
  resource: text('resource').notNull(),           // 'api_key' | 'prompt' | 'config'
  resourceId: integer('resource_id'),             // 被操作的记录 ID
  detail: text('detail'),                         // 变更详情 JSON
  operator: text('operator').default('admin'),    // 操作者
  ip: text('ip'),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
})
