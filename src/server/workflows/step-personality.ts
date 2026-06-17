// ============================================================
// Step 1 工作流 — 性格与格局总评（调 LLM）
// ============================================================

import { generateText } from 'ai'
import type { AnnotationResult } from '../../engine/index'
import type { Try, PersonalityOutput } from '../lib/types'
import { createModel, loadConfig, withRetry } from '../lib/llm'
import { buildPersonalityPrompt } from '../prompts/personality'

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
  const config = { ...loadConfig(), ...MODEL_OVERRIDE }
  const model = createModel(config)

  return withRetry(async () => {
    const { system, prompt } = buildPersonalityPrompt(annotation)

    const { text } = await generateText({
      model,
      system,
      prompt,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
    })

    return parsePersonalityOutput(text)
  }, 'personality')
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
