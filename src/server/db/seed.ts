// ============================================================
// Phase 4A — 数据库种子数据
// 文件：src/server/db/seed.ts
// 职责：首次运行时写入默认配置（从 .env 兜底）+ 默认 Provider
// ============================================================

import { setConfig, getConfig } from './repositories/app-configs'
import { listApiKeys, createApiKey } from './repositories/api-keys'

export function seedDefaults() {
  // 仅首次运行时写入（config 表为空时触发）
  const hasConfigs = getConfig('default_llm_provider')
  if (hasConfigs) return

  const defaultProvider = process.env.LLM_PROVIDER || 'local'

  setConfig('default_llm_provider', defaultProvider, '默认 LLM 厂商', '当前使用的 LLM Provider', 'string', 'llm')
  setConfig('default_llm_model', process.env.LLM_MODEL || process.env.OPENAI_MODEL || 'qwen2.5:7b', '默认模型', 'LLM 模型名称', 'string', 'llm')
  setConfig('default_temperature', process.env.LLM_TEMPERATURE || '0.7', '默认温度', '生成温度 0-2', 'string', 'llm')
  setConfig('max_chat_messages', '10', '对话窗口大小', '滑动窗口最大消息数', 'number', 'general')
  setConfig('max_retries', '1', 'LLM 重试次数', '失败后最大重试次数', 'number', 'llm')
  setConfig('llm_timeout_ms', '30000', 'LLM 超时(ms)', '单次请求超时时间', 'number', 'llm')

  console.log('[DB] seed: default configs written')
}

/**
 * 插入默认 Local Provider（首次启动）
 */
export function seedLocalProvider() {
  // 检查是否已有 provider
  const existing = listApiKeys()
  if (existing.length > 0) return

  createApiKey({
    provider: 'local',
    label: 'Qwen2.5-Coder-7B (本地)',
    apiKey: 'ollama',
    baseUrl: process.env.LLM_BASE_URL || 'http://localhost:11434/v1',
    model: process.env.LLM_MODEL || 'qwen2.5:7b',
    temperature: 0.7,
    maxTokens: 2048,
    isActive: 1,
    sortOrder: 0,
    supportedTools: '["solar_term_calc","calendar_lookup","classic_search"]',
    testStatus: 'untested',
    testLatency: null,
    testedAt: null,
  } as any)

  console.log('[DB] seed: default local provider created')
}
