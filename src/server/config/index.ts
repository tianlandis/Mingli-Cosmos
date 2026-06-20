// ============================================================
// Phase 4B — 双轨配置路由
// 文件：src/server/config/index.ts
// 职责：DB 优先 → .env 回退 + 内存缓存 TTL 60s
// ============================================================

import { getConfigValue, listConfigs } from '../db'

interface AppConfig {
  /** LLM Provider ('openai' | 'deepseek' | 'claude' | 'local') */
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
  /** 原始来源：'db' | 'env' */
  source: 'db' | 'env'
}

// ═══════════════════════════════════════
// 内存缓存
// ═══════════════════════════════════════

let cachedConfig: AppConfig | null = null
let cacheTime = 0
const CACHE_TTL_MS = 60_000 // 60 秒

/**
 * 双轨加载：DB 优先 → .env 回退
 */
function loadFromSource(): { config: AppConfig; source: 'db' | 'env' } {
  // 尝试从数据库加载
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

  // 回退到 .env
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
 * 获取当前生效配置（双轨自动选择 + 60s 缓存）
 */
export function getAppConfig(): AppConfig {
  const now = Date.now()
  if (cachedConfig && now - cacheTime < CACHE_TTL_MS) {
    return cachedConfig
  }

  const { config, source } = loadFromSource()
  cachedConfig = config
  cacheTime = now

  if (source === 'db') {
    console.log('[Config] loaded from database (cached 60s)')
  } else {
    console.log('[Config] loaded from .env (database not available)')
  }

  return cachedConfig
}

/**
 * 强制刷新配置缓存（管理后台保存配置后调用）
 */
export function reloadConfig(): AppConfig {
  cachedConfig = null
  cacheTime = 0
  return getAppConfig()
}

/**
 * 获取所有数据库配置项（供管理面板展示）
 */
export function getAllDbConfigs() {
  return listConfigs()
}

/**
 * 判断当前是否使用数据库配置
 */
export function isUsingDbConfig(): boolean {
  return getAppConfig().source === 'db'
}
