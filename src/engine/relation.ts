// ============================================================
// 八字 — 地支关系常量（依据 bazijichu §4-6）
// 冲·合·刑·破·害·三合·三会·空亡
// ============================================================

import type { DiZhi } from './types'

// ─────────── 1. 地支六冲 ───────────
// 子午冲、丑未冲、寅申冲、卯酉冲、辰戌冲、巳亥冲
export const CHONG_MAP: Record<DiZhi, DiZhi> = {
  '子': '午', '午': '子', '丑': '未', '未': '丑',
  '寅': '申', '申': '寅', '卯': '酉', '酉': '卯',
  '辰': '戌', '戌': '辰', '巳': '亥', '亥': '巳',
}

// ─────────── 2. 地支六合 + 化五行 ───────────
// 子丑合化土、寅亥合化木、卯戌合化火、辰酉合化金、巳申合化水、午未合化土
export const HE_MAP: Record<DiZhi, DiZhi[]> = {
  '子': ['丑'], '丑': ['子'], '寅': ['亥'], '亥': ['寅'],
  '卯': ['戌'], '戌': ['卯'], '辰': ['酉'], '酉': ['辰'],
  '巳': ['申'], '申': ['巳'], '午': ['未'], '未': ['午'],
}

/** 六合 → 化出的五行 */
export const HE_HUA_WUXING: Record<string, string> = {
  '子丑': '土', '丑子': '土',
  '寅亥': '木', '亥寅': '木',
  '卯戌': '火', '戌卯': '火',
  '辰酉': '金', '酉辰': '金',
  '巳申': '水', '申巳': '水',
  '午未': '土', '未午': '土',
}

// ─────────── 3. 地支三合局 ───────────
// 申子辰合水、寅午戌合火、亥卯未合木、巳酉丑合金
export interface SanHe {
  branches: [DiZhi, DiZhi, DiZhi]
  result: string  // 化出的五行
  name: string
}

export const SAN_HE: SanHe[] = [
  { branches: ['申', '子', '辰'], result: '水', name: '申子辰合水局' },
  { branches: ['寅', '午', '戌'], result: '火', name: '寅午戌合火局' },
  { branches: ['亥', '卯', '未'], result: '木', name: '亥卯未合木局' },
  { branches: ['巳', '酉', '丑'], result: '金', name: '巳酉丑合金局' },
]

/** 半合：三合去掉中间字即为半合 */
export interface BanHe {
  branches: [DiZhi, DiZhi]
  result: string
  name: string
}

export const BAN_HE: BanHe[] = [
  { branches: ['申', '辰'], result: '水', name: '申辰半合水局' },
  { branches: ['子', '申'], result: '水', name: '子申半合水局' },
  { branches: ['子', '辰'], result: '水', name: '子辰半合水局' },
  { branches: ['寅', '戌'], result: '火', name: '寅戌半合火局' },
  { branches: ['午', '寅'], result: '火', name: '午寅半合火局' },
  { branches: ['午', '戌'], result: '火', name: '午戌半合火局' },
  { branches: ['亥', '未'], result: '木', name: '亥未半合木局' },
  { branches: ['卯', '亥'], result: '木', name: '卯亥半合木局' },
  { branches: ['卯', '未'], result: '木', name: '卯未半合木局' },
  { branches: ['巳', '丑'], result: '金', name: '巳丑半合金局' },
  { branches: ['酉', '巳'], result: '金', name: '酉巳半合金局' },
  { branches: ['酉', '丑'], result: '金', name: '酉丑半合金局' },
]

// ─────────── 4. 地支三会局 ───────────
// 亥子丑会水、寅卯辰会木、巳午未会火、申酉戌会金
export interface SanHui {
  branches: [DiZhi, DiZhi, DiZhi]
  result: string
  name: string
}

export const SAN_HUI: SanHui[] = [
  { branches: ['亥', '子', '丑'], result: '水', name: '亥子丑会北方水局' },
  { branches: ['寅', '卯', '辰'], result: '木', name: '寅卯辰会东方木局' },
  { branches: ['巳', '午', '未'], result: '火', name: '巳午未会南方火局' },
  { branches: ['申', '酉', '戌'], result: '金', name: '申酉戌会西方金局' },
]

// ─────────── 5. 地支相刑 ───────────
// 无礼之刑: 子刑卯、卯刑子
// 无恩之刑: 寅刑巳、巳刑申、申刑寅
// 持势之刑: 丑刑戌、戌刑未、未刑丑
// 自刑: 辰午酉亥
export const XING_MAP: Record<DiZhi, DiZhi[]> = {
  '子': ['卯'], '卯': ['子'],
  '寅': ['巳', '申'], '巳': ['寅', '申'], '申': ['寅', '巳'],
  '丑': ['戌', '未'], '戌': ['丑', '未'], '未': ['丑', '戌'],
  '辰': ['辰'], '午': ['午'], '酉': ['酉'], '亥': ['亥'],
}

/** 自刑的地支集合 */
export const ZI_XING: Set<DiZhi> = new Set(['辰', '午', '酉', '亥'])

/** 刑的类型名 */
export function getXingName(a: DiZhi, b: DiZhi): string {
  if ((a === '子' && b === '卯') || (a === '卯' && b === '子')) return '无礼之刑'
  if (['寅', '巳', '申'].includes(a) && ['寅', '巳', '申'].includes(b)) return '无恩之刑'
  if (['丑', '戌', '未'].includes(a) && ['丑', '戌', '未'].includes(b)) return '持势之刑'
  if (a === b && ZI_XING.has(a)) return '自刑'
  return '相刑'
}

