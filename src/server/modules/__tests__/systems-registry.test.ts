// ============================================================
// [ADR-011] 多体系注册表 — 回归测试
// 文件：src/server/modules/__tests__/systems-registry.test.ts
//
// 锁定四条最容易悄悄坏掉的语义：
//   1. 三体系（bazi / astro / mbti）均已注册且 id 与前端逐字一致
//      —— 前端切换器下发 system 字段，对不上就是 400；
//   2. 各体系产物能过自己的 isValidResult（守卫不能形同虚设）；
//   3. 指纹稳定且带体系前缀（跨体系不得碰撞，否则校验会张冠李戴）；
//   4. 星座体系不支持农历时**明确报错**，而不是静默算错。
// ============================================================

import { describe, it, expect } from 'vitest'
import {
  listSystemIds,
  isKnownSystem,
  getSystemEngine,
  computeSystem,
  DEFAULT_SYSTEM,
} from '@/server/systems/registry'
import type { AstroBundle } from '@/server/systems/astro'
import type { MbtiBundle } from '@/server/systems/mbti'
import type { BaziBundle } from '@/server/systems/bazi'
import { SYSTEMS } from '@/lib/systems'

/** 阳历 1990-03-08 14:00 女 */
const BIRTH = {
  year: 1990, month: 3, day: 8,
  hour: 14, minute: 0, gender: '女' as const,
  calendarType: 'solar' as const,
}

describe('体系注册表', () => {
  it('三体系均已注册，且默认体系为八字', () => {
    const ids = listSystemIds()
    expect(ids).toContain('bazi')
    expect(ids).toContain('astro')
    expect(ids).toContain('mbti')
    expect(DEFAULT_SYSTEM).toBe('bazi')
  })

  it('前端标为 available 的体系，后端必须已注册（防 id 漂移）', () => {
    // 前端 systems.ts 的 id 一旦与后端不一致，切过去就是 400 —— 这是最容易犯的错
    const availableIds = SYSTEMS.filter(s => s.status === 'available').map(s => s.id)
    expect(availableIds.length).toBeGreaterThan(0)
    for (const id of availableIds) {
      expect(isKnownSystem(id)).toBe(true)
    }
  })

  it('未知体系取引擎 → undefined（不抛错，交由上层返回 400）', () => {
    expect(getSystemEngine('zodiac')).toBeUndefined()
    expect(isKnownSystem('zodiac')).toBe(false)
  })
})

describe('星座体系', () => {
  it('算出太阳星座且通过自身守卫', async () => {
    const bundle = await computeSystem<AstroBundle>('astro', BIRTH)
    expect(bundle.sign.index).toBeGreaterThanOrEqual(0)
    expect(bundle.sign.index).toBeLessThanOrEqual(11)
    expect(bundle.sign.name).toMatch(/座$/)
    expect(['火', '土', '风', '水']).toContain(bundle.sign.element)

    const engine = getSystemEngine('astro')!
    expect(engine.isValidResult(bundle)).toBe(true)
  })

  it('指纹稳定且带 astro 前缀', async () => {
    const a = await computeSystem<AstroBundle>('astro', BIRTH)
    const b = await computeSystem<AstroBundle>('astro', BIRTH)
    const engine = getSystemEngine('astro')!
    expect(engine.hash(a)).toBe(engine.hash(b))
    expect(engine.hash(a).startsWith('astro:')).toBe(true)
  })

  it('农历输入明确报错（不做静默的错误换算）', async () => {
    await expect(
      computeSystem<AstroBundle>('astro', { ...BIRTH, calendarType: 'lunar' }),
    ).rejects.toThrow(/农历/)
  })

  it('Prompt 里如实声明不支持月亮 / 上升', async () => {
    const bundle = await computeSystem<AstroBundle>('astro', BIRTH)
    const prompt = getSystemEngine('astro')!.buildPrompt(bundle)
    expect(prompt).toContain('太阳星座')
    expect(prompt).toContain('月亮')
  })
})

describe('MBTI 体系', () => {
  it('产出人格倾向且通过自身守卫', async () => {
    const bundle = await computeSystem<MbtiBundle>('mbti', BIRTH)
    expect(bundle.profile.typicalTypes.length).toBeGreaterThan(0)
    expect(bundle.primaryType).toBeTruthy()

    const engine = getSystemEngine('mbti')!
    expect(engine.isValidResult(bundle)).toBe(true)
  })

  it('指纹带 mbti 前缀，且不与八字指纹相同（跨体系不碰撞）', async () => {
    const mbtiBundle = await computeSystem<MbtiBundle>('mbti', BIRTH)
    const baziBundle = await computeSystem<BaziBundle>('bazi', BIRTH)

    const mbtiHash = getSystemEngine('mbti')!.hash(mbtiBundle)
    const baziHash = getSystemEngine('bazi')!.hash(baziBundle)
    expect(mbtiHash.startsWith('mbti:')).toBe(true)
    expect(mbtiHash).not.toBe(baziHash)
  })

  it('Prompt 说明来源是命盘推导，而非问卷测评', async () => {
    const bundle = await computeSystem<MbtiBundle>('mbti', BIRTH)
    const prompt = getSystemEngine('mbti')!.buildPrompt(bundle)
    expect(prompt).toContain('生辰')
    expect(prompt).toContain('不是问卷测评')
  })
})
