// ============================================================
// LLM Provider 抽象层 + withRetry 熔断
// 文件：src/server/lib/llm.ts
// 职责：封装 Vercel AI SDK，统一 4 种 Provider 接入
// ============================================================

import { createOpenAI } from '@ai-sdk/openai'
import type { LanguageModel } from 'ai'
import type { LLMConfig, ModelProvider, Try } from './types'
import { getAppConfig, getAppConfigByRole, isUsingDbConfig, type LLMRole } from '../config'

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
// ════════════════════════════════════════════════════════════
// [适配] thinking 模型（reasoning_content）
// ════════════════════════════════════════════════════════════
//
// DeepSeek-R1 / QwQ 这类「思考型」模型，正文写在 `reasoning_content`
// 字段里，`content` 是空字符串。AI SDK 只读 `content` → 生成结果为空。
//
// 解法：给 provider 注入自定义 fetch，把非流式 JSON 响应里的
// reasoning_content 回填到 content。流式（SSE）不改写 —— 需要逐 chunk
// 解析且各家长格式不一，风险高于收益；流式场景请改用非思考型模型
// （实测 ollama 的 qwen2.5:7b 速度最快且天然不串台）。
const THINKING_MODEL_RE = /(?:^|[^a-z0-9])(?:r1|reasoner|thinking|qwq)(?:[^a-z0-9]|$)/i

/** 判断是否思考型模型（deepseek-r1:7b / qwq / xxx-reasoner 等） */
export function isThinkingModel(model?: string): boolean {
  if (!model) return false
  return THINKING_MODEL_RE.test(model)
}

/** 构造会把 reasoning_content 回填到 content 的 fetch（只处理非流式 JSON） */
function createReasoningAwareFetch(): typeof fetch {
  return async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    const res = await globalThis.fetch(input, init)
    const contentType = res.headers.get('content-type') ?? ''
    // 只处理 JSON 响应；SSE(text/event-stream) 原样透传
    if (!contentType.includes('application/json')) return res

    const text = await res.text()
    const rebuild = (body: string) =>
      new Response(body, {
        status: res.status,
        statusText: res.statusText,
        headers: new Headers(res.headers),
      })

    try {
      const json = JSON.parse(text) as {
        choices?: Array<{ message?: { content?: string | null; reasoning_content?: string | null } }>
      }
      const msg = json.choices?.[0]?.message
      const reasoning = msg?.reasoning_content
      if (msg && !msg.content && reasoning) {
        msg.content = reasoning
        console.warn('[LLM] 思考型模型：已从 reasoning_content 回填正文')
        return rebuild(JSON.stringify(json))
      }
      return rebuild(text)
    } catch {
      // 解析失败（非预期格式）→ 原样返回，不做任何改写
      return rebuild(text)
    }
  }
}

export function createModel(config: LLMConfig): LanguageModel {
  const { model: defaultModel } = PROVIDER_DEFAULTS[config.provider]
  const modelId = config.model ?? defaultModel

  const provider = createOpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseUrl ?? getDefaultBaseUrl(config.provider),
    // 仅思考型模型注入改写 fetch，其余零开销
    fetch: isThinkingModel(modelId) ? createReasoningAwareFetch() : undefined,
  })

  // @ai-sdk/openai v3 的 chat() 返回 LanguageModelV3，可直接被 ai v6 的 generateText/streamText 消费
  return provider.chat(modelId)
}

/** provider 字符串归一化：已知枚举直接用，未知则按 baseUrl 推断 */
function resolveProvider(raw: string, baseUrl?: string | null): ModelProvider {
  if (['deepseek', 'siliconflow', 'claude', 'openai', 'local'].includes(raw)) {
    return raw as ModelProvider
  }
  const url = baseUrl ?? ''
  if (url.includes('siliconflow')) return 'siliconflow'
  if (url.includes('deepseek'))   return 'deepseek'
  if (url.includes('anthropic'))  return 'claude'
  if (url.includes('localhost'))  return 'local'
  return 'openai'
}

/**
 * 构建 LLMConfig（DB 优先 → .env 回退）
 *
 * @param role 用途角色（模型分级）
 *   - `'fast'`：AI 对话、意图路由等低延迟场景 → 本地小模型 / 便宜模型
 *   - `'deep'`：命书 Step1 性格 / Step2 运势等高质量场景 → 强模型
 *   - 不传：全局默认（等价于旧行为）
 *
 * 后台没给 role 配专属供应商时，`getAppConfigByRole()` 内部自动回落全局默认，
 * 因此不配置 = 完全兼容旧行为。
 */
