// ============================================================
// 八字取格判断规则（V2.0 核心算法）
// 来源：八字取格判断规则引导词（V2.0）+ 从月令取用到实战策略的完整解析
// ============================================================

import type { BaZiResult } from '../types'
import {
  TIAN_GAN_WUXING, TIAN_GAN_YIN_YANG,
  HIDDEN_STEMS_DAYS, type HiddenStemSegment,
} from '../types'
import { getShiShenName } from '../annotation/wuxing'

// ─── 常量定义 ───

/** 四正月 */
const SI_ZHENG = ['子', '午', '卯', '酉']
/** 四长生月 */
const SI_CHANG_SHENG = ['寅', '申', '巳', '亥']

/** 十神 → 格局名映射 */
const SHISHEN_TO_PATTERN: Record<string, string> = {
  '正官': '正官格', '偏官': '偏官格',
  '正印': '正印格', '偏印': '偏印格',
  '食神': '食神格', '伤官': '伤官格',
  '正财': '正财格', '偏财': '偏财格',
  '比肩': '建禄格', '劫财': '羊刃格',
}

/** 格局吉凶分类 */
export const PATTERN_JI_XIONG: Record<string, { type: '吉' | '凶' | '中性'; desc: string }> = {
  '正官格':   { type: '吉',   desc: '喜生扶，忌克制、混杂' },
  '正印格':   { type: '吉',   desc: '喜生扶，忌财星破印' },
  '偏印格':   { type: '吉',   desc: '喜生扶，忌财星破印' },
  '食神格':   { type: '吉',   desc: '喜生扶，忌偏印倒食' },
  '正财格':   { type: '吉',   desc: '喜生扶，忌比劫夺财' },
  '偏财格':   { type: '吉',   desc: '喜生扶，忌比劫夺财' },
  '七杀格':   { type: '凶',   desc: '喜制化（食神制杀/印化杀），忌财星滋杀' },
  '伤官格':   { type: '凶',   desc: '喜制化（伤官配印/伤官生财），忌见官星' },
  '羊刃格':   { type: '凶',   desc: '喜制化（官杀制刃/食伤泄刃），忌财星党杀' },
  '建禄格':   { type: '中性', desc: '喜顺局（财官印食引导），忌冲禄、禄刃交汇' },
}

// ─── 辅助函数 ───

/** 日主与目标天干的十神名 */
function stemShiShen(dayMaster: string, targetStem: string): string {
  if (dayMaster === targetStem) return '比肩'
  const dmWx = TIAN_GAN_WUXING[dayMaster] ?? ''
  const dmYy = TIAN_GAN_YIN_YANG[dayMaster] ?? '阳'
  const tWx = TIAN_GAN_WUXING[targetStem] ?? ''
  const tYy = TIAN_GAN_YIN_YANG[targetStem] ?? '阳'
  return getShiShenName(dmWx, dmYy, tWx, tYy)
}

/** 检查是否为比劫类十神 */
function isBiJie(shiShen: string): boolean {
  return shiShen === '比肩' || shiShen === '劫财'
}

// ─── 规则一：四正月直接取本气 ───

function resolveSiZheng(monthBranch: string, dayMaster: string): PatternResult {
  const segments = HIDDEN_STEMS_DAYS[monthBranch]
  if (!segments || segments.length === 0) {
    return { found: false }
  }
  const mainStem = segments[0].stem // 四正月只有一个藏干
  const shiShen = stemShiShen(dayMaster, mainStem)
  const patternName = SHISHEN_TO_PATTERN[shiShen] ?? shiShen + '格'

  return {
    found: true,
    patternName,
    shiShen,
    sourceStem: mainStem,
    rule: '四正月直接取本气',
    method: '四正月',
    conditions: [
      `月支${monthBranch}为四正月（子午卯酉），气最专一`,
      `取本气${mainStem}与日主十神${shiShen}，定${patternName}`,
    ],
  }
}

// ─── 规则二：透干取用 ───

