// ============================================================
// LLM Provider 抽象层 + withRetry 熔断
// 文件：src/server/lib/llm.ts
// 职责：封装 Vercel AI SDK，统一 4 种 Provider 接入
// ============================================================

import { createOpenAI } from '@ai-sdk/openai'
import type { LanguageModel } from 'ai'
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

// ════════════════════════════════════════════════════════════
// [护栏 L1] 自言自语刹车 —— 防止模型编造后续对话
// ════════════════════════════════════════════════════════════
//
// 背景：LLM 本质是「续写机器」。训练语料里满是 Human/AI 交替的多轮对话，
//       答完一轮后，模型概率上最顺手的延续就是开启下一轮。
//       官方对齐的模型会输出收尾符（EOS）自然停下，但未经充分对齐的
//       微调版本（如 xxx-un / base-like）这层刹车很弱 ——
//       它不认为自己「说完了」，于是替用户问下一个问题，再自己回答，
//       一路续写到 token 上限（实测 61 秒 / 6552 字符）。
//
// 为什么不能只靠 system prompt：软约束只能降低概率，压不住采样随机性；
//       必须在解码层做硬切断 —— 这就是 stopSequences 的作用。
//
// 为什么不能只靠 maxTokens：那是止损不是刹车，用户会白等几十秒，
//       且输出里仍然夹着垃圾内容。两者必须叠加（L1 切断 + L2 兜底）。
//
// 注意：本表对所有 Provider 无害 —— 对齐良好的模型本就会输出 EOS，
//       命中不了这些序列；对小模型 / 本地模型则是必需的刹车。
export const SELF_TALK_STOP: string[] = [
  // 角色标签（中英各种写法）
  'Assistant:', 'AI:', 'User:', 'Human:', 'System:',
  '\nAssistant:', '\nAI:', '\nUser:', '\nHuman:', '\nSystem:',
  '\n\nAssistant', '\n\nAI', '\n\nUser', '\n\nHuman', '\n\nSystem',
  // Qwen / ChatML 模板边界
  '<|im_start|>', '<|im_end|>', '<|endoftext|>',
  // 常见的自言自语起手式
  '根据上面这个对话历史', '请按照要求写出', '你给出的回答是否符合规则',
]

// ════════════════════════════════════════════════════════════
// [护栏 L1.5] 结果级兜底 —— 截断已经混进来的自言自语
// ════════════════════════════════════════════════════════════
//
// stopSequences（L1）在解码层切断，但它只认精确匹配。
// 模型换种写法（比如中文全角冒号、或先输出一个空行再编）就可能绕过。
// 因此这里再做一道「结果级」清洗：已生成的文本里一旦出现第二轮对话的
// 角色标签，就从那里截断，保证落库的会话历史与护栏看到的始终是干净的。
//
// 只在「换行 + 角色标签」的组合上命中，避免误伤正常行文中提到 AI/助手。
const SELF_TALK_RE =
  /\n\s*(?:Human|Assistant|User|AI|System|用户|助手|提问|客户|问)\s*[:：]/

/**
 * 找出自言自语污染的起始下标。
 * @returns 污染起始下标；返回 -1 表示文本干净
 */
export function findSelfTalkIndex(text: string): number {
  const m = SELF_TALK_RE.exec(text)
  return m ? m.index : -1
}

/**
 * 截断自言自语污染（幂等，干净文本原样返回）。
 * @returns { text, trimmed } —— trimmed 为 true 表示发生了截断
 */
export function truncateSelfTalk(text: string): { text: string; trimmed: boolean } {
  const idx = findSelfTalkIndex(text)
  if (idx < 0) return { text, trimmed: false }
  return { text: text.slice(0, idx).trimEnd(), trimmed: true }
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
export function createModel(config: LLMConfig): LanguageModel {
  const { model: defaultModel } = PROVIDER_DEFAULTS[config.provider]

  const provider = createOpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseUrl ?? getDefaultBaseUrl(config.provider),
  })

  // @ai-sdk/openai v3 的 chat() 返回 LanguageModelV3，可直接被 ai v6 的 generateText/streamText 消费
  return provider.chat(config.model ?? defaultModel)
}

/** 从环境变量构建 LLMConfig（DB 优先 → .env 回退） */
export function loadConfig(): LLMConfig {
  // 优先使用数据库配置（api_keys > app_configs，60s 缓存，管理后台可热更新）
  if (isUsingDbConfig()) {
    const db = getAppConfig()
    // api_keys 表中已包含完整 provider 字符串，直接使用
    const provider: ModelProvider = (() => {
      const p = db.provider as string
      if (['deepseek', 'siliconflow', 'claude', 'openai', 'local'].includes(p)) {
        return p as ModelProvider
      }
      // 未能识别 → 从 baseUrl 推断
      const url = db.baseUrl ?? ''
      if (url.includes('siliconflow')) return 'siliconflow'
      if (url.includes('deepseek'))   return 'deepseek'
      if (url.includes('anthropic'))  return 'claude'
      if (url.includes('localhost'))  return 'local'
      return 'openai'
    })()

    return {
      provider,
      // api_keys 表提供的 apiKey 是第一优先级，.env 作为兜底
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
