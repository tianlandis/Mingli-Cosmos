// ============================================================
// 双人合盘 —— 规则层（纯计算，不用大模型）
// 文件：src/server/lib/synastry.ts
//
// 定位（田哥 2026-09-29 定调）：
//   合盘的**事实判断**（日干合不合、夫妻宫冲不冲、五行补不补）全部由规则算出，
//   零模型成本、结果可复现、可逐条解释。AI 只是可选的后置"润滑"，
//   因此本模块**不调用任何 LLM**——没有模型也能给出完整结论。
//
// 红线：不修改 src/engine/，只读其产物（BaZiResult / AnnotationResult）。
// ============================================================

import type { BaZiResult, AnnotationResult } from '../../engine'

// ────────────────────────────────────────────
// 干支基础常量（自包含，避免依赖引擎内部实现）
// ────────────────────────────────────────────

/** 十天干 */
export const GAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'] as const
/** 十二地支 */
export const ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'] as const

/** 天干五行 */
const GAN_WUXING: Record<string, string> = {
  甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土',
  己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水',
}

/** 地支五行 */
const ZHI_WUXING: Record<string, string> = {
  亥: '水', 子: '水', 寅: '木', 卯: '木', 巳: '火', 午: '火',
  申: '金', 酉: '金', 辰: '土', 戌: '土', 丑: '土', 未: '土',
}

/** 五行相生：key 生 value */
const SHENG: Record<string, string> = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' }
/** 五行相克：key 克 value */
const KE: Record<string, string> = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' }

/** 天干五合（合化之五行） */
const GAN_HE: Record<string, string> = {
  甲己: '土', 乙庚: '金', 丙辛: '水', 丁壬: '木', 戊癸: '火',
}

/** 地支六合 */
const ZHI_LIUHE: Record<string, string> = {
  子丑: '土', 寅亥: '木', 卯戌: '火', 辰酉: '金', 巳申: '水', 午未: '土',
}
/** 地支三合局（成员 → 局五行） */
const ZHI_SANHE: Record<string, string> = {
  申: '水', 子: '水', 辰: '水',
  亥: '木', 卯: '木', 未: '木',
  寅: '火', 午: '火', 戌: '火',
  巳: '金', 酉: '金', 丑: '金',
}
/** 地支六冲 */
const ZHI_CHONG: Array<[string, string]> = [
  ['子', '午'], ['丑', '未'], ['寅', '申'], ['卯', '酉'], ['辰', '戌'], ['巳', '亥'],
]
/** 地支六害（相穿） */
const ZHI_HAI: Array<[string, string]> = [
  ['子', '未'], ['丑', '午'], ['寅', '巳'], ['卯', '辰'], ['申', '亥'], ['酉', '戌'],
]
/** 地支相刑（无恩之刑 / 恃势之刑 / 无礼之刑） */
const ZHI_XING: string[][] = [
  ['寅', '巳', '申'], ['丑', '戌', '未'], ['子', '卯'],
]

function pairKey(a: string, b: string): string {
  return GAN.indexOf(a as typeof GAN[number]) <= GAN.indexOf(b as typeof GAN[number]) ? a + b : b + a
}

function zhiPair(a: string, b: string): string {
  return ZHI.indexOf(a as typeof ZHI[number]) <= ZHI.indexOf(b as typeof ZHI[number]) ? a + b : b + a
}

function inPairs(pairs: Array<[string, string]>, a: string, b: string): boolean {
  return pairs.some(([x, y]) => (x === a && y === b) || (x === b && y === a))
}

// ────────────────────────────────────────────
// 关系类型与维度权重
// ────────────────────────────────────────────

/**
 * 关系类型。
 * key 与前端 `RELATION_OPTIONS`（src/lib/birth.ts）**逐字对齐** ——
 * father/mother 在权重上等同 parent，但保留独立 key，避免前后端做映射时漂移。
 */
export type RelationKey =
  | 'spouse' | 'lover'
  | 'parent' | 'father' | 'mother' | 'child' | 'sibling'
  | 'friend' | 'classmate' | 'colleague'
  | 'other'
  | 'self'

/** 关系显示名（与前端 RELATION_OPTIONS 同步，测试锁定一致性） */
export const RELATION_LABELS: Record<RelationKey, string> = {
  spouse: '夫妻', lover: '恋人', parent: '父母', father: '父亲', mother: '母亲',
  child: '子女', sibling: '兄弟姐妹', friend: '朋友', classmate: '同学',
  colleague: '同事', other: '其他', self: '本人',
}