export function loadConfig(role?: LLMRole): LLMConfig {
  // 优先使用数据库配置（api_keys > app_configs，60s 缓存，管理后台可热更新）
  if (isUsingDbConfig()) {
    const db = role ? getAppConfigByRole(role) : getAppConfig()

    return {
      provider: resolveProvider(db.provider as string, db.baseUrl),
      // api_keys 表提供的 apiKey 是第一优先级，.env 作为兜底
      apiKey: db.apiKey || process.env.LLM_API_KEY || process.env.OPENAI_API_KEY || 'ollama',
      baseUrl: db.baseUrl,
      model: db.model,
      temperature: db.temperature,
      maxTokens: db.maxTokens,
    }
  }

  // .env 回退路径没有分级概念 —— role 会被忽略（本地开发场景，不影响生产）
  if (role) {
    console.warn(`[LLM] .env 模式不支持模型分级，忽略 role=${role}`)
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

// ════════════════════════════════════════════════════════════
// [模型分级 + 降级] 候选调用链
// ════════════════════════════════════════════════════════════
//
// 场景：fast 角色常配本地模型（ollama / LM Studio）。本机一关机或模型
//       被卸载，端点立刻不可达 → 对话全线失败。因此需要「首选不可达就
//       降级到全局默认」的能力。
//
// 做法：调用前用一次轻量探测（GET <baseUrl>/models，2.5s 超时）筛出可达
//       端点。探测只在存在多个候选时发生，单候选零额外开销。

export interface LLMRoute {
  /** 该候选的角色来源（全局默认候选为 undefined） */
  role?: LLMRole
  config: LLMConfig
  model: LanguageModel
}

/** 两个候选是否指向同一个端点 + 模型（用于去重） */
function sameEndpoint(a: LLMConfig, b: LLMConfig): boolean {
  const baseA = a.baseUrl ?? getDefaultBaseUrl(a.provider)
  const baseB = b.baseUrl ?? getDefaultBaseUrl(b.provider)
  return baseA === baseB && (a.model ?? '') === (b.model ?? '')
}

/**
 * 构造候选调用链：[role 专属（若有）→ 全局默认]
 * role 专属与全局默认指向同一端点时会去重，只保留一条。
 */
export function resolveRoutes(role?: LLMRole): LLMRoute[] {
  const primary = loadConfig(role)
  const routes: LLMRoute[] = [{ role, config: primary, model: createModel(primary) }]

  if (!role) return routes

  const fallback = loadConfig() // 全局默认
  if (!sameEndpoint(primary, fallback)) {
    routes.push({ config: fallback, model: createModel(fallback) })
  }
  return routes
}

/** 探测端点可达性：能连上就认为可用（401/403 也算"在"，只是 key 问题） */
async function probeReachable(config: LLMConfig, timeoutMs = 2500): Promise<boolean> {
  const base = (config.baseUrl ?? getDefaultBaseUrl(config.provider)).replace(/\/+$/, '')
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), timeoutMs)
    const res = await fetch(`${base}/models`, { signal: ctrl.signal })
    clearTimeout(timer)
    return res.ok || res.status === 401 || res.status === 403
  } catch {
    return false
  }
}

/**
 * 选出第一个可达的候选端点；全部不可达时返回首选（让原始错误原样暴露，
 * 便于排障，而不是掩盖成"降级失败"）。
 */
export async function pickAvailableRoute(routes: LLMRoute[]): Promise<LLMRoute> {
  if (routes.length <= 1) return routes[0]

  const flags = await Promise.all(routes.map((r) => probeReachable(r.config)))
  const idx = flags.findIndex(Boolean)
  if (idx < 0) {
    console.warn('[LLM] 所有候选端点均不可达，使用首选（错误原样暴露）')
    return routes[0]
  }
  if (idx > 0) {
    console.warn(
      `[LLM] 首选端点不可达，已降级 → provider=${routes[idx].config.provider} model=${routes[idx].config.model ?? '(default)'}`,
    )
  }
  return routes[idx]
}

/** 单步 LLM 默认超时（30s）。本地小模型跑命书多步推理会超，用 `LLM_TIMEOUT_MS` 覆盖。 */
const DEFAULT_LLM_TIMEOUT_MS = 30_000

/** 读取超时配置（函数内读 env，避免模块顶层读 process.env） */
function llmTimeoutMs(): number {
  const raw = Number(process.env.LLM_TIMEOUT_MS)
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_LLM_TIMEOUT_MS
}

/**
 * 带重试 + 超时的 LLM 调用包装器
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
          setTimeout(() => reject(new Error('LLM_TIMEOUT')), llmTimeoutMs()),
        ),
      ])
      return { ok: true, data: result }
    } catch (e) {
      const msg = String(e)
      // 超时多为模型本身慢，重试只会再等一整个超时窗口 → 直接失败
      if (msg.includes('LLM_TIMEOUT') || attempt === maxRetries) {
        return { ok: false, error: msg, step }
      }
      console.warn(`[LLM] retry ${attempt + 1}/${maxRetries} for ${step}`)
    }
  }
  return { ok: false, error: 'UNREACHABLE', step }
}
