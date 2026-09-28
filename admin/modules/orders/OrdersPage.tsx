// ============================================================
// Phase 4b M-7 — 管理后台：订单管理 + 套餐管理
// 文件：admin/modules/orders/OrdersPage.tsx
// 功能：订单列表/统计/详情/确认收款/退款/维护 + 套餐 CRUD（Tab 切换）
// ============================================================

import { useCallback, useEffect, useState } from 'react'
import {
  Card, CardHeader, CardTitle, CardDescription, CardContent,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { api } from '../../lib/api'
import {
  ShoppingCart,
  Search,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Undo2,
  Package,
  Plus,
  Pencil,
  Trash2,
  Wrench,
} from 'lucide-react'

// ═══════════════════════════════════════
// 类型
// ═══════════════════════════════════════

interface OrderRow {
  id: number
  orderNo: string
  userId: number
  planId: number | null
  planName: string
  amountCents: number
  amountYuan?: number
  status: string
  payMethod: string | null
  tradeNo: string | null
  paidAt: string | null
  refundedAt: string | null
  expiredAt: string | null
  remark: string | null
  createdAt: string
  updatedAt: string
  username: string | null
}

interface OrderStats {
  total: number
  pending: number
  paid: number
  cancelled: number
  refunded: number
  revenueCents: number
  revenueYuan: number
  revenueTodayYuan: number
  activeSubscriptions: number
}

interface PlanRow {
  id: number
  code: string
  name: string
  priceCents: number
  priceYuan?: number
  durationDays: number
  quotaGrant: number
  vipLevel: string
  features: string[]
  description: string | null
  isActive: number
  sortOrder: number
}

const PAGE_SIZE = 20

const STATUS_LABEL: Record<string, string> = {
  pending: '待支付',
  paid: '已支付',
  cancelled: '已取消',
  refunded: '已退款',
}

const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  paid: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  cancelled: 'bg-white/[0.04] text-[#6B6459] border-white/[0.08]',
  refunded: 'bg-red-500/10 text-red-400 border-red-500/20',
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// ═══════════════════════════════════════
// 主页面
// ═══════════════════════════════════════

export default function OrdersPage() {
  const [tab, setTab] = useState<'orders' | 'plans'>('orders')

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="size-8 flex items-center justify-center rounded-lg bg-[#B8964A]/10 border border-[#B8964A]/20">
              <ShoppingCart size={16} className="text-[#B8964A]" />
            </div>
            <h2 className="text-xl font-semibold text-[#EDE8DF] tracking-[0.04em]">订单与订阅</h2>
          </div>
          <p className="text-sm text-[#6B6459] mt-1 ml-[42px]">
            订单流水 · 收款确认 · 退款回收 · 套餐配置
          </p>
        </div>
        <div className="flex items-center gap-1 p-1 rounded-lg bg-white/[0.03] border border-white/[0.06]">
          {(['orders', 'plans'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                'px-3 py-1.5 rounded-md text-sm transition-colors',
                tab === t
                  ? 'bg-[#B8964A]/15 text-[#B8964A]'
                  : 'text-[#6B6459] hover:text-[#A09888]',
              )}
            >
              {t === 'orders' ? '订单' : '套餐'}
            </button>
          ))}
        </div>
      </div>

      {tab === 'orders' ? <OrdersPanel /> : <PlansPanel />}
    </div>
  )
}

// ═══════════════════════════════════════
// 订单面板
// ═══════════════════════════════════════

