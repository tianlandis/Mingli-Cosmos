// ============================================================
// 批注引擎 — 类型定义
// ============================================================

import type { BaZiResult, ShiShen } from '../types'

/** 日主旺衰等级 */
export type DayMasterStrength = '极强' | '强' | '中和偏强' | '中和' | '中和偏弱' | '弱' | '极弱'

/** 格局类型 */
export type PatternType = '正格' | '从格' | '特殊格局'

/** 五行等级 */
export type WuXingLevel = '偏旺' | '中和' | '偏弱'

/** 用神忌神结果 */
export interface YongShenResult {
  yongShen: string[]        // 用神五行列表
  jiShen: string[]           // 忌神五行列表
  xianShen: string[]         // 闲神（中性）
  reason: string[]           // 取用理由
  tiaoHou: string[]          // 调候用神
}

/** 日主强弱分析 */
export interface StrengthAnalysis {
  strength: DayMasterStrength
  score: number              // 0-100 分
  /** 置信度 0-1，分数越极端置信度越高 */
  confidence: number
  reasons: string[]          // 判断依据
  /** 经典引证（可空） */
  classicReference: string[]
  components: {
    yueLing: number          // 月令得分
    diZhiGen: number         // 地支根气得
    tianGanBiJie: number    // 天干比劫得分
    shengFu: number          // 生扶力量
    keXieHao: number         // 克泄耗力量
  }
}

/** 格局分析 */
export interface PatternAnalysis {
  patternType: PatternType
  patternName: string
  /** 置信度 0-1，月令透出或条件明确则高 */
  confidence: number
  conditions: string[]       // 成格条件
  quality: '上等' | '中等' | '平'  // 格局高低
  description: string        // 格局描述
  /** 备选格局（如有争议） */
  alternatives: { name: string; reason: string }[]
  /** 经典引证 */
  classicReference: string[]

  // ─── V2.0 新增字段 ───

  /** 取格方法 */
  method: string
  /** 取格使用的藏干 */
  sourceStem: string
  /** 格局十神 */
  shiShen: string
  /** 格局吉凶属性 */
  jiXiong: '吉' | '凶' | '中性'
  /** 格局吉凶描述 */
  jiXiongDesc: string

  /** 格局组合（V2.0组合判定） */
  combination: {
    name: string
    dominantPattern: string
    keyCombination: string
    keyStem: string
    keyPosition: string
    isPure: boolean
  }

  /** 破格风险 */
  poGeRisks: {
    type: string
    description: string
    severity: '高' | '中' | '低'
    suggestion: string
    mbtiAdjust: string
  }[]

  /** MBTI 分析 */
  mbti: {
    cognitiveFunctions: string
    typicalTypes: string[]
    traits: string
    portrait: string
    industrySuggestions: string[]
    energyAdjustments: string[]
  }

  /** 月令分金详情（仅分金取格时有值） */
  fenJinDetail?: {
    qiYunDays: number
    daYunForward: boolean
    fenJinReverse: boolean
    effectiveDays: number
    steps: string[]
  }
}

/** 五行平衡项 */
export interface WuXingBalanceItem {
  name: string               // 五行名
  level: WuXingLevel
  count: number              // 数量
  advice: string             // 建议
}

/** 十神概况项 */
export interface ShiShenProfileItem {
  name: ShiShen
  count: number
  positions: string[]
}

/** 大运解读项 */
export interface DaYunAnalysisItem {
  ganZhi: string
  startAge: number
  endAge: number
  interpretation: string     // 运势解读
  quality: '佳' | '平' | '不佳'  // 运势好坏
}

/** 流年分析 */
export interface CurrentYearAnalysis {
  ganZhi: string
  interpretation: string
  focus: string[]            // 关注要点
}

/** 人生节点 */
export interface Milestone {
  age: number
  year: number
  ganZhi: string
  event: string
  reason: string
}

/** 专题批注 */
export interface SpecialTopics {
  personality: string[]
  career: string[]
  wealth: string[]
  marriage: string[]
  health: string[]
  children: string[]
}

/** 神煞项 */
export interface ShenShaItem {
  name: string               // 神煞名称
  type: '吉' | '凶' | '中性'
  description: string
  pillar: string             // 所在柱
  classicRef: string         // 经典出处
}

/** 神煞分析 */
export interface ShenShaAnalysis {
  summary: string[]
  items: ShenShaItem[]
}

/** ─── 地支关系分析 ─── */
export interface BranchRelationItem {
  target: string             // 关系对象（另一柱名或地支）
  relation: string           // 关系名：冲/合/刑/破/害/三合/三会/半合/空亡
  detail: string             // 详细描述
}

export interface BranchRelationsAnalysis {
  /** 整体关系摘要 */
  summary: string[]
  /** 刑冲合害破逐一分析 */
  items: string[]
  /** 空亡分析 */
  kongWang: string[]
  /** 三合三会 */
  heJu: string[]
  /** 四柱间关系详情 */
  pillarRelations: {
    pillar: string
    branch: string
    relations: BranchRelationItem[]
  }[]
}

/** ─── 完整批注输出 ─── */
export interface AnnotationResult {
  overview: {
    summary: string           // 一句话命局总评
    dayMaster: string
    strength: string
    pattern: string
    yongShen: string
    jiShen: string
    /** MBTI 类型（V2.0新增） */
    mbti?: string
    /** 格局组合（V2.0新增） */
    combination?: string
  }

  strengthAnalysis: StrengthAnalysis

  yongShen: YongShenResult

  wuXingBalance: WuXingBalanceItem[]

  shiShenProfile: ShiShenProfileItem[]

  patternAnalysis: PatternAnalysis

  luckAnalysis: {
    daYunList: DaYunAnalysisItem[]
    currentYear: CurrentYearAnalysis
    milestones: Milestone[]
  }

  branchRelations: BranchRelationsAnalysis

  shenSha: ShenShaAnalysis

  specialTopics: SpecialTopics

  /** 免责声明 */
  disclaimer: string

  comprehensiveAdvice: string[]
}

/** ─── 内部计算中间量 ─── */
export interface AnnotationInput {
  bazi: BaZiResult
}
