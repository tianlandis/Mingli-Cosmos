/**
 * 语料相容性检测器（星座语料 × MBTI 档案）
 *
 * 背景：星座由出生月份决定、MBTI 由四柱决定，两者统计独立——
 * 12 星座 × 32 MBTI 档案（16 类型 × A/T）的任意组合都会真实出现在同一用户身上。
 * 因此星座语料中任何「方向性人格断言」（E/I、S/N、T/F、J/P、A/T 五组维度）
 * 都必然与一部分 MBTI 档案语料直接矛盾。
 *
 * 本模块提供确定性（非 LLM）的矛盾检测，用于：
 * 1. `zodiac.json` 导入前的 CI 守卫（批次 C 检索式注入的前置闸门）；
 * 2. 星座语料写作规范的自动化验收。
 *
 * 判定采用**精确词表白名单**（TRAIT_DIM_LEXICON）：
 * 词表内的词按其断言维度判定，词表外的词一律视为中性（不误报）。
 */

export type MbtiLetter = 'E' | 'I' | 'S' | 'N' | 'T' | 'F' | 'J' | 'P'
/** A=自信型(Assertive)，TURB=动荡型(Turbulent)，与四字母维度分开 */
export type CorpusDim = MbtiLetter | 'ASSERT' | 'TURB'
export type ConflictSeverity = 'conflict' | 'tension'

export interface CorpusConflict {
  /** 触发矛盾的星座特质词 */
  trait: string
  /** 该词断言的维度 */
  asserted: CorpusDim
  /** 与档案相反的维度 */
  opposite: CorpusDim
  severity: ConflictSeverity
  /** 档案侧证据描述 */
  evidence: string
}

export interface MbtiProfileKey {
  letters: [MbtiLetter, MbtiLetter, MbtiLetter, MbtiLetter]
  identity: 'A' | 'T'
}

const LETTER_OPPOSITE: Record<MbtiLetter, MbtiLetter> = {
  E: 'I', I: 'E', S: 'N', N: 'S', T: 'F', F: 'T', J: 'P', P: 'J',
}

const DIM_LABEL: Record<CorpusDim, string> = {
  E: '外向（能量指向人与外部）',
  I: '内向（能量指向独处与内省）',
  S: '实感（关注具体与当下事实）',
  N: '直觉（关注抽象与可能性）',
  T: '思考（决策优先逻辑一致）',
  F: '情感（决策优先价值与感受）',
  J: '判断（偏好计划与确定性）',
  P: '感知（偏好灵活与开放性）',
  ASSERT: '自信型身份（少内耗、笃定）',
  TURB: '动荡型身份（自我怀疑、敏感复盘）',
}

/**
 * 特质词 → 断言维度 白名单词表。
 * 只收录主流星座话术中**明确指向某一 MBTI 维度**的词；
 * 「直率」「稳重」等方向中性的词刻意不收录。
 */
export const TRAIT_DIM_LEXICON: Readonly<Record<string, CorpusDim[]>> = {
  // E 断言
  热情: ['E'], 爱当焦点: ['E'], 天生领袖: ['E', 'ASSERT'], 爱社交: ['E'],
  社交达人: ['E'], 健谈: ['E'], 戏剧化: ['E'], 人来疯: ['E'], 爱热闹: ['E'],
  // I 断言
  安静: ['I'], 内向: ['I'], 慢热: ['I'], 疏离: ['I'], 独处型: ['I'], 独来独往: ['I'],
  // S 断言
  务实: ['S'], 现实: ['S'], 保守: ['S'], 注重细节: ['S'], 脚踏实地: ['S'],
  // N 断言
  梦幻: ['N'], 前卫: ['N'], 天马行空: ['N'], 好幻想: ['N'],
  // T 断言
  理性: ['T'], 客观: ['T'], 就事论事: ['T'], 爱讲道理: ['T'], 冷静分析: ['T'],
  // F 断言
  体贴: ['F'], 共情力强: ['F'], 多愁善感: ['F'], 深情: ['F'], 情绪化: ['F'], 心软: ['F'], 浪漫: ['F'],
  // J 断言
  自律: ['J'], 有条理: ['J'], 计划控: ['J'], 完美主义: ['J'], 固执: ['J'],
  事业心强: ['J', 'ASSERT'], 按部就班: ['J'],
  // P 断言
  随性: ['P'], 善变: ['P'], 不拘小节: ['P'], 爱冒险: ['P'], 冲动: ['P'], 临场发挥: ['P'],
  // A / T 身份断言
  自信: ['ASSERT'], 果敢: ['ASSERT'], 意志力强: ['ASSERT'], 坚韧: ['ASSERT'],
  雷厉风行: ['ASSERT'], 输得起: ['ASSERT'],
  敏感: ['TURB'], 多疑: ['TURB'], 犹豫不决: ['TURB'], 逃避现实: ['TURB'],
  自我怀疑: ['TURB'], 患得患失: ['TURB'],
}

