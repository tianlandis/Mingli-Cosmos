// ============================================================
// LLM Provider 抽象层 + withRetry 熔断
// 文件：src/server/lib/llm.ts
// 职责：封装 Vercel AI SDK，统一 4 种 Provider 接入
// ============================================================

import { createOpenAI } from '@ai-sdk/openai'
import type { LanguageModelV1 } from 'ai'
import type { LLMConfig, ModelProvider, Try } from './types'
import { getAppConfig, isUsingDbConfig } from '../config'

const PROVIDER_DEFAULTS: Record<ModelProvider, { model: string }> = {
  deepseek:    { model: 'deepseek-chat' },
  siliconflow: { model: 'Qwen/Qwen3.5-122B-A10B' },
  claude:      { model: 'claude-3-5-sonnet-20241022' },
  openai:      { model: 'gpt-4o-mini' },
  local:       { model: 'qwen2.5:7b' },
}

/** 根据 Provider 返回默认 baseUrl */
function getDefaultBaseUrl(provider: ModelProvider): string {
  switch (provider) {
    case 'deepseek':    return 'https://api.deepseek.com/v1'
    case 'siliconflow': return 'https://api.siliconflow.cn/v1'
    case 'claude':      return 'https://api.anthropic.com/v1'
    case 'openai':      return 'https://api.openai.com/v1'
    case 'local':       return 'http://localhost:11434/v1'
  }
}

/**
 * 创建模型实例
 * 通过 @ai-sdk/openai 的 createOpenAI() 实现多 Provider 兼容
 * （DeepSeek / Anthropic / Ollama / SiliconFlow 都兼容 OpenAI API 格式）
 *
 * ⚠️ v3 默认 provider(modelId) 调用 Responses API (/responses)，
 *    三方兼容 API 只支持 Chat Completions (/chat/completions)，
 *    因此显式使用 provider.chat(modelId)
 */
export function createModel(config: LLMConfig): LanguageModelV1 {
  const { model: defaultModel } = PROVIDER_DEFAULTS[config.provider]

  const provider = createOpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseUrl ?? getDefaultBaseUrl(config.provider),
  })

  // @ts-expect-error @ai-sdk/openai v3 返回 LanguageModelV3，与 ai v6 的 LanguageModelV1 结构兼容
  return provider.chat(config.model ?? defaultModel)
}

/** 从环境变量构建 LLMConfig（DB 优先 → .env 回退） */
export function loadConfig(): LLMConfig {
  // 优先使用数据库配置（管理后台可热更新，60s 缓存）
  if (isUsingDbConfig()) {
    const db = getAppConfig()
    // 从 DB 配置推断 provider（若未明确指定则自动推断）
    const provider: ModelProvider = (process.env.LLM_PROVIDER as ModelProvider) ?? (() => {
      const url = db.baseUrl ?? ''
      if (url.includes('siliconflow')) return 'siliconflow'
      if (url.includes('deepseek'))   return 'deepseek'
      if (url.includes('anthropic'))  return 'claude'
      if (url.includes('localhost'))  return 'local'
      return 'openai'
    })()
    return {
      provider,
      apiKey: db.apiKey || process.env.LLM_API_KEY || process.env.OPENAI_API_KEY || 'ollama',
      baseUrl: db.baseUrl,
      model: db.model,
      temperature: db.temperature,
      maxTokens: db.maxTokens,
    }
  }

  // 回退到环境变量
  const apiKey = process.env.LLM_API_KEY || process.env.OPENAI_API_KEY || 'ollama'
  const baseUrl = process.env.LLM_BASE_URL || process.env.OPENAI_API_BASE
  const model = process.env.LLM_MODEL || process.env.OPENAI_MODEL

  const explicitProvider = process.env.LLM_PROVIDER as ModelProvider | undefined
  const provider: ModelProvider = explicitProvider ?? (() => {
    const url = baseUrl ?? ''
    if (url.includes('siliconflow')) return 'siliconflow'
    if (url.includes('deepseek'))   return 'deepseek'
    if (url.includes('anthropic'))  return 'claude'
    if (url.includes('localhost'))  return 'local'
    if (apiKey !== 'ollama')        return 'openai'
    return 'local'
  })()

  return {
    provider,
    apiKey,
    baseUrl,
    model,
    temperature: process.env.LLM_TEMPERATURE ? Number(process.env.LLM_TEMPERATURE) : undefined,
    maxTokens: process.env.LLM_MAX_TOKENS ? Number(process.env.LLM_MAX_TOKENS) : undefined,
  }
}

/**
 * 带重试 + 30s 超时的 LLM 调用包装器
 * 失败后返回 Try<T>.ok = false，由上游流水线短路
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  step: string,
  maxRetries = 1,
): Promise<Try<T>> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await Promise.race([
        fn(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('LLM_TIMEOUT')), 30_000),
        ),
      ])
      return { ok: true, data: result }
    } catch (e) {
      if (attempt === maxRetries) {
        return { ok: false, error: String(e), step }
      }
      console.warn(`[LLM] retry ${attempt + 1}/${maxRetries} for ${step}`)
    }
  }
  return { ok: false, error: 'UNREACHABLE', step }
}
