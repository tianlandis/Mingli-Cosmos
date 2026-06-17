// ============================================================
// 批注主引擎 — 组合所有规则模块
// V2.1：移除用神忌神体系，改为格局导向分析
// ============================================================

import type { BaZiResult } from '../types'
import { TIAN_GAN_WUXING } from '../types'
import { analyzeDayMasterStrength } from './dayMasterStrength'
import { analyzePattern } from './pattern'
import { analyzeDaYun, analyzeCurrentYear, analyzeMilestones } from './luckAnalysis'
import { analyzeSpecialTopics } from './specialTopics'
import { analyzeBranchRelations } from './branchRelations'
import { analyzeShenSha } from '../rules/shenShaRules'
import type {
  AnnotationResult,
  WuXingBalanceItem,
  ShiShenProfileItem,
} from './types'

/** 五行平衡分析 */
function analyzeWuXingBalance(bazi: BaZiResult): WuXingBalanceItem[] {
  const WUXING = ['金', '木', '水', '火', '土'] as const
  const items: WuXingBalanceItem[] = []

  // 找出数量和最大最小
  const counts = { ...bazi.fiveElements }
  const values = Object.values(counts)
  const max = Math.max(...values)

  const adviceMap: Record<string, string> = {
    '金': '金过弱宜增金（佩戴金属饰品、向西发展）',
    '木': '木过弱宜增木（种植绿植、穿绿色衣物）',
    '水': '水过弱宜补水（多饮水、养鱼、近水）',
    '火': '火过弱宜补火（多运动、增加红色元素）',
    '土': '土过弱宜补土（接触自然、穿黄色衣物）',
  }

  for (const wx of WUXING) {
    const count = counts[wx] ?? 0
    let level: WuXingBalanceItem['level']
    if (count >= max * 0.7) level = '偏旺'
    else if (count <= 2) level = '偏弱'
    else level = '中和'

    let advice = ''
    if (level === '偏弱') advice = adviceMap[wx] ?? ''
    else if (level === '偏旺' && count >= max * 0.9) advice = `${wx}过旺，宜适当抑制，避免失衡`

    items.push({ name: wx, level, count, advice })
  }

  return items
}

/** 十神概况分析 */
function analyzeShiShenProfile(bazi: BaZiResult): ShiShenProfileItem[] {
  const tenGods = bazi.tenGods
  const profile: Record<string, { count: number; positions: string[] }> = {}

  for (const tg of tenGods) {
    if (!profile[tg.shiShen]) {
      profile[tg.shiShen] = { count: 0, positions: [] }
    }
    profile[tg.shiShen].count++
    profile[tg.shiShen].positions.push(tg.position)
  }

  return Object.entries(profile).map(([name, data]) => ({
    name: name as ShiShenProfileItem['name'],
    count: data.count,
    positions: data.positions,
  }))
}

/** 生成命局总览 */
function generateOverview(
  bazi: BaZiResult,
  strength: string,
  patternAnalysis: ReturnType<typeof import('./pattern').analyzePattern>,
): AnnotationResult['overview'] {
  const dayMasterWx = TIAN_GAN_WUXING[bazi.dayMaster] ?? ''
  const pa = patternAnalysis

  let summary = `日主${bazi.dayMaster}(${dayMasterWx})，身${strength}，命局${pa.patternName}（${pa.method}）`

  // 添加组合信息
  if (pa.combination && !pa.combination.isPure) {
    summary += `，组合${pa.combination.name}`
  }
  if (pa.combination && pa.combination.isPure) {
    summary += `，为${pa.combination.name}`
  }

  // 添加MBTI
  if (pa.mbti.typicalTypes.length > 0) {
    summary += `，MBTI倾向${pa.mbti.typicalTypes.join('/')}`
  }

  // 刻入取格方法详情
  summary += `\n取格详情：${pa.method}，由月令藏干${pa.sourceStem ?? '?'}取${pa.shiShen}定${pa.patternName}`

  return {
    summary,
    dayMaster: bazi.dayMaster,
    strength,
    pattern: `${pa.patternName}（${pa.jiXiong}）${pa.combination && !pa.combination.isPure ? '·' + pa.combination.name : ''}`,
    mbti: pa.mbti.typicalTypes.length > 0 ? pa.mbti.typicalTypes.join('/') : undefined,
    combination: pa.combination?.name,
  }
}

