// ============================================================
// Phase 4 — Modules: LLM 工具注册表（Zod 验证）
// 文件：src/server/modules/llm/tools-registry.ts
// ============================================================

import { z } from 'zod'

// ═══════════════════════════════════════
// 工具定义 Zod Schema
// ═══════════════════════════════════════

export const toolDefinitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  category: z.enum(['astronomy', 'calendar', 'knowledge', 'search', 'analysis']),
  /** 该工具需要的 Provider 能力 */
  requires: z.string().optional(),
})

export type ToolDefinition = z.infer<typeof toolDefinitionSchema>

// ═══════════════════════════════════════
// Provider 绑定的 Tools JSON Schema
// ═══════════════════════════════════════

export const supportedToolsSchema = z.array(z.string()).default([])

/**
 * 安全解析 supported_tools JSON（Zod 兜底）
 */
export function parseSupportedTools(raw: string | null | undefined): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return supportedToolsSchema.parse(parsed)
  } catch {
    return []
  }
}

/**
 * 序列化 supported_tools 为存储 JSON
 */
export function serializeSupportedTools(tools: string[]): string {
  return JSON.stringify(supportedToolsSchema.parse(tools))
}

// ═══════════════════════════════════════
// 可用工具注册表
// ═══════════════════════════════════════

export const AVAILABLE_TOOLS: ToolDefinition[] = [
  {
    id: 'solar_term_calc',
    name: '🧮 精准节气计算',
    description: '基于天文算法的24节气精准时刻计算',
    category: 'astronomy',
  },
  {
    id: 'calendar_lookup',
    name: '📅 万年历查询',
    description: '1900-2100年农历公历互转',
    category: 'calendar',
  },
  {
    id: 'classic_search',
    name: '🔍 命理典籍检索',
    description: '渊海子平/三命通会/滴天髓 RAG 检索',
    category: 'knowledge',
  },
  {
    id: 'famous_chart_compare',
    name: '📊 命例对比分析',
    description: '历史名人八字数据库对比',
    category: 'analysis',
  },
  {
    id: 'web_search',
    name: '🌐 Web Search',
    description: '联网搜索补充信息',
    category: 'search',
  },
]
