// ============================================================
// Phase 4B — 三轨配置路由（api_keys 优先 → app_configs 回退 → .env 兜底）
// 文件：src/server/config/index.ts
// 职责：api_keys(isDefault=1) 优先 → app_configs K/V 回退 → .env 最终兜底
//       + 内存缓存 TTL 60s
// ============================================================

import { getConfigValue, listConfigs } from '../db'
import {
  getDefaultApiKey,
  getDefaultApiKeyFallback,
  getApiKeyByRole,
} from '../db/repositories/api-keys'

/**
 * [模型分级] 用途角色
 * - fast：低延迟场景（AI 对话、意图路由）→ 本地小模型 / 便宜模型
 * - deep：高质量场景（命书 Step1 性格 / Step2 运势）→ 强模型
 */
export type LLMRole = 'fast' | 'deep'

interface AppConfig {
  /** LLM Provider ('openai' | 'deepseek' | 'claude' | 'local' | 'siliconflow') */
  provider: string
  /** API Key */
  apiKey: string
  /** 自定义 API Base URL（可选） */
  baseUrl?: string
  /** 模型名 */
  model?: string
  /** 温度 0-2 */
  temperature: number
  /** 最大 Token */
  maxTokens: number
  /** 对话窗口大小 */
  maxChatMessages: number
  /** LLM 重试次数 */
  maxRetries: number
  /** LLM 超时(ms) */
  llmTimeoutMs: number
  /** 原始来源：'api_keys' | 'db' | 'env' */
  source: 'api_keys' | 'db' | 'env'
}

// ═══════════════════════════════════════
// 内存缓存
// ═══════════════════════════════════════

let cachedConfig: AppConfig | null = null
let cacheTime = 0
const CACHE_TTL_MS = 60_000 // 60 秒

/** [模型分级] role 维度缓存（与全局缓存同 TTL，各自独立失效） */
const roleCache = new Map<LLMRole, { config: AppConfig; ts: number }>()

/**
 * 【新】从 api_keys 表加载供应商配置
 *
 * 解析优先级（role 有值时）：
 *   1. role 专属供应商（role 匹配 AND isActive=1）
 *   2. 全局默认 isDefault=1 AND isActive=1
 *   3. 全局默认 isDefault=1（放宽 Active，避免误下线导致不可用）
 *
 * @param role 用途角色；不传则只按全局默认解析
 * @returns null 表示没有任何可用配置
 */
function loadFromApiKeys(role?: LLMRole): { config: AppConfig; source: 'api_keys' } | null {
  // 第一优先级：role 专属供应商（仅当明确传了 role）
  let row = role ? getApiKeyByRole(role) : undefined

  // 第二优先级：isDefault=1 AND isActive=1
  if (!row) row = getDefaultApiKey()

  // 第三优先级：isDefault=1（即使被下线，至少 admin 明确设过）
  if (!row) row = getDefaultApiKeyFallback()

  if (!row) return null

  return {
    config: {
      provider: row.provider,
      apiKey: row.apiKey,
      baseUrl: row.baseUrl || undefined,
      model: row.model || undefined,
      temperature: row.temperature ?? 0.7,
      maxTokens: row.maxTokens ?? 2048,
      maxChatMessages: Number(process.env.MAX_CHAT_MESSAGES || 10),
      maxRetries: Number(process.env.MAX_RETRIES || 1),
      llmTimeoutMs: Number(process.env.LLM_TIMEOUT_MS || 30000),
      source: 'api_keys',
    },
    source: 'api_keys' as const,
  }
}

/**
 * 双轨回退：app_configs K/V 表 → .env
 */
