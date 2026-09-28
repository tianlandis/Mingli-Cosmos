// ============================================================
// 功能清单（发现页网格数据源）
// 文件：src/lib/features.ts
//
// 目的：把「待增加的功能」先在前端**布局**出来，逐个点亮。
//   - status='available' → 可点击，有真实路由
//   - status='planned'   → 显示「敬请期待」，不可点击（不制造可用假象）
//
// 约定：key 必须存在于 CREDIT_COSTS（点券消耗表），否则视为免费。
// ============================================================

import { CREDIT_COSTS, type CreditCostDef } from './credits'

export type FeatureStatus = 'available' | 'planned'

/** 图标名 → DiscoverPage 内映射到 lucide 组件（避免在 .ts 里直接持有组件） */
export type FeatureIconName =
  | 'users'
  | 'family'
  | 'book'
  | 'calendar'
  | 'sun'
  | 'share'

export interface FeatureDef {
  /** 与 CREDIT_COSTS 对齐的 key */
  key: string
  title: string
  desc: string
  status: FeatureStatus
  icon: FeatureIconName
  /** available 时的内部路由 */
  route?: string
}

export const FEATURES: FeatureDef[] = [
  {
    key: 'synastry',
    title: '双人合盘',
    desc: '夫妻 / 亲子 / 合伙人，按关系评分',
    status: 'planned',
    icon: 'users',
  },
  {
    key: 'relatives',
    title: '六亲详解',
    desc: '从本人八字推父母配偶子女',
    status: 'planned',
    icon: 'family',
  },
  {
    key: 'report',
    title: '命书报告',
    desc: '人格 + 运势完整命书',
    status: 'planned',
    icon: 'book',
  },
  {
    key: 'fortune',
    title: '流年详批',
    desc: '逐年逐月细批宜忌',
    status: 'planned',
    icon: 'calendar',
  },
  {
    key: 'daily',
    title: '每日运势',
    desc: '今日宜忌与能量提示',
    status: 'planned',
    icon: 'sun',
  },
  {
    key: 'share',
    title: '分享长图',
    desc: '生成精美命盘分享卡',
    status: 'planned',
    icon: 'share',
  },
]

/** 取功能的点券定义（未登记则视为免费） */
export function costOf(key: string): CreditCostDef {
  return (
    CREDIT_COSTS[key] ?? {
      key,
      label: key,
      credits: 0,
      backendReady: false,
      reason: '暂未定价',
    }
  )
}
