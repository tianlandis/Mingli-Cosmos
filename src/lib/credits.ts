// ============================================================
// 点券（Credits）模型
// 文件：src/lib/credits.ts
//
// 设计原则（田哥 2026-09-29 定调）：
//   1. **库里能算的，不收券** —— 排盘 / 批注 / 格局 / 大运 全部由引擎本地算，
//      零服务器成本、零延迟，因此永久免费，这是引流与留存的底盘。
//   2. **AI 只做"润滑"** —— 把结构化结论改写成口语化、有人味的表述，才消耗点券。
//   3. **深度功能贵一点** —— 合盘、流年详批这类多步推理，消耗更高。
//
// ⚠️ 当前后端状态：额度系统（quota_ledger）已在跑，但**按功能区分消耗尚未接入**
//    （chat 固定 cost=1，命书 /api/report 甚至完全不扣费）。
//    本文件是前端的**目标模型**，UI 上按此呈现；
//    后端按功能扣费落地前，标 `backendReady: false` 的功能不真正扣券。
// ============================================================

/** 点券单位（UI 展示） */
export const CREDIT_UNIT = '券'

/** 单个功能的点券消耗定义 */
export interface CreditCostDef {
  /** 功能 key，与 features.ts 对齐 */
  key: string
  label: string
  /** 消耗点券数；0 = 免费 */
  credits: number
  /**
   * 后端是否已按此消耗扣费。
   * false = 当前不真正扣券（功能未接入或后端未分级），UI 需诚实标注。
   */
  backendReady: boolean
  /** 为什么收（或不收），展示在功能卡上 */
  reason: string
}

export const CREDIT_COSTS: Record<string, CreditCostDef> = {
  chart: { key: 'chart', label: '排盘', credits: 0, backendReady: true, reason: '引擎本地计算，不消耗' },
  chat: { key: 'chat', label: 'AI 问答', credits: 1, backendReady: true, reason: '每轮一次大模型润色' },
  // ⚠️ 测试期（2026-09-29 田哥定）：所有已接入功能统一 cost=1，正式定价后再调回。
  // backendReady=true：后端已接入幂等额度预留（后台可配 report_quota_cost）+ 同命盘缓存命中不扣券
  report: { key: 'report', label: '命书报告', credits: 1, backendReady: true, reason: '四步生成，含人格与运势' },
  // backendReady=true：规则层算事实（不调模型），已接入扣费（后台可配 synastry_quota_cost）+ 同组合缓存
  synastry: { key: 'synastry', label: '双人合盘', credits: 1, backendReady: true, reason: '双造比对 + 关系评分' },
  relatives: { key: 'relatives', label: '六亲详解', credits: 8, backendReady: false, reason: '六亲宫位逐项推演' },
  fortune: { key: 'fortune', label: '流年详批', credits: 15, backendReady: false, reason: '逐年逐月细批' },
  daily: { key: 'daily', label: '每日运势', credits: 0, backendReady: false, reason: '模板化输出，无需模型' },
  share: { key: 'share', label: '分享长图', credits: 0, backendReady: false, reason: '前端渲染，无需模型' },
}

/** 格式化点券数（负数也安全） */
export function formatCredits(n: number): string {
  const v = Math.max(0, Math.round(n))
  return `${v} ${CREDIT_UNIT}`
}

/** 是否免费 */
export function isFree(key: string): boolean {
  return (CREDIT_COSTS[key]?.credits ?? 0) === 0
}

/** 充值档位（点券包） */
export interface CreditPack {
  code: string
  priceCents: number
  credits: number
  /** 相对基准档的优惠标注，如「多送 20%」 */
  bonus?: string
}

export const CREDIT_PACKS: CreditPack[] = [
  { code: 'pack-s', priceCents: 600, credits: 50 },
  { code: 'pack-m', priceCents: 1800, credits: 180, bonus: '多送 20%' },
  { code: 'pack-l', priceCents: 3800, credits: 400, bonus: '多送 32%' },
]

/** 订阅档位（月付 / 年付，按期发券） */
export interface CreditPlan {
  code: string
  name: string
  priceCents: number
  /** 每期发放点券 */
  creditsPerPeriod: number
  periodLabel: string
  highlight?: string
}

export const CREDIT_PLANS: CreditPlan[] = [
  {
    code: 'monthly',
    name: '月度会员',
    priceCents: 3900,
    creditsPerPeriod: 300,
    periodLabel: '每月',
    highlight: '排盘不限次',
  },
  {
    code: 'yearly',
    name: '年度会员',
    priceCents: 29900,
    creditsPerPeriod: 4000,
    periodLabel: '每年',
    highlight: '性价比最高',
  },
]

/** 元 -> 展示字符串（分存储，避免浮点） */
export function formatPrice(cents: number): string {
  return `¥${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`
}
