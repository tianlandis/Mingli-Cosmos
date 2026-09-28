// ============================================================
// 五行配色的 UI 唯一来源
// 值指向设计 token（定义于 src/index.css :root 的 --wx-*）。
// 组件禁止再自行定义五行颜色 —— 改造前 FiveElements / AnnotationPanel
// 各写了一份完全相同的副本，换肤时必然漏改。
// ============================================================

export const WX_COLOR: Record<string, string> = {
  '木': 'var(--wx-wood)',
  '火': 'var(--wx-fire)',
  '土': 'var(--wx-earth)',
  '金': 'var(--wx-metal)',
  '水': 'var(--wx-water)',
}

/** 取五行色，未知五行回退到语义层次级文字色 */
export function wxColor(name: string): string {
  return WX_COLOR[name] ?? 'var(--text-secondary)'
}
