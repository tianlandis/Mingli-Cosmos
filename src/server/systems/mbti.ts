// ============================================================
// [ADR-011] MBTI 体系适配器
// 文件：src/server/systems/mbti.ts
//
// 数据来源：八字批注里已有的 MBTI 分析（annotation.patternAnalysis.mbti），
// 由封版引擎从格局 / 十神 / 五行推导 —— 本项目**不做问卷式 MBTI**，
// 而是"从命盘看人格倾向"，这正与产品定位一致（生辰即人格入口）。
//
// 因此本适配器不新增算法，只做两件事：
//   1. 把八字批注中的 MBTI 段提升为独立体系产物，纳入注册表；
//   2. 产出该体系自己的 Prompt（与八字体系口径分离）。
//
// 红线：不修改 src/engine/，只读其产物。
// ============================================================

import type { BaZiResult, AnnotationResult } from '../../engine'
import { calculateBazi, calculateBaziFromLunar, generateAnnotation } from '../../engine'
import { chartHash, ENGINE_VERSION } from '../lib/chart-hash'
import type { BirthInput } from '../lib/types'
import type { SystemEngine } from './types'

/** MBTI 段结构（与 annotation.patternAnalysis.mbti 对齐） */
export interface MbtiProfile {
  cognitiveFunctions: string
  typicalTypes: string[]
  traits: string
  portrait: string
  industrySuggestions: string[]
  energyAdjustments: string[]
}

/** MBTI 体系产物 = 命盘 + MBTI 段 */
export interface MbtiBundle {
  chart: BaZiResult
  profile: MbtiProfile
  /** 主类型（typicalTypes[0]），便于展示与指纹 */
  primaryType: string
}

function readProfile(annotation: AnnotationResult): MbtiProfile | null {
  const raw = annotation?.patternAnalysis?.mbti as MbtiProfile | undefined
  if (!raw || typeof raw !== 'object') return null
  if (!Array.isArray(raw.typicalTypes)) return null
  return raw
}

export const mbtiEngine: SystemEngine<BirthInput, MbtiBundle> = {
  id: 'mbti',
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
    const annotation = generateAnnotation(chart)
    const profile = readProfile(annotation)
    if (!profile) {
      throw new Error('该命盘未产出 MBTI 分析（引擎未给出 patternAnalysis.mbti）')
    }
    return {
      chart,
      profile,
      primaryType: profile.typicalTypes[0] ?? '—',
    }
  },

  hash(bundle) {
    return `mbti:${chartHash(bundle.chart)}`
  },

  isValidResult(value): value is MbtiBundle {
    if (!value || typeof value !== 'object') return false
    const v = value as { profile?: unknown; primaryType?: unknown }
    if (!v.profile || typeof v.profile !== 'object') return false
    const p = v.profile as { typicalTypes?: unknown }
    return Array.isArray(p.typicalTypes) && typeof v.primaryType === 'string'
  },

  ctxFor(bundle) {
    const p = bundle.profile
    return [
      '## 人格数据（唯一数据源）',
      `- MBTI 倾向：${p.typicalTypes.join(' / ')}`,
      `- 认知功能：${p.cognitiveFunctions}`,
      `- 特质：${p.traits}`,
      `- 画像：${p.portrait}`,
      p.industrySuggestions?.length ? `- 适配领域：${p.industrySuggestions.join('、')}` : '',
      p.energyAdjustments?.length ? `- 能量调节：${p.energyAdjustments.join('；')}` : '',
    ].filter(Boolean).join('\n')
  },

  buildPrompt(bundle, opts) {
    const reportSummary = opts?.reportSummary
    const adminSection = opts?.adminSection ?? null
    return [
      '## 角色',
      '你是人格分析顾问"墨白"，擅长把 MBTI 倾向讲成人话。',
      '',
      this.ctxFor(bundle),
      '',
      reportSummary ? `## 解读摘要\n${reportSummary}\n` : '',
      adminSection ? `${adminSection}\n` : '',
      [
        '## 护栏',
        '- 只依据上方人格数据作答，不得编造未列出的类型或功能栈。',
        '- 这是**从生辰推导的人格倾向**，不是问卷测评结果；被质疑时要如实说明来源。',
        '- 不要给人贴绝对标签，倾向不等于定论。',
      ].join('\n'),
    ].join('\n')
  },
}