/**
 * 各维度满分权重 —— 关系不同，看重的东西不同。
 * 夫妻看夫妻宫（日支）与日干相合；亲子看根基与生养（年柱 + 五行相生）；
 * 合伙/同事看十神互补（财官互补 = 一个出资源一个出执行）。
 */
interface Weights { dayGan: number; dayZhi: number; yearZhi: number; wuxing: number; shishen: number }

const WEIGHTS: Record<RelationKey, Weights> = {
  spouse:    { dayGan: 25, dayZhi: 30, yearZhi: 10, wuxing: 20, shishen: 15 },
  lover:     { dayGan: 25, dayZhi: 30, yearZhi: 10, wuxing: 20, shishen: 15 },
  // 亲子 / 父母：看根基与生养，故年柱与五行权重最高
  parent:    { dayGan: 15, dayZhi: 15, yearZhi: 30, wuxing: 30, shishen: 10 },
  father:    { dayGan: 15, dayZhi: 15, yearZhi: 30, wuxing: 30, shishen: 10 },
  mother:    { dayGan: 15, dayZhi: 15, yearZhi: 30, wuxing: 30, shishen: 10 },
  child:     { dayGan: 15, dayZhi: 15, yearZhi: 30, wuxing: 30, shishen: 10 },
  sibling:   { dayGan: 15, dayZhi: 15, yearZhi: 35, wuxing: 25, shishen: 10 },
  friend:    { dayGan: 30, dayZhi: 20, yearZhi: 10, wuxing: 20, shishen: 20 },
  classmate: { dayGan: 30, dayZhi: 20, yearZhi: 10, wuxing: 20, shishen: 20 },
  // 同事 / 合伙：看十神互补（一个出资源一个出执行）
  colleague: { dayGan: 20, dayZhi: 20, yearZhi: 10, wuxing: 20, shishen: 30 },
  other:     { dayGan: 25, dayZhi: 25, yearZhi: 15, wuxing: 20, shishen: 15 },
  self:      { dayGan: 25, dayZhi: 25, yearZhi: 15, wuxing: 20, shishen: 15 },
}

// ────────────────────────────────────────────
// 单维度计算
// ────────────────────────────────────────────

interface DimResult {
  key: string
  label: string
  /** 得分率 0~1 */
  ratio: number
  /** 加权后得分 */
  score: number
  comment: string
}

/** 日干关系：合 > 生 > 比和 > 克 > 冲克 */
function evalDayGan(a: string, b: string, full: number): DimResult {
  const key = pairKey(a, b)
  const wa = GAN_WUXING[a]
  const wb = GAN_WUXING[b]
  let ratio: number
  let comment: string

  const he = GAN_HE[key]
  if (he) {
    ratio = 1
    comment = `${a}${b}相合化${he}，天性相吸，是传统合婚里最被看重的一条。`
  } else if (wa === wb) {
    ratio = 0.62
    comment = `双方日干同属${wa}，性格底色相近，容易互相理解，但也容易一起钻牛角尖。`
  } else if (SHENG[wa] === wb || SHENG[wb] === wa) {
    ratio = 0.8
    const from = SHENG[wa] === wb ? '你' : '对方'
    comment = `日干${wa}${wb}相生，${from}天然愿意为这段关系付出，相处阻力小。`
  } else {
    // 相克
    const aKeB = KE[wa] === wb
    ratio = 0.3
    comment = `日干${wa}${wb}相克（${aKeB ? '你克对方' : '对方克你'}），
      观点容易对冲；不是不能处，而是需要约定"谁在什么事上说了算"。`.replace(/\s+/g, '')
  }

  return { key: 'dayGan', label: '日干相合', ratio, score: +(ratio * full).toFixed(1), comment }
}