function resolveTouGan(
  monthBranch: string,
  dayMaster: string,
  allStems: { stem: string; position: '月干' | '年干' | '时干' }[],
): PatternResult | null {
  const segments = HIDDEN_STEMS_DAYS[monthBranch]
  if (!segments) return null

  const hiddenSet = new Set(segments.map(s => s.stem))

  // 优先级：月干 > 年干 > 时干
  const priorityOrder = ['月干', '年干', '时干'] as const
  for (const pos of priorityOrder) {
    const match = allStems.find(s => s.position === pos && hiddenSet.has(s.stem))
    if (match) {
      const shiShen = stemShiShen(dayMaster, match.stem)
      const patternName = SHISHEN_TO_PATTERN[shiShen] ?? shiShen + '格'

      return {
        found: true,
        patternName,
        shiShen,
        sourceStem: match.stem,
        rule: `月令藏干透出天干（${match.position}透${match.stem}）`,
        method: '透干取用',
        conditions: [
          `月令${monthBranch}藏干${match.stem}透出在${match.position}`,
          `取透出之神${match.stem}与日主十神${shiShen}，定${patternName}`,
        ],
      }
    }
  }

  return null
}

// ─── 规则三：月令分金 ───

function resolveFenJin(
  monthBranch: string,
  dayMaster: string,
  qiYunDays: number,
  daYunForward: boolean,
): FenJinResult {
  const segments = HIDDEN_STEMS_DAYS[monthBranch]
  if (!segments || segments.length === 0) {
    return { found: false, error: '无可用分金数据' }
  }

  // 分金方向
  // 阳男阴女(大运顺排) → 分金逆数 → effectiveDays = 30 - qiYunDays
  // 阴男阳女(大运逆排) → 分金顺数 → effectiveDays = qiYunDays
  const fenJinReverse = daYunForward
  const effectiveDays = fenJinReverse
    ? Math.max(1, 30 - qiYunDays)
    : Math.max(1, qiYunDays)

  // 在分金刻度尺上定位
  let accumulated = 0
  let targetStem = ''
  let targetDays = 0

  for (const seg of segments) {
    accumulated += seg.days
    if (effectiveDays <= accumulated) {
      targetStem = seg.stem
      targetDays = seg.days
      break
    }
  }

  // 回退到最后一个藏干
  if (!targetStem && segments.length > 0) {
    const last = segments[segments.length - 1]
    targetStem = last.stem
    targetDays = last.days
  }

  const shiShen = stemShiShen(dayMaster, targetStem)

  return {
    found: true,
    targetStem,
    shiShen,
    fenJinReverse,
    effectiveDays: Math.min(effectiveDays, 30),
    steps: [
      `大运${daYunForward ? '顺排' : '逆排'} → 分金${fenJinReverse ? '逆数' : '顺数'}`,
      `起运天数=${qiYunDays}，有效分金天数=${effectiveDays}`,
      `分金刻度定位 → ${targetStem}(${targetDays}天区段)`,
      `${targetStem}与日主十神关系 → ${shiShen}`,
    ],
  }
}

/** 分金结果 */
interface FenJinResult {
  found: boolean
  targetStem?: string
  shiShen?: string
  fenJinReverse?: boolean
  effectiveDays?: number
  steps?: string[]
  error?: string
}

// ─── 比劫不成格特殊处理 ───

