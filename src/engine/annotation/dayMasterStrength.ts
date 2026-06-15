// ============================================================
// 日主强弱判断模块
// ============================================================

import type { BaZiResult } from '../types'
import { TIAN_GAN_WUXING, DI_ZHI_WUXING, TIAN_GAN_YIN_YANG, HIDDEN_STEMS } from '../types'
import { WUXING_SHENG, DI_ZHI_BEN_QI_WUXING, MONTH_POWER } from './wuxing'
import type { DayMasterStrength, StrengthAnalysis } from './types'

/** 月令旺衰→分数映射 */
const MONTH_POWER_SCORE: Record<string, number> = {
  '旺': 40, '相': 25, '余气': 10, '休': 0, '囚': 0,
}

/** 地支根气得分 */
function scoreDiZhiGen(branch: string, dayMasterWx: string): number {
  let score = 0
  // 本气
  const benQi = DI_ZHI_BEN_QI_WUXING[branch]
  if (benQi === dayMasterWx) score += 15
  // 与日主同五行（地支五行）
  if (DI_ZHI_WUXING[branch] === dayMasterWx) score += 5
  // 藏干包含日主五行
  const hidden = HIDDEN_STEMS[branch] ?? []
  for (const hs of hidden) {
    if (TIAN_GAN_WUXING[hs] === dayMasterWx) score += 5
  }
  return score
}

/** 判断地支是否包含日主根气 */
function hasRoot(branch: string, dayMasterWx: string): boolean {
  if (DI_ZHI_WUXING[branch] === dayMasterWx) return true
  const hidden = HIDDEN_STEMS[branch] ?? []
  return hidden.some(hs => TIAN_GAN_WUXING[hs] === dayMasterWx)
}

/** 全局天干数量分析 */
function analyzeTianGan(bazi: BaZiResult, dayMasterWx: string): {
  biJieCount: number
  yinCount: number
  guanShaCount: number
  shiShangCount: number
  caiCount: number
  biJieScore: number
  supportScore: number
  exhaustScore: number
} {
  const stems = [
    bazi.yearPillar.stem,
    bazi.monthPillar.stem,
    bazi.hourPillar.stem,
  ]
  let biJieCount = 0, yinCount = 0, guanShaCount = 0, shiShangCount = 0, caiCount = 0

  for (const stem of stems) {
    const wx = TIAN_GAN_WUXING[stem]
    if (!wx) continue
    if (wx === dayMasterWx) biJieCount++
    else if (WUXING_SHENG[wx] === dayMasterWx) yinCount++
    else if (WUXING_SHENG[dayMasterWx] === wx) shiShangCount++
    else {
      // 克或被克
      const rel = getRelation(wx, dayMasterWx)
      if (rel === '克我') guanShaCount++
      else if (rel === '我克') caiCount++
    }
  }

  const supportScore = biJieCount * 10 + yinCount * 8
  const exhaustScore = guanShaCount * 8 + shiShangCount * 7 + caiCount * 6
  return { biJieCount, yinCount, guanShaCount, shiShangCount, caiCount, biJieScore: biJieCount * 10, supportScore, exhaustScore }
}

function getRelation(fromWx: string, toWx: string): '生我' | '我生' | '克我' | '我克' | '同' {
  const KE: Record<string, string> = { '金': '木', '木': '土', '土': '水', '水': '火', '火': '金' }
  const SHENG = WUXING_SHENG
  if (fromWx === toWx) return '同'
  if (SHENG[fromWx] === toWx) return '我生'
  if (SHENG[toWx] === fromWx) return '生我'
  if (KE[fromWx] === toWx) return '我克'
  if (KE[toWx] === fromWx) return '克我'
  return '同'
}

/** 从分数得到旺衰等级 */
function scoreToStrength(score: number): DayMasterStrength {
  if (score >= 75) return '极强'
  if (score >= 60) return '强'
  if (score >= 48) return '中和偏强'
  if (score >= 38) return '中和'
  if (score >= 28) return '中和偏弱'
  if (score >= 15) return '弱'
  return '极弱'
}

