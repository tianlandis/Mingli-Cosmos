// ============================================================
// 我的 · 用户中心（路由 `/my`）
// 文件：src/pages/MyPage.tsx
//
// 数据来源（全部为已有 C 端公开接口）：
//   - /api/v1/app/user/me            账户 + 额度 + 订阅（经 useUser）
//   - /api/v1/app/billing/orders     我的订单
//   - /api/v1/app/user/charts        我的历史命盘（P1 新增）
// 未登录时展示登录引导，点击复用外壳层的登录弹窗。
// ============================================================

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight, BadgeCheck, CalendarDays, Check, CircleUser, Copy, CreditCard, Gift, History, Loader2,
  LogOut, Receipt, Wallet,
} from 'lucide-react'
import { userApi } from '../lib/user-api'
import { useShell } from '../lib/shell'
import BirthFields from '../components/BirthFields'
import {
  createDefaultBirthValue, formatBirth, genderText, toBirthPayload,
  type BirthProfileDto, type BirthValue,
} from '../lib/birth'

interface OrderItem {
  id: number
  orderNo: string
  planName: string
  amountCents: number
  amountYuan: number
  status: string
  payMethod: string | null
  paidAt: string | null
  createdAt: string
}

interface ChartItem {
  id: string
  chartHash: string | null
  engineVersion: string | null
  createdAt: string | null
  lastActive: string | null
  birthDate: string | null
  birthTime: string | null
  gender: string | null
}

/** [ADR-013] 推介信息 */
interface ReferralInfo {
  code: string
  rewardQuota: number
  invited: number
  qualified: number
  rewarded: number
}

const VIP_LABEL: Record<string, string> = {
  free: '免费用户',
  basic: '会员',
  pro: '专业会员',
}

