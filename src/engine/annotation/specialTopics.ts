// ============================================================
// 专题批注模块
// 性格 / 事业 / 财运 / 婚姻 / 健康 / 子女
// ============================================================

import type { BaZiResult, ShiShenItem, DiZhi } from '../types'
import { TIAN_GAN_WUXING, DI_ZHI_WUXING } from '../types'
import { CHONG_MAP, HE_MAP, XING_MAP, PO_MAP, HAI_MAP, getKongWang } from '../relation'
import type { SpecialTopics } from './types'

/** 五行 → 性格特征 */
const WUXING_PERSONALITY: Record<string, string[]> = {
  '木': ['仁慈正直', '有上进心', '注重成长', '有时固执'],
  '火': ['热情开朗', '行动力强', '急躁冲动', '富有感染力'],
  '土': ['诚信稳重', '包容力强', '保守谨慎', '脚踏实地'],
  '金': ['刚毅果断', '讲义气', '追求完美', '有时冷酷'],
  '水': ['聪明灵活', '善变适应', '深沉内敛', '有时善变'],
}

/** 十神 → 性格特征 */
const SHISHEN_PERSONALITY: Record<string, string> = {
  '正官': '正直守规，责任心强，有领导力',
  '偏官': '果敢进取，魄力十足，但易冲动',
  '正印': '仁慈好学，智慧内敛，重视精神生活',
  '偏印': '思维独特，有创造力，但可能孤僻',
  '比肩': '独立自主，自尊心强，朋友缘佳',
  '劫财': '社交能力强，行动力足，但竞争心重',
  '食神': '温和宽厚，有艺术天赋，享受生活',
  '伤官': '聪明才华，表现欲强，不拘一格',
  '正财': '踏实务实，善于理财，注重物质',
  '偏财': '慷慨大方，善于投资，人缘佳',
}

/** 分析性格 */
function analyzePersonality(bazi: BaZiResult, tenGods: ShiShenItem[]): string[] {
  const dayMasterWx = TIAN_GAN_WUXING[bazi.dayMaster] ?? ''
  const traits: string[] = []

  // 日主五行特性
  traits.push(...(WUXING_PERSONALITY[dayMasterWx] ?? []))

  // 十神主导性格
  const tenGodCount: Record<string, number> = {}
  for (const tg of tenGods) {
    tenGodCount[tg.shiShen] = (tenGodCount[tg.shiShen] ?? 0) + 1
  }

  // 按数量排序取前3个十神
  const sortedShiShen = Object.entries(tenGodCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)

  for (const [name] of sortedShiShen) {
    const desc = SHISHEN_PERSONALITY[name]
    if (desc) traits.push(desc)
  }

  // 日支性格
  const dayBranch = bazi.dayPillar.branch
  const dayBranchWx = DI_ZHI_WUXING[dayBranch]
  if (dayBranchWx) {
    traits.push(`日坐${dayBranchWx}，内心${dayBranchWx === '火' ? '热情' : dayBranchWx === '水' ? '深沉' : dayBranchWx === '金' ? '刚毅' : dayBranchWx === '木' ? '仁厚' : '稳重'}`)
  }

  return traits
}

/** 分析事业 */
function analyzeCareer(bazi: BaZiResult, tenGods: ShiShenItem[]): string[] {
  const dayMasterWx = TIAN_GAN_WUXING[bazi.dayMaster] ?? ''
  const tips: string[] = []

  const tenGodCount: Record<string, number> = {}
  for (const tg of tenGods) {
    tenGodCount[tg.shiShen] = (tenGodCount[tg.shiShen] ?? 0) + 1
  }

  const guanShaCount = (tenGodCount['正官'] ?? 0) + (tenGodCount['偏官'] ?? 0)
  const yinCount = (tenGodCount['正印'] ?? 0) + (tenGodCount['偏印'] ?? 0)
  const shiShangCount = (tenGodCount['食神'] ?? 0) + (tenGodCount['伤官'] ?? 0)
  const caiCount = (tenGodCount['正财'] ?? 0) + (tenGodCount['偏财'] ?? 0)

  if (guanShaCount >= 3) {
    tips.push('官杀旺相，适合体制内、管理岗位、纪律部队等权威性工作')
    tips.push('有较强的领导力和执行力')
  }
  if (yinCount >= 3) {
    tips.push('印星得力，适合教育、学术、研究、文化类工作')
    tips.push('学习能力强，适合不断进修提升')
  }
  if (shiShangCount >= 3) {
    tips.push('食伤吐秀，适合创意、艺术、技术、自由职业')
    tips.push('才华横溢，宜发挥创造力')
  }
  if (caiCount >= 3) {
    tips.push('财星旺，适合经商、金融、贸易等与金钱相关行业')
    tips.push('有经营头脑，善理财')
  }

  if (guanShaCount >= 2 && yinCount >= 2) {
    tips.push('官印相生，仕途顺利，适合考公或进入大企业')
  }
  if (shiShangCount >= 2 && caiCount >= 2) {
    tips.push('食伤生财，技艺致富，适合技术创业')
  }

  if (tips.length === 0) {
    tips.push('命局十神均衡，适合综合性岗位，可根据兴趣发展')
    tips.push('大运来临时把握好方向即可')
  }

  // 日主五行与事业方向
  const industryMap: Record<string, string> = {
    '木': '教育、医疗、文化、环保',
    '火': '传媒、能源、餐饮、科技',
    '土': '房地产、建筑、农业、金融',
    '金': '金融、法律、机械、军警',
    '水': '物流、贸易、旅游、咨询',
  }
  tips.push(`五行属${dayMasterWx}，适合行业：${industryMap[dayMasterWx] ?? '多元发展'}`)

  return tips
}

