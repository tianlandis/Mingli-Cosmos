// ============================================================
// Phase 4 — 数据库 Schema 定义 (Drizzle ORM + SQLite)
// 文件：src/server/db/schema.ts
// 表：api_keys / prompt_templates / prompt_versions / app_configs /
//      sessions / admin_sessions / knowledge_assets / audit_logs
//      [Phase 4b] users / user_sessions / plans / orders /
//                subscriptions / analytics_events
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
  isDefault: integer('is_default').default(0),     // 0=非默认, 1=全局默认供应商（唯一）
  sortOrder: integer('sort_order').default(0),
  // [Phase 4 NEW] Skills/Tools 扩展字段
  supportedTools: text('supported_tools').default('[]'),  // JSON: ["solar_term_calc","calendar_lookup"]
  tools: text('tools').default('[]'),                     // JSON: ["bazi_calculator","knowledge_dict_lookup","feishu_bot_notifier"] (Agent Tool Calling)
  topP: real('top_p'),                                    // Top P 核采样 (0~1)
  frequencyPenalty: real('frequency_penalty'),            // 频率惩罚 (-2~2)
  streamEnabled: integer('stream_enabled').default(1),    // 0=禁用, 1=启用 SSE 流式
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
// knowledge_assets [Phase 7 NEW] — 通用命理知识资产字典
// ═══════════════════════════════════════

export const knowledgeAssets = sqliteTable('knowledge_assets', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  category: text('category').notNull(),             // 'classics' | 'shensha' | 'personality' | 'bazi' | 'pattern'
  key: text('key').notNull(),                       // 唯一键名，如 'tianyi_gui_ren'、'INTJ'
  value: text('value').notNull(),                   // JSON 值（结构化数据）
  description: text('description'),                 // 中文说明
  sortOrder: integer('sort_order').default(0),
  version: integer('version').default(1),
  isActive: integer('is_active').default(1),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').default(sql`(datetime('now'))`),
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

// ═══════════════════════════════════════
// [Phase 4b M-6] users — C 端注册用户
// ═══════════════════════════════════════

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  username: text('username').notNull().unique(),   // 登录账号（3~32 字符）
  phone: text('phone'),                            // 手机号（可选，登录用）
  email: text('email'),                            // 邮箱（可选，登录用）
  passwordHash: text('password_hash').notNull(),   // bcrypt hash
  nickname: text('nickname'),                      // 昵称
  avatarUrl: text('avatar_url'),
  status: text('status').default('active').notNull(),   // 'active' | 'disabled'
  role: text('role').default('user').notNull(),           // 'user' | 'admin'
  vipLevel: text('vip_level').default('free').notNull(),  // 'free' | 'basic' | 'pro'
  vipExpiresAt: text('vip_expires_at'),            // ISO 时间
  quotaTotal: integer('quota_total').default(5).notNull(),  // 可用额度总量（AI 深度解读次数）
  quotaUsed: integer('quota_used').default(0).notNull(),      // 已用额度
  lastLoginAt: text('last_login_at'),
  lastLoginIp: text('last_login_ip'),
  registerIp: text('register_ip'),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').default(sql`(datetime('now'))`),
})

// ═══════════════════════════════════════
// [Phase 4b M-6] user_sessions — C 端登录会话
// ═══════════════════════════════════════

export const userSessions = sqliteTable('user_sessions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  tokenJti: text('token_jti').notNull().unique(),
  ip: text('ip'),
  userAgent: text('user_agent'),
  isActive: integer('is_active').default(1),
  expiresAt: text('expires_at').notNull(),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
  logoutAt: text('logout_at'),
})

// ═══════════════════════════════════════
// [Phase 4b M-7] plans — 订阅套餐
// ═══════════════════════════════════════

export const plans = sqliteTable('plans', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  code: text('code').notNull().unique(),           // 'monthly' | 'yearly' | ...
  name: text('name').notNull(),                    // 显示名
  priceCents: integer('price_cents').notNull(),           // 价格（分），避免浮点
  durationDays: integer('duration_days').notNull(),        // 订阅时长（天）
  quotaGrant: integer('quota_grant').default(0).notNull(), // 订阅期内赠送额度
  vipLevel: text('vip_level').default('basic').notNull(),  // 订阅后达到的等级
  features: text('features').default('[]'),        // JSON 字符串数组
  isActive: integer('is_active').default(1),
  sortOrder: integer('sort_order').default(0),
  description: text('description'),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').default(sql`(datetime('now'))`),
})

// ═══════════════════════════════════════
// [Phase 4b M-7] orders — 订单
// ═══════════════════════════════════════

export const orders = sqliteTable('orders', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  orderNo: text('order_no').notNull().unique(),    // 业务订单号 ML + 时间戳 + 随机
  userId: integer('user_id').notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  planId: integer('plan_id').references(() => plans.id, { onDelete: 'set null' }),
  planName: text('plan_name').notNull(),           // 下单时套餐名快照
  amountCents: integer('amount_cents').notNull(),         // 应付金额（分）
  status: text('status').default('pending').notNull(),      // 'pending' | 'paid' | 'cancelled' | 'refunded'
  payMethod: text('pay_method'),                   // 'mock' | 'wechat' | 'alipay'
  tradeNo: text('trade_no'),                       // 第三方流水号
  paidAt: text('paid_at'),
  refundedAt: text('refunded_at'),
  expiredAt: text('expired_at'),                   // 未支付订单自动关闭时间
  remark: text('remark'),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').default(sql`(datetime('now'))`),
})

// ═══════════════════════════════════════
// [Phase 4b M-7] subscriptions — 用户订阅
// ═══════════════════════════════════════

export const subscriptions = sqliteTable('subscriptions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  planId: integer('plan_id').references(() => plans.id, { onDelete: 'set null' }),
  orderId: integer('order_id').references(() => orders.id, { onDelete: 'set null' }),
  vipLevel: text('vip_level').notNull(),           // 订阅生效等级
  startsAt: text('starts_at').notNull(),
  endsAt: text('ends_at').notNull(),
  quotaGranted: integer('quota_granted').default(0).notNull(),
  status: text('status').default('active').notNull(),       // 'active' | 'expired' | 'cancelled'
  createdAt: text('created_at').default(sql`(datetime('now'))`),
})

// ═══════════════════════════════════════
// [Phase 4b M-8] analytics_events — 运营埋点事件
// ═══════════════════════════════════════

export const analyticsEvents = sqliteTable('analytics_events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  event: text('event').notNull(),                  // 'paipan' | 'chat' | 'login' | 'register' | 'page_view' | ...
  userId: integer('user_id'),                      // 未登录为 null
  sessionId: text('session_id'),                   // 匿名会话标识
  payload: text('payload').default('{}'),          // JSON 附加数据
  ip: text('ip'),
  userAgent: text('user_agent'),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
})
