/**
 * 格局判断 & 组合 & 破格 → 单元测试
 * 对照 Python MCP tengods.py 验证算法一致性
 */
import { describe, it, expect } from 'vitest'
import {
  determineCombination,
  detectPoGeRisks,
  getSchoolPreference,
  PATTERN_JI_XIONG,
  type PatternCombination,
  type PoGeRisk,
} from '../src/engine/pattern/patternRules'
import type { BaZiResult } from '../src/engine/types'

// ─── Helper: mock minimal BaZiResult ───
function mockBazi(overrides: Partial<BaZiResult> = {}): BaZiResult {
  return {
    birthDate: '2000-01-01',
    birthTime: '08:00',
    gender: '男',
    dayMaster: '甲',
    yearPillar: { stem: '庚', branch: '辰', stemWuXing: '金', branchWuXing: '土', hiddenStems: ['乙', '癸', '戊'], ganZhi: '庚辰' },
    monthPillar: { stem: '戊', branch: '申', stemWuXing: '土', branchWuXing: '金', hiddenStems: ['戊', '壬', '庚'], ganZhi: '戊申' },
    dayPillar:   { stem: '甲', branch: '子', stemWuXing: '木', branchWuXing: '水', hiddenStems: ['癸'], ganZhi: '甲子' },
    hourPillar:  { stem: '庚', branch: '申', stemWuXing: '金', branchWuXing: '金', hiddenStems: ['戊', '壬', '庚'], ganZhi: '庚申' },
    fiveElements: { 金: 4, 木: 1, 水: 2, 火: 0, 土: 3 },
    tenGods: [],
    daYun: [],
    currentDaYun: null,
    currentYear: { stem: '丙', branch: '午', ganZhi: '丙午' },
    qiYunDays: 5,
    daYunForward: true,
    ...overrides,
  }
}

// ═══════════════════════════════════════════
// PATTERN_JI_XIONG 常量 (格局吉凶分类)
// ═══════════════════════════════════════════
describe('PATTERN_JI_XIONG 格局吉凶分类', () => {
  it('正官格为吉格', () => {
    expect(PATTERN_JI_XIONG['正官格'].type).toBe('吉')
    expect(PATTERN_JI_XIONG['正官格'].desc).toContain('喜生扶')
  })

  it('七杀格为凶格，需制化', () => {
    expect(PATTERN_JI_XIONG['七杀格'].type).toBe('凶')
    expect(PATTERN_JI_XIONG['七杀格'].desc).toContain('喜制化')
  })

  it('建禄格为中性格', () => {
    expect(PATTERN_JI_XIONG['建禄格'].type).toBe('中性')
  })

  it('包含所有10种标准格局', () => {
    const keys = Object.keys(PATTERN_JI_XIONG)
    expect(keys).toHaveLength(10)
    expect(keys).toContain('正官格')
    expect(keys).toContain('七杀格')
    expect(keys).toContain('正印格')
    expect(keys).toContain('偏印格')
    expect(keys).toContain('正财格')
    expect(keys).toContain('偏财格')
    expect(keys).toContain('食神格')
    expect(keys).toContain('伤官格')
    expect(keys).toContain('建禄格')
    expect(keys).toContain('羊刃格')
  })
})

