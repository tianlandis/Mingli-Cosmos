// ============================================================
// Step 1 工作流 — 性格与格局总评（调 LLM）
// ============================================================

import { generateText } from 'ai'
import type { AnnotationResult } from '../../engine/index'
import type { Try, PersonalityOutput } from '../lib/types'
import { resolveRoutes, withRetry, SELF_TALK_STOP } from '../lib/llm'
import { buildPersonalityPrompt } from '../prompts/personality'
import { buildMbtiAnchorBlock, resolveMbtiExpression } from './mbti-expression'

const MODEL_OVERRIDE = {
  temperature: 0.1,
  maxTokens: 800,
}

/**
 * SOP-1：性格与格局总评
 * 输入 annotation → 调 LLM → 返回 Try<PersonalityOutput>
 */
export async function generatePersonality(
  annotation: AnnotationResult,
): Promise<Try<PersonalityOutput>> {
  // [模型分级] 命书走 deep 角色（强模型）；候选链 = [deep 专属 → 全局默认]
  // 首选失败（本地模型关机 / 端点不可达）时自动换下一个候选重试，
  // 避免一次上游抖动就让整份命书生成失败。
  const routes = resolveRoutes('deep')
  let lastError = 'UNKNOWN'

  for (const route of routes) {
    const config = { ...route.config, ...MODEL_OVERRIDE }

    const result = await withRetry(async () => {
      // MBTI 表达锚点：命中知识字典则注入，缺失则静默降级为原行为
      const expr = resolveMbtiExpression(annotation)
      const mbtiAnchor = expr ? buildMbtiAnchorBlock(expr) : undefined
      const { system, prompt } = buildPersonalityPrompt(annotation, mbtiAnchor)

      const { text } = await generateText({
        model: route.model,
        system,
        prompt,
        temperature: config.temperature,
        maxOutputTokens: config.maxTokens,
        // [护栏 L1] 防止本地小模型答完后自行续写下一轮对话
        stopSequences: SELF_TALK_STOP,
      })

      return parsePersonalityOutput(text)
    }, 'personality')

    if (result.ok) return result

    lastError = result.error
    console.warn(
      `[Step1] 候选失败（${route.config.provider}/${route.config.model ?? 'default'}）：${result.error}`,
    )
  }

  return { ok: false, error: lastError, step: 'personality' }
}

/** 解析 LLM 输出 → PersonalityOutput，容错降级 */
function parsePersonalityOutput(text: string): PersonalityOutput {
  try {
    // 尝试提取 JSON（处理可能的外层文字）
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON found')

    const parsed = JSON.parse(jsonMatch[0])

    return {
      overview: String(parsed.overview ?? '').slice(0, 300),
      mbtiProfile: String(parsed.mbtiProfile ?? '').slice(0, 200),
    }
  } catch {
    // 降级：整段当 overview，mbtiProfile 留空
    return {
      overview: text.slice(0, 300),
      mbtiProfile: '',
    }
  }
}
