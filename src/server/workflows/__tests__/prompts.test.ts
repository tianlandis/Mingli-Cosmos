// ============================================================
// Prompt 模板回归测试 — prompts.test.ts
// 文件：src/server/workflows/__tests__/prompts.test.ts
// ============================================================
import { describe, it, expect } from 'vitest'
import { buildSystemPrompt } from '@/server/prompts/system'
import { buildPersonalityPrompt } from '@/server/prompts/personality'
import { buildLuckPrompt } from '@/server/prompts/luck'
import type { AnnotationResult } from '@/engine/annotation/types'
import type { BaZiResult } from '@/engine/types'
import path from 'node:path'
import fs from 'node:fs'

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

const CASES = [
  'case-01-qianlong',
  'case-02-zhugeliang',
  'case-03-normal-male',
  'case-04-normal-female',
  'case-05-bianryu',
] as const

// ═══════════════════════════════════════════
// A 模式 System Prompt 回归
// ═══════════════════════════════════════════
describe('A 模式 — buildSystemPrompt 回归', () => {
  for (const caseId of CASES) {
    it(`${caseId} — System Prompt 注入完整四柱`, () => {
      const fixt = loadFixture(caseId)
      const prompt = buildSystemPrompt(fixt.chart, fixt.annotation)

      expect(prompt).toContain(fixt.chart.yearPillar.ganZhi)
      expect(prompt).toContain(fixt.chart.monthPillar.ganZhi)
      expect(prompt).toContain(fixt.chart.dayPillar.ganZhi)
      expect(prompt).toContain(fixt.chart.hourPillar.ganZhi)
    })

    it(`${caseId} — System Prompt 注入日主+格局`, () => {
      const fixt = loadFixture(caseId)
      const prompt = buildSystemPrompt(fixt.chart, fixt.annotation)

      expect(prompt).toContain(`日主：${fixt.chart.dayMaster}`)
      expect(prompt).toContain(fixt.annotation.patternAnalysis.patternName)
      expect(prompt).toContain(fixt.annotation.patternAnalysis.quality)
    })

    it(`${caseId} — System Prompt 包含防越权规则`, () => {
      const fixt = loadFixture(caseId)
      const prompt = buildSystemPrompt(fixt.chart, fixt.annotation)

      // 核心定位
      expect(prompt).toContain('解盘者')
      expect(prompt).toContain('排盘者')
      // 防越权规则
      expect(prompt).toContain('严禁私自排盘')
      expect(prompt).toContain('数据锁定')
      expect(prompt).toContain('禁止绝对化')
      expect(prompt).toContain('安全边界')
      expect(prompt).toContain('表达风格')
      expect(prompt).toContain('话题边界')
      expect(prompt).toContain('以上分析仅供参考')
    })

    it(`${caseId} — System Prompt 非空且 > 200 字符`, () => {
      const fixt = loadFixture(caseId)
      const prompt = buildSystemPrompt(fixt.chart, fixt.annotation)
      expect(prompt.length).toBeGreaterThan(200)
      expect(prompt.length).toBeLessThan(3000)
    })

    it(`${caseId} — System Prompt 注入 reportSummary（可选）`, () => {
      const fixt = loadFixture(caseId)
      const summary = '命主身强，正官为用，一生官运亨通。'
      const prompt = buildSystemPrompt(fixt.chart, fixt.annotation, summary)
      expect(prompt).toContain('命书摘要')
      expect(prompt).toContain(summary)
    })
  }
})

// ═══════════════════════════════════════════
// B 模式 Personality Prompt 回归
// ═══════════════════════════════════════════
describe('B 模式 — buildPersonalityPrompt 回归', () => {
  for (const caseId of CASES) {
    it(`${caseId} — personality prompt 包含日主+强弱`, () => {
      const fixt = loadFixture(caseId)
      const { system, prompt } = buildPersonalityPrompt(fixt.annotation)

      expect(system).toBeTruthy()
      expect(prompt).toBeTruthy()
      expect(prompt).toContain(fixt.annotation.strengthAnalysis.strength)
    })

    it(`${caseId} — personality prompt 包含格局名`, () => {
      const fixt = loadFixture(caseId)
      const { prompt } = buildPersonalityPrompt(fixt.annotation)
      expect(prompt).toContain(fixt.annotation.patternAnalysis.patternName)
    })

    it(`${caseId} — personality system prompt 包含质量要求`, () => {
      const fixt = loadFixture(caseId)
      const { system } = buildPersonalityPrompt(fixt.annotation)
      expect(system.length).toBeGreaterThan(50)
    })
  }
})

// ═══════════════════════════════════════════
// B 模式 Luck Prompt 回归
// ═══════════════════════════════════════════
describe('B 模式 — buildLuckPrompt 回归', () => {
  for (const caseId of CASES) {
    it(`${caseId} — luck prompt 包含近三年运势章节`, () => {
      const fixt = loadFixture(caseId)
      const { system, prompt } = buildLuckPrompt(fixt.annotation, '测试人格')

      expect(system).toBeTruthy()
      expect(prompt).toBeTruthy()
      expect(prompt).toContain('近三年运势')
      expect(prompt).toContain('当前大运')
    })

    it(`${caseId} — luck prompt 包含至少一条大运干支`, () => {
      const fixt = loadFixture(caseId)
      const { prompt } = buildLuckPrompt(fixt.annotation, '测试人格')
      // 至少前 3 条中的第一条应出现
      const first = fixt.annotation.luckAnalysis.daYunList[0]
      expect(prompt).toContain(first.ganZhi)
    })

    it(`${caseId} — luck prompt 包含 quality 标签`, () => {
      const fixt = loadFixture(caseId)
      const { prompt } = buildLuckPrompt(fixt.annotation, '测试人格')
      // 只检查前 3 条大运（slice(0,3)）的 quality
      const sliced = fixt.annotation.luckAnalysis.daYunList.slice(0, 3)
      for (const dy of sliced) {
        expect(prompt).toContain(dy.quality)
      }
    })
  }
})

// ═══════════════════════════════════════════
// Prompt 质量快照 — 确保 5 个命例区分度
// ═══════════════════════════════════════════
describe('Prompt 区分度验证', () => {
  it('5 个命例的 System Prompt 互不相同', () => {
    const prompts = CASES.map(caseId => {
      const fixt = loadFixture(caseId)
      return buildSystemPrompt(fixt.chart, fixt.annotation)
    })
    const unique = new Set(prompts)
    expect(unique.size).toBe(CASES.length)
  })

  it('特殊格局 prompt 包含"特殊格局"标记', () => {
    const fixt = loadFixture('case-05-bianryu')
    const prompt = buildSystemPrompt(fixt.chart, fixt.annotation)
    expect(prompt).toContain('化气格')
    expect(prompt).toContain('极弱')
  })

  it('普通命例 prompt 不包含"化气"等特殊术语', () => {
    const fixt = loadFixture('case-03-normal-male')
    const prompt = buildSystemPrompt(fixt.chart, fixt.annotation)
    expect(prompt).not.toContain('化气格')
    expect(prompt).not.toContain('从格')
  })
})
