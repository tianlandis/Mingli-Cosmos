// ============================================================
// 八字排盘 — 核心类型定义 (Pure TypeScript)
// 来源：八字取格判断规则引导词（V2.0）+ 从月令取用到实战策略的完整解析 + 八字格局与MBTI类型映射
// ============================================================

import { KnowledgeRegistry } from './knowledge-registry'

export const TIAN_GAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'] as const
export type TianGan = typeof TIAN_GAN[number]

export const DI_ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'] as const
export type DiZhi = typeof DI_ZHI[number]

export const TIAN_GAN_YIN_YANG: Record<string, '阳' | '阴'> = {
  '甲': '阳', '乙': '阴', '丙': '阳', '丁': '阴', '戊': '阳',
  '己': '阴', '庚': '阳', '辛': '阴', '壬': '阳', '癸': '阴',
}

export const TIAN_GAN_WUXING: Record<string, string> = {
  '甲': '木', '乙': '木', '丙': '火', '丁': '火', '戊': '土',
  '己': '土', '庚': '金', '辛': '金', '壬': '水', '癸': '水',
}

export const DI_ZHI_WUXING: Record<string, string> = {
  '子': '水', '丑': '土', '寅': '木', '卯': '木',
  '辰': '土', '巳': '火', '午': '火', '未': '土',
  '申': '金', '酉': '金', '戌': '土', '亥': '水',
}



export const WUXING_COLORS: Record<string, string> = {
  '木': '#22C55E', '火': '#EF4444', '土': '#F59E0B',
  '金': '#F5F0E1', '水': '#3B82F6',
}

export const WUXING_LIST = ['金', '木', '水', '火', '土'] as const

/** 藏干天数分段表（固定刻度尺，V2.0规则）
 *  按照时间顺序排列：余气→中气→本气
 *  每月固定30天，供月令分金算法使用
 */
export interface HiddenStemSegment { stem: string; days: number }

// ─── _PRIVATE 硬编码兜底（DB 故障时引擎不死机） ───

/** 地支藏干表（余气→中气/墓气→本气顺序，对齐 Python MCP） */
const _HIDDEN_STEMS: Record<string, string[]> = {
  '子': ['癸'],
  '丑': ['癸', '辛', '己'],
  '寅': ['戊', '丙', '甲'],
  '卯': ['乙'],
  '辰': ['乙', '癸', '戊'],
  '巳': ['戊', '庚', '丙'],
  '午': ['丁'],
  '未': ['丁', '乙', '己'],
  '申': ['戊', '壬', '庚'],
  '酉': ['辛'],
  '戌': ['辛', '丁', '戊'],
  '亥': ['戊', '甲', '壬'],
}

const _HIDDEN_STEMS_DAYS: Record<string, HiddenStemSegment[]> = {
  '子': [{ stem: '癸', days: 30 }],
  '丑': [{ stem: '癸', days: 9 }, { stem: '辛', days: 6 }, { stem: '己', days: 15 }],
  '寅': [{ stem: '戊', days: 4 },  { stem: '丙', days: 6 }, { stem: '甲', days: 20 }],
  '卯': [{ stem: '乙', days: 30 }],
  '辰': [{ stem: '乙', days: 9 },  { stem: '癸', days: 6 }, { stem: '戊', days: 15 }],
  '巳': [{ stem: '戊', days: 4 },  { stem: '庚', days: 6 }, { stem: '丙', days: 20 }],
  '午': [{ stem: '丁', days: 30 }],
  '未': [{ stem: '丁', days: 9 },  { stem: '乙', days: 6 }, { stem: '己', days: 15 }],
  '申': [{ stem: '戊', days: 4 },  { stem: '壬', days: 6 }, { stem: '庚', days: 20 }],
  '酉': [{ stem: '辛', days: 30 }],
  '戌': [{ stem: '辛', days: 9 },  { stem: '丁', days: 6 }, { stem: '戊', days: 15 }],
  '亥': [{ stem: '戊', days: 2 },  { stem: '甲', days: 7 }, { stem: '壬', days: 21 }],
}

// ─── ES Module Live Binding（初始值 = _PRIVATE 兜底，reload 后动态接管） ───

export let HIDDEN_STEMS: Record<string, string[]> = _HIDDEN_STEMS
export let HIDDEN_STEMS_DAYS: Record<string, HiddenStemSegment[]> = _HIDDEN_STEMS_DAYS

// ─── reload：从 KnowledgeRegistry 动态接管 ───

export function reloadTypesData() {
  HIDDEN_STEMS = KnowledgeRegistry.getOrFallback<Record<string, string[]>>(
    'bazi.hidden_stems', _HIDDEN_STEMS
  )
  HIDDEN_STEMS_DAYS = KnowledgeRegistry.getOrFallback<Record<string, HiddenStemSegment[]>>(
    'bazi.hidden_stems_days', _HIDDEN_STEMS_DAYS
  )
}

export type ShiShen =
  | '正官' | '偏官' | '正印' | '偏印'
  | '比肩' | '劫财' | '食神' | '伤官'
  | '正财' | '偏财'

export interface Pillar {
  stem: string
  branch: string
  stemWuXing: string
  branchWuXing: string
  hiddenStems: string[]
  ganZhi: string
}

export interface DaYun {
  startAge: number
  endAge: number
  startYear: number
  endYear: number
  stem: string
  branch: string
  ganZhi: string
  isForward: boolean
}

export interface ShiShenItem {
  ganZhi: string
  position: string
  shiShen: ShiShen
}

export interface BaZiResult {
  birthDate: string
  birthTime: string
  gender: '男' | '女'
  yearPillar: Pillar
  monthPillar: Pillar
  dayPillar: Pillar
  hourPillar: Pillar
  dayMaster: string
  fiveElements: Record<string, number>
  tenGods: ShiShenItem[]
  daYun: DaYun[]
  currentDaYun: DaYun | null
  currentYear: { stem: string; branch: string; ganZhi: string }
  /** 起运天数（出生到最近节气的天数） */
  qiYunDays: number
  /** 大运是否顺排（阳男阴女为true，阴男阳女为false） */
  daYunForward: boolean
}

// 五鼠遁 / 五虎遁 不再需要（改用 lunar-typescript 计算）
// 保留注释作为算法参考，如需降级到手动计算时可恢复此代码
