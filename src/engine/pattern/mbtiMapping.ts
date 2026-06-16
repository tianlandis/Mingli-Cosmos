// ============================================================
// MBTI 映射模块
// 来源：八字格局与MBTI类型映射.md（三阶精修版）
// ============================================================

import type { PatternCombination, PoGeRisk } from './patternRules'

// ─── 十神 → MBTI主功能映射 ───

/** 十神格局组合 → 认知功能组合（主导+辅助） */
export const SHISHEN_MBTI_FUNCTION: Record<string, { dominant: string; auxiliary: string; mbtiTypes: string[] }> = {
  '正官': { dominant: 'Te', auxiliary: 'Si/Ni', mbtiTypes: ['ESTJ', 'INTJ'] },
  '七杀': { dominant: 'Ti', auxiliary: 'Ne/Se', mbtiTypes: ['INTP', 'ESTP'] },
  '正印': { dominant: 'Ne', auxiliary: 'Fi/Ti', mbtiTypes: ['ENFP', 'ENTP'] },
  '偏印': { dominant: 'Ni', auxiliary: 'Te/Fe', mbtiTypes: ['INTJ', 'INFJ'] },
  '正财': { dominant: 'Se', auxiliary: 'Te/Fi', mbtiTypes: ['ESTP', 'ESFP'] },
  '偏财': { dominant: 'Si', auxiliary: 'Te/Fe', mbtiTypes: ['ESTJ', 'ISFJ'] },
  '食神': { dominant: 'Fi', auxiliary: 'Ne/Se', mbtiTypes: ['INFP', 'ISFP'] },
  '伤官': { dominant: 'Fe', auxiliary: 'Ni/Se', mbtiTypes: ['INFJ', 'ESFJ'] },
}

// ─── 格局组合 → MBTI 映射 ───

export interface MBTIProfile {
  /** 格局组合名称 */
  combinationName: string
  /** 认知功能组合 */
  cognitiveFunctions: string
  /** 典型 MBTI 类型 */
  typicalTypes: string[]
  /** 核心特质描述 */
  traits: string
  /** 实战画像补充 */
  portrait: string
}

