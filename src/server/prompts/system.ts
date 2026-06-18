// ============================================================
// A 模式 System Prompt 构建器
// ============================================================

import type { BaZiResult, AnnotationResult } from '../../engine/index'
import { buildAntiHallucinationPrompt } from '../lib/anti-hallucination'

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
    // ⬇️ 防幻觉指令由独立模块管理，Phase 4 后可管理后台热更新
    buildAntiHallucinationPrompt(chart, annotation),
  ].join('\n')
}

// ─── 格式化辅助函数 ───

function formatPillars(chart: BaZiResult): string {
  const p = [chart.yearPillar, chart.monthPillar, chart.dayPillar, chart.hourPillar]
  const labels = ['年', '月', '日', '时']
  return p.map((pillar, i) => `${labels[i]}柱：${pillar.ganZhi}`).join('，')
}

function formatShiShen(profile: AnnotationResult['shiShenProfile']): string {
  return profile
    .filter(p => p.count > 0)
    .map(p => `${p.name}(${p.count})`)
    .join('、')
}

function formatDaYun(luck: AnnotationResult['luckAnalysis']): string {
  const current = luck.daYunList.find(d => d.quality !== undefined) ?? luck.daYunList[0]
  return current
    ? `${current.ganZhi}（${current.startAge}-${current.endAge}岁，${current.quality}）`
    : '暂未起运'
}

function formatShenSha(shenSha: AnnotationResult['shenSha']): string {
  if (!shenSha.items || shenSha.items.length === 0) return '无明显神煞'
  return shenSha.items
    .slice(0, 5)
    .map(i => `${i.name}(${i.type}，${i.pillar})`)
    .join('、')
}
