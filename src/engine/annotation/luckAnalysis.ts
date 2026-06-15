// ============================================================
// 大运流年解读模块
// ============================================================

import type { BaZiResult, DaYun, DiZhi } from '../types'
import { TIAN_GAN_WUXING, TIAN_GAN_YIN_YANG, DI_ZHI_WUXING } from '../types'
import { getShiShenName, WUXING_SHENG, WUXING_KE } from './wuxing'
import { CHONG_MAP, HE_MAP, XING_MAP, PO_MAP, HAI_MAP } from '../relation'
import type { DaYunAnalysisItem, CurrentYearAnalysis, Milestone, YongShenResult } from './types'

/** 分析单个大运 */
function analyzeOneDaYun(
  daYun: DaYun,
  bazi: BaZiResult,
  yongShenWx: string[],
  jiShenWx: string[],
): DaYunAnalysisItem {
  const dayMasterWx = TIAN_GAN_WUXING[bazi.dayMaster] ?? ''
  const dayMasterYy = TIAN_GAN_YIN_YANG[bazi.dayMaster] ?? '阳'

  const { stem, branch } = daYun
  const stemWx = TIAN_GAN_WUXING[stem] ?? ''
  const branchWx = DI_ZHI_WUXING[branch] ?? ''
  const stemYy = TIAN_GAN_YIN_YANG[stem] ?? '阳'

  // 大运干支十神
  const stemShiShen = getShiShenName(dayMasterWx, dayMasterYy, stemWx, stemYy)
  const branchShiShen = getShiShenName(dayMasterWx, dayMasterYy, branchWx, '阳')

  // 大运好坏判断
  let goodCount = 0, badCount = 0

  if (yongShenWx.includes(stemWx)) goodCount += 1.5
  if (jiShenWx.includes(stemWx)) badCount += 1
  if (yongShenWx.includes(branchWx)) goodCount += 1
  if (jiShenWx.includes(branchWx)) badCount += 1

  let quality: '佳' | '平' | '不佳' = '平'
  if (goodCount >= 2) quality = '佳'
  else if (badCount >= 2) quality = '不佳'

  let interpretation = ''
  const parts: string[] = []

  // 天干解读
  if (stemWx === dayMasterWx) {
    parts.push(`天干${stem}为比劫帮身`)
  } else if (yongShenWx.includes(stemWx)) {
    parts.push(`天干${stem}(${stemShiShen})为用神，好运`)
  } else if (jiShenWx.includes(stemWx)) {
    parts.push(`天干${stem}(${stemShiShen})为忌神，需防范`)
  } else {
    parts.push(`天干${stem}(${stemShiShen})运势平稳`)
  }

  // 地支解读
  if (branchWx === dayMasterWx) {
    parts.push(`地支${branch}为比劫帮身`)
  } else if (yongShenWx.includes(branchWx)) {
    parts.push(`地支${branch}(${branchShiShen})为用神之运`)
  } else if (jiShenWx.includes(branchWx)) {
    parts.push(`地支${branch}(${branchShiShen})为忌神之运，需谨慎`)
  } else {
    parts.push(`地支${branch}(${branchShiShen})运势平平`)
  }

  // 大运干支配合
  if (stemShiShen === '正官' && branchShiShen === '正印') {
    parts.push('官印相生，事业平稳上升')
  } else if (stemShiShen === '食神' && branchShiShen === '正财') {
    parts.push('食神生财，财运亨通')
  } else if (stemShiShen === '伤官' && branchShiShen === '偏官') {
    parts.push('伤官见官，需防官非口舌')
  }

  interpretation = parts.join('；')

  return {
    ganZhi: daYun.ganZhi,
    startAge: daYun.startAge,
    endAge: daYun.endAge,
    interpretation,
    quality,
  }
}

/** 分析所有大运 */
export function analyzeDaYun(
  bazi: BaZiResult,
  yongShen: string[],
  jiShen: string[],
): DaYunAnalysisItem[] {
  return bazi.daYun.map(dy => analyzeOneDaYun(dy, bazi, yongShen, jiShen))
}

