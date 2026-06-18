// ============================================================
// Phase 7 — KnowledgeProvider：通用命理知识资产统一读取服务
// 文件：src/server/services/KnowledgeProvider.ts
// 职责：供前端引擎 & LLM Agent 动态读取 knowledge_assets 中的规则，
//       确保不写入 Prompt 硬编码，多端算法绝对一致。
// ============================================================

import { listKnowledgeAssets, getKnowledgeAssetByKey, type KnowledgeAsset } from '../db'

// ═══════════════════════════════════════
// 类型定义
// ═══════════════════════════════════════

export interface KnowledgeCategory {
  category: string
  items: KnowledgeAsset[]
  itemCount: number
}

export interface KnowledgeQueryResult {
  /** 按 key 精确查询的结果 */
  item: Record<string, unknown> | null
  /** 按 key 精确查询的原始行 */
  raw: KnowledgeAsset | null
}

// ═══════════════════════════════════════
// 单例缓存（5分钟 TTL，避免每次工具调用都查库）
// ═══════════════════════════════════════

let _cache: { data: KnowledgeAsset[]; ts: number } | null = null
const CACHE_TTL_MS = 5 * 60 * 1000

function getCachedAssets(): KnowledgeAsset[] {
  const now = Date.now()
  if (_cache && (now - _cache.ts) < CACHE_TTL_MS) {
    return _cache.data
  }
  const data = listKnowledgeAssets()
  _cache = { data, ts: now }
  return data
}

/** 强制刷新缓存（CRUD 操作后调用） */
export function invalidateCache() {
  _cache = null
}

// ═══════════════════════════════════════
// 公共 API
// ═══════════════════════════════════════

/**
 * 获取指定分类的所有知识项（解析 JSON value）
 */
export function getCategory(category: string): KnowledgeCategory {
  const all = getCachedAssets()
  const items = all.filter(a => a.category === category && a.isActive === 1)
  return { category, items, itemCount: items.length }
}

/**
 * 精确查询：按 category + key 返回解析后的 JSON value
 */
export function query(category: string, key: string): KnowledgeQueryResult {
  const all = getCachedAssets()
  const raw = all.find(a => a.category === category && a.key === key && a.isActive === 1) ?? null

  if (!raw) return { item: null, raw: null }

  let item: Record<string, unknown> | null = null
  try {
    item = JSON.parse(raw.value)
  } catch {
    item = { _raw: raw.value }
  }

  return { item, raw }
}

/**
 * 批量查询：按 category 获取多个 key 的结果
 * 用于 AI Agent 一次性获取神煞规则、人格映射等
 */
export function queryBatch(category: string, keys: string[]): Record<string, Record<string, unknown>> {
  const result: Record<string, Record<string, unknown>> = {}
  for (const key of keys) {
    const q = query(category, key)
    if (q.item) result[key] = q.item
  }
  return result
}

/**
 * 获取所有分类摘要（用于前端渲染分类列表）
 */
export function getCategories(): Array<{ name: string; label: string; count: number }> {
  const all = getCachedAssets().filter(a => a.isActive === 1)
  const map = new Map<string, number>()
  for (const a of all) {
    map.set(a.category, (map.get(a.category) || 0) + 1)
  }

  const LABELS: Record<string, string> = {
    classics: '古籍经典',
    shensha: '神煞规则',
    personality: '16 人格映射',
    bazi: '八字基础',
    pattern: '格局判定',
  }

  return Array.from(map.entries()).map(([name, count]) => ({
    name,
    label: LABELS[name] || name,
    count,
  }))
}

/**
 * 将整个知识库格式化为 LLM System Prompt 注入文本
 * （用于 RAG 场景，将知识作为上下文注入）
 */
export function formatAsContext(categories?: string[]): string {
  const all = getCachedAssets().filter(a => a.isActive === 1)
  const filtered = categories ? all.filter(a => categories.includes(a.category)) : all

  const lines: string[] = ['[命理知识资产库]']
  const byCategory = new Map<string, KnowledgeAsset[]>()
  for (const a of filtered) {
    if (!byCategory.has(a.category)) byCategory.set(a.category, [])
    byCategory.get(a.category)!.push(a)
  }

  for (const [cat, items] of byCategory) {
    lines.push(`\n## ${cat}`)
    for (const item of items) {
      lines.push(`- **${item.key}**${item.description ? `: ${item.description}` : ''}`)
      try {
        const parsed = JSON.parse(item.value)
        if (typeof parsed === 'object' && parsed !== null) {
          for (const [k, v] of Object.entries(parsed)) {
            lines.push(`  - ${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`)
          }
        } else {
          lines.push(`  - ${parsed}`)
        }
      } catch {
        lines.push(`  - ${item.value}`)
      }
    }
  }

  return lines.join('\n')
}