/** 格局组合 → MBTI 映射表 */
const COMBINATION_MBTI_MAP: Record<string, MBTIProfile> = {
  '官印相生': {
    combinationName: '官印相生',
    cognitiveFunctions: 'Te + Ne',
    typicalTypes: ['ENTJ', 'ENTP'],
    traits: '规则建筑者 + 宏观构想家',
    portrait: '有理想且懂规则，计划性与创造力并重。既善于在体制内制定长远战略，也能在创业中开辟蓝海。',
  },
  '煞印相生': {
    combinationName: '煞印相生',
    cognitiveFunctions: 'Ti + Ni',
    typicalTypes: ['INTJ', 'INFJ'],
    traits: '逻辑分析家 + 深度洞察家',
    portrait: '深谋远虑，在压力下爆发。将深度逻辑与内在洞察结合，成为铁腕政治家或战略军事家。',
  },
  '财官相生': {
    combinationName: '财官相生',
    cognitiveFunctions: 'Se + Te',
    typicalTypes: ['ESTJ', 'ENTJ'],
    traits: '现实控制者 + 规则建筑者',
    portrait: '务实高效的执行者，善于管理、运营。将资源控制与规则执行结合，适合大型企业或政府管理部门。',
  },
  '食神生财': {
    combinationName: '食神生财',
    cognitiveFunctions: 'Fi + Se',
    typicalTypes: ['ISFP', 'ESFP'],
    traits: '内在价值守护者 + 现实控制者',
    portrait: '用才华和技术服务社会，将内心审美外化为具体作品或服务，以"艺"安身立命，快乐赚钱。',
  },
  '伤官生财': {
    combinationName: '伤官生财',
    cognitiveFunctions: 'Fe + Se',
    typicalTypes: ['ESFJ', 'ESTP'],
    traits: '情感连接者 + 现实控制者',
    portrait: '情绪饱满，善于社交和连接资源。将情感力量转化为市场影响力，适合销售、公关、娱乐领域。',
  },
  '伤官佩印': {
    combinationName: '伤官佩印',
    cognitiveFunctions: 'Fe + Ne',
    typicalTypes: ['ENFJ', 'ENFP'],
    traits: '情感连接者 + 宏观构想家',
    portrait: '才华横溢且有思想深度。用理性(印)驾驭感性(伤官)，成为创意领袖、教育家或心理咨询师。',
  },
  '纯印格': {
    combinationName: '纯印格（无官杀）',
    cognitiveFunctions: 'Ne/Ni + Fi/Ti',
    typicalTypes: ['INFP', 'INFJ'],
    traits: '灵感丰沛但缺执行力',
    portrait: '灵感丰沛但缺乏结构化执行力（缺官杀）。需要补足思维（官杀）才能将天赋最大化。',
  },
  '纯财格': {
    combinationName: '纯财格（无食伤）',
    cognitiveFunctions: 'Se/Si + Te/Fe',
    typicalTypes: ['ESTJ', 'ISFJ'],
    traits: '务实稳健缺创造力',
    portrait: '务实稳健，但缺乏才华（食伤）的源头活水。容易"死赚钱"，需要引入食伤来激发创造性和收入渠道。',
  },
  '禄格': {
    combinationName: '禄格',
    cognitiveFunctions: 'Si + Ne',
    typicalTypes: ['ISFJ', 'INFP'],
    traits: '安稳的顺局者',
    portrait: '安稳的顺局者。依赖稳定环境，需关注透干十神，顺势而为。',
  },
  '羊刃格': {
    combinationName: '羊刃格',
    cognitiveFunctions: 'Se + Te',
    typicalTypes: ['ESTP', 'ENTJ'],
    traits: '冲突与动荡的制造者或解决者',
    portrait: '能量极强，必须被有效制化（食神/官杀），否则易成"悍匪"。',
  },
}

// ─── 行业适配 ───

export interface IndustryMatch {
  combination: string
  industries: string[]
  mbtiAdvantage: string
  riskWarning: string
}

const INDUSTRY_MATCHES: Record<string, IndustryMatch> = {
  '伤官格': {
    combination: '伤官格（ENFP/ENFJ）',
    industries: ['新媒体运营', '创意策划', '心理咨询'],
    mbtiAdvantage: 'Ne+Fe 优势',
    riskWarning: '需警惕"伤官见官"流年，强化逻辑(Ti)以避免情绪化决策',
  },
  '七杀格': {
    combination: '七杀格（ISTJ/INTJ）',
    industries: ['数据分析', '风险管理'],
    mbtiAdvantage: 'Te+Si/Ni 优势',
    riskWarning: '需警惕"财星滋杀"运势，避免过度冒险，并增强Fi(人文关怀)防止控制欲过强',
  },
  '官印相生': {
    combination: '官印相生（ENTJ/ENTP）',
    industries: ['战略规划', '企业管理'],
    mbtiAdvantage: 'Te+Ne 优势',
    riskWarning: '需警惕"财星破印"运势，避免被短期利益动摇长远理想',
  },
  '煞印相生': {
    combination: '煞印相生（INTJ/INFJ）',
    industries: ['军政谋略', '尖端科研'],
    mbtiAdvantage: 'Ni+Ti/Fe 优势',
    riskWarning: '需警惕自我封闭，主动引入Se(外倾感觉)以保持与现实连接',
  },
  '食神生财': {
    combination: '食神生财（ISFP/ESFP）',
    industries: ['艺术创作', '自由职业', '技术研发'],
    mbtiAdvantage: 'Fi+Se 优势',
    riskWarning: '需警惕"枭神夺食"大运，补充Te(外倾思维)进行财务规划',
  },
}

// ─── 能量调整策略 ───

export interface EnergyAdjustment {
  initialState: string
  weakness: string
  mbtiDirection: string
  practicalMethods: string[]
}