// ═══════════════════════════════════════════
// determineCombination 格局组合判定
// ═══════════════════════════════════════════
describe('determineCombination 格局组合', () => {
  it('印格 + 七杀透出 → 煞印相生', () => {
    const bazi = mockBazi({
      dayMaster: '乙',
      monthPillar: { stem: '壬', branch: '子', stemWuXing: '水', branchWuXing: '水', hiddenStems: ['癸'], ganZhi: '壬子' },
      yearPillar:  { stem: '辛', branch: '酉', stemWuXing: '金', branchWuXing: '金', hiddenStems: ['辛'], ganZhi: '辛酉' },
      hourPillar:  { stem: '壬', branch: '午', stemWuXing: '水', branchWuXing: '火', hiddenStems: ['丁'], ganZhi: '壬午' },
    })
    // 乙日主，辛=偏官(杀)，壬=正印。月干透壬(正印格) + 年干透辛(七杀) → 煞印相生
    const result = determineCombination(bazi, '偏印格', '偏印')
    expect(result.name).toBe('煞印相生')
    expect(result.isPure).toBe(false)
  })

  it('财格 + 正官透出 → 财官相生', () => {
    const bazi = mockBazi({
      dayMaster: '丙',
      monthPillar: { stem: '辛', branch: '酉', stemWuXing: '金', branchWuXing: '金', hiddenStems: ['辛'], ganZhi: '辛酉' },
      yearPillar:  { stem: '癸', branch: '亥', stemWuXing: '水', branchWuXing: '水', hiddenStems: ['戊', '甲', '壬'], ganZhi: '癸亥' },
    })
    // 丙日主，辛=正财，癸=正官。财格 + 官透 → 财官相生
    const result = determineCombination(bazi, '正财格', '正财')
    expect(result.name).toBe('财官相生')
    expect(result.isPure).toBe(false)
  })

  it('食神格 + 财星透出 → 食神生财', () => {
    const bazi = mockBazi({
      dayMaster: '戊',
      monthPillar: { stem: '庚', branch: '申', stemWuXing: '金', branchWuXing: '金', hiddenStems: ['戊', '壬', '庚'], ganZhi: '庚申' },
      yearPillar:  { stem: '壬', branch: '子', stemWuXing: '水', branchWuXing: '水', hiddenStems: ['癸'], ganZhi: '壬子' },
    })
    // 戊日主，庚=食神，壬=偏财。食神格 + 财透 → 食神生财
    const result = determineCombination(bazi, '食神格', '食神')
    expect(result.name).toBe('食神生财')
    expect(result.isPure).toBe(false)
  })

  it('伤官格 + 印星透出 → 伤官佩印', () => {
    const bazi = mockBazi({
      dayMaster: '辛',
      monthPillar: { stem: '壬', branch: '子', stemWuXing: '水', branchWuXing: '水', hiddenStems: ['癸'], ganZhi: '壬子' },
      yearPillar:  { stem: '戊', branch: '戌', stemWuXing: '土', branchWuXing: '土', hiddenStems: ['辛', '丁', '戊'], ganZhi: '戊戌' },
    })
    // 辛日主，壬=伤官，戊=正印。伤官格 + 印透 → 伤官佩印
    const result = determineCombination(bazi, '伤官格', '伤官')
    expect(result.name).toBe('伤官佩印')
    expect(result.isPure).toBe(false)
  })

  it('正官格 + 印星透出 → 官印相生', () => {
    const bazi = mockBazi({
      dayMaster: '壬',
      monthPillar: { stem: '己', branch: '未', stemWuXing: '土', branchWuXing: '土', hiddenStems: ['丁', '乙', '己'], ganZhi: '己未' },
      yearPillar:  { stem: '庚', branch: '申', stemWuXing: '金', branchWuXing: '金', hiddenStems: ['戊', '壬', '庚'], ganZhi: '庚申' },
    })
    // 壬日主，己=正官，庚=偏印。正官格 + 印透 → 官印相生
    const result = determineCombination(bazi, '正官格', '正官')
    expect(result.name).toBe('官印相生')
    expect(result.isPure).toBe(false)
  })

  it('七杀格 + 印星透出 → 煞印相生', () => {
    const bazi = mockBazi({
      dayMaster: '丙',
      monthPillar: { stem: '壬', branch: '子', stemWuXing: '水', branchWuXing: '水', hiddenStems: ['癸'], ganZhi: '壬子' },
      yearPillar:  { stem: '甲', branch: '寅', stemWuXing: '木', branchWuXing: '木', hiddenStems: ['戊', '丙', '甲'], ganZhi: '甲寅' },
    })
    // 丙日主，壬=偏官(七杀)，甲=偏印。七杀格 + 印透 → 煞印相生
    const result = determineCombination(bazi, '七杀格', '七杀')
    expect(result.name).toBe('煞印相生')
    expect(result.isPure).toBe(false)
  })

  it('印格无官杀 → 纯印格', () => {
    const bazi = mockBazi({
      dayMaster: '甲',
      monthPillar: { stem: '壬', branch: '子', stemWuXing: '水', branchWuXing: '水', hiddenStems: ['癸'], ganZhi: '壬子' },
      yearPillar:  { stem: '甲', branch: '寅', stemWuXing: '木', branchWuXing: '木', hiddenStems: ['戊', '丙', '甲'], ganZhi: '甲寅' },
      hourPillar:  { stem: '甲', branch: '辰', stemWuXing: '木', branchWuXing: '土', hiddenStems: ['乙', '癸', '戊'], ganZhi: '甲辰' },
    })
    const result = determineCombination(bazi, '偏印格', '偏印')
    expect(result.name).toBe('纯印格')
    expect(result.isPure).toBe(true)
  })

  it('建禄格 → 禄格', () => {
    const bazi = mockBazi()
    const result = determineCombination(bazi, '建禄格', '比肩')
    expect(result.name).toBe('禄格')
    expect(result.isPure).toBe(false)
  })

  it('羊刃格 → 羊刃格', () => {
    const bazi = mockBazi()
    const result = determineCombination(bazi, '羊刃格', '劫财')
    expect(result.name).toBe('羊刃格')
    expect(result.isPure).toBe(false)
  })
})

