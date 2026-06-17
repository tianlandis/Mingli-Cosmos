// ============================================================
// 地支关系分析模块
// 刑·冲·破·害·三合·三会·空亡 的全面分析
// 依据：从月令取用到实战策略的完整解析 + 八字取格判断规则引导词（V2.0）
// ============================================================

import type { BaZiResult, DiZhi } from '../types'
import {
  HE_MAP, ZI_XING,
  getKongWang, getFourPillarKongWang, findSanHui, findSanHe, findBanHe,
  getBranchRelation,
} from '../relation'
import type {
  BranchRelationItem,
  BranchRelationsAnalysis,
} from './types'

/** 主入口：分析命局地支关系 */
export function analyzeBranchRelations(bazi: BaZiResult): BranchRelationsAnalysis {
  const allBranches: DiZhi[] = [
    bazi.yearPillar.branch as DiZhi,
    bazi.monthPillar.branch as DiZhi,
    bazi.dayPillar.branch as DiZhi,
    bazi.hourPillar.branch as DiZhi,
  ]
  const pillarNames = ['年柱', '月柱', '日柱', '时柱']

  // ─── 1. 四柱间地支两两关系 ───
  const pillarRelations: BranchRelationsAnalysis['pillarRelations'] = []
  const allRelations: BranchRelationItem[] = []

  for (let i = 0; i < 4; i++) {
    const relations: BranchRelationItem[] = []
    for (let j = i + 1; j < 4; j++) {
      const rel = getBranchRelation(allBranches[i], allBranches[j])
      if (rel.chong) {
        relations.push({
          target: pillarNames[j],
          relation: '冲',
          detail: `${pillarNames[i]}(${allBranches[i]})与${pillarNames[j]}(${allBranches[j]})六冲，主变动`,
        })
      }
      if (rel.heLiu) {
        relations.push({
          target: pillarNames[j],
          relation: '合',
          detail: `${pillarNames[i]}(${allBranches[i]})与${pillarNames[j]}(${allBranches[j]})六合，主和谐`,
        })
      }
      if (rel.xing) {
        const xName = rel.xingName || '相刑'
        relations.push({
          target: pillarNames[j],
          relation: '刑',
          detail: `${pillarNames[i]}(${allBranches[i]})与${pillarNames[j]}(${allBranches[j]})${xName}，需谨慎`,
        })
      }
      if (rel.po) {
        relations.push({
          target: pillarNames[j],
          relation: '破',
          detail: `${pillarNames[i]}(${allBranches[i]})与${pillarNames[j]}(${allBranches[j]})相破，主暗中破坏`,
        })
      }
      if (rel.hai) {
        relations.push({
          target: pillarNames[j],
          relation: '害',
          detail: `${pillarNames[i]}(${allBranches[i]})与${pillarNames[j]}(${allBranches[j]})相害，主暗中相害`,
        })
      }
    }
    pillarRelations.push({
      pillar: pillarNames[i],
      branch: allBranches[i],
      relations,
    })
  }

  // ─── 2. 三合局 / 三会局 / 半合 ───
  const heJu: string[] = []
  const sanHeResult = findSanHe(allBranches)
  if (sanHeResult) {
    heJu.push(`命局地支有${sanHeResult.name}，${sanHeResult.result}旺`)
  }
  const sanHuiResult = findSanHui(allBranches)
  if (sanHuiResult) {
    heJu.push(`命局地支有${sanHuiResult.name}，${sanHuiResult.result}极旺`)
  }
  const banHeResult = findBanHe(allBranches)
  if (banHeResult) {
    heJu.push(`命局地支有${banHeResult.name}，${banHeResult.result}偏旺`)
  }
  // 单独检查六合
  const heLiuSet = new Set<string>()
  for (let i = 0; i < 4; i++) {
    for (let j = i + 1; j < 4; j++) {
      const a = allBranches[i], b = allBranches[j]
      if (HE_MAP[a]?.includes(b)) {
        const key = [a, b].sort().join('')
        if (!heLiuSet.has(key)) {
          heLiuSet.add(key)
          heJu.push(`${pillarNames[i]}(${a})与${pillarNames[j]}(${b})六合`)
        }
      }
    }
  }

  // ─── 3. 自刑检查 ───
  const ziXingBranches = allBranches.filter(b => ZI_XING.has(b))
  if (ziXingBranches.length > 0) {
    const dupCheck = new Set(ziXingBranches)
    for (const b of dupCheck) {
      const count = ziXingBranches.filter(x => x === b).length
      if (count >= 2) {
        allRelations.push({
          target: b,
          relation: '自刑',
          detail: `地支${b}重复出现，自刑为患，需注意情绪稳定和自我冲突`,
        })
      }
    }
  }

  // ─── 4. 空亡 ───
  const kongWang: string[] = []
  const kwPair = getKongWang(bazi.dayPillar.ganZhi)
  if (kwPair) {
    kongWang.push(`日柱${bazi.dayPillar.ganZhi}属旬空亡：${kwPair[0]}、${kwPair[1]}空亡`)
    const kwInPillars = getFourPillarKongWang(
      bazi.dayPillar.ganZhi,
      allBranches,
    )
    if (kwInPillars.length > 0) {
      for (const b of kwInPillars) {
        const pillarIdx = allBranches.indexOf(b)
        if (pillarIdx >= 0) {
          kongWang.push(`${pillarNames[pillarIdx]}(${b})落入空亡，该柱力量减弱`)
        }
      }
    } else {
      kongWang.push('四柱地支均不在空亡之列，命局根基稳固')
    }
  }

  // ─── 5. 汇总刑冲破害 ───
  const items: string[] = []
  for (const pr of pillarRelations) {
    for (const r of pr.relations) {
      items.push(r.detail)
    }
  }

  // ─── 6. 摘要 ───
  const summary: string[] = []
  const hasChong = items.some(i => i.includes('冲'))
  const hasHe = items.some(i => i.includes('合')) || heJu.length > 0
  const hasXing = items.some(i => i.includes('刑'))
  const hasPo = items.some(i => i.includes('破'))
  const hasHai = items.some(i => i.includes('害'))
  const hasKongWang = kongWang.some(k => k.includes('落入空亡'))

  if (hasChong) summary.push('命局有冲，一生多变动，宜动中求发展')
  if (hasHe) summary.push('命局有合，人际关系佳，善于合作')
  if (hasXing) summary.push('命局带刑，需注意口舌是非和法律问题')
  if (hasPo) summary.push('命局带破，注意小人和暗中破坏')
  if (hasHai) summary.push('命局带害，防背后中伤和慢性疾病')
  if (hasKongWang) summary.push('命局有空亡，部分力量被虚化，宜在行运填实时发旺')

  if (summary.length === 0) {
    summary.push('命局地支关系平和，根基稳固')
  }

  return {
    summary,
    items,
    kongWang,
    heJu,
    pillarRelations,
  }
}
