// ============================================================
// 双人合盘页（路由 `/synastry`）
// 文件：src/pages/SynastryPage.tsx
//
// 「一人管全家」的落点：档案存过一次，之后合盘下拉即选，不用再打字。
// 两边都支持两种来源 —— 已存档案 / 现场填生辰。
//
// 结果由服务端规则层算出（不调大模型），因此零等待、零模型成本、可逐条解释；
// 界面把每个维度为什么得这个分直接写出来，而不是只丢一个总分。
// ============================================================

import { useCallback, useEffect, useState } from 'react'
import BirthFields from '../components/BirthFields'
import { EmptyGuide, ErrorNotice } from '../components/StateBlocks'
import { useShell } from '../lib/shell'
import { userApi } from '../lib/user-api'
import {
  createDefaultBirthValue,
  formatBirth,
  genderText,
  relationLabel,
  toBirthPayload,
  RELATION_OPTIONS,
  type BirthProfileDto,
  type BirthValue,
} from '../lib/birth'
import { CREDIT_COSTS } from '../lib/credits'

/** 与服务端 computeSynastry 输出对齐（前端独立声明，不 import 服务端代码） */
interface SynastryDimension {
  key: string
  label: string
  score: number
  ratio: number
  comment: string
}

interface SynastrySide {
  label: string
  dayMaster: string
  dayBranch: string
  yearBranch: string
  strengthScore: number
}

interface SynastryData {
  relation: string
  relationLabel: string
  score: number
  grade: string
  verdict: string
  dimensions: SynastryDimension[]
  highlights: string[]
  cautions: string[]
  advice: string
  sides: SynastrySide[]
  cached: boolean
}

type SideMode = 'profile' | 'manual'

interface SideState {
  mode: SideMode
  profileId: number | null
  birth: BirthValue
  label: string
}

function initialSide(defaultProfileId: number | null): SideState {
  return {
    mode: defaultProfileId ? 'profile' : 'manual',
    profileId: defaultProfileId,
    birth: createDefaultBirthValue(),
    label: '',
  }
}

