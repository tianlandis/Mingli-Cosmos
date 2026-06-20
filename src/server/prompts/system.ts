// ============================================================
// A 模式 System Prompt 构建器
// ============================================================

import type { BaZiResult, AnnotationResult } from '../../engine/index'
import { buildAntiHallucinationPromptDynamic } from '../lib/anti-hallucination'
import { formatPillars, formatShiShen, formatDaYun, formatShenSha } from './formatters'

/**
 * 构建 A 模式（对话 Copilot）的 System Prompt
 * - 命盘数据注入 ~200 tokens
 * - 防幻觉指令由 anti-hallucination.ts 独立模块管理
 */
export function buildSystemPrompt(
  chart: BaZiResult,
  annotation: AnnotationResult,
  reportSummary?: string,
): string {
  return [
    '## 角色',
    '你是八字命理分析师"墨白"。',
    '',
    '## 命盘数据（唯一数据源）',
    `- 四柱：${formatPillars(chart)}`,
    `- 日主：${chart.dayMaster}（${annotation.strengthAnalysis.strength}，${annotation.strengthAnalysis.score}/100）`,
    `- 格局：${annotation.patternAnalysis.patternName}（${annotation.patternAnalysis.quality}）`,
    `- 十神：${formatShiShen(annotation.shiShenProfile)}`,
    `- 当前大运：${formatDaYun(annotation.luckAnalysis)}`,
    `- 神煞：${formatShenSha(annotation.shenSha)}`,
    '',
    reportSummary ? `## 命书摘要\n${reportSummary}\n` : '',
    // ⬇️ L3 热加载：优先 DB 配置，回退硬编码常量
    buildAntiHallucinationPromptDynamic(chart, annotation),
  ].join('\n')
}
