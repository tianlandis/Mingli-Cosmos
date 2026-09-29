// ============================================================
// [ADR-011] 星座体系适配器
// 文件：src/server/systems/astro.ts
//
// 复用已有的星座↔八字映射（src/server/lib/astro-mapping.ts）：
// 太阳星座分界 = 中气时刻，与八字月支分界（节）同源、精确到秒。
//
// 范围：**仅太阳星座**。月亮 / 上升需要星历库（如 astronomy-engine）计算
// 天体黄经，本项目未引入，故不臆造——缺的能力宁可不给，也不给假的。
//
// 口径：排盘统一北京时间（项目既定口径），不做真太阳时校正。
// ============================================================

import { getSolarSign, mapSunSignToBazi, SOLAR_SIGNS } from '../lib/astro-mapping'
import type { SolarSignInfo } from '../lib/astro-mapping'
import type { BirthInput } from '../lib/types'
import type { SystemEngine } from './types'

/** 星座体系产物 */
export interface AstroBundle {
  sign: SolarSignInfo
  /** 出生时刻（ISO，本地时间口径） */
  birthAt: string
}

/** 星座版本（与映射口径绑定，变更时需同步 astro-mapping） */
export const ASTRO_ENGINE_VERSION = 'v1.0.0'

/** 稳定指纹（星座体系没有命盘，用签名字符串） */
function stableHash(s: string): string {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return (h >>> 0).toString(16).padStart(8, '0')
}

/** 受控输入 → Date（北京时间口径，按本地时间构造即可） */
function toDate(input: BirthInput): Date {
  return new Date(
    input.year,
    input.month - 1,
    input.day,
    input.hour ?? 12,
    input.minute ?? 0,
    0,
    0,
  )
}

export const astroEngine: SystemEngine<BirthInput, AstroBundle> = {
  id: 'astro',
  version: ASTRO_ENGINE_VERSION,

  async compute(input) {
    if (input.calendarType === 'lunar') {
      // 农历需先转阳历。八字体系有现成转换，星座侧暂不重复实现，
      // 明确报错好过静默算错。
      throw new Error('星座体系暂不支持农历输入，请先转换为阳历')
    }
    const date = toDate(input)
    const sign = getSolarSign(date)
    return { sign, birthAt: date.toISOString() }
  },

  hash(bundle) {
    return `astro:v1:${stableHash(`${bundle.sign.index}|${bundle.sign.name}`)}`
  },

  isValidResult(value): value is AstroBundle {
    if (!value || typeof value !== 'object') return false
    const v = value as { sign?: unknown }
    if (!v.sign || typeof v.sign !== 'object') return false
    const s = v.sign as { index?: unknown; name?: unknown }
    return typeof s.index === 'number' && typeof s.name === 'string'
  },

  ctxFor(bundle) {
    const s = bundle.sign
    return [
      '## 星座数据（唯一数据源）',
      `- 太阳星座：${s.name}（${s.en}）`,
      `- 元素：${s.element}`,
      `- 本星座起于：${s.since.toISOString()}`,
      `- 下一星座起于：${s.until.toISOString()}`,
      `- 出生时刻：${bundle.birthAt}`,
    ].join('\n')
  },

  buildPrompt(bundle, opts) {
    const reportSummary = opts?.reportSummary
    const adminSection = opts?.adminSection ?? null
    return [
      '## 角色',
      '你是星座解读师"墨白"。',
      '',
      this.ctxFor(bundle),
      '',
      reportSummary ? `## 解读摘要\n${reportSummary}\n` : '',
      adminSection ? `${adminSection}\n` : '',
      // 星座体系没有命盘可校验，但仍要约束臆造
      [
        '## 护栏',
        '- 只依据上方星座数据作答，不得编造出生时刻之外的天体位置。',
        '- 本体系仅提供太阳星座；月亮、上升星座数据不存在，被问到须如实说明无法计算。',
        '- 所有星座分界以中气时刻为准，与八字月支分界（节）不同源，不要混用术语。',
      ].join('\n'),
    ].join('\n')
  },
}

/** 供前端/测试核对：12 星座清单 */
export const ASTRO_SIGN_COUNT = SOLAR_SIGNS.length

/** 导出映射函数，供上层做「星座 × 八字」交叉解读 */
export { mapSunSignToBazi }