// ─────────── 6. 地支相破 ───────────
// 子酉破、丑辰破、寅亥破、午卯破、未戌破、巳申破
export const PO_MAP: Record<DiZhi, DiZhi[]> = {
  '子': ['酉'], '酉': ['子'],
  '丑': ['辰'], '辰': ['丑'],
  '寅': ['亥'], '亥': ['寅'],
  '午': ['卯'], '卯': ['午'],
  '未': ['戌'], '戌': ['未'],
  '巳': ['申'], '申': ['巳'],
}

// ─────────── 7. 地支相害（六害） ───────────
// 子未害、丑午害、寅巳害、卯辰害、申亥害、酉戌害
export const HAI_MAP: Record<DiZhi, DiZhi[]> = {
  '子': ['未'], '未': ['子'],
  '丑': ['午'], '午': ['丑'],
  '寅': ['巳'], '巳': ['寅'],
  '卯': ['辰'], '辰': ['卯'],
  '申': ['亥'], '亥': ['申'],
  '酉': ['戌'], '戌': ['酉'],
}

// ─────────── 8. 空亡（六甲旬空亡） ───────────
// 依据日柱干支查所属六甲旬，对应两个空亡地支
// 六甲旬: 甲子旬→戌亥, 甲戌旬→申酉, 甲申旬→午未,
//           甲午旬→辰巳, 甲辰旬→寅卯, 甲寅旬→子丑
const KONG_WANG_XUN: { stem: string; branchStart: DiZhi; kongWang: [DiZhi, DiZhi] }[] = [
  { stem: '甲', branchStart: '子', kongWang: ['戌', '亥'] },
  { stem: '甲', branchStart: '戌', kongWang: ['申', '酉'] },
  { stem: '甲', branchStart: '申', kongWang: ['午', '未'] },
  { stem: '甲', branchStart: '午', kongWang: ['辰', '巳'] },
  { stem: '甲', branchStart: '辰', kongWang: ['寅', '卯'] },
  { stem: '甲', branchStart: '寅', kongWang: ['子', '丑'] },
]

import { TIAN_GAN, DI_ZHI } from './types'

/** 根据日柱干支获取空亡地支对 */
export function getKongWang(dayGanZhi: string): [DiZhi, DiZhi] | null {
  if (dayGanZhi.length < 2) return null
  const stem = dayGanZhi[0]
  const branch = dayGanZhi[1] as DiZhi
  if (!TIAN_GAN.includes(stem as typeof TIAN_GAN[number]) || !DI_ZHI.includes(branch)) return null

  const JIA_ZI_ORDER = [
    '甲子','乙丑','丙寅','丁卯','戊辰','己巳','庚午','辛未','壬申','癸酉',
    '甲戌','乙亥','丙子','丁丑','戊寅','己卯','庚辰','辛巳','壬午','癸未',
    '甲申','乙酉','丙戌','丁亥','戊子','己丑','庚寅','辛卯','壬辰','癸巳',
    '甲午','乙未','丙申','丁酉','戊戌','己亥','庚子','辛丑','壬寅','癸卯',
    '甲辰','乙巳','丙午','丁未','戊申','己酉','庚戌','辛亥','壬子','癸丑',
    '甲寅','乙卯','丙辰','丁巳','戊午','己未','庚申','辛酉','壬戌','癸亥',
  ]

  const idx = JIA_ZI_ORDER.indexOf(dayGanZhi)
  if (idx === -1) return null

  const xunIdx = Math.floor(idx / 10) // 0-5
  return KONG_WANG_XUN[xunIdx].kongWang
}

/** 获取四柱中所有空亡地支（按日柱查） */
export function getFourPillarKongWang(
  dayGanZhi: string,
  allBranches: DiZhi[],
): DiZhi[] {
  const kw = getKongWang(dayGanZhi)
  if (!kw) return []
  return allBranches.filter(b => kw.includes(b))
}

// ─────────── 9. 工具函数 ───────────

/** 判断连在一起的三会局（如亥子丑、寅卯辰等） */
export function findSanHui(branches: DiZhi[]): SanHui | null {
  for (const hui of SAN_HUI) {
    if (hui.branches.every(b => branches.includes(b))) {
      return hui
    }
  }
  return null
}

/** 判断三合局 */
export function findSanHe(branches: DiZhi[]): SanHe | null {
  for (const he of SAN_HE) {
    if (he.branches.every(b => branches.includes(b))) {
      return he
    }
  }
  return null
}

/** 判断半合局 */
export function findBanHe(branches: DiZhi[]): BanHe | null {
  for (const bh of BAN_HE) {
    if (bh.branches.every(b => branches.includes(b))) {
      return bh
    }
  }
  return null
}

/** 检查两个地支之间的所有关系 */
export interface BranchRelation {
  chong: boolean      // 冲
  heLiu: boolean      // 六合
  xing: boolean       // 刑
  po: boolean         // 破
  hai: boolean        // 害
  xingName?: string   // 刑的类型名
}

export function getBranchRelation(a: DiZhi, b: DiZhi): BranchRelation {
  return {
    chong: CHONG_MAP[a] === b,
    heLiu: (HE_MAP[a] ?? []).includes(b),
    xing: (XING_MAP[a] ?? []).includes(b),
    po: (PO_MAP[a] ?? []).includes(b),
    hai: (HAI_MAP[a] ?? []).includes(b),
    xingName: (XING_MAP[a] ?? []).includes(b) ? getXingName(a, b) : undefined,
  }
}
