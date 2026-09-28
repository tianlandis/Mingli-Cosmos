import type { AnnotationResult } from '../engine/annotation'

interface Props {
  /** 批注可能尚未就绪（渲染层解耦），为 null 时展示骨架 */
  annotation: AnnotationResult | null
  dayMaster: string
}

/**
 * L1 速读三卡 —— 用户排盘后第一眼要看到的三个结论：
 * 日主强弱 / 格局 / 命局总览。
 * 只做摘要，完整内容在 L2「命理解读」Tab。
 */
export default function ResultSummary({ annotation, dayMaster }: Props) {
  if (!annotation) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3" aria-hidden="true">
        {[0, 1, 2].map(i => (
          <div key={i} className="rounded-md border border-line-soft bg-white p-4 animate-pulse">
            <div className="h-3 w-16 rounded-full bg-surface-sunken mb-3" />
            <div className="h-5 w-24 rounded-sm bg-surface-sunken mb-2" />
            <div className="h-3 w-full rounded-full bg-surface-muted" />
          </div>
        ))}
      </div>
    )
  }

  const { strengthAnalysis, patternAnalysis, overview } = annotation

  const strengthTone =
    strengthAnalysis.score >= 60 ? 'var(--brand)'
      : strengthAnalysis.score >= 48 ? 'var(--semantic-attention)'
        : 'var(--semantic-info)'

  const jiXiongTone =
    patternAnalysis.jiXiong === '吉' ? 'text-semantic-positive bg-accent-green-soft'
      : patternAnalysis.jiXiong === '凶' ? 'text-brand bg-[#F5EDEB]'
        : 'text-fg-tertiary bg-surface-sunken'

  const cards = [
    {
      label: '日主强弱',
      main: <span style={{ color: strengthTone }}>{strengthAnalysis.strength}</span>,
      sub: `${dayMaster} · ${Math.round(strengthAnalysis.score)} 分`,
    },
    {
      label: '格局',
      main: patternAnalysis.patternName,
      sub: (
        <span className="inline-flex items-center gap-1.5">
          <span>{patternAnalysis.quality}格</span>
          <span className={`px-1.5 py-0.5 rounded-sm text-[11px] ${jiXiongTone}`}>
            {patternAnalysis.jiXiong}
          </span>
        </span>
      ),
    },
    {
      label: '命局总览',
      main: <span className="text-sm font-normal leading-relaxed line-clamp-3">{overview.summary}</span>,
      sub: null,
    },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {cards.map(c => (
        <div key={c.label} className="rounded-md border border-line-soft bg-white p-4">
          <div className="text-[11px] text-[#8A8172] tracking-[0.15em] mb-2">{c.label}</div>
          <div
            className="text-lg font-bold text-fg-primary mb-1"
            style={{ fontFamily: '"Noto Serif SC", serif' }}
          >
            {c.main}
          </div>
          {c.sub && <div className="text-xs text-fg-tertiary">{c.sub}</div>}
        </div>
      ))}
    </div>
  )
}