function resolveBiJieException(
  monthBranch: string,
  dayMaster: string,
  fenJinResult: FenJinResult,
  daYunForward: boolean,
  fenJinReverse: boolean,
  segments: HiddenStemSegment[],
): { patternName?: string; shiShen?: string; action: string; conditions: string[] } | null {
  const fjStem = fenJinResult.targetStem!
  const fjShen = fenJinResult.shiShen!

  // 禄格破例：四长生月 + 日干得禄
  // 甲禄在寅, 丙戊禄在巳, 庚禄在申, 壬禄在亥
  const LU_MAP: Record<string, string> = {
    '甲': '寅', '丙': '巳', '戊': '巳', '庚': '申', '壬': '亥',
  }
  if (SI_CHANG_SHENG.includes(monthBranch) && LU_MAP[dayMaster] === monthBranch) {
    return {
      patternName: '建禄格',
      shiShen: fjShen,
      action: '破例立禄格',
      conditions: [
        `月支${monthBranch}为四长生月，日干${dayMaster}得禄于此`,
        `分金结果虽为比劫，但满足禄格条件，破例立为建禄格`,
      ],
    }
  }

  // 羊刃格破例：四正月 + 日干为羊刃
  // 甲刃在卯, 丙戊刃在午, 庚刃在酉, 壬刃在子
  const REN_MAP: Record<string, string> = {
    '甲': '卯', '丙': '午', '戊': '午', '庚': '酉', '壬': '子',
  }
  if (SI_ZHENG.includes(monthBranch) && REN_MAP[dayMaster] === monthBranch) {
    return {
      patternName: '羊刃格',
      shiShen: fjShen,
      action: '破例立羊刃格',
      conditions: [
        `月支${monthBranch}为四正位，日干${dayMaster}羊刃在此`,
        `分金结果虽为比劫，但满足羊刃格条件，破例立为羊刃格`,
      ],
    }
  }

  // 通用规则：比劫不成格，进退一位
  const allStems = segments.map(s => s.stem)
  const fjIdx = allStems.indexOf(fjStem)

  // 分金逆数时「进一位」意味着在刻度尺上往后移一位
  // 分金顺数时「退一位」意味着在刻度尺上前移一位
  let adjacentIdx: number
  let direction: string
  if (fjIdx === 0) {
    // 第一个位置，只能往后移
    adjacentIdx = 1
    direction = '后移'
  } else if (fjIdx === allStems.length - 1) {
    // 最后一个位置，只能往前移
    adjacentIdx = allStems.length - 2
    direction = '前移'
  } else {
    // 中间位置，按分金方向移动
    // 逆数→进一位(往后), 顺数→退一位(往前)
    if (fenJinReverse) {
      adjacentIdx = Math.min(fjIdx + 1, allStems.length - 1)
      direction = '进一位'
    } else {
      adjacentIdx = Math.max(fjIdx - 1, 0)
      direction = '退一位'
    }
  }

  if (adjacentIdx >= 0 && adjacentIdx < allStems.length && adjacentIdx !== fjIdx) {
    const adjStem = allStems[adjacentIdx]
    const adjShen = stemShiShen(dayMaster, adjStem)

    // 如果相邻的也是比劫，跳过继续
    if (isBiJie(adjShen)) {
      let skipIdx = adjacentIdx
      for (let tries = 0; tries < allStems.length; tries++) {
        if (fenJinReverse) skipIdx = Math.min(skipIdx + 1, allStems.length - 1)
        else skipIdx = Math.max(skipIdx - 1, 0)
        if (skipIdx === fjIdx) break
        const skipStem = allStems[skipIdx]
        const skipShen = stemShiShen(dayMaster, skipStem)
        if (!isBiJie(skipShen)) {
          const patternName = SHISHEN_TO_PATTERN[skipShen] ?? skipShen + '格'
          return {
            patternName,
            shiShen: skipShen,
            action: `比劫不成格，继续${fenJinReverse ? '进' : '退'}一位至${skipStem}`,
            conditions: [
              `分金定位${fjStem}为${fjShen}，按规则比劫不成格`,
              `按分金方向${direction}至${adjStem}(${adjShen})，仍为比劫`,
              `继续移动至${skipStem}(${skipShen})，取${patternName}`,
            ],
          }
        }
      }
      return null
    }

    const patternName = SHISHEN_TO_PATTERN[adjShen] ?? adjShen + '格'
    return {
      patternName,
      shiShen: adjShen,
      action: `比劫不成格，${direction}取${adjStem}`,
      conditions: [
        `分金定位${fjStem}为${fjShen}，按规则比劫不成格`,
        `按分金方向${direction}，取相邻${adjStem}(${adjShen})，定${patternName}`,
      ],
    }
  }

  return null
}

// ─── 结果类型 ───

export interface PatternResult {
  found: boolean
  patternName?: string
  shiShen?: string
  sourceStem?: string        // 取格的藏干
  rule?: string              // 使用的规则描述
  method?: '四正月' | '透干取用' | '月令分金'
  conditions?: string[]
  /** 月令分金详细信息 */
  fenJinDetail?: {
    qiYunDays: number
    daYunForward: boolean
    fenJinReverse: boolean
    effectiveDays: number
    steps: string[]
  }
  /** 比劫不成格处理记录 */
  biJieAction?: string
}