export default function SynastryPage() {
  const { user } = useShell()

  const [profiles, setProfiles] = useState<BirthProfileDto[]>([])
  const [sideA, setSideA] = useState<SideState>(() => initialSide(null))
  const [sideB, setSideB] = useState<SideState>(() => initialSide(null))
  const [relation, setRelation] = useState<string>('spouse')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<SynastryData | null>(null)

  // 拉取生辰档案（登录后才拉；未登录时保持空，由页面引导登录）
  useEffect(() => {
    if (!user) return
    void (async () => {
      const res = await userApi.get<{ items: BirthProfileDto[] }>(
        '/api/v1/app/user/birth-profiles',
      )
      const items = res.data?.items ?? []
      setProfiles(items)

      const def = items.find(p => p.isDefault)
      const defId = def?.id ?? items[0]?.id ?? null
      setSideA(prev => (prev.profileId === null && defId ? { ...prev, mode: 'profile', profileId: defId } : prev))
      setSideB(prev => {
        if (prev.profileId !== null) return prev
        const other = items.find(p => p.id !== defId)
        return other ? { ...prev, mode: 'profile', profileId: other.id } : { ...prev, mode: 'manual' }
      })
    })()
  }, [user])

  const buildBody = useCallback(() => {
    const a = sideA.mode === 'profile' && sideA.profileId
      ? { aProfileId: sideA.profileId }
      : { a: toBirthPayload(sideA.birth) }
    const b = sideB.mode === 'profile' && sideB.profileId
      ? { bProfileId: sideB.profileId }
      : { b: toBirthPayload(sideB.birth) }
    return {
      relation,
      ...a,
      ...b,
      ...(sideA.label.trim() ? { labelA: sideA.label.trim() } : {}),
      ...(sideB.label.trim() ? { labelB: sideB.label.trim() } : {}),
    }
  }, [sideA, sideB, relation])

  const run = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await userApi.post<SynastryData>('/api/v1/app/synastry', buildBody())
      if (!res.success || !res.data) {
        setError(res.error?.message ?? '合盘计算失败，请稍后重试')
        return
      }
      setResult(res.data)
    } finally {
      setLoading(false)
    }
  }, [buildBody])

  // 未登录：明确引导，不给一个点了必然报错的按钮
  if (!user) {
    return (
      <div className="space-y-4">
        <header>
          <h1 className="text-xl font-bold text-fg-primary tracking-wide serif">双人合盘</h1>
          <p className="mt-1 text-sm text-fg-secondary">
            夫妻 / 亲子 / 合伙人，按关系算契合度。
          </p>
        </header>
        <p className="text-sm text-fg-secondary">
          登录后才能使用合盘 —— 需要读取你保存的生辰档案，也用于扣除合盘点券。
        </p>
        <EmptyGuide />
      </div>
    )
  }

  const cost = CREDIT_COSTS.synastry?.credits ?? 20

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-bold text-fg-primary tracking-wide serif">双人合盘</h1>
        <p className="mt-1 text-sm text-fg-secondary">
          夫妻 / 亲子 / 合伙人，按关系算契合度。结论由规则算出，可逐条解释。
        </p>
      </header>

      {/* ── 双方选择 ── */}
      <div className="space-y-3">
        <SideCard
          title="甲方"
          side={sideA}
          profiles={profiles}
          onChange={setSideA}
        />
        <SideCard
          title="乙方"
          side={sideB}
          profiles={profiles}
          onChange={setSideB}
        />
      </div>

      {/* ── 关系 ── */}
      <section className="rounded-md border border-line-soft bg-white shadow-[0_1px_3px_rgba(28,25,20,0.05)] px-4 py-4">
        <label className="block text-[11px] text-fg-secondary mb-1 tracking-wide">
          关系（决定各维度权重）
        </label>
        <select
          value={relation}
          onChange={e => setRelation(e.target.value)}
          className="w-full min-h-[44px] px-3 rounded-sm border border-line-strong bg-white text-sm text-fg-primary focus:outline-none focus:border-brand"
        >
          {RELATION_OPTIONS.filter(o => o.key !== 'self').map(o => (
            <option key={o.key} value={o.key}>{o.label}</option>
          ))}
        </select>
        <p className="mt-1 text-[11px] text-fg-tertiary">
          夫妻看夫妻宫与日干相合，亲子看根基与五行生养，同事合伙看十神互补。
        </p>
      </section>

      <button
        type="button"
        onClick={() => void run()}
        disabled={loading}
        className="w-full min-h-[44px] rounded-sm bg-brand text-white text-sm tracking-wide hover:opacity-90 disabled:opacity-50 transition-opacity"
      >
        {loading ? '合盘计算中…' : `开始合盘 · ${cost} 券`}
      </button>

      {error && <ErrorNotice message={error} />}

      {/* ── 结果 ── */}
      {result && (
        <div className="animate-in fade-in duration-500 space-y-3">
          <section className="rounded-md border border-line-soft bg-white shadow-[0_1px_3px_rgba(28,25,20,0.05)] px-4 py-5">
            <div className="flex items-center gap-4">
              <ScoreRing score={result.score} />
              <div className="min-w-0">
                <p className="text-lg font-bold text-fg-primary serif">
                  {result.grade}
                  <span className="ml-2 text-xs font-normal text-fg-secondary">
                    {result.relationLabel}
                  </span>
                </p>
                <p className="mt-1 text-sm text-fg-secondary leading-relaxed">
                  {result.verdict}
                </p>
              </div>
            </div>
            {result.cached && (
              <p className="mt-2 text-[11px] text-fg-tertiary">
                结果来自缓存，本次未扣券
              </p>
            )}
          </section>

          <section className="rounded-md border border-line-soft bg-white shadow-[0_1px_3px_rgba(28,25,20,0.05)] px-4 py-4 space-y-3">
            <h3 className="text-sm font-medium text-fg-primary tracking-wide">维度拆解</h3>
            {result.dimensions.map(d => (
              <div key={d.key}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs text-fg-secondary">{d.label}</span>
                  <span className="text-xs text-fg-tertiary tabular-nums">
                    {d.score.toFixed(1)}
                  </span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-line-soft overflow-hidden">
                  <div
                    className="h-full rounded-full bg-brand transition-all duration-500"
                    style={{ width: `${Math.round(d.ratio * 100)}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-fg-secondary leading-relaxed">{d.comment}</p>
              </div>
            ))}
          </section>

          {result.highlights.length > 0 && (
            <section className="rounded-md border border-line-soft bg-white px-4 py-4">
              <h3 className="text-sm font-medium text-fg-primary tracking-wide mb-2">亮点</h3>
              <ul className="space-y-1.5">
                {result.highlights.map((h, i) => (
                  <li key={i} className="text-xs text-fg-secondary leading-relaxed">· {h}</li>
                ))}
              </ul>
            </section>
          )}

          {result.cautions.length > 0 && (
            <section className="rounded-md border border-line-soft bg-white px-4 py-4">
              <h3 className="text-sm font-medium text-fg-primary tracking-wide mb-2">需注意</h3>
              <ul className="space-y-1.5">
                {result.cautions.map((h, i) => (
                  <li key={i} className="text-xs text-fg-secondary leading-relaxed">· {h}</li>
                ))}
              </ul>
            </section>
          )}

          <section className="rounded-md border border-line-soft bg-white px-4 py-4">
            <h3 className="text-sm font-medium text-fg-primary tracking-wide mb-2">建议</h3>
            <p className="text-xs text-fg-secondary leading-relaxed">{result.advice}</p>
          </section>
        </div>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════
// 子组件
// ════════════════════════════════════════════════════════════

interface SideCardProps {
  title: string
  side: SideState
  profiles: BirthProfileDto[]
  onChange: (next: SideState) => void
}

function SideCard({ title, side, profiles, onChange }: SideCardProps) {
  return (
    <section className="rounded-md border border-line-soft bg-white shadow-[0_1px_3px_rgba(28,25,20,0.05)] px-4 py-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-fg-primary tracking-wide">{title}</h3>
        <div className="flex gap-1 text-[11px]">
          {(['profile', 'manual'] as SideMode[]).map(m => (
            <button
              key={m}
              type="button"
              onClick={() => onChange({ ...side, mode: m })}
              className={`px-2 py-1 rounded-sm border transition-colors ${
                side.mode === m
                  ? 'border-brand text-brand'
                  : 'border-line-strong text-fg-tertiary'
              }`}
            >
              {m === 'profile' ? '选档案' : '手动填'}
            </button>
          ))}
        </div>
      </div>

      {side.mode === 'profile' ? (
        <>
          <select
            value={side.profileId ?? ''}
            onChange={e => onChange({ ...side, profileId: Number(e.target.value) || null })}
            className="w-full min-h-[44px] px-3 rounded-sm border border-line-strong bg-white text-sm text-fg-primary focus:outline-none focus:border-brand"
          >
            <option value="">请选择生辰档案</option>
            {profiles.map(p => (
              <option key={p.id} value={p.id}>
                {p.label || relationLabel(p.relation) || '档案'} · {formatBirth(p)}
                {' · '}{genderText(p.gender)}
                {p.isDefault ? '（默认）' : ''}
              </option>
            ))}
          </select>
          {profiles.length === 0 && (
            <p className="mt-1 text-[11px] text-fg-tertiary">
              还没有档案，可在「我的 → 我的生辰」添加，或切到手动填写。
            </p>
          )}
        </>
      ) : (
        <>
          <BirthFields
            value={side.birth}
            onChange={patch => onChange({ ...side, birth: { ...side.birth, ...patch } })}
          />
          <input
            value={side.label}
            onChange={e => onChange({ ...side, label: e.target.value })}
            placeholder="称呼（选填，如「老妈」）"
            className="mt-2 w-full px-3 py-2 rounded-sm border border-line-strong bg-white text-sm text-fg-primary placeholder:text-fg-tertiary focus:outline-none focus:border-brand"
          />
        </>
      )}
    </section>
  )
}

function ScoreRing({ score }: { score: number }) {
  const r = 30
  const c = 2 * Math.PI * r
  const pct = Math.max(0, Math.min(100, score)) / 100
  return (
    <div className="relative shrink-0" style={{ width: 76, height: 76 }}>
      <svg width="76" height="76" viewBox="0 0 76 76" aria-hidden="true">
        <circle cx="38" cy="38" r={r} fill="none" stroke="var(--line-soft)" strokeWidth="6" />
        <circle
          cx="38" cy="38" r={r} fill="none" stroke="var(--brand)" strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          transform="rotate(-90 38 38)"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-lg font-bold text-fg-primary tabular-nums">{score}</span>
      </div>
    </div>
  )
}
