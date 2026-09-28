// ============================================================
// UI-9 — 日主强弱进度条
// 文件：src/components/DayMasterStrength.tsx
// 数据：annotation.strengthAnalysis（score 0-100 + 五维分量 + 判断依据）
// ============================================================

import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import type { StrengthAnalysis } from '../engine/annotation/types'

interface Props {
  analysis: StrengthAnalysis
  dayMaster: string
}

/** 等级区间边界（与引擎 scoreToStrength 保持一致） */
const BANDS: Array<{ label: string; min: number; max: number }> = [
  { label: '极弱', min: 0, max: 15 },
  { label: '弱', min: 15, max: 28 },
  { label: '中和偏弱', min: 28, max: 38 },
  { label: '中和', min: 38, max: 48 },
  { label: '中和偏强', min: 48, max: 60 },
  { label: '强', min: 60, max: 75 },
  { label: '极强', min: 75, max: 100 },
]

/** 分数 → 颜色（弱偏冷、中和居中、强偏朱砂） */
function scoreColor(score: number): string {
  if (score < 28) return 'var(--semantic-info)'       // 弱：靛青
  if (score < 48) return 'var(--text-secondary)'      // 中和偏弱：墨灰
  if (score < 60) return 'var(--semantic-attention)'  // 中和偏强：土金
  return 'var(--brand)'                               // 强：朱砂
}

export default function DayMasterStrength({ analysis, dayMaster }: Props) {
  const [showReasons, setShowReasons] = useState(false)
  const { score, strength, confidence, components, reasons } = analysis
  const color = scoreColor(score)
  const pct = Math.max(0, Math.min(100, score))

  const items = [
    { label: '月令', value: components.yueLing },
    { label: '地支根气', value: components.diZhiGen },
    { label: '天干比劫', value: components.tianGanBiJie },
    { label: '生扶', value: components.shengFu },
    { label: '克泄耗', value: components.keXieHao },
  ]
  const maxComponent = Math.max(1, ...items.map(i => Math.abs(i.value)))

  return (
    <section>
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="chapter-title mb-0">日主强弱</h3>
        <span className="text-[11px] text-[#8A8172]">
          置信度 {(confidence * 100).toFixed(0)}%
        </span>
      </div>

      {/* 主条：等级徽章 + 分数 */}
      <div className="flex items-center gap-3 mb-2">
        <span
          className="inline-flex items-center justify-center min-w-[3.5rem] px-2 py-1 rounded-sm text-xs font-bold tracking-wider"
          style={{ color, border: `1.5px solid ${color}`, background: `${color}0F` }}
        >
          {strength}
        </span>
        <div className="flex-1">
          <div className="relative h-3 bg-[#E8E3D9] rounded-full overflow-visible">
            {/* 已填充 */}
            <div
              className="absolute left-0 top-0 h-full rounded-full transition-all duration-700 ease-out"
              style={{ width: `${pct}%`, backgroundColor: `${color}CC` }}
            />
            {/* 指针 */}
            <div
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 size-3.5 rounded-full border-2 border-white shadow-sm transition-all duration-700 ease-out"
              style={{ left: `${pct}%`, backgroundColor: color }}
            />
          </div>
          {/* 刻度标签 */}
          <div className="relative h-4 mt-1">
            {BANDS.map(b => {
              // 每个区间的中点作为标签位置
              const mid = ((b.min + b.max) / 2)
              return (
                <span
                  key={b.label}
                  className="absolute -translate-x-1/2 text-[9px] whitespace-nowrap"
                  style={{
                    left: `${mid}%`,
                    color: score >= b.min && score < b.max ? color : 'var(--text-tertiary)',
                    fontWeight: score >= b.min && score < b.max ? 700 : 400,
                  }}
                >
                  {b.label}
                </span>
              )
            })}
          </div>
        </div>
        <span
          className="w-12 text-right text-xl font-bold tabular-nums"
          style={{ color, fontFamily: '"Noto Serif SC", serif' }}
        >
          {Math.round(score)}
        </span>
      </div>

      {/* 五维分量 */}
      <div className="grid grid-cols-5 gap-2 mt-3">
        {items.map(i => (
          <div key={i.label} className="text-center">
            <div className="h-1.5 bg-[#E8E3D9] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.max(6, (Math.abs(i.value) / maxComponent) * 100)}%`,
                  backgroundColor: i.label === '克泄耗' ? '#8A8172' : 'var(--semantic-attention)',
                }}
              />
            </div>
            <p className="text-[10px] text-[#8A8172] mt-1">{i.label}</p>
            <p className="text-xs font-medium text-fg-primary tabular-nums">
              {Math.round(i.value)}
            </p>
          </div>
        ))}
      </div>

      {/* 判断依据（可折叠） */}
      {reasons.length > 0 && (
        <div className="mt-3">
          <button
            onClick={() => setShowReasons(v => !v)}
            className="flex items-center gap-1 text-[11px] text-fg-secondary hover:text-brand transition-colors"
          >
            {showReasons ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            判断依据（{reasons.length} 条）
          </button>
          {showReasons && (
            <ul className="mt-2 space-y-1">
              {reasons.map((r, i) => (
                <li key={i} className="text-xs text-fg-secondary leading-relaxed flex gap-1.5">
                  <span className="text-fg-tertiary">·</span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <p className="sr-only">
        日主 {dayMaster} 强弱得分为 {Math.round(score)} 分，等级 {strength}
      </p>
    </section>
  )
}
