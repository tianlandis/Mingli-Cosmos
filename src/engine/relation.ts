// ============================================================
// 八字 — 地支关系常量（Phase 4b：Registry 动态数据 + 硬编码兜底）
// 文件：src/engine/relation.ts
// 冲·合·刑·破·害·三合·三会·空亡
//
// 架构说明：
//   - export let 利用 ES Module live binding，允许热更新
//   - 硬编码常量保留为兜底（_PRIVATE）确保 Registry 空时引擎不死
//   - reloadBranchRelations() 由服务端 bootKnowledgeRegistry 调用
// ============================================================

import type { DiZhi } from './types'
import { TIAN_GAN, DI_ZHI } from './types'
import { KnowledgeRegistry } from './knowledge-registry'

// ═══════════════════════════════════════
// 硬编码兜底常量（_PRIVATE，永不导出）
// ═══════════════════════════════════════

// ─── 1. 地支六冲 ───
const _CHONG_MAP: Record<DiZhi, DiZhi> = {
  '子': '午', '午': '子', '丑': '未', '未': '丑',
  '寅': '申', '申': '寅', '卯': '酉', '酉': '卯',
  '辰': '戌', '戌': '辰', '巳': '亥', '亥': '巳',
}

// ─── 2. 地支六合 + 化五行 ───
const _HE_MAP: Record<DiZhi, DiZhi[]> = {
  '子': ['丑'], '丑': ['子'], '寅': ['亥'], '亥': ['寅'],
  '卯': ['戌'], '戌': ['卯'], '辰': ['酉'], '酉': ['辰'],
  '巳': ['申'], '申': ['巳'], '午': ['未'], '未': ['午'],
}

const _HE_HUA_WUXING: Record<string, string> = {
  '子丑': '土', '丑子': '土',
  '寅亥': '木', '亥寅': '木',
  '卯戌': '火', '戌卯': '火',
  '辰酉': '金', '酉辰': '金',
  '巳申': '水', '申巳': '水',
  '午未': '土', '未午': '土',
}

// ─── 3. 地支三合局 ───
export interface SanHe {
  branches: [DiZhi, DiZhi, DiZhi]
  result: string
  name: string
}

const _SAN_HE: SanHe[] = [
  { branches: ['申', '子', '辰'], result: '水', name: '申子辰合水局' },
  { branches: ['寅', '午', '戌'], result: '火', name: '寅午戌合火局' },
  { branches: ['亥', '卯', '未'], result: '木', name: '亥卯未合木局' },
  { branches: ['巳', '酉', '丑'], result: '金', name: '巳酉丑合金局' },
]

// ─── 4. 半合局 ───
export interface BanHe {
  branches: [DiZhi, DiZhi]
  result: string
  name: string
}