/** 分析财运 */
function analyzeWealth(bazi: BaZiResult, tenGods: ShiShenItem[]): string[] {
  void TIAN_GAN_WUXING[bazi.dayMaster]
  const tips: string[] = []

  const tenGodCount: Record<string, number> = {}
  for (const tg of tenGods) {
    tenGodCount[tg.shiShen] = (tenGodCount[tg.shiShen] ?? 0) + 1
  }

  const zhengCai = tenGodCount['正财'] ?? 0
  const pianCai = tenGodCount['偏财'] ?? 0
  const shiShang = (tenGodCount['食神'] ?? 0) + (tenGodCount['伤官'] ?? 0)
  const biJie = (tenGodCount['比肩'] ?? 0) + (tenGodCount['劫财'] ?? 0)

  if (zhengCai >= 2) {
    tips.push('正财旺，适合稳定的工作收入，有储蓄意识')
  }
  if (pianCai >= 2) {
    tips.push('偏财旺，适合投资经营，有意外之财运')
    tips.push('但偏财不稳定，需注意风险控制')
  }
  if (zhengCai + pianCai >= 3) {
    tips.push('财星有力，一生财运不错')
  }
  if (zhengCai + pianCai === 0) {
    tips.push('财星不显，需靠食伤生财或大运财星来临方有好财运')
  }
  if (shiShang >= 3 && zhengCai + pianCai >= 1) {
    tips.push('食伤生财格，通过技术和才华赚钱，财源稳定')
  }
  if (biJie >= 3 && zhengCai + pianCai >= 1) {
    tips.push('比劫多，有破财风险，不宜与人合伙或为人担保')
  }

  return tips
}

/** 分析婚姻 */
function analyzeMarriage(bazi: BaZiResult, tenGods: ShiShenItem[]): string[] {
  const tips: string[] = []
  const gender = bazi.gender

  const tenGodCount: Record<string, number> = {}
  for (const tg of tenGods) {
    tenGodCount[tg.shiShen] = (tenGodCount[tg.shiShen] ?? 0) + 1
  }

  // 日支为配偶宫
  const dayBranch = bazi.dayPillar.branch as DiZhi
  const dayBranchWx = DI_ZHI_WUXING[dayBranch] ?? ''

  // 男命看财星，女命看官杀
  if (gender === '男') {
    const caiCount = (tenGodCount['正财'] ?? 0) + (tenGodCount['偏财'] ?? 0)
    if (caiCount >= 2) {
      tips.push('财星多现，异性缘佳，但需注意感情专一')
    } else if (caiCount === 0) {
      tips.push('财星不显，晚婚为宜，需大运财星出现')
    } else {
      tips.push('财星适中，婚姻感情较为顺遂')
    }
  } else {
    const guanShaCount = (tenGodCount['正官'] ?? 0) + (tenGodCount['偏官'] ?? 0)
    if (guanShaCount >= 2) {
      tips.push('官杀混杂，感情选择较多，需明确心意')
    } else if (guanShaCount === 0) {
      tips.push('官星不显，晚婚为宜，需大运官星出现')
    } else {
      tips.push('官星清透，婚姻感情较为顺利')
    }
  }

  // 日支分析
  tips.push(`日支（配偶宫）为${dayBranch}(${dayBranchWx})，配偶性格${dayBranchWx === '火' ? '热情直率' : dayBranchWx === '水' ? '聪明敏感' : dayBranchWx === '金' ? '刚强独立' : dayBranchWx === '木' ? '仁慈温和' : '稳重务实'}`)

  // 日支被冲
  const chongBranch = CHONG_MAP[dayBranch]
  if (bazi.monthPillar.branch === chongBranch || bazi.hourPillar.branch === chongBranch) {
    tips.push('配偶宫逢冲，婚姻需用心经营，可能有聚少离多之象')
  }

  // 日支被合（配偶宫逢合，易有婚变）
  const monthBranch = bazi.monthPillar.branch as DiZhi
  const hourBranch = bazi.hourPillar.branch as DiZhi
  if ((HE_MAP[dayBranch] ?? []).includes(monthBranch) || (HE_MAP[dayBranch] ?? []).includes(hourBranch)) {
    tips.push('配偶宫逢合，伴侣人缘佳，需沟通维系信任')
  }

  // 日支被刑（配偶宫受刑，婚姻多摩擦）
  if ((XING_MAP[dayBranch] ?? []).includes(monthBranch) || (XING_MAP[dayBranch] ?? []).includes(hourBranch)) {
    tips.push('配偶宫逢刑，婚姻生活多摩擦，需互相包容')
  }

  // 日支被害（配偶宫被害，防第三者）
  if ((HAI_MAP[dayBranch] ?? []).includes(monthBranch) || (HAI_MAP[dayBranch] ?? []).includes(hourBranch)) {
    tips.push('配偶宫被害，感情易受外界干扰，需注意防范')
  }

  // 日支被破（配偶宫被破，感情易破裂）
  if ((PO_MAP[dayBranch] ?? []).includes(monthBranch) || (PO_MAP[dayBranch] ?? []).includes(hourBranch)) {
    tips.push('配偶宫被破，感情基础不稳固，需多沟通维护')
  }

  // 日支空亡
  const kwPair = getKongWang(bazi.dayPillar.ganZhi)
  if (kwPair && kwPair.includes(dayBranch)) {
    tips.push('配偶宫落空亡，婚姻缘分较淡，宜晚婚或行运填实时成婚')
  }

  return tips
}