/** 日支（夫妻宫/本位宫）关系 */
function evalDayZhi(a: string, b: string, full: number): DimResult {
  const pk = zhiPair(a, b)
  let ratio: number
  let comment: string

  if (ZHI_LIUHE[pk]) {
    ratio = 1
    comment = `日支${a}${b}六合化${ZHI_LIUHE[pk]}，宫位相合，是最稳的一种组合。`
  } else if (ZHI_SANHE[a] && ZHI_SANHE[a] === ZHI_SANHE[b] && a !== b) {
    ratio = 0.82
    comment = `日支${a}${b}同入${ZHI_SANHE[a]}局，气场相投，合作与相处都顺。`
  } else if (inPairs(ZHI_CHONG, a, b)) {
    ratio = 0.18
    comment = `日支${a}${b}六冲，宫位对冲。矛盾往往来得快也去得快，怕的是翻旧账。`
  } else if (inPairs(ZHI_HAI, a, b)) {
    ratio = 0.32
    comment = `日支${a}${b}相害，易有暗地里的消耗与误会，有事摊开说会好很多。`
  } else if (ZHI_XING.some(g => g.includes(a) && g.includes(b))) {
    ratio = 0.3
    comment = `日支${a}${b}相刑，相处中容易互相较劲，需要给彼此留余地。`
  } else if (a === b) {
    ratio = 0.68
    comment = `日支同为${a}，感受方式接近，但也意味着盲区重合。`
  } else {
    const wa = ZHI_WUXING[a]
    const wb = ZHI_WUXING[b]
    if (SHENG[wa] === wb || SHENG[wb] === wa) {
      ratio = 0.72
      comment = `日支${a}${b}五行相生，日常相处少摩擦。`
    } else {
      ratio = 0.5
      comment = `日支${a}${b}无明显的合冲刑害，属于中性组合，靠经营。`
    }
  }

  return { key: 'dayZhi', label: '宫位关系', ratio, score: +(ratio * full).toFixed(1), comment }
}

/** 年支（根基 / 家世 / 出身气场） */
function evalYearZhi(a: string, b: string, full: number): DimResult {
  const pk = zhiPair(a, b)
  let ratio: number
  let comment: string

  if (ZHI_LIUHE[pk]) {
    ratio = 1
    comment = `年支${a}${b}六合，两家根基相合，长辈层面阻力小。`
  } else if (ZHI_SANHE[a] && ZHI_SANHE[a] === ZHI_SANHE[b] && a !== b) {
    ratio = 0.85
    comment = `年支${a}${b}三合，出身气场相近，价值观容易对齐。`
  } else if (inPairs(ZHI_CHONG, a, b)) {
    ratio = 0.2
    comment = `年支${a}${b}六冲，家庭背景与生活习惯差异明显，需要更长磨合期。`
  } else if (inPairs(ZHI_HAI, a, b)) {
    ratio = 0.35
    comment = `年支${a}${b}相害，容易受外界（亲友、环境）因素干扰。`
  } else if (ZHI_XING.some(g => g.includes(a) && g.includes(b))) {
    ratio = 0.35
    comment = `年支${a}${b}相刑，家庭观念上易有拉扯。`
  } else {
    ratio = 0.62
    comment = `年支${a}${b}无冲无合，根基层面平顺。`
  }

  return { key: 'yearZhi', label: '根基家世', ratio, score: +(ratio * full).toFixed(1), comment }
}

/**
 * 五行互补：一方最缺的五行，另一方恰好旺 → 补得上。
 * 双方缺同一个五行 → 共同短板，扣分。
 */
