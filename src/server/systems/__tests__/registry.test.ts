// ============================================================
// [ADR-011] 多体系注册表 — 可插拔性 + 行为等价 回归
// 文件：src/server/systems/__tests__/registry.test.ts
//
// 目的：
//   1. 证明「第 N 个体系 = 实现一个 SystemEngine + 注册一行」真的可行（可插拔）；
//   2. 证明 prompt 路由泛化是**行为等价重构**（八字输出与重构前逐字一致）。
// ============================================================

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { calculateBazi, generateAnnotation } from '@/engine'
import type { BaZiResult, AnnotationResult } from '@/engine'
import {
  registerSystem,
  getSystemEngine,
  requireSystemEngine,
  listSystemIds,
  isKnownSystem,
  computeSystem,
  DEFAULT_SYSTEM,
} from '@/server/systems/registry'
import { baziEngine } from '@/server/systems/bazi'
import { buildSystemPromptFor, buildSystemPrompt } from '@/server/prompts/system'
import { initDb, closeDb } from '@/server/db'
import type { SystemEngine } from '@/server/systems/types'

// ── 一个「假体系」，用于验证插件化（不依赖真实星座实现）──
interface MockInput { degrees: number }
interface MockResult { sign: string }
const mockAstro: SystemEngine<MockInput, MockResult> = {
  id: 'mock-astro',
  version: 'test-1',
  compute(input) { return { sign: input.degrees < 30 ? 'Aries' : 'Taurus' } },
  hash() { return 'mock:v1:deadbeef' },
  isValidResult(v): v is MockResult {
    return !!v && typeof v === 'object' && typeof (v as MockResult).sign === 'string'
  },
  ctxFor(r) { return `## 星盘数据（唯一数据源）\n- 星座：${r.sign}` },
  buildPrompt(r) { return `## 角色\n你是占星师。\n\n${this.ctxFor(r)}\n\n## 护栏\n严禁私自排盘。` },
}

let chart: BaZiResult
let annotation: AnnotationResult

beforeAll(async () => {
  process.env.DB_PATH = ':memory:'
  initDb() // 让 buildAdminInstructionSection 走真实（无自定义模板 → null）
  chart = await calculateBazi(1990, 6, 15, 12, 30, '男')
  annotation = generateAnnotation(chart)
})

afterAll(() => {
  closeDb()
  delete process.env.DB_PATH
})

describe('ADR-011 — 注册表基础', () => {
  it('内置 bazi 体系已注册，id/version 正确', () => {
    expect(isKnownSystem(DEFAULT_SYSTEM)).toBe(true)
    expect(listSystemIds()).toContain('bazi')
    const e = requireSystemEngine('bazi')
    expect(e.id).toBe('bazi')
    expect(e.version).toBe(baziEngine.version)
  })

  it('未知体系：getSystemEngine 返回 undefined，requireSystemEngine 抛错', () => {
    expect(getSystemEngine('no-such-system')).toBeUndefined()
    expect(() => requireSystemEngine('no-such-system')).toThrow(/未注册的体系/)
  })

  it('computeSystem("bazi", birth) 产出合法产物，hash 带体系前缀', async () => {
    const bundle = await computeSystem<{ chart: BaZiResult; annotation: AnnotationResult }>('bazi', {
      year: 1990, month: 6, day: 15, hour: 12, minute: 30, gender: '男',
    })
    expect(bundle.chart).toBeTruthy()
    expect(bundle.annotation).toBeTruthy()
    expect(baziEngine.hash(bundle)).toMatch(/^v1:[0-9a-f]{64}$/)
  })

  it('isValidResult 形状守卫：合法 bundle → true，空/异形 → false', () => {
    expect(baziEngine.isValidResult({ chart, annotation })).toBe(true)
    expect(baziEngine.isValidResult({ chart, annotation: null })).toBe(false)
    expect(baziEngine.isValidResult({})).toBe(false)
    expect(baziEngine.isValidResult(null)).toBe(false)
  })
})

describe('ADR-011 — 可插拔性（第 N 个体系 = 注册一行）', () => {
  it('注册 mock 体系后即可被发现并按 id 取回', () => {
    registerSystem(mockAstro)
    expect(isKnownSystem('mock-astro')).toBe(true)
    expect(listSystemIds()).toContain('mock-astro')
    expect(getSystemEngine('mock-astro')?.id).toBe('mock-astro')
  })

  it('mock 体系的 compute/hash/ctxFor 均可通过注册表调用', async () => {
    const r = await computeSystem<MockResult>('mock-astro', { degrees: 10 } satisfies MockInput)
    expect(r.sign).toBe('Aries')
    expect(requireSystemEngine('mock-astro').hash(r)).toBe('mock:v1:deadbeef')
    expect(requireSystemEngine('mock-astro').ctxFor(r)).toContain('星座：Aries')
  })

  it('prompt 路由能识别新体系（buildSystemPromptFor 走其 buildPrompt）', () => {
    const prompt = buildSystemPromptFor('mock-astro', { sign: 'Aries' })
    expect(prompt).toContain('占星师')
    expect(prompt).toContain('星座：Aries')
    expect(prompt).toContain('严禁私自排盘')
  })

  it('buildSystemPromptFor 对未注册体系抛错（快速失败）', () => {
    expect(() => buildSystemPromptFor('nope', {})).toThrow(/未注册的体系/)
  })
})

describe('ADR-011 — 行为等价（八字 prompt 逐字不变）', () => {
  it('buildSystemPrompt(chart, annotation) === baziEngine.buildPrompt(bundle, {adminSection:null})', () => {
    const viaRouter = buildSystemPrompt(chart, annotation)
    const viaEngine = baziEngine.buildPrompt({ chart, annotation }, { adminSection: null })
    expect(viaRouter).toBe(viaEngine)
  })

  it('注入 reportSummary 后仍等价', () => {
    const summary = '命主身强，正官为用。'
    expect(buildSystemPrompt(chart, annotation, summary))
      .toBe(baziEngine.buildPrompt({ chart, annotation }, { reportSummary: summary, adminSection: null }))
  })

  it('八字 prompt 关键内容仍完整（角色 / 数据段 / 日主 / 护栏）', () => {
    const prompt = buildSystemPrompt(chart, annotation)
    expect(prompt).toContain('你是八字命理分析师"墨白"。')
    expect(prompt).toContain('## 命盘数据（唯一数据源）')
    expect(prompt).toContain(`日主：${chart.dayMaster}`)
    expect(prompt).toContain('严禁私自排盘')
  })
})