const ORDER_STATUS: Record<string, { label: string; tone: string }> = {
  pending: { label: '待支付', tone: 'text-semantic-attention bg-semantic-attention/10' },
  paid: { label: '已支付', tone: 'text-semantic-positive bg-semantic-positive/10' },
  cancelled: { label: '已取消', tone: 'text-fg-tertiary bg-surface-sunken' },
  refunded: { label: '已退款', tone: 'text-fg-tertiary bg-surface-sunken' },
  expired: { label: '已过期', tone: 'text-fg-tertiary bg-surface-sunken' },
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export default function MyPage() {
  const { user, subscription, quotaRemaining, verifying, openAuth, logout, loadChart, refreshUser } = useShell()
  const navigate = useNavigate()
  // 订单：以 owner(user.id) 标记归属；null 表示尚未加载
  const [ordersState, setOrdersState] = useState<{
    owner: number
    items: OrderItem[]
    error: string | null
  } | null>(null)

  // 历史命盘：同样以 owner 标记归属，避免串号
  const [chartsState, setChartsState] = useState<{
    owner: number
    items: ChartItem[]
    error: string | null
  } | null>(null)

  // [ADR-013] 推介信息
  const [referralState, setReferralState] = useState<{
    owner: number
    info: ReferralInfo | null
  } | null>(null)
  const [copied, setCopied] = useState(false)

  // [ADR-012] 生辰档案：登录后自动出盘的数据来源
  const [profilesState, setProfilesState] = useState<{
    owner: number
    items: BirthProfileDto[]
    error: string | null
  } | null>(null)
  /** 递增即触发重新拉取（增删改后的刷新开关） */
  const [profilesTick, setProfilesTick] = useState(0)
  const [addingProfile, setAddingProfile] = useState(false)
  const [draftBirth, setDraftBirth] = useState<BirthValue>(createDefaultBirthValue)
  const [draftLabel, setDraftLabel] = useState('')
  const [profileBusy, setProfileBusy] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)

  // 登录后拉取最近订单（仅在异步回调中落状态，避免 effect 内同步 setState）
  useEffect(() => {
    if (!user) return
    let cancelled = false
    const owner = user.id
    userApi.get<{ items: OrderItem[]; total: number }>('/api/v1/app/billing/orders?pageSize=6')
      .then(res => {
        if (cancelled) return
        setOrdersState(
          res.success
            ? { owner, items: res.data?.items ?? [], error: null }
            : { owner, items: [], error: res.error?.message || '订单加载失败' },
        )
      })
    return () => { cancelled = true }
  }, [user])

  // 登录后拉取历史命盘
  useEffect(() => {
    if (!user) return
    let cancelled = false
    const owner = user.id
    userApi.get<{ items: ChartItem[]; total: number }>('/api/v1/app/user/charts')
      .then(res => {
        if (cancelled) return
        setChartsState(
          res.success
            ? { owner, items: res.data?.items ?? [], error: null }
            : { owner, items: [], error: res.error?.message || '历史命盘加载失败' },
        )
      })
    return () => { cancelled = true }
  }, [user])

  // 登录后拉取推介信息
  useEffect(() => {
    if (!user) return
    let cancelled = false
    const owner = user.id
    userApi.get<ReferralInfo>('/api/v1/app/referral/me')
      .then(res => {
        if (cancelled) return
        setReferralState({ owner, info: res.success ? (res.data ?? null) : null })
      })
    return () => { cancelled = true }
  }, [user])

  // 登录后拉取生辰档案
  useEffect(() => {
    if (!user) return
    let cancelled = false
    const owner = user.id
    userApi.get<{ items: BirthProfileDto[]; total: number }>('/api/v1/app/user/birth-profiles')
      .then(res => {
        if (cancelled) return
        setProfilesState(
          res.success
            ? { owner, items: res.data?.items ?? [], error: null }
            : { owner, items: [], error: res.error?.message || '生辰档案加载失败' },
        )
      })
    return () => { cancelled = true }
  }, [user, profilesTick])

  // ── 校验登录态中 ──
  if (verifying) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-fg-secondary">
        <Loader2 size={16} className="animate-spin text-brand" aria-hidden="true" />
        正在校验登录态…
      </div>
    )
  }

  // ── 未登录：引导 ──
  if (!user) {
    return (
      <section className="rounded-md border border-line-soft bg-white p-6 text-center">
        <CircleUser size={40} className="mx-auto text-fg-tertiary mb-3" aria-hidden="true" />
        <h2 className="text-base font-bold text-fg-primary tracking-wide mb-1" style={{ fontFamily: '"Noto Serif SC", serif' }}>
          登录后查看个人中心
        </h2>
        <p className="text-xs text-fg-secondary mb-5">
          登录即可查看剩余额度、会员订阅与历史订单
        </p>
        <button
          type="button"
          onClick={() => openAuth('login')}
          className="w-full sm:w-auto sm:px-10 py-3 sm:py-2.5 rounded-sm bg-brand text-white text-sm font-medium tracking-[0.2em] hover:bg-brand-strong transition-colors"
        >
          登录 / 注册
        </button>
      </section>
    )
  }

  // 派生订单视图状态（不在 effect 中同步 setState）
  const ordersLoading = ordersState?.owner !== user.id
  const orders = ordersState?.owner === user.id ? ordersState.items : []
  const ordersError = ordersState?.owner === user.id ? ordersState.error : null

  // 派生历史命盘视图状态
  const chartsLoading = chartsState?.owner !== user.id
  const charts = chartsState?.owner === user.id ? chartsState.items : []
  const chartsError = chartsState?.owner === user.id ? chartsState.error : null

  /** 载入某份历史命盘并跳回排盘页展示 */
  const openChart = async (id: string) => {
    await loadChart(id)
    navigate('/')
  }

  // 派生推介信息
  const referral = referralState?.owner === user.id ? referralState.info : null

  // 派生生辰档案视图状态
  const profilesLoading = profilesState?.owner !== user.id
  const profiles = profilesState?.owner === user.id ? profilesState.items : []
  const profilesError = profilesState?.owner === user.id ? profilesState.error : null

  /**
   * 档案变更后：刷新本卡列表，并同步外壳上的默认档案。
   * 后者是「登录自动出盘」的依据，不同步会导致改了档案但自动出盘仍用旧值。
   */
  const afterProfileChange = async () => {
    setProfilesTick(t => t + 1)
    await refreshUser()
  }

  const saveNewProfile = async () => {
    setProfileError(null)
    setProfileBusy(true)
    try {
      const res = await userApi.post('/api/v1/app/user/birth-profiles', {
        ...(draftLabel.trim() ? { label: draftLabel.trim() } : {}),
        ...toBirthPayload(draftBirth),
      })
      if (!res.success) throw new Error(res.error?.message || '保存失败')
      setAddingProfile(false)
      setDraftLabel('')
      setDraftBirth(createDefaultBirthValue())
      await afterProfileChange()
    } catch (e) {
      setProfileError(e instanceof Error ? e.message : '保存失败')
    } finally {
      setProfileBusy(false)
    }
  }

  const makeDefaultProfile = async (id: number) => {
    setProfileError(null)
    setProfileBusy(true)
    try {
      const res = await userApi.post(`/api/v1/app/user/birth-profiles/${id}/default`)
      if (!res.success) throw new Error(res.error?.message || '设置失败')
      await afterProfileChange()
    } catch (e) {
      setProfileError(e instanceof Error ? e.message : '设置失败')
    } finally {
      setProfileBusy(false)
    }
  }

  const removeProfile = async (id: number) => {
    if (!window.confirm('删除这份生辰档案？删除后不可恢复。')) return
    setProfileError(null)
    setProfileBusy(true)
    try {
      const res = await userApi.del(`/api/v1/app/user/birth-profiles/${id}`)
      if (!res.success) throw new Error(res.error?.message || '删除失败')
      await afterProfileChange()
    } catch (e) {
      setProfileError(e instanceof Error ? e.message : '删除失败')
    } finally {
      setProfileBusy(false)
    }
  }

  /** 复制邀请码 */
  const copyCode = async () => {
    if (!referral) return
    try {
      await navigator.clipboard.writeText(referral.code)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch { /* 剪贴板不可用（非安全上下文），忽略 */ }
  }

  const quotaTotal = user.quotaTotal
  const quotaUsed = user.quotaUsed
  const usedPct = quotaTotal > 0 ? Math.min(100, Math.round((quotaUsed / quotaTotal) * 100)) : 0
  const displayName = user.nickname || user.username

  return (
    <div className="space-y-4">
      {/* ── 账户卡 ── */}
      <section className="rounded-md border border-line-soft bg-white p-5">
        <div className="flex items-center gap-4">
          <div
            className="size-14 shrink-0 rounded-full bg-brand/10 border border-brand/30 flex items-center justify-center text-brand text-xl font-bold"
            style={{ fontFamily: '"Noto Serif SC", serif' }}
            aria-hidden="true"
          >
            {displayName.slice(0, 1)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-base font-bold text-fg-primary truncate">{displayName}</span>
              <span className="px-2 py-0.5 rounded-sm text-[11px] text-brand bg-cinnabar-100 border border-cinnabar-200">
                {VIP_LABEL[user.vipLevel] || user.vipLevel}
              </span>
            </div>
            <p className="text-xs text-fg-tertiary mt-1 truncate">
              账号 {user.username} · 注册于 {fmtDate(user.createdAt)}
            </p>
          </div>
        </div>
      </section>

      {/* ── 额度卡 ── */}
      <section className="rounded-md border border-line-soft bg-white p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Wallet size={15} className="text-brand" aria-hidden="true" />
            <span className="text-sm font-bold text-fg-primary tracking-wide">剩余额度</span>
          </div>
          <span className="text-xs text-fg-tertiary tabular-nums">
            已用 {quotaUsed} / 共 {quotaTotal}
          </span>
        </div>
        <div className="flex items-baseline gap-2 mb-3">
          <span className="text-3xl font-bold text-brand tabular-nums" style={{ fontFamily: '"Noto Serif SC", serif' }}>
            {quotaRemaining}
          </span>
          <span className="text-xs text-fg-secondary">次可用</span>
        </div>
        <div
          className="h-2 rounded-full bg-surface-sunken overflow-hidden"
          role="progressbar"
          aria-valuenow={usedPct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="额度使用进度"
        >
          <div className="h-full bg-brand rounded-full transition-all" style={{ width: `${usedPct}%` }} />
        </div>
      </section>

      {/* ── 我的生辰 ── */}
      <section className="rounded-md border border-line-soft bg-white p-5">
        <div className="flex items-center gap-2 mb-1">
          <CalendarDays size={15} className="text-brand" aria-hidden="true" />
          <span className="text-sm font-bold text-fg-primary tracking-wide">我的生辰</span>
          {profiles.length > 0 && (
            <span className="ml-auto text-[11px] text-fg-tertiary tabular-nums">
              共 {profiles.length} 个
            </span>
          )}
        </div>
        <p className="text-[11px] text-fg-tertiary leading-relaxed mb-3">
          登录后自动用默认档案出盘，不需要再手填生辰。
        </p>

        {profilesLoading ? (
          <div className="flex items-center justify-center gap-2 py-6 text-xs text-fg-secondary">
            <Loader2 size={14} className="animate-spin text-brand" aria-hidden="true" />
            加载中…
          </div>
        ) : profilesError ? (
          <p className="py-6 text-center text-xs text-fg-secondary">{profilesError}</p>
        ) : profiles.length === 0 ? (
          <p className="py-5 text-center text-xs text-fg-tertiary">
            还没有生辰档案 · 添加后登录即自动出盘
          </p>
        ) : (
          <ul className="divide-y divide-line-soft list-none p-0 m-0">
            {profiles.map(p => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm text-fg-primary truncate">
                    {p.label || '生辰档案'}
                    {p.isDefault && (
                      <span className="shrink-0 px-1.5 py-0.5 rounded-sm text-[10px] text-brand bg-cinnabar-100 border border-cinnabar-200">
                        默认
                      </span>
                    )}
                  </p>
                  <p className="text-[11px] text-fg-tertiary tabular-nums mt-0.5">
                    {formatBirth(p)} · {genderText(p.gender)}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {!p.isDefault && (
                    <button
                      type="button"
                      disabled={profileBusy}
                      onClick={() => { void makeDefaultProfile(p.id) }}
                      className="px-2 py-1.5 rounded-sm text-[11px] text-fg-secondary border border-line-strong hover:bg-surface-muted transition-colors disabled:opacity-50"
                    >
                      设为默认
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={profileBusy}
                    onClick={() => { void removeProfile(p.id) }}
                    className="px-2 py-1.5 rounded-sm text-[11px] text-brand-strong border border-cinnabar-200 bg-cinnabar-100/60 hover:bg-cinnabar-100 transition-colors disabled:opacity-50"
                  >
                    删除
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {profileError && (
          <p className="mt-3 text-xs text-brand-strong bg-[#F5EDEB] border border-[#D4A8A4] rounded-sm px-3 py-2">
            {profileError}
          </p>
        )}

        {addingProfile ? (
          <div className="mt-3 pt-4 border-t border-line-soft">
            <div className="mb-3">
              <label className="block text-[11px] text-fg-secondary mb-1 tracking-wide">
                标签（选填，如「本人」「父亲」）
              </label>
              <input
                value={draftLabel}
                onChange={e => setDraftLabel(e.target.value)}
                disabled={profileBusy}
                placeholder="本人"
                className="w-full px-3 py-2 rounded-sm border border-line-strong bg-white text-sm text-fg-primary placeholder:text-fg-tertiary focus:outline-none focus:border-brand transition-colors"
              />
            </div>
            <BirthFields
              value={draftBirth}
              onChange={patch => setDraftBirth(v => ({ ...v, ...patch }))}
              disabled={profileBusy}
              compact
            />
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                disabled={profileBusy}
                onClick={() => { void saveNewProfile() }}
                className="flex-1 py-2.5 rounded-sm bg-brand text-white text-sm font-medium hover:bg-brand-strong transition-colors disabled:opacity-60 inline-flex items-center justify-center gap-2"
              >
                {profileBusy && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
                保存
              </button>
              <button
                type="button"
                disabled={profileBusy}
                onClick={() => { setAddingProfile(false); setProfileError(null) }}
                className="px-5 py-2.5 rounded-sm border border-line-strong text-sm text-fg-secondary hover:bg-surface-muted transition-colors disabled:opacity-60"
              >
                取消
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => { setProfileError(null); setAddingProfile(true) }}
            className="mt-3 w-full py-2.5 rounded-sm border border-dashed border-line-strong text-sm text-fg-secondary hover:bg-surface-muted transition-colors"
          >
            + 添加生辰档案
          </button>
        )}
      </section>

      {/* ── 历史命盘 ── */}
      <section className="rounded-md border border-line-soft bg-white p-5">
        <div className="flex items-center gap-2 mb-3">
          <History size={15} className="text-brand" aria-hidden="true" />
          <span className="text-sm font-bold text-fg-primary tracking-wide">历史命盘</span>
          {charts.length > 0 && (
            <span className="ml-auto text-[11px] text-fg-tertiary tabular-nums">共 {charts.length} 份</span>
          )}
        </div>

        {chartsLoading ? (
          <div className="flex items-center justify-center gap-2 py-6 text-xs text-fg-secondary">
            <Loader2 size={14} className="animate-spin text-brand" aria-hidden="true" />
            加载中…
          </div>
        ) : chartsError ? (
          <p className="py-6 text-center text-xs text-fg-secondary">{chartsError}</p>
        ) : charts.length === 0 ? (
          <p className="py-6 text-center text-xs text-fg-tertiary">
            暂无历史命盘 · 登录状态下推演一次会自动留存
          </p>
        ) : (
          <ul className="divide-y divide-line-soft list-none p-0 m-0">
            {charts.map(c => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => { void openChart(c.id) }}
                  className="w-full flex items-center justify-between gap-3 py-3 text-left hover:bg-surface-muted rounded-sm transition-colors"
                >
                  <div className="min-w-0 flex items-center gap-2.5">
                    <CalendarDays size={15} className="text-fg-tertiary shrink-0" aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="text-sm text-fg-primary truncate tabular-nums">
                        {c.birthDate ?? '—'}{c.birthTime ? ` ${c.birthTime}` : ''}
                      </p>
                      <p className="text-[11px] text-fg-tertiary tabular-nums mt-0.5">
                        {c.gender ? `${c.gender}命` : '—'} · 更新于 {fmtDate(c.lastActive || c.createdAt)}
                      </p>
                    </div>
                  </div>
                  <ArrowRight size={14} className="text-fg-tertiary shrink-0" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── 推荐有礼 ── */}
      <section className="rounded-md border border-line-soft bg-white p-5">
        <div className="flex items-center gap-2 mb-3">
          <Gift size={15} className="text-brand" aria-hidden="true" />
          <span className="text-sm font-bold text-fg-primary tracking-wide">推荐有礼</span>
        </div>

        {referral ? (
          <>
            <p className="text-xs text-fg-secondary leading-relaxed mb-3">
              好友注册时填写你的邀请码，好友首次付费后你可得
              <span className="text-brand font-bold"> {referral.rewardQuota} </span>次额度
            </p>
            <div className="flex items-stretch gap-2 mb-4">
              <code className="flex-1 flex items-center justify-center px-3 py-2 rounded-sm bg-surface-sunken border border-line-strong text-sm font-bold tracking-[0.25em] text-fg-primary tabular-nums select-all">
                {referral.code}
              </code>
              <button
                type="button"
                onClick={() => { void copyCode() }}
                className="shrink-0 px-3 rounded-sm border border-line-strong text-xs text-fg-secondary hover:bg-surface-muted transition-colors inline-flex items-center gap-1.5"
              >
                {copied
                  ? <Check size={13} className="text-semantic-positive" aria-hidden="true" />
                  : <Copy size={13} aria-hidden="true" />}
                {copied ? '已复制' : '复制'}
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                { label: '已邀请', value: referral.invited },
                { label: '已付费', value: referral.qualified },
                { label: '已获奖', value: referral.rewarded },
              ].map(s => (
                <div key={s.label} className="rounded-sm bg-surface-sunken py-2.5">
                  <p className="text-lg font-bold text-fg-primary tabular-nums" style={{ fontFamily: '"Noto Serif SC", serif' }}>
                    {s.value}
                  </p>
                  <p className="text-[11px] text-fg-tertiary mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="py-3 text-center text-xs text-fg-tertiary">邀请信息加载中…</p>
        )}
      </section>

      {/* ── 订阅卡 ── */}
      <section className="rounded-md border border-line-soft bg-white p-5">
        <div className="flex items-center gap-2 mb-3">
          <BadgeCheck size={15} className="text-brand" aria-hidden="true" />
          <span className="text-sm font-bold text-fg-primary tracking-wide">我的订阅</span>
        </div>
        {subscription ? (
          <div className="text-sm text-fg-secondary space-y-1">
            <p className="text-fg-primary font-medium">
              {VIP_LABEL[subscription.vipLevel] || subscription.vipLevel}
            </p>
            <p className="text-xs text-fg-tertiary tabular-nums">
              有效期 {fmtDate(subscription.startsAt)} 至 {fmtDate(subscription.endsAt)}
            </p>
          </div>
        ) : (
          <p className="text-xs text-fg-secondary">当前无订阅 · 升级后可解锁更多推演次数</p>
        )}
      </section>

      {/* ── 我的订单 ── */}
      <section className="rounded-md border border-line-soft bg-white p-5">
        <div className="flex items-center gap-2 mb-3">
          <Receipt size={15} className="text-brand" aria-hidden="true" />
          <span className="text-sm font-bold text-fg-primary tracking-wide">我的订单</span>
        </div>

        {ordersLoading ? (
          <div className="flex items-center justify-center gap-2 py-6 text-xs text-fg-secondary">
            <Loader2 size={14} className="animate-spin text-brand" aria-hidden="true" />
            加载中…
          </div>
        ) : ordersError ? (
          <p className="py-6 text-center text-xs text-fg-secondary">{ordersError}</p>
        ) : orders.length === 0 ? (
          <p className="py-6 text-center text-xs text-fg-tertiary">暂无订单</p>
        ) : (
          <ul className="divide-y divide-line-soft list-none p-0 m-0">
            {orders.map(o => {
              const st = ORDER_STATUS[o.status] ?? { label: o.status, tone: 'text-fg-tertiary bg-surface-sunken' }
              return (
                <li key={o.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="text-sm text-fg-primary truncate">{o.planName}</p>
                    <p className="text-[11px] text-fg-tertiary tabular-nums mt-0.5">
                      {fmtDate(o.createdAt)} · {o.orderNo}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="text-sm font-medium text-fg-primary tabular-nums">¥{o.amountYuan}</span>
                    <span className={`px-1.5 py-0.5 rounded-sm text-[10px] ${st.tone}`}>{st.label}</span>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* ── 账户操作 ── */}
      <section className="rounded-md border border-line-soft bg-white p-2">
        <button
          type="button"
          onClick={() => { void logout() }}
          className="w-full flex items-center justify-between px-3 py-3 rounded-sm text-sm text-fg-secondary hover:bg-surface-muted transition-colors"
        >
          <span className="inline-flex items-center gap-2">
            <LogOut size={15} aria-hidden="true" />
            退出登录
          </span>
          <ArrowRight size={14} className="text-fg-tertiary" aria-hidden="true" />
        </button>
      </section>

      <p className="text-center text-[11px] text-fg-tertiary tracking-wider pt-1">
        <CreditCard size={11} className="inline align-[-1px] mr-1" aria-hidden="true" />
        订单与支付功能尚在完善中，仅作展示
      </p>
    </div>
  )
}
