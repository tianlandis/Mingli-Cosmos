// ============================================================
// 八字排盘 — 核心类型定义 (Pure TypeScript)
// 来源: bazijichu.md §1-18
// ============================================================

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

export const NAYIN_TABLE: Record<string, string> = {
  '甲子': '海中金', '乙丑': '海中金', '丙寅': '炉中火', '丁卯': '炉中火',
  '戊辰': '大林木', '己巳': '大林木', '庚午': '路旁土', '辛未': '路旁土',
  '壬申': '剑锋金', '癸酉': '剑锋金', '甲戌': '山头火', '乙亥': '山头火',
  '丙子': '涧下水', '丁丑': '涧下水', '戊寅': '城头土', '己卯': '城头土',
  '庚辰': '白腊金', '辛巳': '白腊金', '壬午': '杨柳木', '癸未': '杨柳木',
  '甲申': '泉中水', '乙酉': '泉中水', '丙戌': '屋上土', '丁亥': '屋上土',
  '戊子': '霹雳火', '己丑': '霹雳火', '庚寅': '松柏木', '辛卯': '松柏木',
  '壬辰': '长流水', '癸巳': '长流水', '甲午': '沙中金', '乙未': '沙中金',
  '丙申': '山下火', '丁酉': '山下火', '戊戌': '平地木', '己亥': '平地木',
  '庚子': '壁上土', '辛丑': '壁上土', '壬寅': '金箔金', '癸卯': '金箔金',
  '甲辰': '覆灯火', '乙巳': '覆灯火', '丙午': '天河水', '丁未': '天河水',
  '戊申': '大驿土', '己酉': '大驿土', '庚戌': '钗钏金', '辛亥': '钗钏金',
  '壬子': '桑柘木', '癸丑': '桑柘木', '甲寅': '大溪水', '乙卯': '大溪水',
  '丙辰': '沙中土', '丁巳': '沙中土', '戊午': '天上火', '己未': '天上火',
  '庚申': '石榴木', '辛酉': '石榴木', '壬戌': '大海水', '癸亥': '大海水',
}

export const HIDDEN_STEMS: Record<string, string[]> = {
  '子': ['癸'],
  '丑': ['己', '癸', '辛'],
  '寅': ['甲', '丙', '戊'],
  '卯': ['乙'],
  '辰': ['戊', '乙', '癸'],
  '巳': ['丙', '庚', '戊'],
  '午': ['丁', '己'],
  '未': ['己', '丁', '乙'],
  '申': ['庚', '壬', '戊'],
  '酉': ['辛'],
  '戌': ['戊', '辛', '丁'],
  '亥': ['壬', '甲'],
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
export const HIDDEN_STEMS_DAYS: Record<string, HiddenStemSegment[]> = {
  '子': [{ stem: '癸', days: 30 }],
  '丑': [{ stem: '己', days: 15 }, { stem: '癸', days: 9 }, { stem: '辛', days: 6 }],
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
  naYin: string
  ganZhi: string
}

export interface DaYun {
  startAge: number
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

// Reserved for a future manual fallback path; the current runtime path uses lunar-typescript.
export const DAY_TO_HOUR_STEM: Record<string, string> = {
  '甲': '甲', '己': '甲', '乙': '丙', '庚': '丙',
  '丙': '戊', '辛': '戊', '丁': '庚', '壬': '庚',
  '戊': '壬', '癸': '壬',
}

export const YEAR_TO_MONTH_STEM: Record<string, string> = {
  '甲': '丙', '己': '丙', '乙': '戊', '庚': '戊',
  '丙': '庚', '辛': '庚', '丁': '壬', '壬': '壬',
  '戊': '甲', '癸': '甲',
}
