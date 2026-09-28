// ============================================================
// A 模式 System Prompt 构建器
// ============================================================

import type { BaZiResult, AnnotationResult } from '../../engine/index'
import { buildAntiHallucinationPromptDynamic } from '../lib/anti-hallucination'
import { formatPillars, formatShiShen, formatDaYun, formatShenSha } from './formatters'
import { isDbReady, listPrompts } from '../db'

/**
 * 读取管理后台中「启用」的自定义模板，拼装为管理员自定义指令段
 *
 * 设计约束：
 * - DB 未初始化 / 未配置任何自定义模板 → 返回 null，行为与历史版本完全一致（可回归）
 * - 仅消费 category='custom' 且 isActive=1 的模板，内置模板不参与
 * - 任何异常静默降级，绝不因配置问题中断排盘对话
 */
function buildAdminInstructionSection(): string | null {
  try {
    if (!isDbReady()) return null

    const customs = listPrompts().filter(
      (p: any) => p.isActive === 1 && (p.category === 'custom' || p.isBuiltin === 0),
    )
    if (customs.length === 0) return null

    const blocks = customs.map((p: any) => `### ${p.displayName || p.name}\n${p.content}`)
    return `## 管理员自定义指令（prompt_templates · 热生效）\n\n${blocks.join('\n\n')}`
  } catch {
    return null
  }
}

/**
 * 构建 A 模式（对话 Copilot）的 System Prompt
 * - 命盘数据注入 ~200 tokens
 * - 防幻觉指令由 anti-hallucination.ts 独立模块管理
 * - 管理员自定义指令（若配置了启用中的自定义模板）排在护栏之前
 */
export function buildSystemPrompt(
  chart: BaZiResult,
  annotation: AnnotationResult,
  reportSummary?: string,
): string {
  const adminSection = buildAdminInstructionSection()

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
    adminSection ? `${adminSection}\n` : '',
    // ⬇️ L3 热加载：优先 DB 配置，回退硬编码常量
    buildAntiHallucinationPromptDynamic(chart, annotation),
  ].join('\n')
}
