// ============================================================
// Phase 4 — Modules: Config Schema（module_settings Zod Schema）
// 文件：src/server/modules/config/schema.ts
// 职责：泛型功能开关的 Zod 验证 + app_configs 扩展
// ============================================================

import { z } from 'zod'

// ═══════════════════════════════════════
// 泛型功能开关 Schema（决策 8）
// ═══════════════════════════════════════

export const moduleSettingsSchema = z.object({
  features: z.object({
    /** C端用户管理 */      userManagement: z.boolean().default(false),
    /** 订单与充值 */        orderSystem:     z.boolean().default(false),
    /** 命理知识库 */        knowledgeBase:   z.boolean().default(false),
    /** AI 增强分析 */       aiEnhancement:   z.boolean().default(true),
    /** 自动生成报告 */      autoReport:      z.boolean().default(true),
    /** 对话历史导出 */      chatExport:      z.boolean().default(false),
    /** 批量排盘 */          batchChart:      z.boolean().default(false),
  }).prefault({}),

  limits: z.object({
    /** 单会话最大消息数 */  maxChatMessages:    z.number().int().positive().default(50),
    /** 每分钟 API 限流 */   rateLimitPerMinute: z.number().int().positive().default(10),
    /** 最大并发会话数 */    maxConcurrentSessions: z.number().int().positive().default(100),
    /** 报告最大 Token */    maxReportTokens:    z.number().int().positive().default(4096),
  }).prefault({}),

  ui: z.object({
    /** 默认主题 */          theme:            z.enum(['dark', 'light']).default('dark'),
    /** 语言 */              language:         z.enum(['zh-CN', 'zh-TW', 'en']).default('zh-CN'),
    /** 显示高级选项 */      showAdvanced:     z.boolean().default(false),
  }).prefault({}),

  /**
   * [ADR-011] 体系（应用）选择 —— 后台「选定应用」的落点
   * 后端真值来自 systems/registry.ts；这里只管「默认哪个 + 放行哪几个」。
   */
  systems: z.object({
    /** 默认体系：C 端未显式指定 system 时使用；必须已注册且已启用 */
    defaultSystem:   z.string().default('bazi'),
    /** 启用的体系 id 列表；不在列表内的体系对 C 端不可见 */
    enabledSystems:  z.array(z.string()).default(['bazi']),
  }).prefault({}),
})

export type ModuleSettings = z.infer<typeof moduleSettingsSchema>

/**
 * 安全解析 module_settings JSON
 * 永远不抛出异常 — 损坏数据返回默认值
 */
export function parseModuleSettings(raw: string | null | undefined): ModuleSettings {
  if (!raw) return moduleSettingsSchema.parse({})
  try {
    return moduleSettingsSchema.parse(JSON.parse(raw))
  } catch {
    console.warn('[Config] module_settings JSON 损坏，使用默认值')
    return moduleSettingsSchema.parse({})
  }
}
