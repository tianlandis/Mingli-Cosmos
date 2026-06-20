// ============================================================
// Phase 4 — admin 入口：模块化仪表盘
// 文件：admin/core/index.ts
// 职责：统一导出 core 组件
// ============================================================

export { default as Layout } from './Layout'
export { default as Sidebar } from './Sidebar'
export { menuGroups, type PageKey, type MenuItem, type MenuGroup } from './menu.config'
