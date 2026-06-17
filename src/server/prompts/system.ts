// ============================================================
// A 模式 System Prompt 构建器
// ============================================================

import type { BaZiResult, AnnotationResult } from '../../engine/index'

/**
 * 构建 A 模式（对话 Copilot）的 System Prompt
 * 注入全量命盘数据 ~800-1200 tokens
 */
export function buildSystemPrompt(
  chart: BaZiResult,
  annotation: AnnotationResult,
  reportSummary?: string,
): string {
  return [
    '## 角色',
    '你是八字命理分析师"墨白"。你的分析基于下方结构化排盘数据，不得编造数据之外的内容。',
    '',
    '## 命盘数据',
    `- 四柱：${formatPillars(chart)}`,
    `- 日主：${chart.dayMaster}（${annotation.strengthAnalysis.strength}，${annotation.strengthAnalysis.score}/100）`,
    `- 格局：${annotation.patternAnalysis.patternName}（${annotation.patternAnalysis.quality}）`,
    `- 十神：${formatShiShen(annotation.shiShenProfile)}`,
    `- 当前大运：${formatDaYun(annotation.luckAnalysis)}`,
    `- 神煞：${formatShenSha(annotation.shenSha)}`,
    '',
    reportSummary ? `## 命书摘要\n${reportSummary}\n` : '',
    '## 规则',
    '1. 所有回答必须基于以上数据，不得脱离数据自由发挥',
    '2. 禁止绝对化断言（"一定""必然""绝对"）',
    '3. 禁止提供医疗、法律、投资建议',
    '4. 语气平和客观，有典籍气质但不晦涩',
    '5. 每次回复末尾附："以上分析仅供参考，祝您生活愉快。"',
    '6. 拒绝回答与命盘无关的闲聊问题',
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