function OrdersPanel() {
  const [items, setItems] = useState<OrderRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('')
  const [keyword, setKeyword] = useState('')
  const [keywordInput, setKeywordInput] = useState('')
  const [stats, setStats] = useState<OrderStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  // 弹窗
  const [refundTarget, setRefundTarget] = useState<OrderRow | null>(null)
  const [refundReason, setRefundReason] = useState('')
  const [confirmTarget, setConfirmTarget] = useState<OrderRow | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const qs = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
      if (status) qs.set('status', status)
      if (keyword) qs.set('keyword', keyword)

      const [listRes, statsRes] = await Promise.all([
        api.get<{ items: OrderRow[]; total: number }>(`/api/v1/admin/orders?${qs.toString()}`),
        api.get<OrderStats>('/api/v1/admin/orders/stats'),
      ])
      if (!listRes.success) throw new Error(listRes.error?.message || '加载失败')
      setItems(listRes.data?.items ?? [])
      setTotal(listRes.data?.total ?? 0)
      if (statsRes.success) setStats(statsRes.data ?? null)
      setError(null)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [page, status, keyword])

  useEffect(() => { load() }, [load])

  function notify(type: 'ok' | 'err', text: string) {
    setMsg({ type, text })
    setTimeout(() => setMsg(null), 3500)
  }

  async function confirmPayment() {
    if (!confirmTarget) return
    setBusy(true)
    const res = await api.post(`/api/v1/admin/orders/${confirmTarget.id}/confirm`, {
      payMethod: 'offline',
    })
    setBusy(false)
    if (res.success) {
      notify('ok', `订单 ${confirmTarget.orderNo} 已确认收款，订阅权益已发放`)
      setConfirmTarget(null)
      load()
    } else {
      notify('err', res.error?.message || '操作失败')
    }
  }

  async function submitRefund() {
    if (!refundTarget) return
    setBusy(true)
    const res = await api.post(`/api/v1/admin/orders/${refundTarget.id}/refund`, {
      reason: refundReason || undefined,
    })
    setBusy(false)
    if (res.success) {
      const d = res.data as any
      notify('ok', `已退款，撤销订阅 ${d?.revokedSubscriptions ?? 0} 条，回收额度 ${d?.quotaRevoked ?? 0}`)
      setRefundTarget(null)
      setRefundReason('')
      load()
    } else {
      notify('err', res.error?.message || '退款失败')
    }
  }

  async function runMaintenance() {
    setBusy(true)
    const res = await api.post('/api/v1/admin/orders/maintenance')
    setBusy(false)
    if (res.success) {
      const d = res.data as any
      notify('ok', `维护完成：关闭超时订单 ${d?.expiredOrders ?? 0} 笔，标记过期订阅 ${d?.expiredSubscriptions ?? 0} 条`)
      load()
    } else {
      notify('err', res.error?.message || '执行失败')
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <>
      {/* 统计 */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <MiniStat label="累计收入" value={`¥${stats?.revenueYuan ?? '—'}`} tone="ok" />
        <MiniStat label="今日收入" value={`¥${stats?.revenueTodayYuan ?? '—'}`} tone="ok" />
        <MiniStat label="已支付" value={stats?.paid ?? '—'} />
        <MiniStat label="待支付" value={stats?.pending ?? '—'} tone="warn" />
        <MiniStat label="已退款" value={stats?.refunded ?? '—'} tone="bad" />
        <MiniStat label="有效订阅" value={stats?.activeSubscriptions ?? '—'} />
      </div>

      {msg && (
        <div className={cn(
          'px-4 py-2.5 rounded-lg border text-sm',
          msg.type === 'ok'
            ? 'bg-emerald-500/8 border-emerald-500/20 text-emerald-400'
            : 'bg-red-500/8 border-red-500/20 text-red-400',
        )}>
          {msg.text}
        </div>
      )}

      {/* 筛选 */}
      <Card className="bg-[#1A1F2E] border-white/[0.06]">
        <CardContent className="p-4 flex flex-col md:flex-row gap-3">
          <div className="flex-1 flex gap-2">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B6459]" />
              <Input
                value={keywordInput}
                onChange={e => setKeywordInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { setPage(1); setKeyword(keywordInput.trim()) } }}
                placeholder="搜索订单号 / 套餐名"
                className="pl-9 h-9 bg-[#0A1118] border-white/[0.08] text-[#EDE8DF] placeholder:text-[#4A4540]"
              />
            </div>
            <Button
              onClick={() => { setPage(1); setKeyword(keywordInput.trim()) }}
              className="h-9 bg-[#B8964A] hover:bg-[#D8C08A] text-[#0A1118] font-medium px-4"
            >
              搜索
            </Button>
          </div>
          <Select
            value={status}
            onChange={e => { setStatus(e.target.value); setPage(1) }}
            className="h-9 w-36 bg-[#0A1118] border-white/[0.08]"
          >
            <option value="">全部状态</option>
            <option value="pending">待支付</option>
            <option value="paid">已支付</option>
            <option value="cancelled">已取消</option>
            <option value="refunded">已退款</option>
          </Select>
          <Button
            variant="outline"
            onClick={runMaintenance}
            disabled={busy}
            className="h-9 border-white/[0.08] text-[#A09888] hover:text-[#D8D2C8]"
          >
            <Wrench size={13} className="mr-1.5" />
            清理超时
          </Button>
        </CardContent>
      </Card>

      {/* 表格 */}
      <Card className="bg-[#1A1F2E] border-white/[0.06] overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium text-[#D8D2C8]">订单列表</CardTitle>
          <CardDescription className="text-xs text-[#6B6459]">
            共 {total} 笔订单 · 第 {page} / {totalPages} 页
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {error ? (
            <div className="py-10 text-center space-y-3">
              <p className="text-red-400 text-sm">{error}</p>
              <Button onClick={load} variant="outline" className="border-[#B8964A]/30 text-[#B8964A]">重试</Button>
            </div>
          ) : loading && items.length === 0 ? (
            <div className="p-6 space-y-2">
              {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-10 w-full bg-white/[0.04]" />)}
            </div>
          ) : items.length === 0 ? (
            <div className="py-16 text-center">
              <Package size={28} className="mx-auto text-[#4A4540] mb-3" />
              <p className="text-sm text-[#6B6459]">暂无订单</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-white/[0.06]">
                  <TableHead className="text-[11px] text-[#6B6459]">订单号</TableHead>
                  <TableHead className="text-[11px] text-[#6B6459] hidden md:table-cell">用户</TableHead>
                  <TableHead className="text-[11px] text-[#6B6459]">套餐</TableHead>
                  <TableHead className="text-[11px] text-[#6B6459]">金额</TableHead>
                  <TableHead className="text-[11px] text-[#6B6459]">状态</TableHead>
                  <TableHead className="text-[11px] text-[#6B6459] hidden lg:table-cell">支付时间</TableHead>
                  <TableHead className="text-[11px] text-[#6B6459] text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map(o => (
                  <TableRow key={o.id} className="border-white/[0.03] hover:bg-white/[0.02]">
                    <TableCell className="text-xs font-mono text-[#A09888]">{o.orderNo}</TableCell>
                    <TableCell className="text-xs text-[#A09888] hidden md:table-cell">
                      {o.username ?? `#${o.userId}`}
                    </TableCell>
                    <TableCell className="text-sm text-[#EDE8DF]">{o.planName}</TableCell>
                    <TableCell className="text-sm font-mono tabular-nums text-[#EDE8DF]">
                      ¥{(o.amountYuan ?? o.amountCents / 100).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Badge className={cn('text-[10px] border', STATUS_STYLE[o.status] || STATUS_STYLE.cancelled)}>
                        {STATUS_LABEL[o.status] || o.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-[#6B6459] hidden lg:table-cell whitespace-nowrap">
                      {formatDateTime(o.paidAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      {o.status === 'pending' && (
                        <Button
                          size="sm"
                          onClick={() => setConfirmTarget(o)}
                          className="h-7 text-[11px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/25"
                        >
                          <CheckCircle2 size={12} className="mr-1" />
                          确认收款
                        </Button>
                      )}
                      {o.status === 'paid' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setRefundTarget(o)}
                          className="h-7 text-[11px] border-red-500/20 text-red-400 hover:bg-red-500/10"
                        >
                          <Undo2 size={12} className="mr-1" />
                          退款
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-white/[0.06]">
              <span className="text-xs text-[#6B6459]">
                显示第 {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} 条
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline" size="sm" disabled={page <= 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  className="h-7 border-white/[0.08] text-[#A09888]"
                >
                  <ChevronLeft size={13} /> 上一页
                </Button>
                <Button
                  variant="outline" size="sm" disabled={page >= totalPages}
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  className="h-7 border-white/[0.08] text-[#A09888]"
                >
                  下一页 <ChevronRight size={13} />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 确认收款 */}
      <Dialog open={!!confirmTarget} onOpenChange={open => !open && setConfirmTarget(null)}>
        <DialogContent className="bg-[#1A1F2E] border-white/[0.08] text-[#EDE8DF] max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#EDE8DF]">确认收款</DialogTitle>
            <DialogDescription className="text-[#6B6459]">
              适用于线下转账等场景。确认后订单标记为已支付，并立即发放订阅权益与额度。
            </DialogDescription>
          </DialogHeader>
          {confirmTarget && (
            <div className="space-y-2">
              <Row label="订单号" value={confirmTarget.orderNo} />
              <Row label="套餐" value={confirmTarget.planName} />
              <Row label="金额" value={`¥${(confirmTarget.amountCents / 100).toFixed(2)}`} />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmTarget(null)} className="border-white/[0.08] text-[#A09888]">
              取消
            </Button>
            <Button
              onClick={confirmPayment}
              disabled={busy}
              className="bg-emerald-500/90 hover:bg-emerald-500 text-white"
            >
              {busy ? '处理中...' : '确认已收款'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 退款 */}
      <Dialog open={!!refundTarget} onOpenChange={open => !open && setRefundTarget(null)}>
        <DialogContent className="bg-[#1A1F2E] border-red-500/20 text-[#EDE8DF] max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-400">订单退款</DialogTitle>
            <DialogDescription className="text-[#6B6459]">
              退款将撤销该订单关联的订阅，并回收已发放的额度；若用户无其它有效订阅会降级为免费。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {refundTarget && (
              <div className="space-y-2">
                <Row label="订单号" value={refundTarget.orderNo} />
                <Row label="金额" value={`¥${(refundTarget.amountCents / 100).toFixed(2)}`} />
              </div>
            )}
            <div>
              <Label className="text-[11px] text-[#6B6459] mb-1.5 block">退款原因（写入审计日志）</Label>
              <Input
                value={refundReason}
                onChange={e => setRefundReason(e.target.value)}
                placeholder="如：用户申请 / 重复下单"
                className="h-9 bg-[#0A1118] border-white/[0.08] text-[#EDE8DF] placeholder:text-[#4A4540]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefundTarget(null)} className="border-white/[0.08] text-[#A09888]">
              取消
            </Button>
            <Button onClick={submitRefund} disabled={busy} className="bg-red-500/90 hover:bg-red-500 text-white">
              {busy ? '处理中...' : '确认退款'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ═══════════════════════════════════════
// 套餐面板
// ═══════════════════════════════════════

interface PlanFormState {
  id: number | null
  code: string
  name: string
  priceYuan: string
  durationDays: string
  quotaGrant: string
  vipLevel: string
  description: string
  isActive: boolean
}

const EMPTY_FORM: PlanFormState = {
  id: null, code: '', name: '', priceYuan: '', durationDays: '30',
  quotaGrant: '0', vipLevel: 'basic', description: '', isActive: true,
}

function PlansPanel() {
  const [items, setItems] = useState<PlanRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [form, setForm] = useState<PlanFormState | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<PlanRow | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get<PlanRow[]>('/api/v1/admin/orders/plans')
      if (!res.success) throw new Error(res.error?.message || '加载失败')
      setItems(res.data ?? [])
      setError(null)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  function notify(type: 'ok' | 'err', text: string) {
    setMsg({ type, text })
    setTimeout(() => setMsg(null), 3500)
  }

  async function submitForm() {
    if (!form) return
    setBusy(true)
    const payload = {
      code: form.code.trim(),
      name: form.name.trim(),
      priceCents: Math.round(Number(form.priceYuan) * 100),
      durationDays: Number(form.durationDays),
      quotaGrant: Number(form.quotaGrant),
      vipLevel: form.vipLevel,
      description: form.description || undefined,
      isActive: form.isActive ? 1 : 0,
    }
    const res = form.id
      ? await api.put(`/api/v1/admin/orders/plans/${form.id}`, payload)
      : await api.post('/api/v1/admin/orders/plans', payload)
    setBusy(false)
    if (res.success) {
      notify('ok', form.id ? '套餐已更新' : '套餐已创建')
      setForm(null)
      load()
    } else {
      notify('err', res.error?.message || '保存失败')
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setBusy(true)
    const res = await api.delete(`/api/v1/admin/orders/plans/${deleteTarget.id}`)
    setBusy(false)
    if (res.success) {
      notify('ok', `已删除套餐 ${deleteTarget.name}`)
      setDeleteTarget(null)
      load()
    } else {
      notify('err', res.error?.message || '删除失败')
    }
  }

  return (
    <>
      <div className="flex justify-end">
        <Button
          onClick={() => setForm({ ...EMPTY_FORM })}
          className="bg-[#B8964A] hover:bg-[#D8C08A] text-[#0A1118] font-medium"
        >
          <Plus size={14} className="mr-1.5" />
          新建套餐
        </Button>
      </div>

      {msg && (
        <div className={cn(
          'px-4 py-2.5 rounded-lg border text-sm',
          msg.type === 'ok'
            ? 'bg-emerald-500/8 border-emerald-500/20 text-emerald-400'
            : 'bg-red-500/8 border-red-500/20 text-red-400',
        )}>
          {msg.text}
        </div>
      )}

      <Card className="bg-[#1A1F2E] border-white/[0.06] overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium text-[#D8D2C8]">套餐列表</CardTitle>
          <CardDescription className="text-xs text-[#6B6459]">
            共 {items.length} 个套餐 · C 端仅展示启用中的套餐
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {error ? (
            <div className="py-10 text-center text-red-400 text-sm">{error}</div>
          ) : loading ? (
            <div className="p-6 space-y-2">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full bg-white/[0.04]" />)}
            </div>
          ) : items.length === 0 ? (
            <div className="py-16 text-center text-sm text-[#6B6459]">暂无套餐</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-white/[0.06]">
                  <TableHead className="text-[11px] text-[#6B6459]">编码</TableHead>
                  <TableHead className="text-[11px] text-[#6B6459]">名称</TableHead>
                  <TableHead className="text-[11px] text-[#6B6459]">价格</TableHead>
                  <TableHead className="text-[11px] text-[#6B6459]">时长</TableHead>
                  <TableHead className="text-[11px] text-[#6B6459]">赠送额度</TableHead>
                  <TableHead className="text-[11px] text-[#6B6459]">等级</TableHead>
                  <TableHead className="text-[11px] text-[#6B6459]">状态</TableHead>
                  <TableHead className="text-[11px] text-[#6B6459] text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map(p => (
                  <TableRow key={p.id} className="border-white/[0.03] hover:bg-white/[0.02]">
                    <TableCell className="text-xs font-mono text-[#A09888]">{p.code}</TableCell>
                    <TableCell className="text-sm text-[#EDE8DF]">{p.name}</TableCell>
                    <TableCell className="text-sm font-mono tabular-nums text-[#EDE8DF]">
                      ¥{(p.priceYuan ?? p.priceCents / 100).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-xs text-[#A09888]">{p.durationDays} 天</TableCell>
                    <TableCell className="text-xs font-mono text-[#A09888]">{p.quotaGrant}</TableCell>
                    <TableCell className="text-xs text-[#A09888]">{p.vipLevel}</TableCell>
                    <TableCell>
                      <Badge className={cn('text-[10px] border', p.isActive === 1
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : 'bg-white/[0.04] text-[#6B6459] border-white/[0.08]')}>
                        {p.isActive === 1 ? '启用' : '下架'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          title="编辑"
                          onClick={() => setForm({
                            id: p.id,
                            code: p.code,
                            name: p.name,
                            priceYuan: String(p.priceCents / 100),
                            durationDays: String(p.durationDays),
                            quotaGrant: String(p.quotaGrant),
                            vipLevel: p.vipLevel,
                            description: p.description ?? '',
                            isActive: p.isActive === 1,
                          })}
                          className="size-7 flex items-center justify-center rounded text-[#6B6459] hover:text-[#B8964A] hover:bg-[#B8964A]/10 transition-colors"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          title="删除"
                          onClick={() => setDeleteTarget(p)}
                          className="size-7 flex items-center justify-center rounded text-[#6B6459] hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 新建 / 编辑 */}
      <Dialog open={!!form} onOpenChange={open => !open && setForm(null)}>
        <DialogContent className="bg-[#1A1F2E] border-white/[0.08] text-[#EDE8DF] max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-[#EDE8DF]">{form?.id ? '编辑套餐' : '新建套餐'}</DialogTitle>
            <DialogDescription className="text-[#6B6459]">
              编码创建后不建议修改；价格单位为元，保存时自动换算为分
            </DialogDescription>
          </DialogHeader>
          {form && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="套餐编码">
                <Input
                  value={form.code}
                  disabled={!!form.id}
                  onChange={e => setForm({ ...form, code: e.target.value })}
                  placeholder="monthly"
                  className="h-9 bg-[#0A1118] border-white/[0.08] text-[#EDE8DF] placeholder:text-[#4A4540]"
                />
              </Field>
              <Field label="套餐名称">
                <Input
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="月度会员"
                  className="h-9 bg-[#0A1118] border-white/[0.08] text-[#EDE8DF] placeholder:text-[#4A4540]"
                />
              </Field>
              <Field label="价格（元）">
                <Input
                  type="number"
                  value={form.priceYuan}
                  onChange={e => setForm({ ...form, priceYuan: e.target.value })}
                  className="h-9 bg-[#0A1118] border-white/[0.08] text-[#EDE8DF]"
                />
              </Field>
              <Field label="订阅时长（天）">
                <Input
                  type="number"
                  value={form.durationDays}
                  onChange={e => setForm({ ...form, durationDays: e.target.value })}
                  className="h-9 bg-[#0A1118] border-white/[0.08] text-[#EDE8DF]"
                />
              </Field>
              <Field label="赠送额度（次）">
                <Input
                  type="number"
                  value={form.quotaGrant}
                  onChange={e => setForm({ ...form, quotaGrant: e.target.value })}
                  className="h-9 bg-[#0A1118] border-white/[0.08] text-[#EDE8DF]"
                />
              </Field>
              <Field label="会员等级">
                <Select
                  value={form.vipLevel}
                  onChange={e => setForm({ ...form, vipLevel: e.target.value })}
                  className="h-9 bg-[#0A1118] border-white/[0.08]"
                >
                  <option value="free">免费</option>
                  <option value="basic">会员</option>
                  <option value="pro">专业</option>
                </Select>
              </Field>
              <div className="col-span-2">
                <Field label="说明">
                  <Input
                    value={form.description}
                    onChange={e => setForm({ ...form, description: e.target.value })}
                    placeholder="套餐卖点描述"
                    className="h-9 bg-[#0A1118] border-white/[0.08] text-[#EDE8DF] placeholder:text-[#4A4540]"
                  />
                </Field>
              </div>
              <div className="col-span-2 flex items-center gap-2">
                <Switch
                  checked={form.isActive}
                  onCheckedChange={v => setForm({ ...form, isActive: v })}
                />
                <span className="text-xs text-[#A09888]">启用（C 端可见并可购买）</span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(null)} className="border-white/[0.08] text-[#A09888]">
              取消
            </Button>
            <Button
              onClick={submitForm}
              disabled={busy || !form?.code || !form?.name}
              className="bg-[#B8964A] hover:bg-[#D8C08A] text-[#0A1118] font-medium"
            >
              {busy ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除套餐 */}
      <Dialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <DialogContent className="bg-[#1A1F2E] border-red-500/20 text-[#EDE8DF] max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-400">删除套餐</DialogTitle>
            <DialogDescription className="text-[#6B6459]">
              确定删除 <span className="text-[#EDE8DF]">{deleteTarget?.name}</span> ？
              历史订单仍会保留套餐名快照。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} className="border-white/[0.08] text-[#A09888]">
              取消
            </Button>
            <Button onClick={confirmDelete} disabled={busy} className="bg-red-500/90 hover:bg-red-500 text-white">
              {busy ? '删除中...' : '确认删除'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ═══════════════════════════════════════
// 通用子组件
// ═══════════════════════════════════════

function MiniStat({ label, value, tone }: { label: string; value: string | number; tone?: 'ok' | 'bad' | 'warn' }) {
  return (
    <Card className="bg-[#1A1F2E] border-white/[0.06]">
      <CardContent className="p-3.5">
        <p className="text-[11px] text-[#6B6459]">{label}</p>
        <p className={cn(
          'text-lg font-bold font-mono tabular-nums mt-1',
          tone === 'ok' ? 'text-emerald-400' : tone === 'bad' ? 'text-red-400' : tone === 'warn' ? 'text-amber-400' : 'text-[#EDE8DF]',
        )}>
          {value}
        </p>
      </CardContent>
    </Card>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between px-3 py-2 rounded bg-white/[0.02]">
      <span className="text-xs text-[#6B6459]">{label}</span>
      <span className="text-xs text-[#D8D2C8] font-mono">{value}</span>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-[11px] text-[#6B6459] mb-1.5 block">{label}</Label>
      {children}
    </div>
  )
}
