// ============================================================
// [ADR-011] 体系展示元数据 —— 服务端唯一真值
// 文件：src/server/systems/meta.ts
//
// 为什么存在：
//   registry.ts 只持有引擎（id / version），没有面向人的中文名与说明。
//   此前 C 端 `src/lib/systems.ts` 与后台各写一份中文标签，改一处漏一处
//   （架构评审点名的「硬编码映射表漂移」）。这里收敛为服务端唯一真值，
//   由 `GET /api/v1/admin/systems` 下发，前后端都直接消费。
//
// 新增体系 = 在这里补一行 + registry.ts 注册一行。未登记的 id 自动回落为 id 本身。
// ============================================================

export interface SystemMeta {
  /** 中文显示名 */
  label: string
  /** 一句话说明（后台选择卡片副标题） */
  desc: string
}

const SYSTEM_META: Record<string, SystemMeta> = {
  bazi: {
    label: '八字',
    desc: '四柱排盘 · 格局 · 大运流年 —— 核心体系，不可停用',
  },
  astro: {
    label: '星座',
    desc: '太阳星座 · 中气分界 · 与八字月支互验',
  },
  mbti: {
    label: 'MBTI',
    desc: '由命盘推人格倾向 · 认知功能栈',
  },
}

/** 取体系展示元数据；未登记时回落为 id 本身，保证 UI 不崩 */
export function getSystemMeta(id: string): SystemMeta {
  return SYSTEM_META[id] ?? { label: id, desc: '未登记展示信息的体系' }
}

/** 已登记的体系 id 列表（仅供文档/测试核对） */
export function listKnownSystemIds(): string[] {
  return Object.keys(SYSTEM_META)
}