function evalWuxing(a: Record<string, number>, b: Record<string, number>, full: number): DimResult {
  const ELEMENTS = ['木', '火', '土', '金', '水']
  const norm = (x: Record<string, number>) => {
    const total = ELEMENTS.reduce((s, e) => s + (x[e] ?? 0), 0) || 1
    return Object.fromEntries(ELEMENTS.map(e => [e, (x[e] ?? 0) / total])) as Record<string, number>
  }
  const na = norm(a)
  const nb = norm(b)
  const avg = 1 / ELEMENTS.length

  // A 的短板能否被 B 补上（对称计算后取平均）
  const cover = (need: Record<string, number>, supply: Record<string, number>): number => {
    const weak = ELEMENTS
      .filter(e => need[e] < avg)
      .sort((x, y) => need[x] - need[y])
    if (weak.length === 0) return 0.7 // 五行均衡，本身就是好底子
    const weakest = weak[0]
    if (supply[weakest] >= avg * 1.2) return 1
    if (supply[weakest] >= avg * 0.8) return 0.7
    return 0.35
  }

  let ratio = (cover(na, nb) + cover(nb, na)) / 2

  // 共同短板：两个人都缺同一个五行 —— 遇到该五行当令的年份会一起难受
  const sharedWeak = ELEMENTS.filter(e => na[e] < avg * 0.6 && nb[e] < avg * 0.6)
  if (sharedWeak.length > 0) ratio = Math.max(0.2, ratio - 0.15 * sharedWeak.length)

  const weakA = ELEMENTS.filter(e => na[e] < avg).sort((x, y) => na[x] - na[y])[0]
  const weakB = ELEMENTS.filter(e => nb[e] < avg).sort((x, y) => nb[x] - nb[y])[0]

  let comment: string
  if (sharedWeak.length > 0) {
    comment = `两人${sharedWeak.join('、')}都偏弱，是该关系的共同短板——
      遇到${sharedWeak.join('、')}当令的年份，容易同时压力大，建议提前一起做安排。`.replace(/\s+/g, '')
  } else if (ratio >= 0.85) {
    comment = weakA
      ? `一方${weakA}偏弱、另一方正好旺${weakA}，五行互补，是最理想的配置。`
      : '双方五行分布均衡，底子都稳，互补性好。'
  } else if (ratio >= 0.6) {
    comment = `五行大体互补${weakB ? `（对方${weakB}稍弱）` : ''}，没有明显硬伤。`
  } else {
    comment = `五行互补度一般${weakA ? `（你${weakA}偏弱，对方也补不上）` : ''}，需要靠相处方式弥补。`
  }

  return { key: 'wuxing', label: '五行互补', ratio, score: +(ratio * full).toFixed(1), comment }
}

/**
 * 十神互补：日主强弱 + 十神分布。
 * 传统看法：强弱互补（强配弱）优于双强或双弱；
 * 一方所喜之神恰是另一方所旺之神 → 互补。
 */
function evalShishen(
  a: { chart: BaZiResult; annotation: AnnotationResult },
  b: { chart: BaZiResult; annotation: AnnotationResult },
  full: number,
): DimResult {
  const scoreOf = (x: AnnotationResult): number =>
    x.strengthAnalysis?.score ?? 50
  const sa = scoreOf(a.annotation)
  const sb = scoreOf(b.annotation)

  // 强弱互补：|sa-sb| 适中偏大为佳（一强一弱），都强或都弱次之
  const diff = Math.abs(sa - sb)
  let ratio: number
  let strengthText: string
  if (diff >= 25) {
    ratio = 0.85
    strengthText = `日主一强一弱（${sa} vs ${sb}），强弱互补，关系中自然分出主次，反而少争执。`
  } else if (sa >= 60 && sb >= 60) {
    ratio = 0.45
    strengthText = `双方日主都偏强（${sa} vs ${sb}），都有主见，好事是都能扛事，难处是谁也不服谁。`
  } else if (sa < 45 && sb < 45) {
    ratio = 0.4
    strengthText = `双方日主都偏弱（${sa} vs ${sb}），都需要外部支撑，遇到事容易一起没主意。`
  } else {
    ratio = 0.7
    strengthText = `双方日主强弱接近且都在中位（${sa} vs ${sb}），相处平稳。`
  }

  // 十神互补：看双方十神集合的交集与互补
  const godsOf = (x: BaZiResult): string[] =>
    [...new Set((x.tenGods ?? []).map(t => String(t.shiShen ?? '')))].filter(Boolean)
  const ga = new Set(godsOf(a.chart))
  const gb = new Set(godsOf(b.chart))
  const shared = [...ga].filter(g => gb.has(g))
  if (shared.length >= 3) ratio = Math.min(1, ratio + 0.1)

  const comment = shared.length >= 3
    ? `${strengthText}两人十神重合度高（${shared.slice(0, 3).join('、')}），处世方式接近。`
    : strengthText

  return { key: 'shishen', label: '强弱互补', ratio, score: +(ratio * full).toFixed(1), comment }
}

// ────────────────────────────────────────────
// 主入口
// ────────────────────────────────────────────

export interface SynastrySide {
  label: string
  dayMaster: string
  dayBranch: string
  yearBranch: string
  strengthScore: number
}

