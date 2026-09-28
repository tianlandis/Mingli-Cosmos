// ============================================================
// 我的 · 用户中心（路由 `/my`）
// 文件：src/pages/MyPage.tsx
//
// 数据来源（全部为已有 C 端公开接口，本页零后端改动）：
//   - /api/v1/app/user/me            账户 + 额度 + 订阅（经 useUser）
//   - /api/v1/app/billing/orders     我的订单
// 未登录时展示登录引导，点击复用外壳层的登录弹窗。
// ============================================================

import { useEffect, useState } from 'react'
import {
  ArrowRight, BadgeCheck, CircleUser, CreditCard, Loader2,
  LogOut, Receipt, Wallet,
} from 'lucide-react'
import { userApi } from '../lib/user-api'
import { useShell } from '../lib/shell'

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
  const { user, subscription, quotaRemaining, verifying, openAuth, logout } = useShell()
  // 订单：以 owner(user.id) 标记归属；null 表示尚未加载
  const [ordersState, setOrdersState] = useState<{
    owner: number
    items: OrderItem[]
    error: string | null
  } | null>(null)

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
