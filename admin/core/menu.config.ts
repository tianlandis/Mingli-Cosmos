// ============================================================
// Phase 4 — 管理后台菜单配置（数据驱动）
// 文件：admin/core/menu.config.ts
// 职责：定义侧边栏导航结构，包含分组、图标、权限标记
// ============================================================

import {
  LayoutDashboard,
  Settings,
  FileText,
  Cpu,
  ScrollText,
  Users,
  ShoppingCart,
  BookOpen,
  type LucideIcon,
} from 'lucide-react'

export interface MenuItem {
  key: string
  label: string
  icon: LucideIcon
  disabled?: boolean
  disabledHint?: string
  badge?: string
}

export interface MenuGroup {
  label: string
  items: MenuItem[]
}

export const menuGroups: MenuGroup[] = [
  {
    label: '核心',
    items: [
      {
        key: 'dashboard',
        label: '仪表盘',
        icon: LayoutDashboard,
      },
      {
        key: 'config',
        label: '系统配置',
        icon: Settings,
      },
      {
        key: 'prompts',
        label: 'Prompt 模板',
        icon: FileText,
      },
      {
        key: 'llm',
        label: 'LLM 供应商',
        icon: Cpu,
      },
      {
        key: 'audit',
        label: '审计日志',
        icon: ScrollText,
      },
    ],
  },
  {
    label: '扩展',
    items: [
      {
        key: 'users',
        label: 'C端用户',
        icon: Users,
        disabled: true,
        disabledHint: '功能开发中，敬请期待',
      },
      {
        key: 'orders',
        label: '订单管理',
        icon: ShoppingCart,
        disabled: true,
        disabledHint: '功能开发中，敬请期待',
      },
      {
        key: 'knowledge',
        label: '命理知识库',
        icon: BookOpen,
        disabled: true,
        disabledHint: '功能开发中，敬请期待',
        badge: '规划中',
      },
    ],
  },
]

export type PageKey = MenuItem['key']