// ─── 主入口：V2.0 格局判定 ───

/**
 * V2.0 格局判定主函数
 *
 * 决策流程：
 * 1. 四正月 → 直接取本气
 * 2. 杂气月 → 检查透干（月干 > 年干 > 时干）
 * 3. 不透 → 月令分金算法
 * 4. 分金结果比劫 → 禄格/羊刃格破例 或 进退位
 */
export function determinePattern(bazi: BaZiResult): PatternResult {
  const monthBranch = bazi.monthPillar.branch
  const dayMaster = bazi.dayMaster
  const qiYunDays = bazi.qiYunDays
  const daYunForward = bazi.daYunForward

  // 收集天干信息（用于透干判断）
  const allStems: { stem: string; position: '月干' | '年干' | '时干' }[] = [
    { stem: bazi.monthPillar.stem, position: '月干' },
    { stem: bazi.yearPillar.stem, position: '年干' },
    { stem: bazi.hourPillar.stem, position: '时干' },
  ]

  // 规则一：四正月直接取本气
  if (SI_ZHENG.includes(monthBranch)) {
    // 四正月仍然检查透干，但因为只有一个藏干，本质相同
    const touGan = resolveTouGan(monthBranch, dayMaster, allStems)
    if (touGan) return touGan
    return resolveSiZheng(monthBranch, dayMaster)
  }

  // 规则二：杂气月，检查透干
  const touGan = resolveTouGan(monthBranch, dayMaster, allStems)
  if (touGan) return touGan

  // 规则三：不透，启动月令分金
  const segments = HIDDEN_STEMS_DAYS[monthBranch]
  if (!segments) {
    // 退路：取本气
    const mainStem = bazi.monthPillar.hiddenStems[0]
    const shiShen = stemShiShen(dayMaster, mainStem)
    const patternName = SHISHEN_TO_PATTERN[shiShen] ?? shiShen + '格'
    return {
      found: true,
      patternName,
      shiShen,
      sourceStem: mainStem,
      rule: '无分金数据，退取月令本气',
      method: '月令分金',
      conditions: [`无分金数据，取月令本气${mainStem}(${shiShen})为格`],
    }
  }

  const fenJinResult = resolveFenJin(monthBranch, dayMaster, qiYunDays, daYunForward)
  if (!fenJinResult.found || !fenJinResult.targetStem) {
    // 退路
    const mainStem = segments[0].stem
    const shiShen = stemShiShen(dayMaster, mainStem)
    const patternName = SHISHEN_TO_PATTERN[shiShen] ?? shiShen + '格'
    return {
      found: true,
      patternName,
      shiShen,
      sourceStem: mainStem,
      rule: '分金计算失败，退取月令本气',
      method: '月令分金',
      conditions: [`分金计算失败，退取月令本气${mainStem}定${patternName}`],
    }
  }

  // 检查分金结果为比劫 → 特殊处理
  if (isBiJie(fenJinResult.shiShen!)) {
    const fenJinReverse = fenJinResult.fenJinReverse ?? daYunForward
    const exception = resolveBiJieException(
      monthBranch, dayMaster,
      fenJinResult, daYunForward, fenJinReverse, segments,
    )

    if (exception && exception.patternName) {
      return {
        found: true,
        patternName: exception.patternName,
        shiShen: exception.shiShen,
        sourceStem: fenJinResult.targetStem,
        rule: '月令分金 → 比劫不成格 → ' + exception.action,
        method: '月令分金',
        conditions: [
          ...(fenJinResult.steps ?? []),
          ...exception.conditions,
        ],
        fenJinDetail: {
          qiYunDays,
          daYunForward,
          fenJinReverse,
          effectiveDays: fenJinResult.effectiveDays ?? 0,
          steps: fenJinResult.steps ?? [],
        },
        biJieAction: exception.action,
      }
    } else {
      // 无法处理，退取本气
      const mainStem = segments[0].stem
      const shiShen = stemShiShen(dayMaster, mainStem)
      const patternName = SHISHEN_TO_PATTERN[shiShen] ?? shiShen + '格'
      return {
        found: true,
        patternName,
        shiShen,
        sourceStem: mainStem,
        rule: '分金比劫无法退位，退取月令本气',
        method: '月令分金',
        conditions: [
          ...(fenJinResult.steps ?? []),
          `分金结果${fenJinResult.shiShen}为比劫，无法正常退位，退取月令本气${mainStem}定${patternName}`,
        ],
      }
    }
  }

  // 正常：分金结果非比劫，直接取格
  const patternName = SHISHEN_TO_PATTERN[fenJinResult.shiShen!] ?? fenJinResult.shiShen + '格'
  const fenJinReverse = fenJinResult.fenJinReverse ?? daYunForward

  return {
    found: true,
    patternName,
    shiShen: fenJinResult.shiShen,
    sourceStem: fenJinResult.targetStem,
    rule: '月令分金，定位非比劫，直接取格',
    method: '月令分金',
    conditions: [
      ...(fenJinResult.steps ?? []),
      `分金定位${fenJinResult.targetStem}(${fenJinResult.shiShen})非比劫，直接取${patternName}`,
    ],
    fenJinDetail: {
      qiYunDays,
      daYunForward,
      fenJinReverse,
      effectiveDays: fenJinResult.effectiveDays ?? 0,
      steps: fenJinResult.steps ?? [],
    },
  }
}