/** 分析健康 */
function analyzeHealth(bazi: BaZiResult): string[] {
  const tips: string[] = []
  const dayMasterWx = TIAN_GAN_WUXING[bazi.dayMaster] ?? ''

  // 统计五行缺失
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

  // 五行缺失影响
  const WUXING_HEALTH: Record<string, string> = {
    '木': '肝胆、筋骨',
    '火': '心血管、眼目',
    '土': '脾胃、消化系统',
    '金': '肺、呼吸道、皮肤',
    '水': '肾脏、泌尿系统',
  }

  for (const [wx, count] of Object.entries(fiveCount)) {
    if (count === 0) {
      tips.push(`命局缺${wx}，注意${WUXING_HEALTH[wx] ?? ''}保养`)
    }
    if (count >= 5) {
      tips.push(`命局${wx}过旺，${WUXING_HEALTH[wx] ?? ''}易有负担，需注意平衡`)
    }
  }

  if (dayMasterWx && fiveCount[dayMasterWx] <= 2) {
    tips.push('日主偏弱，注意增强体质，规律作息')
  }

  return tips
}

/** 分析子女 */
function analyzeChildren(bazi: BaZiResult, tenGods: ShiShenItem[]): string[] {
  const tips: string[] = []
  const gender = bazi.gender
  const hourStem = bazi.hourPillar.stem
  const hourBranch = bazi.hourPillar.branch

  const tenGodCount: Record<string, number> = {}
  for (const tg of tenGods) {
    tenGodCount[tg.shiShen] = (tenGodCount[tg.shiShen] ?? 0) + 1
  }

  // 女命看食伤，男命看官杀
  if (gender === '女') {
    const shiShang = (tenGodCount['食神'] ?? 0) + (tenGodCount['伤官'] ?? 0)
    if (shiShang >= 2) tips.push('食伤旺，子女缘分佳，孩子聪明有才')
    else if (shiShang === 0) tips.push('食伤不显，子女缘较淡')
    else tips.push('食伤适中，子女缘分正常')
  } else {
    const guanSha = (tenGodCount['正官'] ?? 0) + (tenGodCount['偏官'] ?? 0)
    if (guanSha >= 2) tips.push('官杀旺，子女缘分佳，孩子有出息')
    else if (guanSha === 0) tips.push('官杀不显，子女缘分较淡')
    else tips.push('官杀适中，子女缘分正常')
  }

  // 时柱分析
  tips.push(`时柱${hourStem}${hourBranch}为子女宫，${TIAN_GAN_WUXING[hourStem] ?? '?'}${DI_ZHI_WUXING[hourBranch] ?? '?'}之性`)

  return tips
}

/** 主入口 */
export function analyzeSpecialTopics(
  bazi: BaZiResult,
): SpecialTopics {
  const tenGods = bazi.tenGods

  return {
    personality: analyzePersonality(bazi, tenGods),
    career: analyzeCareer(bazi, tenGods),
    wealth: analyzeWealth(bazi, tenGods),
    marriage: analyzeMarriage(bazi, tenGods),
    health: analyzeHealth(bazi),
    children: analyzeChildren(bazi, tenGods),
  }
}
