import type { AnnotationResult } from '../engine/annotation'

interface Props {
  /** 批注可能尚未就绪（渲染层解耦），为 null 时展示骨架 */
  annotation: AnnotationResult | null
  dayMaster: string
}

/**
 * L1 速读层 —— 用户排盘后第一眼要看到的结论。
 *
 * 顶部「人格画像」强调卡（16 型人格，规则引擎产出，非 LLM 生成），
 * 下方三卡：日主强弱 / 格局 / 命局总览。完整内容在 L2 对应 Tab。
 */
export default function ResultSummary({ annotation, dayMaster }: Props) {
  if (!annotation) {
    return (
      <div className="space-y-3" aria-hidden="true">
        <div className="rounded-md border border-line-soft bg-white p-4 animate-pulse">
          <div className="h-3 w-16 rounded-full bg-surface-sunken mb-3" />
          <div className="h-6 w-32 rounded-sm bg-surface-sunken" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[0, 1, 2].map(i => (
            <div key={i} className="rounded-md border border-line-soft bg-white p-4 animate-pulse">
              <div className="h-3 w-16 rounded-full bg-surface-sunken mb-3" />
              <div className="h-5 w-24 rounded-sm bg-surface-sunken mb-2" />
              <div className="h-3 w-full rounded-full bg-surface-muted" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  const { strengthAnalysis, patternAnalysis, overview } = annotation
  const mbti = patternAnalysis.mbti

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
    <div className="space-y-3">
      {/* ── 人格画像（重点突出项）── */}
      {mbti.typicalTypes.length > 0 && (
        <div className="rounded-md border border-accent-purple-soft bg-accent-purple/5 p-4">
          <div className="text-[11px] text-accent-purple tracking-[0.15em] mb-1.5">人格画像</div>
          <div className="flex items-baseline gap-3 flex-wrap">
            <span
              className="text-xl font-bold text-accent-purple-deep tracking-wide"
              style={{ fontFamily: '"Noto Serif SC", serif' }}
            >
              {mbti.typicalTypes.join(' / ')}
            </span>
            {mbti.traits && <span className="text-xs text-fg-secondary">{mbti.traits}</span>}
          </div>
        </div>
      )}

      {/* ── 速读三卡 ── */}
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
    </div>
  )
}