export interface SynastryResult {
  /** 关系类型 */
  relation: RelationKey
  relationLabel: string
  /** 总分 0~100 */
  score: number
  /** 档位 */
  grade: string
  /** 一句话总评 */
  verdict: string
  /** 各维度得分 */
  dimensions: DimResult[]
  /** 亮点（ratio ≥ 0.8 的维度） */
  highlights: string[]
  /** 需注意（ratio ≤ 0.4 的维度） */
  cautions: string[]
  /** 建议 */
  advice: string
  /** 双方概要 */
  sides: [SynastrySide, SynastrySide]
  /** 稳定指纹（供缓存） */
  fingerprint: string
}

function gradeOf(score: number): string {
  if (score >= 85) return '上吉'
  if (score >= 72) return '吉'
  if (score >= 58) return '平顺'
  if (score >= 45) return '需磨合'
  return '多考验'
}

function makeSide(name: string, chart: BaZiResult, annotation: AnnotationResult): SynastrySide {
  return {
    label: name,
    dayMaster: chart.dayMaster,
    dayBranch: chart.dayPillar?.branch ?? '',
    yearBranch: chart.yearPillar?.branch ?? '',
    strengthScore: annotation.strengthAnalysis?.score ?? 50,
  }
}

/**
 * 计算双人合盘。
 * @param a 甲方（通常为主账号本人）
 * @param b 乙方
 * @param relation 关系类型，决定各维度权重
 */
export function computeSynastry(
  a: { chart: BaZiResult; annotation: AnnotationResult; label: string },
  b: { chart: BaZiResult; annotation: AnnotationResult; label: string },
  relation: RelationKey,
): SynastryResult {
  const w = WEIGHTS[relation] ?? WEIGHTS.other

  const dims: DimResult[] = [
    evalDayGan(a.chart.dayMaster, b.chart.dayMaster, w.dayGan),
    evalDayZhi(a.chart.dayPillar?.branch ?? '', b.chart.dayPillar?.branch ?? '', w.dayZhi),
    evalYearZhi(a.chart.yearPillar?.branch ?? '', b.chart.yearPillar?.branch ?? '', w.yearZhi),
    evalWuxing(a.chart.fiveElements ?? {}, b.chart.fiveElements ?? {}, w.wuxing),
    evalShishen(a, b, w.shishen),
  ]

  const raw = dims.reduce((s, d) => s + d.score, 0)
  const maxTotal = w.dayGan + w.dayZhi + w.yearZhi + w.wuxing + w.shishen
  const score = Math.round((raw / maxTotal) * 100)

  const grade = gradeOf(score)
  const label = RELATION_LABELS[relation] ?? '其他'

  const highlights = dims.filter(d => d.ratio >= 0.8).map(d => d.comment)
  const cautions = dims.filter(d => d.ratio <= 0.4).map(d => d.comment)

  const verdict = score >= 85
    ? `${label}缘分很深，属于少见的合拍组合。`
    : score >= 72
      ? `${label}关系底子好，主要处得好不好看经营。`
      : score >= 58
        ? `${label}关系平稳，没有硬伤，也没有特别的加分项。`
        : score >= 45
          ? `${label}关系有明显摩擦点，需要双方都愿意让步。`
          : `${label}关系挑战较大，建议在关键问题上多做约定。`

  const advice = cautions.length === 0
    ? '整体没有明显硬伤，保持现在的相处节奏就好；遇到分歧时，谁更在意这件事就听谁的。'
    : `重点留意${cautions.length}处摩擦：${dims.filter(d => d.ratio <= 0.4).map(d => d.label).join('、')}。
       建议把"谁在什么事上做主"提前说清楚，比事后争论省事得多。`.replace(/\s+/g, '')

  const sides: [SynastrySide, SynastrySide] = [
    makeSide(a.label, a.chart, a.annotation),
    makeSide(b.label, b.chart, b.annotation),
  ]

  // 指纹：关系 + 双方日柱年柱（不涉出生时刻，纯命理特征）
  const fingerprint = [
    relation,
    a.chart.dayPillar?.ganZhi ?? '', a.chart.yearPillar?.ganZhi ?? '',
    b.chart.dayPillar?.ganZhi ?? '', b.chart.yearPillar?.ganZhi ?? '',
  ].join('|')

  return {
    relation, relationLabel: label, score, grade, verdict,
    dimensions: dims, highlights, cautions, advice, sides, fingerprint,
  }
}

/** 关系 key 是否合法（供接口校验，避免前后端漂移） */
export function isRelationKey(v: string): v is RelationKey {
  return v in RELATION_LABELS
}
