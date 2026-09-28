// ============================================================
// [ADR-011] 八字体系适配器 —— 薄适配器包住封版引擎
// 文件：src/server/systems/bazi.ts
//
// 引擎零侵入：本文件**不修改** src/engine/ 任何一行，
// 仅把既有能力（calculateBazi / generateAnnotation / chartHash / 护栏 / 格式化）
// 适配到 SystemEngine 接口，从而纳入多体系注册表。
//
// 行为等价：本适配器产出的 System Prompt 与重构前 system.ts 的输出逐字一致。
// ============================================================

import type { BaZiResult, AnnotationResult } from '../../engine'
import { calculateBazi, calculateBaziFromLunar, generateAnnotation } from '../../engine'
import {
  chartHash,
  firstDifference as baziFirstDifference,
  looksLikeChart,
  ENGINE_VERSION,
} from '../lib/chart-hash'
import { buildAntiHallucinationPromptDynamic } from '../lib/anti-hallucination'
import { formatPillars, formatShiShen, formatDaYun, formatShenSha } from '../prompts/formatters'
import type { BirthInput } from '../lib/types'
import type { SystemEngine } from './types'

/** 八字体系产物 = 命盘 + 批注 */
export interface BaziBundle {
  chart: BaZiResult
  annotation: AnnotationResult
}

/** 「命盘数据（唯一数据源）」数据段（供 ctxFor 与 buildPrompt 复用） */
function ctxLines(bundle: BaziBundle): string[] {
  const { chart, annotation } = bundle
  return [
    '## 命盘数据（唯一数据源）',
    `- 四柱：${formatPillars(chart)}`,
    `- 日主：${chart.dayMaster}（${annotation.strengthAnalysis.strength}，${annotation.strengthAnalysis.score}/100）`,
    `- 格局：${annotation.patternAnalysis.patternName}（${annotation.patternAnalysis.quality}）`,
    `- 十神：${formatShiShen(annotation.shiShenProfile)}`,
    `- 当前大运：${formatDaYun(annotation.luckAnalysis)}`,
    `- 神煞：${formatShenSha(annotation.shenSha)}`,
  ]
}

export const baziEngine: SystemEngine<BirthInput, BaziBundle> = {
  id: 'bazi',
  version: ENGINE_VERSION,

  async compute(input) {
    const chart = input.calendarType === 'lunar'
      ? await calculateBaziFromLunar(
        input.year, input.month, input.day, input.hour, input.minute ?? 0,
        input.gender, input.isLeapMonth ?? false,
      )
      : await calculateBazi(
        input.year, input.month, input.day, input.hour, input.minute ?? 0, input.gender,
      )
    return { chart, annotation: generateAnnotation(chart) }
  },

  hash(bundle) {
    return chartHash(bundle.chart)
  },

  isValidResult(value): value is BaziBundle {
    if (!value || typeof value !== 'object') return false
    const v = value as { chart?: unknown; annotation?: unknown }
    return !!v.annotation && looksLikeChart(v.chart)
  },

  firstDifference(a, b) {
    return baziFirstDifference(a.chart, b.chart)
  },

  ctxFor(bundle) {
    return ctxLines(bundle).join('\n')
  },

  buildPrompt(bundle, opts) {
    const { chart, annotation } = bundle
    const reportSummary = opts?.reportSummary
    const adminSection = opts?.adminSection ?? null
    return [
      '## 角色',
      '你是八字命理分析师"墨白"。',
      '',
      ...ctxLines(bundle),
      '',
      reportSummary ? `## 命书摘要\n${reportSummary}\n` : '',
      adminSection ? `${adminSection}\n` : '',
      buildAntiHallucinationPromptDynamic(chart, annotation),
    ].join('\n')
  },
}
