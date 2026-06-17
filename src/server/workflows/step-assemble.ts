// ============================================================
// Step 3 工作流 — 汇总组装（不调 LLM，纯 Markdown 模板）
// ============================================================

import type { BaZiResult, AnnotationResult } from '../../engine/index'
import type { PersonalityOutput, LuckOutput, ReportResult, ReportSection } from '../lib/types'
import { validateResponse } from '../lib/guardrail'

/**
 * SOP-3：汇总组装
 * 输入 chart + specialTopics + Step1 + Step2 → 纯模板拼接 → ReportResult
 * 此步骤不调 LLM，不会失败
 */
export function assembleReport(
  chart: BaZiResult,
  annotation: AnnotationResult,
  personality: PersonalityOutput,
  luck: LuckOutput,
): ReportResult {
  const { specialTopics, disclaimer } = annotation
  const gender = chart.gender === '男' ? '乾造' : '坤造'

  // 八字表格
  const pillarRows = [
    { label: '年柱', pillar: chart.yearPillar },
    { label: '月柱', pillar: chart.monthPillar },
    { label: '日柱', pillar: chart.dayPillar },
    { label: '时柱', pillar: chart.hourPillar },
  ]

  const baziTable = [
    `| 柱位 | 天干 | 地支 | 干支 | 五行 |`,
    `|:---:|:---:|:---:|:---:|:---:|`,
    ...pillarRows.map(r =>
      `| ${r.label} | ${r.pillar.stem} | ${r.pillar.branch} | ${r.pillar.ganZhi} | ${r.pillar.stemWuXing}/${r.pillar.branchWuXing} |`,
    ),
  ].join('\n')

  // 免责声明
  const safeDisclaimer = validateResponse(disclaimer).passed
    ? disclaimer
    : disclaimer + '\n\n以上分析仅供参考，祝您生活愉快。'

  const markdown = [
    `# 数字命书 · ${chart.dayMaster}${gender}`,
    '',
    baziTable,
    '',
    `> ${annotation.overview.summary}`,
    '',
    '---',
    '',
    '## 卷一 · 性格格局',
    '',
    personality.overview,
    '',
    personality.mbtiProfile ? `> ${personality.mbtiProfile}` : '',
    '',
    '---',
    '',
    '## 卷二 · 运势前瞻',
    '',
    luck.trend,
    '',
    luck.highlights ? `> ${luck.highlights}` : '',
    '',
    '---',
    '',
    '## 卷三 · 人生诸域',
    '',
    '### 性格',
    ...(specialTopics.personality.map(t => `- ${t}`)),
    '',
    '### 事业',
    ...(specialTopics.career.map(t => `- ${t}`)),
    '',
    '### 财运',
    ...(specialTopics.wealth.map(t => `- ${t}`)),
    '',
    '### 婚姻',
    ...(specialTopics.marriage.map(t => `- ${t}`)),
    '',
    '### 健康',
    ...(specialTopics.health.map(t => `- ${t}`)),
    '',
    '### 子女',
    ...(specialTopics.children.map(t => `- ${t}`)),
    '',
    '---',
    '',
    safeDisclaimer,
  ].join('\n')

  const sections: ReportSection[] = [
    { id: 'seal', title: '命书', content: `# 数字命书 · ${chart.dayMaster}${gender}\n\n${baziTable}` },
    { id: 'personality', title: '卷一 · 性格格局', content: personality.overview + '\n\n' + (personality.mbtiProfile ?? '') },
    { id: 'luck', title: '卷二 · 运势前瞻', content: luck.trend + '\n\n' + (luck.highlights ?? '') },
    { id: 'topics', title: '卷三 · 人生诸域', content: formatTopics(specialTopics) },
    { id: 'disclaimer', title: '声明', content: safeDisclaimer },
  ]

  return { markdown, sections }
}

function formatTopics(specialTopics: AnnotationResult['specialTopics']): string {
  const domainLabels: Record<string, string> = {
    personality: '性格',
    career: '事业',
    wealth: '财运',
    marriage: '婚姻',
    health: '健康',
    children: '子女',
  }

  return Object.entries(specialTopics)
    .map(([key, items]) =>
      `### ${domainLabels[key] ?? key}\n${items.map(t => `- ${t}`).join('\n')}`,
    )
    .join('\n\n')
}
