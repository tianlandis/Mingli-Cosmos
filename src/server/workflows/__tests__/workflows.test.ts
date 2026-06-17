// ============================================================
// SOP 流水线集成测试 — workflows.test.ts (mock LLM)
// 文件：src/server/workflows/__tests__/workflows.test.ts
// ============================================================
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { AnnotationResult } from '@/engine/annotation/types'
import type { BaZiResult } from '@/engine/types'
import path from 'node:path'
import fs from 'node:fs'

// ─── mock LLM (必须 top-level) ───
vi.mock('ai', () => ({
  generateText: vi.fn().mockResolvedValue({ text: '模拟 LLM 分析结果。以上分析仅供参考。' }),
}))

// ─── fixture loader ───
interface TestFixture {
  chart: BaZiResult
  annotation: AnnotationResult
}

function loadFixture(name: string): TestFixture {
  const raw = fs.readFileSync(
    path.resolve(__dirname, 'fixtures', `${name}.json`),
    'utf-8',
  )
  return JSON.parse(raw) as TestFixture
}

const CASES = ['case-01-qianlong', 'case-02-zhugeliang', 'case-03-normal-male', 'case-04-normal-female', 'case-05-bianryu']

// ─── mock env ───
beforeEach(() => {
  process.env.LLM_PROVIDER = 'local'
  process.env.LLM_API_KEY = 'mock-key'
  process.env.LLM_BASE_URL = 'http://localhost:11434/v1'
  process.env.LLM_MODEL = 'mock-model'
})

afterEach(() => {
  vi.clearAllMocks()
})

// ═══════════════════════════════════════════
// 5 个命例 fixture 结构校验
// ═══════════════════════════════════════════
describe('Fixture 结构完整性', () => {
  for (const caseId of CASES) {
    it(`${caseId} — chart + annotation 结构完整`, () => {
      const fixture = loadFixture(caseId)

      expect(fixture.chart).toBeDefined()
      expect(fixture.chart.dayMaster).toBeTruthy()
      expect(fixture.chart.yearPillar.ganZhi).toBeTruthy()
      expect(fixture.chart.monthPillar.ganZhi).toBeTruthy()
      expect(fixture.chart.dayPillar.ganZhi).toBeTruthy()
      expect(fixture.chart.hourPillar.ganZhi).toBeTruthy()

      expect(fixture.annotation.strengthAnalysis.strength).toBeTruthy()
      expect(fixture.annotation.patternAnalysis.patternName).toBeTruthy()
      expect(fixture.annotation.shiShenProfile.length).toBeGreaterThan(0)
      expect(fixture.annotation.luckAnalysis.daYunList.length).toBeGreaterThan(0)
      expect(fixture.annotation.shenSha).toBeDefined()
      expect(fixture.annotation.specialTopics).toBeDefined()
    })
  }
})

// ═══════════════════════════════════════════
// Step 3 — assembleReport 纯函数回归
// ═══════════════════════════════════════════
describe('assembleReport 组装', () => {
  it('纯函数：输入正常 → 输出 5 章节', async () => {
    const { assembleReport } = await import('@/server/workflows/step-assemble')
    const fixt = loadFixture('case-01-qianlong')
    const report = assembleReport(
      fixt.chart,
      fixt.annotation,
      { overview: fixt.annotation.strengthAnalysis.strength, mbtiProfile: fixt.annotation.patternAnalysis.mbti?.portrait ?? '' },
      { trend: '大运趋势向好', highlights: '关键节点在 35 岁' },
    )

    expect(report.markdown).toBeTruthy()
    expect(report.sections.length).toBe(5)
    expect(report.sections.map(s => s.id)).toEqual([
      'seal', 'personality', 'luck', 'topics', 'disclaimer',
    ])
  })

  it('字符串正确包含日主信息', async () => {
    const { assembleReport } = await import('@/server/workflows/step-assemble')
    const fixt = loadFixture('case-01-qianlong')
    const report = assembleReport(
      fixt.chart,
      fixt.annotation,
      { overview: '庚金', mbtiProfile: 'ENTJ' },
      { trend: '好', highlights: '无' },
    )
    expect(report.sections[4].content).toContain('仅供参考')
  })
})

// ═══════════════════════════════════════════
// Step 1 — personality prompt 构建验证
// ═══════════════════════════════════════════
describe('generatePersonality prompt 验证', () => {
  for (const caseId of CASES) {
    it(`${caseId} — 返回 ok`, async () => {
      const { generateText } = await import('ai')
      ;(generateText as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        text: JSON.stringify({ overview: '测试概述。以上分析仅供参考。', mbtiProfile: '测试 MBTI 描述' }),
      })

      const { generatePersonality } = await import('@/server/workflows/step-personality')
      const fixt = loadFixture(caseId)
      const result = await generatePersonality(fixt.annotation)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.data.overview).toBeTruthy()
        expect(result.data.mbtiProfile).toBeTruthy()
      }
    })
  }
})

// ═══════════════════════════════════════════
// Step 2 — luck prompt 构建验证
// ═══════════════════════════════════════════
describe('generateLuck prompt 验证', () => {
  for (const caseId of CASES) {
    it(`${caseId} — 返回 ok`, async () => {
      const { generateText } = await import('ai')
      ;(generateText as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        text: JSON.stringify({ trend: '测试趋势分析。以上分析仅供参考。', highlights: '测试重点' }),
      })

      const { generateLuck } = await import('@/server/workflows/step-luck')
      const fixt = loadFixture(caseId)
      const result = await generateLuck(fixt.annotation, '测试人格概述')

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.data.trend).toBeTruthy()
        expect(result.data.highlights).toBeTruthy()
      }
    })
  }
})

// ═══════════════════════════════════════════
// 类型契约验证
// ═══════════════════════════════════════════
describe('类型契约 shape 验证', () => {
  it('5 个命例 fixture 全部可正确反序列化', () => {
    for (const caseId of CASES) {
      expect(() => loadFixture(caseId)).not.toThrow()
    }
  })

  it('annotation.strengthAnalysis 结构一致', () => {
    for (const caseId of CASES) {
      const f = loadFixture(caseId)
      const s = f.annotation.strengthAnalysis
      expect(s.score).toBeGreaterThanOrEqual(0)
      expect(s.score).toBeLessThanOrEqual(100)
      expect(typeof s.confidence).toBe('number')
      expect(Array.isArray(s.reasons)).toBe(true)
    }
  })

  it('annotation.patternAnalysis quality ∈ {上等,中等,平}', () => {
    const valid = new Set(['上等', '中等', '平'])
    for (const caseId of CASES) {
      const f = loadFixture(caseId)
      expect(valid.has(f.annotation.patternAnalysis.quality)).toBe(true)
    }
  })

  it('annotation.luckAnalysis.daYunList quality ∈ {佳,平,不佳}', () => {
    const valid = new Set(['佳', '平', '不佳'])
    for (const caseId of CASES) {
      const f = loadFixture(caseId)
      for (const daYun of f.annotation.luckAnalysis.daYunList) {
        expect(valid.has(daYun.quality)).toBe(true)
      }
    }
  })
})
