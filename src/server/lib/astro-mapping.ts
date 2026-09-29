/**
 * 星座 ↔ 八字 精确映射（太阳星座）
 *
 * 天文事实（本模块的唯一依据）：
 * - 太阳星座分界 = 太阳黄经到达 30° 整数倍的时刻 = 「中气」时刻
 *   （春分 0° 起白羊、谷雨 30° 起金牛 …… 雨水 330° 起双鱼）
 * - 八字月支分界 = 「节」时刻（黄经 15° + 30k：立春 315° 起寅、惊蛰 345° 起卯 ……）
 * - 两类分界共用同一张节气表，仅错开 15°（半个月），因此：
 *   每个太阳星座恰好横跨两个月支各一半。
 *
 * 权威源与排盘引擎一致：lunar-typescript 的 getJieQiTable()（精确到秒）。
 * 本模块不自行做任何天文近似计算，不 import engine 内部文件（遵守封版红线）。
 *
 * 映射公式（可证）：
 *   记支序 M = ['辰','巳','午','未','申','酉','戌','亥','子','丑','寅','卯']（M[m] 的「节」在黄经 15°+30m），
 *   星座 s（s=0 白羊 … 11 双鱼）横跨：
 *     前半段（约前 15 天）∈ M[(s-1) mod 12] 月，后半段 ∈ M[s mod 12] 月。
 *   例：白羊 s=0 → 卯月后半 + 辰月前半；摩羯 s=9 → 子月后半 + 丑月前半。
 */

import { Lunar, type Solar } from 'lunar-typescript'

export interface SolarSignInfo {
  /** 0=白羊 … 11=双鱼 */
  index: number
  name: string
  en: string
  /** 星座四元素（后续 MBTI 融合用） */
  element: '火' | '土' | '风' | '水'
  /** 本星座分界（起点中气）时刻，出生时间 ≥ 此刻 */
  since: Date
  /** 下一星座分界时刻，出生时间 < 此刻 */
  until: Date
}

export interface AstroBaziMapping {
  sign: SolarSignInfo
  /** 星座横跨的两个月支 [前半段所属支, 后半段所属支] */
  branchPair: [string, string]
  /** 引擎月支是否落入 branchPair（映射与排盘的一致性校验） */
  consistent: boolean
  /** 出生处于星座的哪一半段 */
  phase: '前半' | '后半'
  /** 人读文案 */
  relation: string
}

/** 星座序数 → 名称/元素 */
export const SOLAR_SIGNS: ReadonlyArray<{
  name: string
  en: string
  element: '火' | '土' | '风' | '水'
}> = [
  { name: '白羊座', en: 'Aries', element: '火' },
  { name: '金牛座', en: 'Taurus', element: '土' },
  { name: '双子座', en: 'Gemini', element: '风' },
  { name: '巨蟹座', en: 'Cancer', element: '水' },
  { name: '狮子座', en: 'Leo', element: '火' },
  { name: '处女座', en: 'Virgo', element: '土' },
  { name: '天秤座', en: 'Libra', element: '风' },
  { name: '天蝎座', en: 'Scorpio', element: '水' },
  { name: '射手座', en: 'Sagittarius', element: '火' },
  { name: '摩羯座', en: 'Capricorn', element: '土' },
  { name: '水瓶座', en: 'Aquarius', element: '风' },
  { name: '双鱼座', en: 'Pisces', element: '水' },
]

/** 中气名（含 lunar-typescript 的中文键与溢出年拼音键）→ 星座序数 */
const ZHONGQI_TO_SIGN: Readonly<Record<string, number>> = {
  春分: 0, CHUN_FEN: 0,
  谷雨: 1, GU_YU: 1,
  小满: 2, XIAO_MAN: 2,
  夏至: 3, XIA_ZHI: 3,
  大暑: 4, DA_SHU: 4,
  处暑: 5, CHU_SHU: 5,
  秋分: 6, QIU_FEN: 6,
  霜降: 7, SHUANG_JIANG: 7,
  小雪: 8, XIAO_XUE: 8,
  冬至: 9, DONG_ZHI: 9,
  大寒: 10, DA_HAN: 10,
  雨水: 11, YU_SHUI: 11,
}

/**
 * 支序表：M[m] 所对应月支的「节」在黄经 15°+30m。
 * 与星座序数直接对齐（M[0]=辰 ↔ 白羊后半段所属月支）。
 */
export const SIGN_BRANCH_ORDER: readonly string[] = [
  '辰', '巳', '午', '未', '申', '酉', '戌', '亥', '子', '丑', '寅', '卯',
]

/** 星座 s 横跨的两个月支（时间先后序）：[前半段支, 后半段支] */
export function getSignBranchPair(signIndex: number): [string, string] {
  const i = ((signIndex % 12) + 12) % 12
  return [SIGN_BRANCH_ORDER[(i + 11) % 12], SIGN_BRANCH_ORDER[i]]
}

/** lunar-typescript Solar → 本地时区 Date（与排盘入参同为本地时间口径） */
function solarToDate(s: Solar): Date {
  return new Date(
    s.getYear(), s.getMonth() - 1, s.getDay(),
    s.getHour(), s.getMinute(), s.getSecond(),
  )
}

/** 判定太阳星座：出生时刻之前（含等于）最近的中气即星座起点 */
export function getSolarSign(birth: Date): SolarSignInfo {
  const table = Lunar.fromDate(birth).getJieQiTable()

  const boundaries: Array<{ index: number; date: Date }> = []
  for (const [key, solar] of Object.entries(table)) {
    const index = ZHONGQI_TO_SIGN[key]
    if (index === undefined) continue
    boundaries.push({ index, date: solarToDate(solar) })
  }
  boundaries.sort((a, b) => a.date.getTime() - b.date.getTime())

  let start: { index: number; date: Date } | null = null
  let next: { index: number; date: Date } | null = null
  for (const b of boundaries) {
    if (b.date.getTime() <= birth.getTime()) start = b
    else { next = b; break }
  }
  if (!start || !next) {
    throw new Error(`astro-mapping: 节气表数据不足以判定星座（birth=${birth.toISOString()}）`)
  }

  const meta = SOLAR_SIGNS[start.index]
  return {
    index: start.index,
    name: meta.name,
    en: meta.en,
    element: meta.element,
    since: start.date,
    until: next.date,
  }
}

/**
 * 组合映射：太阳星座 × 引擎月支。
 * monthBranch 传 engine BaZiResult.monthPillar.branch，用于一致性校验。
 */
export function mapSunSignToBazi(birth: Date, monthBranch: string): AstroBaziMapping {
  const sign = getSolarSign(birth)
  const branchPair = getSignBranchPair(sign.index)
  const consistent = branchPair.includes(monthBranch)
  if (!consistent) {
    throw new Error(
      `astro-mapping: 月支 ${monthBranch} 不在星座 ${sign.name} 的横跨区间 [${branchPair.join(',')}] 内，映射与排盘不一致`,
    )
  }
  const phase: '前半' | '后半' = monthBranch === branchPair[0] ? '前半' : '后半'
  const relation =
    `${sign.name}（${sign.element}象）：横跨 ${branchPair[0]}月后半与 ${branchPair[1]}月前半；` +
    `本人月支为 ${monthBranch} → 生于${sign.name}${phase}段（${phase === '前半' ? '中气后、' + branchPair[1] + '月节前' : branchPair[1] + '月节后'}）`
  return { sign, branchPair, consistent, phase, relation }
}
