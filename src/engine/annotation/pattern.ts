// ============================================================
// 格局判断模块
// ============================================================

import type { BaZiResult } from '../types'
import { TIAN_GAN_WUXING, TIAN_GAN_YIN_YANG, HIDDEN_STEMS } from '../types'
import { getShiShenName, DI_ZHI_BEN_QI_WUXING, WUXING_SHENG, WUXING_KE } from './wuxing'
import type { PatternAnalysis, PatternType } from './types'

/** 月令藏干 → 天干十神映射（相对于日主） */
interface GeJuCheck {
  patternName: string     // 格局名
  shiShenName: string     // 十神名
  condition: string       // 成格条件说明
}

/** 藏干是否透出天干 */
function isHiddenStemRevealed(
  hiddenStems: string[],
  stems: string[],
  dayMaster: string,
): { revealed: string[]; shiShen: string } {
  const dayMasterWx = TIAN_GAN_WUXING[dayMaster] ?? ''
  const dayMasterYy = TIAN_GAN_YIN_YANG[dayMaster] ?? '阳'
  const revealed: string[] = []

  for (const hs of hiddenStems) {
    if (stems.includes(hs)) {
      revealed.push(hs)
    }
  }

  // 取第一个透出的藏干的十神为月令格局
  if (revealed.length > 0) {
    const firstWx = TIAN_GAN_WUXING[revealed[0]] ?? ''
    const firstYy = TIAN_GAN_YIN_YANG[revealed[0]] ?? '阳'
    return { revealed, shiShen: getShiShenName(dayMasterWx, dayMasterYy, firstWx, firstYy) }
  }

  return { revealed: [], shiShen: '' }
}

/** 十神名 → 格局名映射 */
const SHISHEN_TO_PATTERN: Record<string, string> = {
  '正官': '正官格', '偏官': '偏官格',
  '正印': '正印格', '偏印': '偏印格',
  '食神': '食神格', '伤官': '伤官格',
  '正财': '正财格', '偏财': '偏财格',
  '比肩': '建禄格', '劫财': '建禄格',
}

