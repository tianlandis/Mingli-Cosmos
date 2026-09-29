import { describe, it, expect } from 'vitest'
import { Solar, Lunar } from 'lunar-typescript'
import {
  getSolarSign,
  getSignBranchPair,
  mapSunSignToBazi,
  SOLAR_SIGNS,
} from '../astro-mapping'

/** 独立实现：从同一张节气表用「节」推月支（用于性质测试交叉验证，不走 engine） */
const JIE_TO_BRANCH: Record<string, string> = {
  立春: '寅', LI_CHUN: '寅',
  惊蛰: '卯', JING_ZHE: '卯',
  清明: '辰', QING_MING: '辰',
  立夏: '巳', LI_XIA: '巳',
  芒种: '午', MANG_ZHONG: '午',
  小暑: '未', XIAO_SHU: '未',
  立秋: '申', LI_QIU: '申',
  白露: '酉', BAI_LU: '酉',
  寒露: '戌', HAN_LU: '戌',
  立冬: '亥', LI_DONG: '亥',
  大雪: '子', DA_XUE: '子',
  小寒: '丑', XIAO_HAN: '丑',
}

function solarToDate(s: Solar): Date {
  return new Date(
    s.getYear(), s.getMonth() - 1, s.getDay(),
    s.getHour(), s.getMinute(), s.getSecond(),
  )
}

function monthBranchOf(birth: Date): string {
  const table = Lunar.fromDate(birth).getJieQiTable()
  let best: { branch: string; date: Date } | null = null
  for (const [key, solar] of Object.entries(table)) {
    const branch = JIE_TO_BRANCH[key]
    if (branch === undefined) continue
    const d = solarToDate(solar)
    if (d.getTime() <= birth.getTime() && (!best || d > best.date)) {
      best = { branch, date: d }
    }
  }
  if (!best) throw new Error(`节气表不足以推月支: ${birth.toISOString()}`)
  return best.branch
}

describe('astro-mapping 星座↔八字精确映射', () => {
  describe('星座判定（中气分界，精确到秒）', () => {
    it('生产测试账号生辰 1990-03-08 14:00 → 双鱼座（雨水 02-19 之后、春分 03-21 之前）', () => {
      const sign = getSolarSign(new Date(1990, 2, 8, 14, 0, 0))
      expect(sign.index).toBe(11)
      expect(sign.name).toBe('双鱼座')
      expect(sign.element).toBe('水')
      expect(sign.since.getTime()).toBe(
        new Date(1990, 1, 19, 6, 14, 1).getTime(),
      )
      expect(sign.until.getTime()).toBe(new Date(1990, 2, 21, 5, 19, 15).getTime())
    })

    it('春分瞬间 1990-03-21 05:19:15 起白羊，前一秒仍为双鱼', () => {
      const aries = getSolarSign(new Date(1990, 2, 21, 5, 19, 15))
      expect(aries.index).toBe(0)
      const pisces = getSolarSign(new Date(1990, 2, 21, 5, 19, 14))
      expect(pisces.index).toBe(11)
    })

    it('跨年边界：1990-01-10 → 摩羯（上个冬至 1989-12-22 之后）', () => {
      const sign = getSolarSign(new Date(1990, 0, 10, 12, 0, 0))
      expect(sign.index).toBe(9)
      expect(sign.name).toBe('摩羯座')
    })

    it('拼音键溢出：1990-12-25（本年冬至 12-22 之后）→ 摩羯', () => {
      const sign = getSolarSign(new Date(1990, 11, 25, 12, 0, 0))
      expect(sign.index).toBe(9)
      expect(sign.until.getFullYear()).toBe(1991)
    })

    it('1990-07-01 → 巨蟹（夏至 06-21 之后）', () => {
      const sign = getSolarSign(new Date(1990, 6, 1, 12, 0, 0))
      expect(sign.index).toBe(3)
      expect(sign.name).toBe('巨蟹座')
    })
  })

  describe('星座→月支映射公式', () => {
    it('白羊=[卯,辰] 金牛=[辰,巳] 摩羯=[子,丑] 水瓶=[丑,寅] 双鱼=[寅,卯]', () => {
      expect(getSignBranchPair(0)).toEqual(['卯', '辰'])
      expect(getSignBranchPair(1)).toEqual(['辰', '巳'])
      expect(getSignBranchPair(9)).toEqual(['子', '丑'])
      expect(getSignBranchPair(10)).toEqual(['丑', '寅'])
      expect(getSignBranchPair(11)).toEqual(['寅', '卯'])
    })

    it('相邻星座共享月支形成闭环（支序链）', () => {
      for (let s = 0; s < 12; s++) {
        const cur = getSignBranchPair(s)
        const next = getSignBranchPair((s + 1) % 12)
        expect(cur[1]).toBe(next[0])
      }
    })
  })

  describe('组合映射 mapSunSignToBazi', () => {
    it('1990-03-08 14:00 月支卯 → 双鱼座后半段', () => {
      const m = mapSunSignToBazi(new Date(1990, 2, 8, 14, 0, 0), '卯')
      expect(m.sign.name).toBe('双鱼座')
      expect(m.branchPair).toEqual(['寅', '卯'])
      expect(m.consistent).toBe(true)
      expect(m.phase).toBe('后半')
      expect(m.relation).toContain('双鱼')
    })

    it('月支与星座区间不符时抛错（一致性守卫）', () => {
      expect(() => mapSunSignToBazi(new Date(1990, 2, 8, 14, 0, 0), '午')).toThrow(
        /映射与排盘不一致/,
      )
    })
  })

  describe('全量性质测试：月支必落入太阳星座的横跨区间', () => {
    // 1990、2000 两年逐日 12:00（含闰年），共 731 天
    const years = [1990, 2000]

    for (const year of years) {
      it(`${year} 年逐日交叉验证`, () => {
        const end = new Date(year + 1, 0, 1).getTime()
        const seenSigns = new Set<number>()
        const seenPairs = new Set<string>()

        for (let t = new Date(year, 0, 1, 12, 0, 0).getTime(); t < end; t += 86_400_000) {
          const birth = new Date(t)
          const sign = getSolarSign(birth)
          const branch = monthBranchOf(birth)
          const pair = getSignBranchPair(sign.index)
          expect(pair).toContain(branch)
          seenSigns.add(sign.index)
          seenPairs.add(pair.join(''))
        }

        expect(seenSigns.size).toBe(12) // 全部 12 星座被覆盖
        expect(seenPairs.size).toBe(12) // 全部 12 组映射被覆盖
      })
    }

    it('SOLAR_SIGNS 常量表完整且元素分布正确', () => {
      expect(SOLAR_SIGNS).toHaveLength(12)
      expect(SOLAR_SIGNS.filter((s) => s.element === '火').map((s) => s.name)).toEqual([
        '白羊座', '狮子座', '射手座',
      ])
      expect(SOLAR_SIGNS.filter((s) => s.element === '土')).toHaveLength(3)
      expect(SOLAR_SIGNS.filter((s) => s.element === '风')).toHaveLength(3)
      expect(SOLAR_SIGNS.filter((s) => s.element === '水')).toHaveLength(3)
    })
  })
})