/** 生成综合建议 */
function generateAdvice(
  strength: string,
  patternName: string,
): string[] {
  const advice: string[] = []

  if (strength.includes('弱')) {
    advice.push('注意增强体质，规律作息不熬夜')
    advice.push('选择有利于自己的环境和人际关系')
  }
  if (strength.includes('强')) {
    advice.push('发挥自身优势，勇于开拓进取')
    advice.push('注意谦逊低调，避免过于强势')
  }

  const patternAdvice: Record<string, string> = {
    '正官格': '循规蹈矩，以正直诚信待人处事',
    '正印格': '注重学习积累，以知识充实自我',
    '偏印格': '发挥独创思维，但需注意人际沟通',
    '食神格': '培养才艺专长，以才华服务社会',
    '伤官格': '善用创新能力，但需注意言行分寸',
    '正财格': '稳扎稳打理财，注重长期积累',
    '偏财格': '把握投资机会，但需控制风险',
    '七杀格': '勇于面对挑战，化压力为动力',
    '建禄格': '独立自主，发挥自身能量',
    '羊刃格': '刚毅果断，但需避免冲动决策',
  }
  const pAdv = patternAdvice[patternName]
  if (pAdv) advice.push(pAdv)

  return [...new Set(advice)].slice(0, 8)
}

/** 主入口：根据排盘结果生成完整批注 */
export function generateAnnotation(bazi: BaZiResult): AnnotationResult {
  // 1. 日主强弱
  const strengthAnalysis = analyzeDayMasterStrength(bazi)

  // 2. 格局判断
  const patternAnalysis = analyzePattern(bazi, strengthAnalysis.strength)

  // 3. 五行平衡
  const wuXingBalance = analyzeWuXingBalance(bazi)

  // 4. 十神概况
  const shiShenProfile = analyzeShiShenProfile(bazi)

  // 5. 大运流年（格局导向）
  const patternShiShen = patternAnalysis.shiShen ?? '比肩'
  const daYunList = analyzeDaYun(bazi, patternShiShen)
  const currentYear = analyzeCurrentYear(bazi)
  const milestones = analyzeMilestones(bazi)

  // 6. 专题批注
  const specialTopics = analyzeSpecialTopics(bazi)

  // 7. 地支关系分析
  const branchRelations = analyzeBranchRelations(bazi)

  // 8. 神煞分析
  const shenSha = analyzeShenSha(bazi)

  // 9. 免责声明
  const disclaimer = '以上批注内容基于传统命理学理论模型自动生成，仅供文化娱乐参考，不构成科学预测或人生决策建议。每个人的命运由多种因素共同决定，请理性看待，保持积极乐观的人生态度。'

  // 10. 总览
  const overview = generateOverview(
    bazi,
    strengthAnalysis.strength,
    patternAnalysis,
  )

  // 11. 综合建议
  const comprehensiveAdvice = [
    ...generateAdvice(strengthAnalysis.strength, patternAnalysis.patternName),
    ...patternAnalysis.poGeRisks
      .filter(r => r.severity === '高' || r.severity === '中')
      .map(r => `【${r.type}·${r.severity}风险】${r.suggestion}`),
  ]

  return {
    overview,
    strengthAnalysis,
    wuXingBalance,
    shiShenProfile,
    patternAnalysis,
    luckAnalysis: { daYunList, currentYear, milestones },
    branchRelations,
    shenSha,
    specialTopics,
    disclaimer,
    comprehensiveAdvice,
  }
}
