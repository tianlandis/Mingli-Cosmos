// ============================================================
// B 模式流水线执行器 — runReportPipeline
// ============================================================

import type { Try, ReportResult, ReportRequest } from '../lib/types'
import { generatePersonality } from './step-personality'
import { generateLuck } from './step-luck'
import { assembleReport } from './step-assemble'

/**
 * B 模式：命书生成 SOP 流水线
 *
 * Step 1 → 性格格局（调 LLM）
 *   ↓ success
 * Step 2 → 运势趋势（调 LLM，依赖 Step 1 输出）
 *   ↓ success
 * Step 3 → 汇总组装（纯模板，不调 LLM）
 *
 * 任意步骤失败 → Try.ok = false 短路返回
 */
export async function runReportPipeline(
  req: ReportRequest,
): Promise<Try<ReportResult>> {
  // Step 1: 性格格局
  const s1 = await generatePersonality(req.annotation)
  if (!s1.ok) return s1

  // Step 2: 运势趋势（依赖 s1 输出）
  const s2 = await generateLuck(req.annotation, s1.data.overview)
  if (!s2.ok) return s2

  // Step 3: 组装（不调 LLM，不会失败）
  const report = assembleReport(req.chart, req.annotation, s1.data, s2.data)

  return { ok: true, data: report }
}