const ENERGY_ADJUSTMENTS: EnergyAdjustment[] = [
  {
    initialState: '印格无官杀',
    weakness: '缺乏结构化执行力',
    mbtiDirection: '向 ENTJ（Te+Ni）靠拢',
    practicalMethods: ['学习项目管理', '逻辑推演训练', '将灵感程序化'],
  },
  {
    initialState: '财格无食伤',
    weakness: '缺乏创造力和才华源头',
    mbtiDirection: '向 ESFP（Se+Fi）靠拢',
    practicalMethods: ['培养艺术爱好', '发展副业技能', '让赚钱模式多样化'],
  },
  {
    initialState: '官格（顺境）',
    weakness: '缺乏宏观战略眼光',
    mbtiDirection: '向 INTJ（Ni+Te）靠拢',
    practicalMethods: ['加强深度思考', '研究未来趋势', '制定长期战略'],
  },
  {
    initialState: '官格（逆境）',
    weakness: '缺乏灵活破局能力',
    mbtiDirection: '向 ENTP（Ne+Ti）靠拢',
    practicalMethods: ['寻找规则漏洞', '探索新的可能性', '提升灵活应变能力'],
  },
]

// ─── 主入口函数 ───

export interface MBTIAnalysis {
  /** 主导格局的MBTI功能 */
  dominantFunction: { dominant: string; auxiliary: string; mbtiTypes: string[] }
  /** 格局组合对应的MBTI画像 */
  combinationProfile: MBTIProfile | null
  /** 推荐的典型MBTI类型 */
  recommendedTypes: string[]
  /** 认知功能描述 */
  cognitiveDescription: string
  /** 行业适配建议 */
  industrySuggestions: IndustryMatch[]
  /** 能量调整策略 */
  energyAdjustments: EnergyAdjustment[]
}

/**
 * 根据格局和组合生成完整 MBTI 分析
 */
export function analyzeMBTI(
  dominantShiShen: string,
  combination: PatternCombination,
  risks: PoGeRisk[],
): MBTIAnalysis {
  // 主导功能
  const dominantFunc = SHISHEN_MBTI_FUNCTION[dominantShiShen] ?? {
    dominant: '未知', auxiliary: '未知', mbtiTypes: [],
  }

  // 组合画像
  const combinationProfile = COMBINATION_MBTI_MAP[combination.name] ?? null

  // 推荐类型
  const recommendedTypes = combinationProfile
    ? combinationProfile.typicalTypes
    : dominantFunc.mbtiTypes

  // 认知功能描述
  const cognitiveDescription = combinationProfile
    ? `${combinationProfile.cognitiveFunctions} - ${combinationProfile.traits}`
    : `${dominantFunc.dominant} + ${dominantFunc.auxiliary}`

  // 行业适配
  const industrySuggestions: IndustryMatch[] = []
  const cleanPattern = combination.dominantPattern.replace('格', '格').replace(/格/g, '')
  // 尝试按格局名匹配行业
  for (const [key, match] of Object.entries(INDUSTRY_MATCHES)) {
    if (
      combination.name.includes(key) ||
      combination.dominantPattern.includes(key) ||
      key.includes(dominantShiShen)
    ) {
      industrySuggestions.push(match)
      break // 只取最匹配的一个
    }
  }

  // 能量调整策略
  const energyAdjustments: EnergyAdjustment[] = []
  for (const adj of ENERGY_ADJUSTMENTS) {
    if (combination.name.includes('印格') && adj.initialState.includes('印格')) {
      energyAdjustments.push(adj)
    }
    if (combination.name.includes('财格') && adj.initialState.includes('财格')) {
      energyAdjustments.push(adj)
    }
    if (combination.name.includes('官格') && adj.initialState.includes('官格')) {
      energyAdjustments.push(adj)
    }
  }

  return {
    dominantFunction: dominantFunc,
    combinationProfile,
    recommendedTypes,
    cognitiveDescription,
    industrySuggestions,
    energyAdjustments,
  }
}
