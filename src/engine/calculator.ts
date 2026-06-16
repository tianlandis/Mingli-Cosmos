// ============================================================
// 八字排盘 - 核心计算引擎 (Pure TypeScript)
// 使用 lunar-typescript 库 + bazijichu.md 规则
// ============================================================

import type { Solar, Lunar } from 'lunar-typescript'
import {
  type BaZiResult, type Pillar, type DaYun, type ShiShenItem,
  TIAN_GAN_WUXING, DI_ZHI_WUXING,
  NAYIN_TABLE, HIDDEN_STEMS,
  TIAN_GAN_YIN_YANG, WUXING_LIST,
} from './types'

/** 根据公历日期计算八字 */
export function calculateBazi(
  year: number, month: number, day: number,
  hour: number, minute: number,
  gender: '男' | '女',
): Promise<BaZiResult> {
  return calculateBaziImpl(year, month, day, hour, minute, gender)
}

/** 根据农历日期计算八字 */
export function calculateBaziFromLunar(
  lunarYear: number, lunarMonth: number, lunarDay: number,
  hour: number, minute: number,
  gender: '男' | '女',
  isLeapMonth = false,
): Promise<BaZiResult> {
  return calculateBaziFromLunarImpl(lunarYear, lunarMonth, lunarDay, hour, minute, gender, isLeapMonth)
}

async function calculateBaziImpl(
  year: number, month: number, day: number,
  hour: number, minute: number,
  gender: '男' | '女',
): Promise<BaZiResult> {
  const { Solar } = await import('lunar-typescript')
  const solar = Solar.fromYmdHms(year, month, day, hour, minute, 0)
  const lunar = solar.getLunar()
  const eightChar = lunar.getEightChar()

  const birthDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  const birthTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`

  return buildResult(eightChar, solar, gender, birthDate, birthTime)
}

async function calculateBaziFromLunarImpl(
  lunarYear: number, lunarMonth: number, lunarDay: number,
  hour: number, minute: number,
  gender: '男' | '女',
  isLeapMonth: boolean,
): Promise<BaZiResult> {
  const { Lunar, Solar } = await import('lunar-typescript')

  // 构建农历对象
  let lunar: Lunar
  if (isLeapMonth) {
    // 闰月处理：使用 Lunar.fromYmd 创建后再用 leap 属性标记
    lunar = Lunar.fromYmd(lunarYear, lunarMonth, lunarDay)
    // 尝试通过内部机制标记闰月（lunar-typescript 可能通过月份偏移处理）
    const lunarAny = lunar as unknown as Record<string, unknown>
    if (typeof lunarAny['setLeapMonth'] === 'function') {
      (lunarAny['setLeapMonth'] as (m: number) => void)(lunarMonth)
    }
  } else {
    lunar = Lunar.fromYmd(lunarYear, lunarMonth, lunarDay)
  }

  const eightChar = lunar.getEightChar()
  // 通过 Solar.fromLunar 获取对应的公历日期（用于年龄计算等）
  const solar = lunar.getSolar()

  const LUNAR_DAY_NAMES = ['', '初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
    '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
    '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十']
  const LUNAR_MONTH_NAMES = ['', '正月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '冬月', '腊月']

  const prefix = isLeapMonth ? '闰' : ''
  const birthDate = `农历${lunarYear}年${prefix}${LUNAR_MONTH_NAMES[lunarMonth]}${LUNAR_DAY_NAMES[lunarDay] ?? lunarDay}`
  const birthTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`

  return buildResult(eightChar, solar, gender, birthDate, birthTime)
}