const MBTI_TYPE_RE = /^([EI])([NS])([TF])([JP])-([AT])$/

/** 解析 'INFP-T' 形式的档案键 */
export function parseMbtiProfileKey(key: string): MbtiProfileKey | null {
  const m = MBTI_TYPE_RE.exec(key)
  if (!m) return null
  return {
    letters: [m[1], m[2], m[3], m[4]] as MbtiProfileKey['letters'],
    identity: m[5] as 'A' | 'T',
  }
}

/**
 * 检测一组星座特质词与一份 MBTI 档案的矛盾。
 * - conflict：四字母维度方向相反（人格画像互斥）
 * - tension：A/T 身份断言与档案身份相反（能量基调相斥，较轻）
 */
export function detectConflicts(traits: readonly string[], mbtiProfile: string): CorpusConflict[] {
  const key = parseMbtiProfileKey(mbtiProfile)
  if (!key) throw new Error(`corpus-consistency: 非法 MBTI 档案键 "${mbtiProfile}"`)

  const out: CorpusConflict[] = []
  for (const trait of traits) {
    const dims = TRAIT_DIM_LEXICON[trait]
    if (!dims) continue
    for (const dim of dims) {
      if (dim === 'ASSERT' || dim === 'TURB') {
        const profileIdentity = key.identity === 'A' ? 'ASSERT' : 'TURB'
        if (profileIdentity !== dim) {
          out.push({
            trait, asserted: dim, opposite: profileIdentity, severity: 'tension',
            evidence: `${mbtiProfile} 为${DIM_LABEL[profileIdentity]}，与特质「${trait}」（${DIM_LABEL[dim]}）能量基调相斥`,
          })
        }
        continue
      }
      const has = key.letters.includes(dim)
      if (!has) {
        const opposite = LETTER_OPPOSITE[dim]
        out.push({
          trait, asserted: dim, opposite, severity: 'conflict',
          evidence: `${mbtiTypeLabel(key)} 偏好 ${dim}（${DIM_LABEL[dim]}），与特质「${trait}」（${DIM_LABEL[dim]}→${DIM_LABEL[opposite]}）互斥`,
        })
      }
    }
  }
  return out
}

function mbtiTypeLabel(key: MbtiProfileKey): string {
  return key.letters.join('')
}

export interface MatrixRow {
  sign: string
  mbtiProfile: string
  conflicts: CorpusConflict[]
  tensions: CorpusConflict[]
}

export interface MatrixSummary {
  pairs: number
  totalConflicts: number
  totalTensions: number
  /** 出现 conflict 的星座数 */
  signsAffected: number
  /** 矛盾最多的组合（按 conflict 数降序，最多 limit 条） */
  topPairs: Array<{ sign: string; mbtiProfile: string; conflicts: number }>
}

/** 全矩阵扫描：12 星座 × 32 MBTI 档案 */
export function scanMatrix(
  traitsBySign: Readonly<Record<string, readonly string[]>>,
  mbtiProfiles: readonly string[],
): { rows: MatrixRow[]; summary: MatrixSummary } {
  const rows: MatrixRow[] = []
  for (const [sign, traits] of Object.entries(traitsBySign)) {
    for (const mbtiProfile of mbtiProfiles) {
      const found = detectConflicts(traits, mbtiProfile)
      rows.push({
        sign,
        mbtiProfile,
        conflicts: found.filter((c) => c.severity === 'conflict'),
        tensions: found.filter((c) => c.severity === 'tension'),
      })
    }
  }
  const signs = Object.keys(traitsBySign)
  const topPairs = [...rows]
    .sort((a, b) => b.conflicts.length - a.conflicts.length)
    .slice(0, 10)
    .map((r) => ({ sign: r.sign, mbtiProfile: r.mbtiProfile, conflicts: r.conflicts.length }))
  return {
    rows,
    summary: {
      pairs: rows.length,
      totalConflicts: rows.reduce((n, r) => n + r.conflicts.length, 0),
      totalTensions: rows.reduce((n, r) => n + r.tensions.length, 0),
      signsAffected: signs.filter((s) =>
        rows.some((r) => r.sign === s && r.conflicts.length > 0),
      ).length,
      topPairs,
    },
  }
}