/** 分析当前流年 */
export function analyzeCurrentYear(
  bazi: BaZiResult,
  yongShen: string[],
  jiShen: string[],
): CurrentYearAnalysis {
  const currentYear = bazi.currentYear
  const dayMasterWx = TIAN_GAN_WUXING[bazi.dayMaster] ?? ''
  const dayMasterYy = TIAN_GAN_YIN_YANG[bazi.dayMaster] ?? '阳'

  const yearStemWx = TIAN_GAN_WUXING[currentYear.stem] ?? ''
  const yearBranchWx = DI_ZHI_WUXING[currentYear.branch] ?? ''
  const yearStemYy = TIAN_GAN_YIN_YANG[currentYear.stem] ?? '阳'

  const stemShiShen = getShiShenName(dayMasterWx, dayMasterYy, yearStemWx, yearStemYy)

  const parts: string[] = []
  const focus: string[] = []

  // 流年天干判断
  if (yongShen.includes(yearStemWx)) {
    parts.push(`流年天干${currentYear.stem}(${stemShiShen})为用神，今年整体运势向好`)
    focus.push('把握时机，积极进取')
  } else if (jiShen.includes(yearStemWx)) {
    parts.push(`流年天干${currentYear.stem}(${stemShiShen})为忌神，今年需谨慎应对`)
    focus.push('宜稳守，避免冒险')
  } else {
    parts.push(`流年${currentYear.ganZhi}，平运之年`)
    focus.push('按部就班，稳步前行')
  }

  // 流年与大运关系
  if (bazi.currentDaYun) {
    const dyStemWx = TIAN_GAN_WUXING[bazi.currentDaYun.stem] ?? ''
    if (yearStemWx === dyStemWx) {
      parts.push('流年与大运天干相同，力量叠加')
    }
  }

  // 本命年检查（值太岁）
  const yearZodiac = currentYear.branch as DiZhi
  const birthZodiac = bazi.yearPillar.branch as DiZhi
  if (yearZodiac === birthZodiac) {
    parts.push('今年为本命年（值太岁），宜低调行事')
    focus.push('注意健康和安全')
  }

  // 冲太岁
  if (CHONG_MAP[birthZodiac] === yearZodiac) {
    parts.push('今年冲太岁，变动较大')
    focus.push('注意人际关系和事业变动')
  }

  // 合太岁
  if (HE_MAP[birthZodiac]?.includes(yearZodiac)) {
    parts.push('今年合太岁，人缘佳，适合合作')
    focus.push('利于合伙、婚姻')
  }

  // 刑太岁
  if (XING_MAP[birthZodiac]?.includes(yearZodiac)) {
    parts.push('今年刑太岁，防口舌是非')
    focus.push('注意法律文书和人际关系')
  }

  // 破太岁
  if (PO_MAP[birthZodiac]?.includes(yearZodiac)) {
    parts.push('今年破太岁，防小人暗中破坏')
    focus.push('注意合作关系和契约')
  }

  // 害太岁
  if (HAI_MAP[birthZodiac]?.includes(yearZodiac)) {
    parts.push('今年害太岁，防背后中伤')
    focus.push('注意健康和感情关系')
  }

  return {
    ganZhi: currentYear.ganZhi,
    interpretation: parts.join('。'),
    focus,
  }
}