const _BAN_HE: BanHe[] = [
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

// ─── 5. 地支三会局 ───
export interface SanHui {
  branches: [DiZhi, DiZhi, DiZhi]
  result: string
  name: string
}

const _SAN_HUI: SanHui[] = [
  { branches: ['亥', '子', '丑'], result: '水', name: '亥子丑会北方水局' },
  { branches: ['寅', '卯', '辰'], result: '木', name: '寅卯辰会东方木局' },
  { branches: ['巳', '午', '未'], result: '火', name: '巳午未会南方火局' },
  { branches: ['申', '酉', '戌'], result: '金', name: '申酉戌会西方金局' },
]

// ─── 6. 地支相刑 ───
const _XING_MAP: Record<DiZhi, DiZhi[]> = {
  '子': ['卯'], '卯': ['子'],
  '寅': ['巳', '申'], '巳': ['寅', '申'], '申': ['寅', '巳'],
  '丑': ['戌', '未'], '戌': ['丑', '未'], '未': ['丑', '戌'],
  '辰': ['辰'], '午': ['午'], '酉': ['酉'], '亥': ['亥'],
}

const _ZI_XING: Set<DiZhi> = new Set(['辰', '午', '酉', '亥'])

// ─── 7. 地支相破 ───
const _PO_MAP: Record<DiZhi, DiZhi[]> = {
  '子': ['酉'], '酉': ['子'],
  '丑': ['辰'], '辰': ['丑'],
  '寅': ['亥'], '亥': ['寅'],
  '午': ['卯'], '卯': ['午'],
  '未': ['戌'], '戌': ['未'],
  '巳': ['申'], '申': ['巳'],
}

// ─── 8. 地支六害 ───
const _HAI_MAP: Record<DiZhi, DiZhi[]> = {
  '子': ['未'], '未': ['子'],
  '丑': ['午'], '午': ['丑'],
  '寅': ['巳'], '巳': ['寅'],
  '卯': ['辰'], '辰': ['卯'],
  '申': ['亥'], '亥': ['申'],
  '酉': ['戌'], '戌': ['酉'],
}

// ─── 9. 六甲旬空亡 ───
const _KONG_WANG_XUN: { stem: string; branchStart: DiZhi; kongWang: [DiZhi, DiZhi] }[] = [
  { stem: '甲', branchStart: '子', kongWang: ['戌', '亥'] },
  { stem: '甲', branchStart: '戌', kongWang: ['申', '酉'] },
  { stem: '甲', branchStart: '申', kongWang: ['午', '未'] },
  { stem: '甲', branchStart: '午', kongWang: ['辰', '巳'] },
  { stem: '甲', branchStart: '辰', kongWang: ['寅', '卯'] },
  { stem: '甲', branchStart: '寅', kongWang: ['子', '丑'] },
]

// ─── 10. 六十甲子 ───
const _JIA_ZI_ORDER: string[] = [
  '甲子','乙丑','丙寅','丁卯','戊辰','己巳','庚午','辛未','壬申','癸酉',
  '甲戌','乙亥','丙子','丁丑','戊寅','己卯','庚辰','辛巳','壬午','癸未',
  '甲申','乙酉','丙戌','丁亥','戊子','己丑','庚寅','辛卯','壬辰','癸巳',
  '甲午','乙未','丙申','丁酉','戊戌','己亥','庚子','辛丑','壬寅','癸卯',
  '甲辰','乙巳','丙午','丁未','戊申','己酉','庚戌','辛亥','壬子','癸丑',
  '甲寅','乙卯','丙辰','丁巳','戊午','己未','庚申','辛酉','壬戌','癸亥',
]

// ═══════════════════════════════════════
// 动态导出（export let + ES Module live binding）
// 初始值 = 硬编码兜底
// ═══════════════════════════════════════

export let CHONG_MAP: Record<DiZhi, DiZhi> = _CHONG_MAP
export let HE_MAP: Record<DiZhi, DiZhi[]> = _HE_MAP
export let HE_HUA_WUXING: Record<string, string> = _HE_HUA_WUXING
export let SAN_HE: SanHe[] = _SAN_HE
export let BAN_HE: BanHe[] = _BAN_HE
export let SAN_HUI: SanHui[] = _SAN_HUI
export let XING_MAP: Record<DiZhi, DiZhi[]> = _XING_MAP
export let ZI_XING: Set<DiZhi> = _ZI_XING
export let PO_MAP: Record<DiZhi, DiZhi[]> = _PO_MAP
export let HAI_MAP: Record<DiZhi, DiZhi[]> = _HAI_MAP
export let KONG_WANG_XUN: typeof _KONG_WANG_XUN = _KONG_WANG_XUN
export let JIA_ZI_ORDER: string[] = _JIA_ZI_ORDER

// ═══════════════════════════════════════
// 热更新入口：由 bootKnowledgeRegistry 调用
// ═══════════════════════════════════════

/**
 * 从 KnowledgeRegistry 拉取 DB 数据，更新所有引擎运行时变量。
 * DB 数据缺失时自动回退到硬编码兜底。
 *
 * 调用方：src/server/services/KnowledgeProvider.ts → bootKnowledgeRegistry()
 */
export function reloadBranchRelations(): void {
  CHONG_MAP = KnowledgeRegistry.getOrFallback<Record<DiZhi, DiZhi>>('bazi.chong_map', _CHONG_MAP)
  HE_MAP = KnowledgeRegistry.getOrFallback<Record<DiZhi, DiZhi[]>>('bazi.he_map', _HE_MAP)
  HE_HUA_WUXING = KnowledgeRegistry.getOrFallback<Record<string, string>>('bazi.he_hua_wuxing', _HE_HUA_WUXING)
  SAN_HE = KnowledgeRegistry.getOrFallback<SanHe[]>('bazi.san_he', _SAN_HE)
  BAN_HE = KnowledgeRegistry.getOrFallback<BanHe[]>('bazi.ban_he', _BAN_HE)
  SAN_HUI = KnowledgeRegistry.getOrFallback<SanHui[]>('bazi.san_hui', _SAN_HUI)
  XING_MAP = KnowledgeRegistry.getOrFallback<Record<DiZhi, DiZhi[]>>('bazi.xing_map', _XING_MAP)
  PO_MAP = KnowledgeRegistry.getOrFallback<Record<DiZhi, DiZhi[]>>('bazi.po_map', _PO_MAP)
  HAI_MAP = KnowledgeRegistry.getOrFallback<Record<DiZhi, DiZhi[]>>('bazi.hai_map', _HAI_MAP)
  KONG_WANG_XUN = KnowledgeRegistry.getOrFallback<typeof _KONG_WANG_XUN>('bazi.kong_wang_xun', _KONG_WANG_XUN)
  JIA_ZI_ORDER = KnowledgeRegistry.getOrFallback<string[]>('bazi.jia_zi_order', _JIA_ZI_ORDER)

  // ZI_XING 在 DB 中存为 { set: [...] } 结构，需解析
  const ziXingRaw = KnowledgeRegistry.get<{ set: string[] }>('bazi.zi_xing')
  ZI_XING = ziXingRaw ? new Set(ziXingRaw.set as DiZhi[]) : _ZI_XING
}

// ═══════════════════════════════════════
// 工具函数（使用运行时变量，跟随热更新）
// ═══════════════════════════════════════

/** 刑的类型名 */
export function getXingName(a: DiZhi, b: DiZhi): string {
  if ((a === '子' && b === '卯') || (a === '卯' && b === '子')) return '无礼之刑'
  if (['寅', '巳', '申'].includes(a) && ['寅', '巳', '申'].includes(b)) return '无恩之刑'
  if (['丑', '戌', '未'].includes(a) && ['丑', '戌', '未'].includes(b)) return '持势之刑'
  if (a === b && ZI_XING.has(a)) return '自刑'
  return '相刑'
}

/** 根据日柱干支获取空亡地支对 */
export function getKongWang(dayGanZhi: string): [DiZhi, DiZhi] | null {
  if (dayGanZhi.length < 2) return null
  const stem = dayGanZhi[0]
  const branch = dayGanZhi[1] as DiZhi
  if (!TIAN_GAN.includes(stem as typeof TIAN_GAN[number]) || !DI_ZHI.includes(branch)) return null

  const idx = JIA_ZI_ORDER.indexOf(dayGanZhi)
  if (idx === -1) return null

  const xunIdx = Math.floor(idx / 10)
  return KONG_WANG_XUN[xunIdx]?.kongWang ?? null
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

/** 判断连在一起的三会局 */
export function findSanHui(branches: DiZhi[]): SanHui | null {
  for (const hui of SAN_HUI) {
    if (hui.branches.every(b => branches.includes(b))) return hui
  }
  return null
}

/** 判断三合局 */
export function findSanHe(branches: DiZhi[]): SanHe | null {
  for (const he of SAN_HE) {
    if (he.branches.every(b => branches.includes(b))) return he
  }
  return null
}

/** 判断半合局 */
export function findBanHe(branches: DiZhi[]): BanHe | null {
  for (const bh of BAN_HE) {
    if (bh.branches.every(b => branches.includes(b))) return bh
  }
  return null
}

/** 检查两个地支之间的所有关系 */
export interface BranchRelation {
  chong: boolean
  heLiu: boolean
  xing: boolean
  po: boolean
  hai: boolean
  xingName?: string
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