// ─── 组合判定 ───

export interface PatternCombination {
  name: string           // 组合名称（官印相生、煞印相生等）
  dominantPattern: string // 主导格局
  keyCombination: string  // 关键组合十神
  keyStem: string         // 关键组合的天干
  keyPosition: string     // 关键组合所在柱位
  isPure: boolean         // 是否为纯格（无关键组合）
}

/**
 * 格局组合判定
 *
 * 在确定主导格局后，判断是否存在关键十神组合：
 * - 官印相生：印格 + 正官透出
 * - 煞印相生：印格 + 七杀透出
 * - 财官相生：财格 + 正官透出
 * - 食神生财：食神格 + 财星透出
 * - 伤官生财：伤官格 + 财星透出
 * - 伤官佩印：伤官格 + 印星透出
 */
export function determineCombination(
  bazi: BaZiResult,
  dominantPattern: string,
  dominantShiShen: string,
): PatternCombination {
  const dayMaster = bazi.dayMaster
  const allStems = [
    { stem: bazi.monthPillar.stem, position: '月干' },
    { stem: bazi.yearPillar.stem, position: '年干' },
    { stem: bazi.hourPillar.stem, position: '时干' },
  ]

  // 正印格 / 偏印格 + 正官透出 → 官印相生
  if (['正印格', '偏印格'].includes(dominantPattern)) {
    for (const s of allStems) {
      const shiShen = stemShiShen(dayMaster, s.stem)
      if (shiShen === '正官') {
        return { name: '官印相生', dominantPattern, keyCombination: '正官', keyStem: s.stem, keyPosition: s.position, isPure: false }
      }
      if (shiShen === '偏官') {
        return { name: '煞印相生', dominantPattern, keyCombination: '七杀', keyStem: s.stem, keyPosition: s.position, isPure: false }
      }
    }
  }

  // 正印格 / 偏印格 + 无官杀 → 纯印格
  if (['正印格', '偏印格'].includes(dominantPattern)) {
    return { name: '纯印格', dominantPattern, keyCombination: '无（缺官杀）', keyStem: '', keyPosition: '', isPure: true }
  }

  // 正财格 / 偏财格 + 正官透出 → 财官相生
  if (['正财格', '偏财格'].includes(dominantPattern)) {
    for (const s of allStems) {
      const shiShen = stemShiShen(dayMaster, s.stem)
      if (shiShen === '正官') {
        return { name: '财官相生', dominantPattern, keyCombination: '正官', keyStem: s.stem, keyPosition: s.position, isPure: false }
      }
    }
    // 财格 + 食伤透出 → 食伤生财
    for (const s of allStems) {
      const shiShen = stemShiShen(dayMaster, s.stem)
      if (shiShen === '食神' || shiShen === '伤官') {
        return {
          name: shiShen === '食神' ? '食神生财' : '伤官生财',
          dominantPattern,
          keyCombination: shiShen,
          keyStem: s.stem,
          keyPosition: s.position,
          isPure: false,
        }
      }
    }
    return { name: '纯财格', dominantPattern, keyCombination: '无（缺食伤）', keyStem: '', keyPosition: '', isPure: true }
  }

  // 食神格 + 财星透出 → 食神生财
  if (dominantPattern === '食神格') {
    for (const s of allStems) {
      const shiShen = stemShiShen(dayMaster, s.stem)
      if (shiShen === '正财' || shiShen === '偏财') {
        return { name: '食神生财', dominantPattern, keyCombination: shiShen, keyStem: s.stem, keyPosition: s.position, isPure: false }
      }
    }
    return { name: '食神格（无财）', dominantPattern, keyCombination: '无', keyStem: '', keyPosition: '', isPure: true }
  }

  // 伤官格 + 财星透出 → 伤官生财
  // 伤官格 + 印星透出 → 伤官佩印
  if (dominantPattern === '伤官格') {
    for (const s of allStems) {
      const shiShen = stemShiShen(dayMaster, s.stem)
      if (shiShen === '正印' || shiShen === '偏印') {
        return { name: '伤官佩印', dominantPattern, keyCombination: shiShen, keyStem: s.stem, keyPosition: s.position, isPure: false }
      }
    }
    for (const s of allStems) {
      const shiShen = stemShiShen(dayMaster, s.stem)
      if (shiShen === '正财' || shiShen === '偏财') {
        return { name: '伤官生财', dominantPattern, keyCombination: shiShen, keyStem: s.stem, keyPosition: s.position, isPure: false }
      }
    }
    return { name: '纯伤官格', dominantPattern, keyCombination: '无', keyStem: '', keyPosition: '', isPure: true }
  }

  // 正官格 + 印星透出 → 官印相生
  if (dominantPattern === '正官格') {
    for (const s of allStems) {
      const shiShen = stemShiShen(dayMaster, s.stem)
      if (shiShen === '正印' || shiShen === '偏印') {
        return { name: '官印相生', dominantPattern, keyCombination: shiShen, keyStem: s.stem, keyPosition: s.position, isPure: false }
      }
    }
    return { name: '纯官格', dominantPattern, keyCombination: '无', keyStem: '', keyPosition: '', isPure: true }
  }

  // 七杀格 + 印星透出 → 煞印相生
  if (dominantPattern === '七杀格') {
    for (const s of allStems) {
      const shiShen = stemShiShen(dayMaster, s.stem)
      if (shiShen === '正印' || shiShen === '偏印') {
        return { name: '煞印相生', dominantPattern, keyCombination: shiShen, keyStem: s.stem, keyPosition: s.position, isPure: false }
      }
    }
    return { name: '纯杀格', dominantPattern, keyCombination: '无', keyStem: '', keyPosition: '', isPure: true }
  }

  // 建禄格 / 羊刃格
  if (dominantPattern === '建禄格') {
    return { name: '禄格', dominantPattern, keyCombination: '比肩坐禄', keyStem: '', keyPosition: '', isPure: false }
  }
  if (dominantPattern === '羊刃格') {
    return { name: '羊刃格', dominantPattern, keyCombination: '劫财帝旺', keyStem: '', keyPosition: '', isPure: false }
  }

  // 默认
  return { name: dominantPattern, dominantPattern, keyCombination: '', keyStem: '', keyPosition: '', isPure: true }
}