/** 关键人生节点 */
export function analyzeMilestones(bazi: BaZiResult): Milestone[] {
  const milestones: Milestone[] = []
  const birthZodiac = bazi.yearPillar.branch as DiZhi
  const dayStem = bazi.dayMaster

  // 基础参数
  const startYear0 = bazi.daYun[0]?.startYear ?? 0
  const startAge0 = bazi.daYun[0]?.startAge ?? 0
  const zodiacOrder: DiZhi[] = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥']

  // 辅助：某年龄 → 流年地支
  const getYearZodiac = (age: number): DiZhi => {
    const offset = (age - startAge0) % 12
    const idx = (zodiacOrder.indexOf(birthZodiac) + offset + 12) % 12
    return zodiacOrder[idx]
  }

  // 辅助：某年龄 → 流年
  const getYear = (age: number): number => startYear0 - startAge0 + age

  // 1. 每12年本命年（值太岁）
  for (const dy of bazi.daYun) {
    for (let age = dy.startAge; age <= dy.startAge + 9; age++) {
      const yz = getYearZodiac(age)
      if (yz === birthZodiac && age >= 0 && age <= 80) {
        milestones.push({
          age,
          year: getYear(age),
          ganZhi: `值太岁`,
          event: '本命年，值太岁，宜稳守',
          reason: '流年地支与年柱地支相同',
        })
      }
    }
  }

  // 去重辅助
  const seenAges = new Set<number>()
  const addMilestone = (m: Milestone) => {
    if (!seenAges.has(m.age)) {
      seenAges.add(m.age)
      milestones.push(m)
    }
  }

  // 2. 冲太岁年（年支被冲）
  const chongTarget = CHONG_MAP[birthZodiac]
  if (chongTarget) {
    for (const dy of bazi.daYun) {
      for (let age = dy.startAge; age <= dy.startAge + 9; age++) {
        if (getYearZodiac(age) === chongTarget && age >= 0 && age <= 80) {
          addMilestone({
            age,
            year: getYear(age),
            ganZhi: CHONG_MAP[birthZodiac],
            event: '冲太岁年，变动较大，慎行慎言',
            reason: `年柱${birthZodiac}遇冲，根基受震`,
          })
        }
      }
    }
  }

  // 3. 刑太岁年
  const xingTargets = XING_MAP[birthZodiac] ?? []
  for (const dy of bazi.daYun) {
    for (let age = dy.startAge; age <= dy.startAge + 9; age++) {
      if (xingTargets.includes(getYearZodiac(age)) && age >= 0 && age <= 80) {
        addMilestone({
          age,
          year: getYear(age),
          ganZhi: getYearZodiac(age),
          event: '刑太岁年，防口舌是非与法律纠纷',
          reason: `流年与年柱${birthZodiac}相刑`,
        })
      }
    }
  }

  // 4. 破太岁年
  const poTargets = PO_MAP[birthZodiac] ?? []
  for (const dy of bazi.daYun) {
    for (let age = dy.startAge; age <= dy.startAge + 9; age++) {
      if (poTargets.includes(getYearZodiac(age)) && age >= 0 && age <= 80) {
        addMilestone({
          age,
          year: getYear(age),
          ganZhi: getYearZodiac(age),
          event: '破太岁年，防小人和暗中破坏',
          reason: `流年与年柱${birthZodiac}相破`,
        })
      }
    }
  }

  // 5. 害太岁年
  const haiTargets = HAI_MAP[birthZodiac] ?? []
  for (const dy of bazi.daYun) {
    for (let age = dy.startAge; age <= dy.startAge + 9; age++) {
      if (haiTargets.includes(getYearZodiac(age)) && age >= 0 && age <= 80) {
        addMilestone({
          age,
          year: getYear(age),
          ganZhi: getYearZodiac(age),
          event: '害太岁年，防背后中伤和慢性病',
          reason: `流年与年柱${birthZodiac}相害`,
        })
      }
    }
  }

  // 截取最多 8 个里程碑（按年龄排序）
  const filtered = milestones
    .filter(m => m.age >= 0 && m.age <= 80)
    .sort((a, b) => a.age - b.age)
  const filteredSet = new Set<number>()
  const selected: Milestone[] = []
  for (const m of filtered) {
    if (!filteredSet.has(m.age) && selected.length < 8) {
      filteredSet.add(m.age)
      selected.push(m)
    }
  }

  // 6. 换大运年份
  for (const dy of bazi.daYun) {
    if (dy.startAge > 0 && dy.startAge <= 75 && !filteredSet.has(dy.startAge)) {
      filteredSet.add(dy.startAge)
      selected.push({
        age: dy.startAge,
        year: dy.startYear,
        ganZhi: dy.ganZhi,
        event: `换大运：${dy.ganZhi}（${dy.startAge}岁起）`,
        reason: '人生每十年一大运，换运之年多有变动',
      })
    }
  }

  // 按年龄排序，取前 10 个
  selected.sort((a, b) => a.age - b.age)
  return selected.slice(0, 10)
}
