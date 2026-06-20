// ============================================================
// System Prompt 格式化辅助函数（共享模块）
// 文件：src/server/prompts/formatters.ts
// 职责：从 system.ts 抽离的格式化函数，供 agents/prompts.ts 复用
// ============================================================

import type { BaZiResult, AnnotationResult } from '../../engine/index'

export function formatPillars(chart: BaZiResult): string {
  const p = [chart.yearPillar, chart.monthPillar, chart.dayPillar, chart.hourPillar]
  const labels = ['年', '月', '日', '时']
  return p.map((pillar, i) => `${labels[i]}柱：${pillar.ganZhi}`).join('，')
}

export function formatShiShen(profile: AnnotationResult['shiShenProfile']): string {
  return profile
    .filter(p => p.count > 0)
    .map(p => `${p.name}(${p.count})`)
    .join('、')
}

export function formatDaYun(luck: AnnotationResult['luckAnalysis']): string {
  const current = luck.daYunList.find(d => d.quality !== undefined) ?? luck.daYunList[0]
  return current
    ? `${current.ganZhi}（${current.startAge}-${current.endAge}岁，${current.quality}）`
    : '暂未起运'
}

export function formatShenSha(shenSha: AnnotationResult['shenSha']): string {
  if (!shenSha.items || shenSha.items.length === 0) return '无明显神煞'
  return shenSha.items
    .slice(0, 5)
    .map(i => `${i.name}(${i.type}，${i.pillar})`)
    .join('、')
}