// ═══════════════════════════════════════════
// detectPoGeRisks 破格风险检测
// ═══════════════════════════════════════════
describe('detectPoGeRisks 破格风险', () => {
  it('无双冲突 → 无风险', () => {
    const bazi = mockBazi({
      dayMaster: '甲',
      monthPillar: { stem: '壬', branch: '子', stemWuXing: '水', branchWuXing: '水', hiddenStems: ['癸'], ganZhi: '壬子' },
      yearPillar:  { stem: '甲', branch: '寅', stemWuXing: '木', branchWuXing: '木', hiddenStems: ['戊', '丙', '甲'], ganZhi: '甲寅' },
    })
    const risks = detectPoGeRisks(bazi, '偏印格', { name: '纯印格', dominantPattern: '偏印格', keyCombination: '', keyStem: '', keyPosition: '', isPure: true })
    // 纯印格可能产生 "印格无官杀" 风险
    expect(risks.some(r => r.type === '印格无官杀')).toBe(true)
  })

  it('伤官见官 → 高风险', () => {
    const bazi = mockBazi({
      dayMaster: '辛',
      monthPillar: { stem: '壬', branch: '子', stemWuXing: '水', branchWuXing: '水', hiddenStems: ['癸'], ganZhi: '壬子' },
      yearPillar:  { stem: '丙', branch: '午', stemWuXing: '火', branchWuXing: '火', hiddenStems: ['丁'], ganZhi: '丙午' },
    })
    // 辛日主，壬=伤官，丙=正官 → 伤官见官
    const risks = detectPoGeRisks(bazi, '伤官格', { name: '纯伤官格', dominantPattern: '伤官格', keyCombination: '', keyStem: '', keyPosition: '', isPure: true })
    const risk = risks.find(r => r.type === '伤官见官')
    expect(risk).toBeDefined()
    expect(risk!.severity).toBe('高')
  })

  it('官杀混杂 → 中风险', () => {
    const bazi = mockBazi({
      dayMaster: '甲',
      monthPillar: { stem: '辛', branch: '酉', stemWuXing: '金', branchWuXing: '金', hiddenStems: ['辛'], ganZhi: '辛酉' },
      yearPillar:  { stem: '庚', branch: '申', stemWuXing: '金', branchWuXing: '金', hiddenStems: ['戊', '壬', '庚'], ganZhi: '庚申' },
    })
    // 甲日主，辛=正官，庚=偏官(七杀) → 官杀混杂
    const risks = detectPoGeRisks(bazi, '正官格', { name: '纯官格', dominantPattern: '正官格', keyCombination: '', keyStem: '', keyPosition: '', isPure: true })
    const risk = risks.find(r => r.type === '官杀混杂')
    expect(risk).toBeDefined()
    expect(risk!.severity).toBe('中')
  })
})

// ═══════════════════════════════════════════
// getSchoolPreference 流派倾向
// ═══════════════════════════════════════════
describe('getSchoolPreference 流派倾向', () => {
  it('透干取用 → 传统子平', () => {
    expect(getSchoolPreference('透干取用')).toBe('传统子平')
  })

  it('月令分金 → 传统子平', () => {
    expect(getSchoolPreference('月令分金')).toBe('传统子平')
  })
})
