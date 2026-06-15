// ============================================================
// 用神忌神判断模块
// ============================================================

import type { BaZiResult } from '../types'
import { TIAN_GAN_WUXING, HIDDEN_STEMS } from '../types'
import { WUXING_SHENG, WUXING_KE, whoShengMe, whoKeMe, meKe, meSheng, getWuXingRelation } from './wuxing'
import type { DayMasterStrength, StrengthAnalysis, YongShenResult } from './types'

const WUXING = ['金', '木', '水', '火', '土'] as const

/** 身强 → 用神取克泄耗，忌神取生扶 */
function getYongShenForStrong(dayMasterWx: string, bazi: BaZiResult): YongShenResult {
  // 用神：克我（官杀）、我生（食伤）、我克（财）
  const yongShen = new Set<string>()
  yongShen.add(meKe(dayMasterWx))              // 财 (我克)
  yongShen.add(meSheng(dayMasterWx))            // 食伤 (我生)
  whoKeMe(dayMasterWx).forEach(w => yongShen.add(w)) // 官杀 (克我)

  // 忌神：生我（印）、同我（比劫）
  const jiShen = new Set<string>()
  jiShen.add(dayMasterWx)                       // 比劫
  whoShengMe(dayMasterWx).forEach(w => jiShen.add(w)) // 印星

  // 闲神：不在用神忌神中的
  const xianShen: string[] = []
  for (const w of WUXING) {
    if (!yongShen.has(w) && !jiShen.has(w)) xianShen.push(w)
  }

  const reason = [
    `日主${dayMasterWx}身强，宜克泄耗以求平衡。`,
    `用神取${[...yongShen].join('、')}，可制强扶弱。`,
    `忌神为${[...jiShen].join('、')}，不宜再加强。`,
  ]

  return { yongShen: [...yongShen], jiShen: [...jiShen], xianShen, reason, tiaoHou: [] }
}

/** 身弱 → 用神取生扶，忌神取克泄耗 */
function getYongShenForWeak(dayMasterWx: string, bazi: BaZiResult): YongShenResult {
  // 用神：生我（印）、同我（比劫）
  const yongShen = new Set<string>()
  yongShen.add(dayMasterWx)                       // 比劫
  whoShengMe(dayMasterWx).forEach(w => yongShen.add(w)) // 印星

  // 忌神：克我（官杀）、我生（食伤）、我克（财）
  const jiShen = new Set<string>()
  jiShen.add(meKe(dayMasterWx))                   // 财
  whoKeMe(dayMasterWx).forEach(w => jiShen.add(w)) // 官杀

  // 用神也是食伤的情况：伤食在身弱时最忌
  jiShen.add(meSheng(dayMasterWx))                // 食伤

  const xianShen: string[] = []
  for (const w of WUXING) {
    if (!yongShen.has(w) && !jiShen.has(w)) xianShen.push(w)
  }

  const reason = [
    `日主${dayMasterWx}身弱，宜生扶补益。`,
    `用神取${[...yongShen].join('、')}，可扶助日主。`,
    `忌神为${[...jiShen].join('、')}，不宜克泄耗。`,
  ]

  return { yongShen: [...yongShen], jiShen: [...jiShen], xianShen, reason, tiaoHou: [] }
}

/** 中和 → 均衡为主，根据月令调候 */
function getYongShenForNeutral(dayMasterWx: string, monthBranch: string): YongShenResult {
  const reason = [`日主${dayMasterWx}中和，取用需灵活，以调候为先。`]

  const result: YongShenResult = {
    yongShen: [dayMasterWx],
    jiShen: [],
    xianShen: [],
    reason,
    tiaoHou: [],
  }

  // 中和取用以保持平衡为主
  for (const w of WUXING) {
    if (w !== dayMasterWx) {
      whoShengMe(dayMasterWx).includes(w) ? result.yongShen.push(w) : result.xianShen.push(w)
    }
  }

  return result
}

