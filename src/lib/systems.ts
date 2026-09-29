// ============================================================
// 命理体系注册表（前端映射）
// 文件：src/lib/systems.ts
//
// 与后端 ADR-011 多体系注册表对齐：
//   后端 src/server/systems/registry.ts 持有权威引擎，`id` 必须一致；
//   POST /api/v1/app/chart 收可选 `system`（未注册 → 400）。
//
// 当前后端只注册了 `bazi`。其余体系在此**先布局**（status='planned'），
// UI 上禁用并标注「规划中」，避免制造已可用的假象。
// 后端注册后，只需把 status 改为 'available' 即可点亮。
// ============================================================

/** 体系状态：available = 后端已注册可用；planned = 已布局待实现 */
export type SystemStatus = 'available' | 'planned'

/** 体系所需输入形态（决定前端渲染哪个表单） */
export type SystemInputKind =
  | 'birth' // 生辰：年月日时 + 性别（八字）
  | 'birth-place' // 生辰 + 出生地（星座，需经纬度换算）
  | 'quiz' // 问卷作答（MBTI）

export interface SystemDef {
  /** 后端 registry 的 system id，必须逐字一致 */
  id: string
  label: string
  /** 一句话说明，用于切换器下方的解释行 */
  desc: string
  status: SystemStatus
  inputKind: SystemInputKind
}

export const SYSTEMS: SystemDef[] = [
  {
    id: 'bazi',
    label: '八字',
    desc: '四柱排盘 · 格局 · 大运流年',
    status: 'available',
    inputKind: 'birth',
  },
  {
    // ⚠️ id 必须与后端 registry 逐字一致（后端注册的是 'astro'，不是 'zodiac'）
    id: 'astro',
    label: '星座',
    // 只做太阳星座（中气分界）；月亮/上升需星历库，未提供前不写进说明
    desc: '太阳星座 · 中气分界 · 与八字月支互验',
    status: 'available',
    inputKind: 'birth',
  },
  {
    id: 'mbti',
    label: 'MBTI',
    // 从生辰命盘推导人格倾向，不是问卷测评
    desc: '由命盘推人格倾向 · 认知功能栈',
    status: 'available',
    inputKind: 'birth',
  },
]

export const DEFAULT_SYSTEM_ID = 'bazi'

export function getSystem(id: string): SystemDef | undefined {
  return SYSTEMS.find(s => s.id === id)
}

export function isSystemAvailable(id: string): boolean {
  return getSystem(id)?.status === 'available'
}
