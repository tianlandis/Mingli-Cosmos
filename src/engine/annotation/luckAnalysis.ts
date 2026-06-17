// ============================================================
// 大运流年解读模块
// 依据：从月令取用到实战策略的完整解析 + 八字取格判断规则引导词（V2.0）
// V2.1：格局导向分析，移除用神忌神体系
// ============================================================

import type { BaZiResult, DaYun, DiZhi } from '../types'
import { TIAN_GAN_WUXING, TIAN_GAN_YIN_YANG, DI_ZHI_WUXING } from '../types'
import { getShiShenName, CHANG_SHENG } from './wuxing'
import { CHONG_MAP, HE_MAP, XING_MAP, PO_MAP, HAI_MAP } from '../relation'
import type { DaYunAnalysisItem, CurrentYearAnalysis, Milestone } from './types'

/** 根据日主五行查某地支的十二长生状态 */
function getChangShengStatus(dayMasterWx: string, branch: string): string {
  return CHANG_SHENG[dayMasterWx]?.[branch] ?? ''
}

/** 分析单个大运（格局导向，V2.1） */
function analyzeOneDaYun(
  daYun: DaYun,
  bazi: BaZiResult,
  patternShiShen: string,
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

  // 十二长生状态
  const dayStatus = getChangShengStatus(dayMasterWx, branch)
  const statusLabels: Record<string, string> = {
    '长生': '生机勃发', '沐浴': '变化不稳定', '冠带': '成长提升',
    '临官': '事业兴旺', '帝旺': '鼎盛巅峰', '衰': '由盛转衰',
    '病': '困顿波折', '死': '阻滞不顺', '墓': '蓄力收藏',
    '绝': '低谷转折', '胎': '酝酿计划', '养': '培育扶持',
  }

  // 格局吉凶属性：吉格喜生扶，凶格喜制化
  const JI_PATTERNS = new Set(['正官', '正印', '偏印', '食神', '正财', '偏财'])
  const XIONG_PATTERNS = new Set(['七杀', '伤官', '羊刃'])

  const isJiPattern = JI_PATTERNS.has(patternShiShen)
  const isXiongPattern = XIONG_PATTERNS.has(patternShiShen)

  // 大运地支与格局的生克关系（核心判断）
  let quality: '佳' | '平' | '不佳' = '平'
  const relation = getShiShenName(dayMasterWx, dayMasterYy, branchWx, '阳')

  if (isJiPattern) {
    // 吉格：喜生扶
    if (relation === '正印' || relation === '偏印' || relation === '比肩' || relation === '劫财') {
      quality = '佳'
    } else if (relation === '正官' || relation === '偏官') {
      quality = '不佳'
    }
  } else if (isXiongPattern) {
    // 凶格：喜制化
    if (relation === '正印' || relation === '偏印' || relation === '食神') {
      quality = '佳'
    } else if (relation === '正财' || relation === '偏财') {
      quality = '不佳'
    }
  }

  // 十二长生对质量的影响
  const topStatuses = ['长生', '临官', '帝旺', '冠带']
  const badStatuses = ['死', '绝', '病']
  if (topStatuses.includes(dayStatus)) quality = quality === '不佳' ? '平' : '佳'
  if (badStatuses.includes(dayStatus)) quality = quality === '佳' ? '平' : '不佳'

  // 解读
  const parts: string[] = []
  parts.push(`大运${daYun.ganZhi}`)
  parts.push(`天干${stem}为${stemShiShen}，地支${branch}为${branchShiShen}`)
  parts.push(`日主${dayMasterWx}在地支${branch}处${dayStatus}（${statusLabels[dayStatus] ?? '平稳'}）`)

  // 干支配合解读
  if (stemShiShen === '正官' && branchShiShen === '正印') parts.push('官印相生，事业平稳上升')
  else if (stemShiShen === '食神' && branchShiShen === '正财') parts.push('食神生财，财运亨通')
  else if (stemShiShen === '伤官' && branchShiShen === '偏官') parts.push('伤官见杀，需防官非口舌')
  else if (stemShiShen === '偏印' && branchShiShen === '食神') parts.push('枭神夺食，注意健康')
  else if (stemShiShen === '正财' && branchShiShen === '正印') parts.push('财星破印，理想与现实冲突')
  else if (stemShiShen === '偏官' && branchShiShen === '正印') parts.push('杀印相生，化压力为动力')

  const interpretation = parts.join('；')

  return {
    ganZhi: daYun.ganZhi,
    startAge: daYun.startAge,
    endAge: daYun.endAge,
    interpretation,
    quality,
  }
}