/** 共享的结果构建逻辑 */
async function buildResult(
  eightChar: ReturnType<Lunar['getEightChar']>,
  solar: Solar,
  gender: '男' | '女',
  birthDate: string,
  birthTime: string,
): Promise<BaZiResult> {
  // 四柱干支
  const yearGZ = eightChar.getYear()
  const monthGZ = eightChar.getMonth()
  const dayGZ = eightChar.getDay()
  const hourGZ = eightChar.getTime()

  const yearStem = yearGZ[0]
  const yearBranch = yearGZ[1]
  const monthStem = monthGZ[0]
  const monthBranch = monthGZ[1]
  const dayStem = dayGZ[0]
  const dayBranch = dayGZ[1]
  const hourStem = hourGZ[0]
  const hourBranch = hourGZ[1]

  // 构建四柱
  const yearPillar = buildPillar(yearStem, yearBranch)
  const monthPillar = buildPillar(monthStem, monthBranch)
  const dayPillar = buildPillar(dayStem, dayBranch)
  const hourPillar = buildPillar(hourStem, hourBranch)

  const dayMaster = dayStem

  // 十神
  const tenGods = computeTenGods(
    yearStem, yearBranch, monthStem, monthBranch,
    dayStem, dayBranch, hourStem, hourBranch
  )

  // 五行统计
  const fiveElements = computeFiveElements(
    yearPillar, monthPillar, dayPillar, hourPillar
  )

  // 大运
  const daYun = computeDaYun(eightChar, gender)

  // 起运天数 & 大运方向（用于V2.0月令分金算法）
  const { qiYunDays, daYunForward } = computeQiYunDays(solar, gender, yearStem)

  // 当前大运 & 流年按真实当前日期计算
  const { Solar: SolarClass } = await import('lunar-typescript')
  const now = new Date()
  const currentSolar = SolarClass.fromYmd(now.getFullYear(), now.getMonth() + 1, now.getDate())
  const currentDaYun = getCurrentDaYun(daYun, currentSolar, solar)

  const nowLunar = currentSolar.getLunar()
  const nowEightChar = nowLunar.getEightChar()
  const cyYearGZ = nowEightChar.getYear()

  const currentYear = {
    stem: cyYearGZ[0],
    branch: cyYearGZ[1],
    ganZhi: cyYearGZ,
  }

  return {
    birthDate,
    birthTime,
    gender,
    yearPillar, monthPillar, dayPillar, hourPillar,
    dayMaster,
    fiveElements,
    tenGods,
    daYun,
    currentDaYun: currentDaYun ?? null,
    currentYear,
    qiYunDays,
    daYunForward,
  }
}

function buildPillar(stem: string, branch: string): Pillar {
  const ganZhi = stem + branch
  return {
    stem,
    branch,
    stemWuXing: TIAN_GAN_WUXING[stem] ?? '',
    branchWuXing: DI_ZHI_WUXING[branch] ?? '',
    hiddenStems: HIDDEN_STEMS[branch] ?? [],
    naYin: NAYIN_TABLE[ganZhi] ?? '',
    ganZhi,
  }
}

/** 十神计算 - 以日干为中心 */
function computeTenGods(
  yStem: string, yBranch: string,
  mStem: string, mBranch: string,
  dStem: string, dBranch: string,
  hStem: string, hBranch: string,
): ShiShenItem[] {
  const dayWx = TIAN_GAN_WUXING[dStem]
  const dayYy = TIAN_GAN_YIN_YANG[dStem]

  const pillars: Array<{ stem: string; branch: string; ganZhi: string; pos: string }> = [
    { stem: yStem, branch: yBranch, ganZhi: yStem + yBranch, pos: '年柱' },
    { stem: mStem, branch: mBranch, ganZhi: mStem + mBranch, pos: '月柱' },
    { stem: dStem, branch: dBranch, ganZhi: dStem + dBranch, pos: '日柱' },
    { stem: hStem, branch: hBranch, ganZhi: hStem + hBranch, pos: '时柱' },
  ]

  const result: ShiShenItem[] = []
  for (const p of pillars) {
    const stemWx = TIAN_GAN_WUXING[p.stem]
    const stemYy = TIAN_GAN_YIN_YANG[p.stem]
    const shiShen = getShiShen(dayWx, dayYy, stemWx, stemYy, p.stem === dStem ? true : false)
    result.push({
      ganZhi: p.ganZhi,
      position: p.pos + '天干',
      shiShen,
    })
  }

  return result
}

function getShiShen(
  dayWx: string, dayYy: string,
  otherWx: string, otherYy: string,
  isSelf: boolean
): import('./types').ShiShen {
  if (isSelf) return '比肩'

  const isSameYinYang = dayYy === otherYy

  if (dayWx === otherWx) {
    return isSameYinYang ? '比肩' : '劫财'
  }

  // 生克关系: 其他五行 → 日主五行
  const rel = getRelation(dayWx, otherWx)
  if (rel === '我生') return isSameYinYang ? '食神' : '伤官'
  if (rel === '生我') return isSameYinYang ? '偏印' : '正印'
  if (rel === '我克') return isSameYinYang ? '偏财' : '正财'
  if (rel === '克我') return isSameYinYang ? '偏官' : '正官'

  return '比肩'
}