function loadFromLegacySource(): { config: AppConfig; source: 'db' | 'env' } {
  // 尝试从数据库加载（旧 app_configs 表）
  const dbProvider = getConfigValue('default_llm_provider')
  if (dbProvider) {
    return {
      config: {
        provider: dbProvider,
        apiKey: '',
        baseUrl: getConfigValue('default_llm_base_url') || undefined,
        model: getConfigValue('default_llm_model') || undefined,
        temperature: Number(getConfigValue('default_temperature') || 0.7),
        maxTokens: Number(getConfigValue('default_max_tokens') || 2048),
        maxChatMessages: Number(getConfigValue('max_chat_messages') || 10),
        maxRetries: Number(getConfigValue('max_retries') || 1),
        llmTimeoutMs: Number(getConfigValue('llm_timeout_ms') || 30000),
        source: 'db',
      },
      source: 'db' as const,
    }
  }

  // 最终回退到 .env
  const envProvider = process.env.LLM_PROVIDER || 'openai'
  return {
    config: {
      provider: envProvider,
      apiKey: process.env.LLM_API_KEY || process.env.OPENAI_API_KEY || '',
      baseUrl: process.env.LLM_BASE_URL || process.env.OPENAI_API_BASE || undefined,
      model: process.env.LLM_MODEL || process.env.OPENAI_MODEL || undefined,
      temperature: Number(process.env.LLM_TEMPERATURE || 0.7),
      maxTokens: Number(process.env.LLM_MAX_TOKENS || 2048),
      maxChatMessages: Number(process.env.MAX_CHAT_MESSAGES || 10),
      maxRetries: Number(process.env.MAX_RETRIES || 1),
      llmTimeoutMs: Number(process.env.LLM_TIMEOUT_MS || 30000),
      source: 'env',
    },
    source: 'env' as const,
  }
}

/**
 * 三轨加载：api_keys 优先 → app_configs 回退 → .env 最终兜底
 */
function loadFromSource(): { config: AppConfig; source: 'api_keys' | 'db' | 'env' } {
  // 【第一优先级】 api_keys 表 isDefault=1
  const apiKeyResult = loadFromApiKeys()
  if (apiKeyResult) return apiKeyResult

  // 【第二优先级】 app_configs K/V 表 → .env
  return loadFromLegacySource()
}

/**
 * 获取当前生效配置（三轨自动选择 + 60s 缓存）
 */
export function getAppConfig(): AppConfig {
  const now = Date.now()
  if (cachedConfig && now - cacheTime < CACHE_TTL_MS) {
    return cachedConfig
  }

  const { config, source } = loadFromSource()
  cachedConfig = config
  cacheTime = now

  if (source === 'api_keys') {
    console.log('[Config] loaded from api_keys table (isDefault=1, cached 60s)')
  } else if (source === 'db') {
    console.log('[Config] loaded from app_configs K/V table (cached 60s)')
  } else {
    console.log('[Config] loaded from .env (no DB config available)')
  }

  return cachedConfig
}

/**
 * 强制刷新配置缓存（管理后台保存配置后调用）
 */
export function reloadConfig(): AppConfig {
  cachedConfig = null
  cacheTime = 0
  roleCache.clear()
  return getAppConfig()
}

/**
 * [模型分级] 按用途角色获取 LLM 配置（带 60s 缓存）
 *
 * 后台未给该 role 配专属供应商时，自动回落全局默认 —— 因此
 * 「不配置」完全等价于旧行为，不会引入破坏性变更。
 *
 * @param role 'fast'（对话/路由）| 'deep'（命书生成）
 */
export function getAppConfigByRole(role: LLMRole): AppConfig {
  const now = Date.now()
  const hit = roleCache.get(role)
  if (hit && now - hit.ts < CACHE_TTL_MS) {
    return hit.config
  }

  const result = loadFromApiKeys(role)
  // api_keys 里一条都没有 → 走 app_configs / .env 老链路
  const config = result ? result.config : getAppConfig()

  roleCache.set(role, { config, ts: now })
  console.log(
    `[Config] role=${role} → provider=${config.provider} model=${config.model ?? '(default)'} base=${config.baseUrl ?? '(default)'}`,
  )
  return config
}

/**
 * 获取所有数据库配置项（供管理面板展示）
 */
export function getAllDbConfigs() {
  return listConfigs()
}

/**
 * 判断当前是否使用数据库配置（含 api_keys 与 app_configs）
 */
export function isUsingDbConfig(): boolean {
  const src = getAppConfig().source
  return src === 'api_keys' || src === 'db'
}