// ─── 破格风险检测 ───

export interface PoGeRisk {
  type: string              // 风险类型
  description: string       // 风险描述
  severity: '高' | '中' | '低'
  suggestion: string        // 修正建议
  mbtiAdjust: string        // MBTI补益方向
}

/**
 * 检测破格风险
 *
 * 三类核心冲突：
 * 1. 伤官见官 → 伤官(Fe) vs 正官(Te)
 * 2. 财星破印 → 财(Se/Si) vs 印(Ne/Ni)
 * 3. 官杀混杂 → 正官(Te) vs 七杀(Ti)
 */
export function detectPoGeRisks(
  bazi: BaZiResult,
  patternName: string,
  combination: PatternCombination,
): PoGeRisk[] {
  const risks: PoGeRisk[] = []
  const dayMaster = bazi.dayMaster

  const allStems = [
    { stem: bazi.monthPillar.stem, position: '月干' },
    { stem: bazi.yearPillar.stem, position: '年干' },
    { stem: bazi.hourPillar.stem, position: '时干' },
  ]

  // 1. 伤官见官
  const hasShangGuan = allStems.some(s => stemShiShen(dayMaster, s.stem) === '伤官')
  const hasZhengGuan = allStems.some(s => stemShiShen(dayMaster, s.stem) === '正官')
  if (hasShangGuan && hasZhengGuan) {
    risks.push({
      type: '伤官见官',
      description: '伤官与正官并存，内心秩序与外部规则激烈碰撞，易引发事业波动、口舌是非',
      severity: '高',
      suggestion: '伤官格需强化内倾思维(Ti)以分析规则、化解冲突；官格需强化内倾直觉(Ni)以理解情绪、避免刚硬',
      mbtiAdjust: '强化 Ti（伤官格）或 Ni（官格）',
    })
  }

  // 2. 财星破印
  const hasCaiXing = allStems.some(s => {
    const ss = stemShiShen(dayMaster, s.stem)
    return ss === '正财' || ss === '偏财'
  })
  const hasYinXing = allStems.some(s => {
    const ss = stemShiShen(dayMaster, s.stem)
    return ss === '正印' || ss === '偏印'
  })
  if (hasCaiXing && hasYinXing && (patternName.includes('印') || combination.name.includes('印'))) {
    risks.push({
      type: '财星破印',
      description: '财星与印星并存，现实欲望侵蚀精神理想，可能导致灵感枯竭、决策短视',
      severity: '中',
      suggestion: '印格者需强化外倾思维(Te)管理现实(财)，或将财星转化为稳定的内倾感觉(Si)积累',
      mbtiAdjust: '印格者向 ESTJ(Te+Si) 方向靠拢',
    })
  }

  // 3. 官杀混杂
  const guanCount = allStems.filter(s => stemShiShen(dayMaster, s.stem) === '正官').length
  const shaCount = allStems.filter(s => stemShiShen(dayMaster, s.stem) === '偏官').length
  if (guanCount >= 1 && shaCount >= 1) {
    risks.push({
      type: '官杀混杂',
      description: '正官与七杀并列，决策内耗、选择困难、压力增大',
      severity: '中',
      suggestion: '需等待大运流年取清，强化一方功能（去官留杀或去杀留官），让主导功能更清晰',
      mbtiAdjust: '明确 Te 或 Ti 中一方为主导，避免功能内耗',
    })
  }

  // 4. 纯格风险（印格无官杀 / 财格无食伤）
  if (combination.isPure) {
    if (combination.name === '纯印格') {
      risks.push({
        type: '印格无官杀',
        description: '灵感丰沛但缺乏结构化执行力，容易空想妄念，难以落地',
        severity: '中',
        suggestion: '需向 ENTJ(Te+Ni) 方向靠拢，学习项目管理和逻辑推演，将灵感程序化',
        mbtiAdjust: '向 ENTJ(Te+Ni) 靠拢，补足思维(官杀)',
      })
    }
    if (combination.name === '纯财格') {
      risks.push({
        type: '财格无食伤',
        description: '务实稳健，但缺乏才华(食伤)的源头活水，容易死赚钱，收入渠道单一',
        severity: '低',
        suggestion: '向 ESFP(Se+Fi) 方向靠拢，培养艺术爱好、发展副业技能，让赚钱模式多样化',
        mbtiAdjust: '向 ESFP(Se+Fi) 靠拢，引入食伤激发创造性',
      })
    }
  }

  return risks
}

// ─── 流派倾向 ───

/**
 * 判断格局所属流派倾向
 * 传统子平以月令透干取格为主流，透清格局为上
 */
export function getSchoolPreference(method: string): '传统子平' | '盲派' | '新派' {
  if (method === '透干取用') return '传统子平'
  if (method === '月令分金') return '传统子平'
  return '传统子平'
}