/** 根据月令寒暖燥湿调候 */
function getTiaoHou(dayMasterWx: string, monthBranch: string): string[] {
  const tiaoHou: string[] = []

  // 夏季 (巳午未) → 喜水润局
  if (['巳', '午', '未'].includes(monthBranch)) {
    tiaoHou.push('水')
    if (!['壬', '癸'].includes(dayMasterWx)) {
      tiaoHou.push('夏季火炎土燥，喜水调候润局')
    }
  }

  // 冬季 (亥子丑) → 喜火暖局
  if (['亥', '子', '丑'].includes(monthBranch)) {
    tiaoHou.push('火')
    if (!['丙', '丁'].includes(dayMasterWx)) {
      tiaoHou.push('冬季水冷金寒，喜火暖局解冻')
    }
  }

  // 秋季 (申酉戌) → 金旺喜火炼
  if (['申', '酉', '戌'].includes(monthBranch) && dayMasterWx === '金') {
    tiaoHou.push('火')
  }

  return tiaoHou
}

/** 判断全局五行偏向，辅助取用 */
function analyzeGlobalBias(bazi: BaZiResult, dayMasterWx: string): {
  dominantWx: string
  weakestWx: string
} {
  const counts: Record<string, number> = { '金': 0, '木': 0, '水': 0, '火': 0, '土': 0 }

  const pillars = [bazi.yearPillar, bazi.monthPillar, bazi.dayPillar, bazi.hourPillar]
  for (const p of pillars) {
    counts[p.stemWuXing]++
    counts[p.branchWuXing]++
    for (const hs of p.hiddenStems) {
      const wx = TIAN_GAN_WUXING[hs]
      if (wx) counts[wx]++
    }
  }

  let dominantWx = '木', maxCount = 0
  let weakestWx = '木', minCount = Infinity
  for (const [wx, count] of Object.entries(counts)) {
    if (count > maxCount) { maxCount = count; dominantWx = wx }
    if (count < minCount) { minCount = count; weakestWx = wx }
  }

  return { dominantWx, weakestWx }
}

/** 主入口：根据日主强弱给出用神忌神 */
export function analyzeYongShen(
  bazi: BaZiResult,
  strength: StrengthAnalysis,
): YongShenResult {
  const dayMasterWx = TIAN_GAN_WUXING[bazi.dayMaster] ?? ''
  const monthBranch = bazi.monthPillar.branch

  // 基础用神（根据强弱）
  let result: YongShenResult
  const strengthLevel = strength.strength

  if (strengthLevel === '极强' || strengthLevel === '强' || strengthLevel === '中和偏强') {
    result = getYongShenForStrong(dayMasterWx, bazi)
    result.reason.push('身强格局，以克泄耗制衡为要。')
  } else if (strengthLevel === '极弱' || strengthLevel === '弱' || strengthLevel === '中和偏弱') {
    result = getYongShenForWeak(dayMasterWx, bazi)
    result.reason.push('身弱格局，以生扶补益为要。')
  } else {
    result = getYongShenForNeutral(dayMasterWx, monthBranch)
  }

  // 调候用神
  const tiaoHou = getTiaoHou(dayMasterWx, monthBranch)
  result.tiaoHou = tiaoHou
  if (tiaoHou.length > 1 && !result.yongShen.includes(tiaoHou[0])) {
    result.yongShen.push(tiaoHou[0])
    result.reason.push(`调候考虑：${tiaoHou.filter(s => s.length > 1).join('；')}`)
  }

  // 全局偏向调整
  const bias = analyzeGlobalBias(bazi, dayMasterWx)
  if (bias.dominantWx !== dayMasterWx) {
    if (result.yongShen.includes(bias.dominantWx) && strengthLevel.includes('强')) {
      // 全局最旺的五行已在用神中，可能需要重新考量
    }
  }

  // 去重用神忌神
  result.yongShen = [...new Set(result.yongShen)]
  result.jiShen = [...new Set(result.jiShen)]

  return result
}