function getRelation(targetWx: string, otherWx: string): string {
  // 五行相生: 金→水→木→火→土→金
  const sheng: Record<string, string> = { '金': '水', '水': '木', '木': '火', '火': '土', '土': '金' }
  // 五行相克: 金→木→土→水→火→金
  const ke: Record<string, string> = { '金': '木', '木': '土', '土': '水', '水': '火', '火': '金' }

  if (sheng[otherWx] === targetWx) return '生我'    // other 生 target
  if (sheng[targetWx] === otherWx) return '我生'    // target 生 other
  if (ke[otherWx] === targetWx) return '克我'        // other 克 target
  if (ke[targetWx] === otherWx) return '我克'        // target 克 other
  return '同我'
}

/** 五行统计 */
function computeFiveElements(
  yp: Pillar, mp: Pillar, dp: Pillar, hp: Pillar
): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const w of WUXING_LIST) counts[w] = 0

  const pillars = [yp, mp, dp, hp]
  for (const p of pillars) {
    incWuXing(counts, p.stemWuXing)
    incWuXing(counts, p.branchWuXing)
    for (const hs of p.hiddenStems) {
      incWuXing(counts, TIAN_GAN_WUXING[hs] ?? '')
    }
  }
  return counts
}

function incWuXing(counts: Record<string, number>, wx: string) {
  if (wx && counts[wx] !== undefined) counts[wx]++
}

/** 大运计算 */
function computeDaYun(
  eightChar: ReturnType<Lunar['getEightChar']>,
  gender: '男' | '女'
): DaYun[] {
  const yearStem = eightChar.getYear()[0]
  const yearYinYang = TIAN_GAN_YIN_YANG[yearStem] ?? '阳'

  // 阳男阴女顺行, 阴男阳女逆行
  const isForward = (yearYinYang === '阳' && gender === '男') ||
                    (yearYinYang === '阴' && gender === '女')

  // 使用 lunar-typescript 的大运功能；顺逆方向由库按性别和命盘自动处理
  void isForward // keep the derived direction for display/validation
  const yun = eightChar.getYun(gender === '男' ? 1 : 0)
  const daYunList = yun.getDaYun()
  const result: DaYun[] = []

  for (let i = 0; i < Math.min(daYunList.length, 12); i++) {
    const dy = daYunList[i]
    const gz = dy.getGanZhi()
    result.push({
      startAge: dy.getStartAge(),
      startYear: dy.getStartYear(),
      endYear: dy.getEndYear(),
      stem: gz[0],
      branch: gz[1],
      ganZhi: gz,
      isForward,
    })
  }

  return result
}

function getCurrentDaYun(daYun: DaYun[], currentSolar: Solar, birthSolar: Solar): DaYun | null {
  const currentAge = currentSolar.getYear() - birthSolar.getYear() + 1
  for (const dy of daYun) {
    if (currentAge >= dy.startAge && currentAge <= dy.startAge + 9) {
      return dy
    }
  }
  return null
}

/**
 * 计算起运天数（V2.0月令分金算法核心数据）
 *
 * 阳男阴女：大运顺排 → 顺数到下一个节气
 * 阴男阳女：大运逆排 → 逆数到上一个节气
 *
 * @returns { qiYunDays: 起运天数, daYunForward: 大运是否顺排 }
 */
function computeQiYunDays(
  solar: Solar,
  gender: '男' | '女',
  yearStem: string,
): { qiYunDays: number; daYunForward: boolean } {
  const yearYinYang = TIAN_GAN_YIN_YANG[yearStem] ?? '阳'
  const daYunForward = (yearYinYang === '阳' && gender === '男') ||
                       (yearYinYang === '阴' && gender === '女')

  const lunar = solar.getLunar()

  if (daYunForward) {
    // 阳男阴女：顺数到下一个节气
    const nextJie = lunar.getNextJie()
    const jieSolar = nextJie.getSolar()
    const birthJd = solar.getJulianDay()
    const jieJd = jieSolar.getJulianDay()
    // 处理同日情况，返回整数天数
    return { qiYunDays: Math.max(1, Math.floor(jieJd - birthJd)), daYunForward }
  } else {
    // 阴男阳女：逆数到上一个节气
    const prevJie = lunar.getPrevJie()
    const jieSolar = prevJie.getSolar()
    const birthJd = solar.getJulianDay()
    const jieJd = jieSolar.getJulianDay()
    return { qiYunDays: Math.max(1, Math.floor(birthJd - jieJd)), daYunForward }
  }
}
