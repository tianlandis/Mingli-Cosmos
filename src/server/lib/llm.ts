// ============================================================
// LLM Provider 抽象层 + withRetry 熔断
// 文件：src/server/lib/llm.ts
// 职责：封装 Vercel AI SDK，统一 4 种 Provider 接入
// ============================================================

import { createOpenAI } from '@ai-sdk/openai'
import type { LanguageModelV1 } from 'ai'
import type { LLMConfig, ModelProvider, Try } from './types'

const PROVIDER_DEFAULTS: Record<ModelProvider, { model: string }> = {
  deepseek: { model: 'deepseek-chat' },
  claude:   { model: 'claude-3-5-sonnet-20241022' },
  openai:   { model: 'gpt-4o-mini' },
  local:    { model: 'qwen2.5:7b' },
}

/** 根据 Provider 返回默认 baseUrl */
function getDefaultBaseUrl(provider: ModelProvider): string {
  switch (provider) {
    case 'deepseek': return 'https://api.deepseek.com/v1'
    case 'claude':   return 'https://api.anthropic.com/v1'
    case 'openai':   return 'https://api.openai.com/v1'
    case 'local':    return 'http://localhost:11434/v1'
  }
}

/**
 * 创建模型实例
 * 通过 @ai-sdk/openai 的 createOpenAI() 实现多 Provider 兼容
 * （DeepSeek / Anthropic / Ollama 都兼容 OpenAI API 格式）
 */
export function createModel(config: LLMConfig): LanguageModelV1 {
  const { model: defaultModel } = PROVIDER_DEFAULTS[config.provider]

  const provider = createOpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseUrl ?? getDefaultBaseUrl(config.provider),
  })

  return provider(config.model ?? defaultModel)
}

/** 从环境变量构建 LLMConfig */
export function loadConfig(): LLMConfig {
  const provider = (process.env.LLM_PROVIDER ?? 'local') as ModelProvider
  const apiKey = process.env.LLM_API_KEY ?? 'ollama'
  return {
    provider,
    apiKey,
    baseUrl: process.env.LLM_BASE_URL,
    model: process.env.LLM_MODEL,
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
