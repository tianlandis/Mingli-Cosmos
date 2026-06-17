// ============================================================
// Step 2 工作流 — 近三年运势趋势（调 LLM）
// ============================================================

import { generateText } from 'ai'
import type { AnnotationResult } from '../../engine/index'
import type { Try, LuckOutput } from '../lib/types'
import { createModel, loadConfig, withRetry } from '../lib/llm'
import { buildLuckPrompt } from '../prompts/luck'

const MODEL_OVERRIDE = {
  temperature: 0.3,
  maxTokens: 1000,
}

/**
 * SOP-2：运势趋势
 * 输入 annotation + Step1 摘要 → 调 LLM → 返回 Try<LuckOutput>
 */
export async function generateLuck(
  annotation: AnnotationResult,
  personalitySummary: string,
): Promise<Try<LuckOutput>> {
  const config = { ...loadConfig(), ...MODEL_OVERRIDE }
  const model = createModel(config)

  return withRetry(async () => {
    const { system, prompt } = buildLuckPrompt(annotation, personalitySummary)

    const { text } = await generateText({
      model,
      system,
      prompt,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
    })

    return parseLuckOutput(text)
  }, 'luck')
}

/** 解析 LLM 输出 → LuckOutput，容错降级 */
function parseLuckOutput(text: string): LuckOutput {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON found')

    const parsed = JSON.parse(jsonMatch[0])

    return {
      trend: String(parsed.trend ?? '').slice(0, 250),
      highlights: String(parsed.highlights ?? '').slice(0, 150),
    }
  } catch {
    return {
      trend: text.slice(0, 250),
      highlights: '',
    }
  }
}