/** 判断格局 */
export function analyzePattern(
  bazi: BaZiResult,
  dayMasterStrength: string,
): PatternAnalysis {
  const monthBranch = bazi.monthPillar.branch
  const monthHidden = HIDDEN_STEMS[monthBranch] ?? []
  const allStems = [
    bazi.yearPillar.stem,
    bazi.monthPillar.stem,
    bazi.dayPillar.stem,
    bazi.hourPillar.stem,
  ]

  // 日主用神
  const dayMasterWx = TIAN_GAN_WUXING[bazi.dayMaster] ?? ''

  // 1. 检查月令藏干是否透出天干 → 正格
  const { revealed, shiShen } = isHiddenStemRevealed(monthHidden, allStems, bazi.dayMaster)

  // 月令本气透出 → 直接取正格
  const monthMainQi = DI_ZHI_BEN_QI_WUXING[monthBranch]
  const monthMainStem = monthHidden[0] // 主气对应的天干

  let patternName = ''
  let patternType: PatternType = '正格'
  let conditions: string[] = []
  let quality: '上等' | '中等' | '平' = '平'
  let description = ''

  if (revealed.length > 0) {
    patternName = SHISHEN_TO_PATTERN[shiShen] ?? shiShen + '格'
    patternType = '正格'
    conditions.push(`月令${monthBranch}藏干${revealed.join('、')}透出天干`)
    conditions.push(`透出之神为${shiShen}，故取${patternName}`)

    // 格局高低判断
    if (shiShen === '正官' || shiShen === '正印' || shiShen === '食神' || shiShen === '正财') {
      quality = '上等'
      description = `${patternName}为正格中之上品，${shiShen}为吉神顺用，命主有福。`
    } else if (shiShen === '偏财') {
      quality = '中等'
      description = `${patternName}格局不低，偏财旺者善于经营投资。`
    } else if (shiShen === '伤官' || shiShen === '偏官') {
      quality = '中等'
      description = `${patternName}格局较高，但需有制化方能得用。`
      if (shiShen === '伤官') {
        description += '伤官需配印（伤官配印格）或生财（伤官生财格），方为佳美。'
      }
      if (shiShen === '偏官') {
        description += '偏官需有制（食神制杀格），无制则刚暴。'
      }
    }
    if (shiShen === '比肩' || shiShen === '劫财') {
      quality = '平'
      description = `月令为${patternName}，日主坐禄/刃，需看全局配合。`
    }
  } else {
    // 月令不透 → 取月令本气所对应的格局（隐性格局）
    const mainQiWx = monthMainQi
    const dayYy = TIAN_GAN_YIN_YANG[bazi.dayMaster] ?? '阳'
    const implShiShen = getShiShenName(dayMasterWx, dayYy, mainQiWx ?? '', '阳')
    patternName = SHISHEN_TO_PATTERN[implShiShen] ?? `${monthBranch}月${implShiShen}格`
    patternType = '正格'
    conditions.push(`月令${monthBranch}藏干未透出天干，取月令本气${monthMainQi ?? '?'}为格`)
    conditions.push(`月令本气对应十神为${implShiShen}，故取${patternName}`)
    quality = '平'
    description = `格局${patternName}，月令藏干不透，格局层次一般，需看运助。`
  }

  // 2. 检查从格（日主极弱且全局偏向）
  const isSuperWeak = dayMasterStrength === '极弱'
  if (isSuperWeak) {
    const fromGe = checkCongGe(bazi)
    if (fromGe) {
      patternName = fromGe.name
      patternType = '从格'
      conditions = fromGe.conditions
      quality = fromGe.quality
      description = fromGe.description
    }
  }

  // 3. 检查特殊格局
  if (!isSuperWeak) {
    const specialGe = checkSpecialPattern(bazi)
    if (specialGe) {
      patternName = specialGe.name
      patternType = '特殊格局'
      conditions = [...conditions, ...specialGe.conditions]
      quality = specialGe.quality
      description = specialGe.description
    }
  }

  if (!description) {
    description = `${patternName}，命局配合适中。`
  }

  return {
    patternType,
    patternName,
    conditions,
    quality,
    description,
  }
}