/** 计算日主强弱 */
export function analyzeDayMasterStrength(bazi: BaZiResult): StrengthAnalysis {
  const dayMasterWx = TIAN_GAN_WUXING[bazi.dayMaster] ?? ''
  const dayMasterYy = TIAN_GAN_YIN_YANG[bazi.dayMaster] ?? '阳'
  const monthBranch = bazi.monthPillar.branch
  const monthNumber = ['', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥', '子', '丑'].indexOf(monthBranch)

  const reasons: string[] = []

  // 1. 月令旺衰得分
  const monthPower = MONTH_POWER[dayMasterWx]?.[monthNumber] ?? '休'
  const yueLingScore = MONTH_POWER_SCORE[monthPower] ?? 0
  const yueLingDesc: Record<string, string> = {
    '旺': `日主${dayMasterWx}在${monthBranch}月当令得旺，力量充足`,
    '相': `日主${dayMasterWx}在${monthBranch}月为相地，有一定力量`,
    '余气': `日主${dayMasterWx}在${monthBranch}月有余气`,
    '休': `日主${dayMasterWx}在${monthBranch}月失令为休`,
    '囚': `日主${dayMasterWx}在${monthBranch}月失令为囚`,
  }
  reasons.push(`月令层面：${yueLingDesc[monthPower] ?? monthPower}`)

  // 2. 地支根气得分
  const branches = [
    { name: '年支', branch: bazi.yearPillar.branch, weight: 0.5 },
    { name: '月支', branch: bazi.monthPillar.branch, weight: 1 },
    { name: '日支', branch: bazi.dayPillar.branch, weight: 1.2 },
    { name: '时支', branch: bazi.hourPillar.branch, weight: 0.8 },
  ]

  let diZhiGenScore = 0
  const rootBranches: string[] = []
  for (const b of branches) {
    const s = scoreDiZhiGen(b.branch, dayMasterWx)
    const weighted = Math.round(s * b.weight)
    diZhiGenScore += weighted
    if (hasRoot(b.branch, dayMasterWx)) {
      rootBranches.push(b.name)
    }
  }
  if (rootBranches.length > 0) {
    reasons.push(`地支根气：${rootBranches.join('、')}有根，日主有依托`)
  } else {
    reasons.push('地支根气：四支无日主之根，日主虚浮无依')
  }

  // 3. 天干生扶 vs 克泄耗
  const tianGanResult = analyzeTianGan(bazi, dayMasterWx)
  const tianGanBiJieScore = tianGanResult.biJieScore
  const shengFuScore = tianGanResult.supportScore
  const keXieHaoScore = tianGanResult.exhaustScore

  if (tianGanResult.biJieCount > 0) {
    reasons.push(`天干层面：天干有${tianGanResult.biJieCount}个比劫帮身`)
  }
  if (tianGanResult.yinCount > 0) {
    reasons.push(`天干层面：天干有${tianGanResult.yinCount}个印星生身`)
  }
  if (tianGanResult.biJieCount === 0 && tianGanResult.yinCount === 0) {
    reasons.push('天干层面：无印比生扶，天干克泄耗力量偏重')
  }

  // 4. 综合评分
  let totalScore = yueLingScore + Math.min(diZhiGenScore, 40) + Math.min(tianGanBiJieScore + (shengFuScore - tianGanBiJieScore) * 0.6, 25)
  totalScore = Math.max(0, Math.min(100, totalScore)) // clamp 0-100

  // 调整：克泄耗力量远大于生扶 → 减弱
  if (keXieHaoScore > shengFuScore * 2) {
    totalScore = Math.max(0, totalScore - 10)
    reasons.push('全局克泄耗力量远大于生扶，日主偏弱')
  }
  if (shengFuScore > keXieHaoScore * 2) {
    totalScore = Math.min(100, totalScore + 10)
    reasons.push('全局生扶力量远大于克泄耗，日主偏强')
  }

  // 5. 是否有强根（日支或月支临官/帝旺）
  const dayBranchState = hasRoot(bazi.dayPillar.branch, dayMasterWx) && DI_ZHI_BEN_QI_WUXING[bazi.dayPillar.branch] === dayMasterWx
  const monthBranchState = hasRoot(bazi.monthPillar.branch, dayMasterWx) && DI_ZHI_BEN_QI_WUXING[bazi.monthPillar.branch] === dayMasterWx
  if (dayBranchState) {
    totalScore += 5
    reasons.push('日支为日主本气根，根基稳固')
  }
  if (monthBranchState && monthPower === '旺') {
    totalScore += 5
    reasons.push('月令为日主本气且当令，力量极强')
  }

  totalScore = Math.max(0, Math.min(100, totalScore))

  const strength = scoreToStrength(totalScore)

  return {
    strength,
    score: totalScore,
    reasons,
    components: {
      yueLing: yueLingScore,
      diZhiGen: diZhiGenScore,
      tianGanBiJie: tianGanBiJieScore,
      shengFu: shengFuScore,
      keXieHao: keXieHaoScore,
    }
  }
}
