/**
 * 八字排盘核心计算器 → 单元测试
 * 测试五行生克、十神推导、起运天数逻辑
 */
import { describe, it, expect } from 'vitest'
import {
  TIAN_GAN_WUXING,
  TIAN_GAN_YIN_YANG,
  DI_ZHI_WUXING,
  HIDDEN_STEMS,
  HIDDEN_STEMS_DAYS,
  WUXING_LIST,
} from '../src/engine/types'

// ═══════════════════════════════════════════
// 常量完整性校验
// ═══════════════════════════════════════════
describe('types 常量完整性', () => {
  it('十天干全部定义', () => {
    const gan = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸']
    for (const g of gan) {
      expect(TIAN_GAN_WUXING[g]).toBeDefined()
      expect(TIAN_GAN_YIN_YANG[g]).toBeDefined()
    }
  })

  it('十二地支全部定义', () => {
    const zhi = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']
    for (const z of zhi) {
      expect(DI_ZHI_WUXING[z]).toBeDefined()
      expect(HIDDEN_STEMS[z]).toBeDefined()
      expect(HIDDEN_STEMS_DAYS[z]).toBeDefined()
    }
  })

  it('天干阴阳数量正确', () => {
    const yangGan = Object.entries(TIAN_GAN_YIN_YANG).filter(([, v]) => v === '阳')
    const yinGan = Object.entries(TIAN_GAN_YIN_YANG).filter(([, v]) => v === '阴')
    expect(yangGan).toHaveLength(5)
    expect(yinGan).toHaveLength(5)
  })
})

// ═══════════════════════════════════════════
// 藏干表 vs Python MCP 对照
// ═══════════════════════════════════════════
describe('HIDDEN_STEMS 藏干表（对照 Python MCP）', () => {
  it('四正月只有1个藏干', () => {
    const siZheng = ['子', '午', '卯', '酉']
    for (const z of siZheng) {
      expect(HIDDEN_STEMS[z]).toHaveLength(1)
      expect(HIDDEN_STEMS_DAYS[z]).toHaveLength(1)
    }
  })

  it('子月藏癸(30天)', () => {
    expect(HIDDEN_STEMS['子']).toEqual(['癸'])
    expect(HIDDEN_STEMS_DAYS['子']).toEqual([{ stem: '癸', days: 30 }])
  })

  it('午月藏丁(30天)', () => {
    expect(HIDDEN_STEMS['午']).toEqual(['丁'])
    expect(HIDDEN_STEMS_DAYS['午']).toEqual([{ stem: '丁', days: 30 }])
  })

  it('寅月藏戊(4)→丙(6)→甲(20)', () => {
    expect(HIDDEN_STEMS['寅']).toEqual(['戊', '丙', '甲'])
    expect(HIDDEN_STEMS_DAYS['寅']).toEqual([
      { stem: '戊', days: 4 },
      { stem: '丙', days: 6 },
      { stem: '甲', days: 20 },
    ])
  })

  it('亥月藏戊(2)→甲(7)→壬(21)', () => {
    expect(HIDDEN_STEMS['亥']).toEqual(['戊', '甲', '壬'])
    expect(HIDDEN_STEMS_DAYS['亥']).toEqual([
      { stem: '戊', days: 2 },
      { stem: '甲', days: 7 },
      { stem: '壬', days: 21 },
    ])
  })

  it('辰戌丑未四墓库天数之和为30', () => {
    const muKu = ['辰', '戌', '丑', '未']
    for (const z of muKu) {
      const total = HIDDEN_STEMS_DAYS[z].reduce((sum, s) => sum + s.days, 0)
      expect(total).toBe(30)
    }
  })

  it('寅申巳亥四生月天数之和为30', () => {
    const sheng = ['寅', '申', '巳', '亥']
    for (const z of sheng) {
      const total = HIDDEN_STEMS_DAYS[z].reduce((sum, s) => sum + s.days, 0)
      expect(total).toBe(30)
    }
  })
})

// ═══════════════════════════════════════════
// 五行属性校验
// ═══════════════════════════════════════════
describe('五行属性', () => {
  it('甲木乙木', () => { expect(TIAN_GAN_WUXING['甲']).toBe('木'); expect(TIAN_GAN_WUXING['乙']).toBe('木') })
  it('丙火丁火', () => { expect(TIAN_GAN_WUXING['丙']).toBe('火'); expect(TIAN_GAN_WUXING['丁']).toBe('火') })
  it('戊土己土', () => { expect(TIAN_GAN_WUXING['戊']).toBe('土'); expect(TIAN_GAN_WUXING['己']).toBe('土') })
  it('庚金辛金', () => { expect(TIAN_GAN_WUXING['庚']).toBe('金'); expect(TIAN_GAN_WUXING['辛']).toBe('金') })
  it('壬水癸水', () => { expect(TIAN_GAN_WUXING['壬']).toBe('水'); expect(TIAN_GAN_WUXING['癸']).toBe('水') })

  it('子水亥水', () => { expect(DI_ZHI_WUXING['子']).toBe('水'); expect(DI_ZHI_WUXING['亥']).toBe('水') })
  it('寅木卯木', () => { expect(DI_ZHI_WUXING['寅']).toBe('木'); expect(DI_ZHI_WUXING['卯']).toBe('木') })
  it('午火巳火', () => { expect(DI_ZHI_WUXING['午']).toBe('火'); expect(DI_ZHI_WUXING['巳']).toBe('火') })
  it('申金酉金', () => { expect(DI_ZHI_WUXING['申']).toBe('金'); expect(DI_ZHI_WUXING['酉']).toBe('金') })
  it('辰戌丑未土', () => {
    expect(DI_ZHI_WUXING['辰']).toBe('土')
    expect(DI_ZHI_WUXING['戌']).toBe('土')
    expect(DI_ZHI_WUXING['丑']).toBe('土')
    expect(DI_ZHI_WUXING['未']).toBe('土')
  })

  it('五行列表', () => {
    expect(WUXING_LIST).toEqual(['金', '木', '水', '火', '土'])
  })
})