/** 检查从格 */
function checkCongGe(bazi: BaZiResult): { name: string; conditions: string[]; quality: '上等' | '中等' | '平'; description: string } | null {
  const dayMasterWx = TIAN_GAN_WUXING[bazi.dayMaster] ?? ''

  // 统计各五行力量
  const fiveCount: Record<string, number> = { '金': 0, '木': 0, '水': 0, '火': 0, '土': 0 }
  const pillars = [bazi.yearPillar, bazi.monthPillar, bazi.dayPillar, bazi.hourPillar]
  for (const p of pillars) {
    fiveCount[p.stemWuXing] = (fiveCount[p.stemWuXing] ?? 0) + 1
    fiveCount[p.branchWuXing] = (fiveCount[p.branchWuXing] ?? 0) + 1
    for (const hs of p.hiddenStems) {
      const wx = TIAN_GAN_WUXING[hs]
      if (wx) fiveCount[wx] = (fiveCount[wx] ?? 0) + 1
    }
  }

  // 找出主导五行（日主之外的）
  let dominantWx = ''
  let dominantCount = 0
  for (const [wx, c] of Object.entries(fiveCount)) {
    if (wx !== dayMasterWx && c > dominantCount) {
      dominantCount = c
      dominantWx = wx
    }
  }

  if (dominantCount < 5) return null // 不够集中

  // 判断具体从格类型
  const dayMasterYy = TIAN_GAN_YIN_YANG[bazi.dayMaster] ?? '阳'
  const dmWx = TIAN_GAN_WUXING[bazi.dayMaster]
  const dominantYy = '阳' // 简化

  // 官杀主导 → 从杀格
  const guanShaWx = WUXING_KE[dayMasterWx]
  const caiWx = WUXING_SHENG[guanShaWx ?? ''] // 财生官杀
  const shiShangWx = WUXING_SHENG[dayMasterWx]

  if (guanShaWx && fiveCount[guanShaWx] >= 4) {
    return {
      name: '从杀格',
      conditions: [
        `日主${dayMasterWx}极弱无根`,
        `全局官杀(${guanShaWx})力量占主导（${fiveCount[guanShaWx]}个）`,
        '日主不得不弃命从杀',
      ],
      quality: '上等',
      description: '从杀格，格局清纯，顺势而为，利于权势领域发展。行运需官杀、财星为佳，忌印比。',
    }
  }

  // 财星主导 → 从财格
  if (caiWx && fiveCount[caiWx] >= 4) {
    return {
      name: '从财格',
      conditions: [
        `日主${dayMasterWx}极弱无根`,
        `全局财星(${caiWx})力量占主导（${fiveCount[caiWx]}个）`,
        '日主弃命从财',
      ],
      quality: '中等',
      description: '从财格，格局清奇，善于经商理财。行运喜财、食伤，忌印比。',
    }
  }

  // 食伤主导 → 从儿格
  if (shiShangWx && fiveCount[shiShangWx] >= 4) {
    return {
      name: '从儿格',
      conditions: [
        `日主${dayMasterWx}极弱无根`,
        `全局食伤(${shiShangWx})力量占主导（${fiveCount[shiShangWx]}个）`,
        '日主弃命从儿',
      ],
      quality: '中等',
      description: '从儿格，才华横溢，适合艺术创作领域。行运喜食伤、财星。',
    }
  }

  // 多种力量 → 从势格
  return {
    name: '从势格',
    conditions: [
      `日主${dayMasterWx}极弱无根`,
      `全局非日主之五行力量集中`,
      '日主弃命从势，顺势而为',
    ],
    quality: '平',
    description: '从势格，日主极弱，顺势而从。需看大运配合，整体运势起伏较大。',
  }
}

/** 检查特殊格局 */
function checkSpecialPattern(bazi: BaZiResult): { name: string; conditions: string[]; quality: '上等' | '中等' | '平'; description: string } | null {
  const dayStem = bazi.dayMaster
  const dayBranch = bazi.dayPillar.branch

  // 建禄格 / 阳刃格（日干坐禄或帝旺）
  // 甲禄在寅, 乙禄在卯, 丙戊禄在巳, 丁己禄在午, 庚禄在申, 辛禄在酉, 壬禄在亥, 癸禄在子
  const LU_MAP: Record<string, string> = {
    '甲': '寅', '乙': '卯', '丙': '巳', '丁': '午',
    '戊': '巳', '己': '午', '庚': '申', '辛': '酉',
    '壬': '亥', '癸': '子',
  }

  // 帝旺: 甲卯, 乙寅, 丙午, 丁巳, 戊午, 己巳, 庚酉, 辛申, 壬子, 癸亥
  const WANG_MAP: Record<string, string> = {
    '甲': '卯', '乙': '寅', '丙': '午', '丁': '巳',
    '戊': '午', '己': '巳', '庚': '酉', '辛': '申',
    '壬': '子', '癸': '亥',
  }

  if (LU_MAP[dayStem] === dayBranch) {
    return {
      name: '建禄格',
      conditions: [`日干${dayStem}坐禄地${dayBranch}，为建禄格`],
      quality: '中等',
      description: '建禄格，日主得禄，自身力量充足。宜食伤生财或官杀制身为佳。',
    }
  }

  if (WANG_MAP[dayStem] === dayBranch) {
    return {
      name: '阳刃格',
      conditions: [`日干${dayStem}坐帝旺${dayBranch}，为阳刃格`],
      quality: '平',
      description: '阳刃格，日主过旺刚猛。需官杀制刃或食伤泄秀，方能成器。',
    }
  }

  return null
}