/** 分析所有大运（格局导向） */
export function analyzeDaYun(
  bazi: BaZiResult,
  patternShiShen: string,
): DaYunAnalysisItem[] {
  return bazi.daYun.map(dy => analyzeOneDaYun(dy, bazi, patternShiShen))
}

/** 分析当前流年（V2.1 格局导向） */
export function analyzeCurrentYear(
  bazi: BaZiResult,
): CurrentYearAnalysis {
  const currentYear = bazi.currentYear
  const dayMasterWx = TIAN_GAN_WUXING[bazi.dayMaster] ?? ''
  const dayMasterYy = TIAN_GAN_YIN_YANG[bazi.dayMaster] ?? '阳'

  const yearStemWx = TIAN_GAN_WUXING[currentYear.stem] ?? ''
  const yearStemYy = TIAN_GAN_YIN_YANG[currentYear.stem] ?? '阳'

  const stemShiShen = getShiShenName(dayMasterWx, dayMasterYy, yearStemWx, yearStemYy)

  const parts: string[] = []
  const focus: string[] = []

  // 流年天干解读
  const shiShenAdvice: Record<string, string> = {
    '正官': '官星主事，利于事业、名誉、考试求职',
    '偏官': '七杀当值，压力与机遇并存，需果断决策',
    '正印': '印星护身，利于学习、长辈缘、贵人相助',
    '偏印': '偏印当值，利于钻研、独创，但需防孤僻',
    '正财': '正财主事，财运稳定，利于工作收入和储蓄',
    '偏财': '偏财当值，有意外之财，但需防投资风险',
    '食神': '食神值年，心情愉悦，利于创作和享受生活',
    '伤官': '伤官当值，才华展露，但需防口舌是非',
    '比肩': '比肩值年，利于合作合伙，但需防竞争',
    '劫财': '劫财当值，人际关系活跃，但需防破财',
  }
  parts.push(`流年${currentYear.ganZhi}，天干${currentYear.stem}(${stemShiShen})${shiShenAdvice[stemShiShen] ?? '运势平稳'}`)

  // 流年与大运关系
  if (bazi.currentDaYun) {
    const dyStemWx = TIAN_GAN_WUXING[bazi.currentDaYun.stem] ?? ''
    if (yearStemWx === dyStemWx) {
      parts.push('流年与大运天干相同，力量叠加')
    }
  }

  // 太岁关系
  const yearZodiac = currentYear.branch as DiZhi
  const birthZodiac = bazi.yearPillar.branch as DiZhi

  if (yearZodiac === birthZodiac) {
    parts.push('今年为本命年（值太岁），宜低调行事')
    focus.push('注意健康和安全')
  }
  if (CHONG_MAP[birthZodiac] === yearZodiac) {
    parts.push('今年冲太岁，变动较大')
    focus.push('注意人际关系和事业变动')
  }
  if (HE_MAP[birthZodiac]?.includes(yearZodiac)) {
    parts.push('今年合太岁，人缘佳，适合合作')
    focus.push('利于合伙、婚姻')
  }
  if (XING_MAP[birthZodiac]?.includes(yearZodiac)) {
    parts.push('今年刑太岁，防口舌是非')
    focus.push('注意法律文书和人际关系')
  }
  if (PO_MAP[birthZodiac]?.includes(yearZodiac)) {
    parts.push('今年破太岁，防小人暗中破坏')
    focus.push('注意合作关系和契约')
  }
  if (HAI_MAP[birthZodiac]?.includes(yearZodiac)) {
    parts.push('今年害太岁，防背后中伤')
    focus.push('注意健康和感情关系')
  }

  // 默认关注
  if (focus.length === 0) focus.push('按部就班，稳步前行')

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
