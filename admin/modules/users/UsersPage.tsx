// ============================================================
// Phase 4b M-6 — 管理后台：C 端用户管理页
// 文件：admin/modules/users/UsersPage.tsx
// 功能：搜索 / 筛选 / 分页 / 统计 / 启停 / 调额度 / 重置密码 / 删除 / 详情
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
  Users as UsersIcon,
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  UserCog,
  Coins,
  KeyRound,
  Trash2,
  ShieldOff,
  ShieldCheck,
  UserX,
} from 'lucide-react'

// ═══════════════════════════════════════
// 类型
// ═══════════════════════════════════════

interface UserRow {
  id: number
  username: string
  nickname: string | null
  phone: string | null
  email: string | null
  status: string
  role: string
  vipLevel: string
  vipExpiresAt: string | null
  quotaTotal: number
  quotaUsed: number
  quotaRemaining: number
  lastLoginAt: string | null
  lastLoginIp: string | null
  createdAt: string
}

interface UserStats {
  total: number
  active: number
  disabled: number
  vipBreakdown: Record<string, number>
  newToday: number
  newThisWeek: number
}

interface UserDetail {
  user: Omit<UserRow, 'quotaRemaining'> & { avatarUrl?: string | null }
  quotaRemaining: number
  orders: Array<{
    id: number
    orderNo: string
    planName: string
    amountCents: number
    status: string
    createdAt: string
  }>
  subscriptions: Array<{
    id: number
    vipLevel: string
    startsAt: string
    endsAt: string
    status: string
  }>
}

const PAGE_SIZE = 20

// ═══════════════════════════════════════
// 工具
// ═══════════════════════════════════════

function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const VIP_LABEL: Record<string, string> = {
  free: '免费',
  basic: '会员',
  pro: '专业',
}

const ORDER_STATUS_LABEL: Record<string, string> = {
  pending: '待支付',
  paid: '已支付',
  cancelled: '已取消',
  refunded: '已退款',
}

// ═══════════════════════════════════════
// 主页面
// ═══════════════════════════════════════

export default function UsersPage() {
  const [items, setItems] = useState<UserRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [keyword, setKeyword] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [stats, setStats] = useState<UserStats | null>(null)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionMsg, setActionMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  // 弹窗目标
  const [detail, setDetail] = useState<UserDetail | null>(null)
  const [quotaTarget, setQuotaTarget] = useState<UserRow | null>(null)
  const [pwdTarget, setPwdTarget] = useState<UserRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const qs = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
      })
      if (keyword) qs.set('keyword', keyword)
      if (statusFilter) qs.set('status', statusFilter)

      const [listRes, statsRes] = await Promise.all([
        api.get<{ items: UserRow[]; total: number }>(`/api/v1/admin/users?${qs.toString()}`),
        api.get<UserStats>('/api/v1/admin/users/stats'),
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
  }, [page, keyword, statusFilter])

  useEffect(() => { load() }, [load])

  /** 统一的操作反馈 */
  function notify(type: 'ok' | 'err', text: string) {
    setActionMsg({ type, text })
    setTimeout(() => setActionMsg(null), 3500)
  }

  async function toggleStatus(user: UserRow) {
    const next = user.status === 'active' ? 'disabled' : 'active'
    const res = await api.patch(`/api/v1/admin/users/${user.id}`, { status: next })
    if (res.success) {
      notify('ok', next === 'active' ? `已启用 ${user.username}` : `已停用 ${user.username}（其登录会话已强制下线）`)
      load()
    } else {
      notify('err', res.error?.message || '操作失败')
    }
  }

  async function submitQuota(delta: number | null, setTotal: number | null, reason: string) {
    if (!quotaTarget) return
    setBusy(true)
    const body: Record<string, unknown> = { reason }
    if (setTotal !== null) body.setTotal = setTotal
    else body.delta = delta
    const res = await api.post(`/api/v1/admin/users/${quotaTarget.id}/quota`, body)
    setBusy(false)
    if (res.success) {
      notify('ok', `已调整 ${quotaTarget.username} 的额度`)
      setQuotaTarget(null)
      load()
    } else {
      notify('err', res.error?.message || '调整失败')
    }
  }

  async function submitResetPassword(newPassword: string) {
    if (!pwdTarget) return
    setBusy(true)
    const res = await api.post(`/api/v1/admin/users/${pwdTarget.id}/reset-password`, { newPassword })
    setBusy(false)
    if (res.success) {
      notify('ok', `已重置 ${pwdTarget.username} 的密码，其所有设备需重新登录`)
      setPwdTarget(null)
    } else {
      notify('err', res.error?.message || '重置失败')
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setBusy(true)
    const res = await api.delete(`/api/v1/admin/users/${deleteTarget.id}`)
    setBusy(false)
    if (res.success) {
      notify('ok', `已删除用户 ${deleteTarget.username}`)
      setDeleteTarget(null)
      load()
    } else {
      notify('err', res.error?.message || '删除失败')
    }
  }

  async function openDetail(user: UserRow) {
    const res = await api.get<UserDetail>(`/api/v1/admin/users/${user.id}`)
    if (res.success) setDetail(res.data ?? null)
    else notify('err', res.error?.message || '加载详情失败')
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  // ═══════════════════════════════════════
  // 渲染
  // ═══════════════════════════════════════

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-500">
      {/* 页头 */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="size-8 flex items-center justify-center rounded-lg bg-[#B8964A]/10 border border-[#B8964A]/20">
              <UsersIcon size={16} className="text-[#B8964A]" />
            </div>
            <h2 className="text-xl font-semibold text-[#EDE8DF] tracking-[0.04em]">C 端用户</h2>
          </div>
          <p className="text-sm text-[#6B6459] mt-1 ml-[42px]">
            注册账号管理 · 额度分配 · 登录会话控制
          </p>
        </div>
        <button
          onClick={load}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm',
            'bg-white/[0.03] border border-white/[0.06] text-[#A09888]',
            'hover:bg-white/[0.06] hover:text-[#D8D2C8] transition-all duration-200',
          )}
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          刷新
        </button>
      </div>

      {/* 操作反馈 */}
      {actionMsg && (
        <div className={cn(
          'px-4 py-2.5 rounded-lg border text-sm',
          actionMsg.type === 'ok'
            ? 'bg-emerald-500/8 border-emerald-500/20 text-emerald-400'
            : 'bg-red-500/8 border-red-500/20 text-red-400',
        )}>
          {actionMsg.text}
        </div>
      )}

      {/* 统计卡 */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <MiniStat label="用户总数" value={stats?.total ?? '—'} />
        <MiniStat label="启用中" value={stats?.active ?? '—'} tone="ok" />
        <MiniStat label="已停用" value={stats?.disabled ?? '—'} tone="bad" />
        <MiniStat label="今日新增" value={stats?.newToday ?? '—'} />
        <MiniStat label="近 7 天新增" value={stats?.newThisWeek ?? '—'} />
      </div>

      {/* 筛选区 */}
      <Card className="bg-[#1A1F2E] border-white/[0.06]">
        <CardContent className="p-4 flex flex-col md:flex-row gap-3">
          <div className="flex-1 flex gap-2">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B6459]" />
              <Input
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { setPage(1); setKeyword(searchInput.trim()) } }}
                placeholder="搜索账号 / 昵称 / 手机号 / 邮箱"
                className="pl-9 h-9 bg-[#0A1118] border-white/[0.08] text-[#EDE8DF] placeholder:text-[#4A4540]"
              />
            </div>
            <Button
              onClick={() => { setPage(1); setKeyword(searchInput.trim()) }}
              className="h-9 bg-[#B8964A] hover:bg-[#D8C08A] text-[#0A1118] font-medium px-4"
            >
              搜索
            </Button>
            {keyword && (
              <Button
                variant="outline"
                onClick={() => { setSearchInput(''); setKeyword(''); setPage(1) }}
                className="h-9 border-white/[0.08] text-[#6B6459]"
              >
                清除
              </Button>
            )}
          </div>
          <Select
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
            className="h-9 w-36 bg-[#0A1118] border-white/[0.08]"
          >
            <option value="">全部状态</option>
            <option value="active">启用中</option>
            <option value="disabled">已停用</option>
          </Select>
        </CardContent>
      </Card>

      {/* 表格 */}
      <Card className="bg-[#1A1F2E] border-white/[0.06] overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium text-[#D8D2C8]">用户列表</CardTitle>
          <CardDescription className="text-xs text-[#6B6459]">
            共 {total} 位用户 · 第 {page} / {totalPages} 页
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
              <UserX size={28} className="mx-auto text-[#4A4540] mb-3" />
              <p className="text-sm text-[#6B6459]">暂无匹配的用户</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-white/[0.06]">
                  <TableHead className="text-[11px] text-[#6B6459]">ID</TableHead>
                  <TableHead className="text-[11px] text-[#6B6459]">账号</TableHead>
                  <TableHead className="text-[11px] text-[#6B6459] hidden md:table-cell">联系方式</TableHead>
                  <TableHead className="text-[11px] text-[#6B6459]">等级</TableHead>
                  <TableHead className="text-[11px] text-[#6B6459]">额度</TableHead>
                  <TableHead className="text-[11px] text-[#6B6459]">状态</TableHead>
                  <TableHead className="text-[11px] text-[#6B6459] hidden lg:table-cell">最后登录</TableHead>
                  <TableHead className="text-[11px] text-[#6B6459] text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map(u => (
                  <TableRow key={u.id} className="border-white/[0.03] hover:bg-white/[0.02]">
                    <TableCell className="text-xs text-[#6B6459] font-mono">#{u.id}</TableCell>
                    <TableCell>
                      <button
                        onClick={() => openDetail(u)}
                        className="text-sm text-[#EDE8DF] hover:text-[#B8964A] transition-colors text-left"
                      >
                        {u.username}
                        {u.nickname && u.nickname !== u.username && (
                          <span className="block text-[11px] text-[#6B6459]">{u.nickname}</span>
                        )}
                      </button>
                    </TableCell>
                    <TableCell className="text-xs text-[#A09888] hidden md:table-cell">
                      {u.phone || u.email || '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn(
                        'text-[10px] border',
                        u.vipLevel === 'pro'
                          ? 'border-[#B8964A]/30 text-[#B8964A] bg-[#B8964A]/8'
                          : u.vipLevel === 'basic'
                            ? 'border-emerald-500/20 text-emerald-400 bg-emerald-500/8'
                            : 'border-white/[0.08] text-[#6B6459]',
                      )}>
                        {VIP_LABEL[u.vipLevel] || u.vipLevel}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs font-mono tabular-nums">
                      <span className="text-[#EDE8DF]">{u.quotaRemaining}</span>
                      <span className="text-[#6B6459]"> / {u.quotaTotal}</span>
                      <span className="block text-[10px] text-[#4A4540]">已用 {u.quotaUsed}</span>
                    </TableCell>
                    <TableCell>
                      <Badge className={cn(
                        'text-[10px] border',
                        u.status === 'active'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : 'bg-red-500/10 text-red-400 border-red-500/20',
                      )}>
                        {u.status === 'active' ? '启用' : '停用'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-[#6B6459] hidden lg:table-cell whitespace-nowrap">
                      {formatDateTime(u.lastLoginAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <IconButton title="查看详情" onClick={() => openDetail(u)}>
                          <UserCog size={13} />
                        </IconButton>
                        <IconButton title="调整额度" onClick={() => setQuotaTarget(u)}>
                          <Coins size={13} />
                        </IconButton>
                        <IconButton title="重置密码" onClick={() => setPwdTarget(u)}>
                          <KeyRound size={13} />
                        </IconButton>
                        <IconButton
                          title={u.status === 'active' ? '停用账号' : '启用账号'}
                          onClick={() => toggleStatus(u)}
                          tone={u.status === 'active' ? 'warn' : 'ok'}
                        >
                          {u.status === 'active' ? <ShieldOff size={13} /> : <ShieldCheck size={13} />}
                        </IconButton>
                        <IconButton title="删除用户" onClick={() => setDeleteTarget(u)} tone="bad">
                          <Trash2 size={13} />
                        </IconButton>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {/* 分页 */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-white/[0.06]">
              <span className="text-xs text-[#6B6459]">
                显示第 {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} 条
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline" size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  className="h-7 border-white/[0.08] text-[#A09888]"
                >
                  <ChevronLeft size={13} /> 上一页
                </Button>
                <Button
                  variant="outline" size="sm"
                  disabled={page >= totalPages}
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

      {/* ═══ 弹窗：用户详情 ═══ */}
      <Dialog open={!!detail} onOpenChange={open => !open && setDetail(null)}>
        <DialogContent className="bg-[#1A1F2E] border-white/[0.08] text-[#EDE8DF] max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-[#EDE8DF]">
              用户详情 {detail ? `#${detail.user.id} ${detail.user.username}` : ''}
            </DialogTitle>
            <DialogDescription className="text-[#6B6459]">
              账号资料、订阅与订单记录
            </DialogDescription>
          </DialogHeader>
          {detail && (
            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-2">
                <InfoRow label="昵称" value={detail.user.nickname || '—'} />
                <InfoRow label="状态" value={detail.user.status === 'active' ? '启用' : '停用'} />
                <InfoRow label="手机" value={detail.user.phone || '—'} />
                <InfoRow label="邮箱" value={detail.user.email || '—'} />
                <InfoRow label="会员等级" value={VIP_LABEL[detail.user.vipLevel] || detail.user.vipLevel} />
                <InfoRow label="会员到期" value={formatDateTime(detail.user.vipExpiresAt)} />
                <InfoRow label="剩余额度" value={String(detail.quotaRemaining)} />
                <InfoRow label="注册时间" value={formatDateTime(detail.user.createdAt)} />
              </div>

              <div>
                <p className="text-[11px] uppercase tracking-wider text-[#6B6459] mb-2">
                  订阅记录（{detail.subscriptions.length}）
                </p>
                {detail.subscriptions.length === 0 ? (
                  <p className="text-xs text-[#4A4540] px-2 py-3 rounded bg-white/[0.02]">暂无订阅</p>
                ) : (
                  <div className="space-y-1.5">
                    {detail.subscriptions.map(s => (
                      <div key={s.id} className="flex items-center justify-between px-3 py-2 rounded bg-white/[0.02] text-xs">
                        <span className="text-[#D8D2C8]">{VIP_LABEL[s.vipLevel] || s.vipLevel}</span>
                        <span className="text-[#6B6459] font-mono">
                          {formatDateTime(s.startsAt)} → {formatDateTime(s.endsAt)}
                        </span>
                        <Badge className={cn('text-[10px] border', s.status === 'active'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : 'bg-white/[0.04] text-[#6B6459] border-white/[0.08]')}>
                          {s.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <p className="text-[11px] uppercase tracking-wider text-[#6B6459] mb-2">
                  最近订单（{detail.orders.length}）
                </p>
                {detail.orders.length === 0 ? (
                  <p className="text-xs text-[#4A4540] px-2 py-3 rounded bg-white/[0.02]">暂无订单</p>
                ) : (
                  <div className="space-y-1.5">
                    {detail.orders.map(o => (
                      <div key={o.id} className="flex items-center justify-between px-3 py-2 rounded bg-white/[0.02] text-xs">
                        <span className="text-[#D8D2C8]">{o.planName}</span>
                        <span className="text-[#6B6459] font-mono">¥{(o.amountCents / 100).toFixed(2)}</span>
                        <Badge variant="outline" className="text-[10px] border-white/[0.08] text-[#A09888]">
                          {ORDER_STATUS_LABEL[o.status] || o.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetail(null)} className="border-white/[0.08] text-[#A09888]">
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ 弹窗：调整额度 ═══ */}
      <QuotaDialog
        user={quotaTarget}
        busy={busy}
        onCancel={() => setQuotaTarget(null)}
        onSubmit={submitQuota}
      />

      {/* ═══ 弹窗：重置密码 ═══ */}
      <ResetPasswordDialog
        user={pwdTarget}
        busy={busy}
        onCancel={() => setPwdTarget(null)}
        onSubmit={submitResetPassword}
      />

      {/* ═══ 弹窗：删除确认 ═══ */}
      <Dialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <DialogContent className="bg-[#1A1F2E] border-red-500/20 text-[#EDE8DF] max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-400">删除用户</DialogTitle>
            <DialogDescription className="text-[#6B6459]">
              确定删除 <span className="text-[#EDE8DF]">{deleteTarget?.username}</span> ？
              该操作会级联删除其订单、订阅与会话记录，且不可恢复。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} className="border-white/[0.08] text-[#A09888]">
              取消
            </Button>
            <Button
              onClick={confirmDelete}
              disabled={busy}
              className="bg-red-500/90 hover:bg-red-500 text-white"
            >
              {busy ? '删除中...' : '确认删除'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ═══════════════════════════════════════
// 子组件
// ═══════════════════════════════════════

function MiniStat({ label, value, tone }: { label: string; value: string | number; tone?: 'ok' | 'bad' }) {
  return (
    <Card className="bg-[#1A1F2E] border-white/[0.06]">
      <CardContent className="p-3.5">
        <p className="text-[11px] text-[#6B6459]">{label}</p>
        <p className={cn(
          'text-xl font-bold font-mono tabular-nums mt-1',
          tone === 'ok' ? 'text-emerald-400' : tone === 'bad' ? 'text-red-400' : 'text-[#EDE8DF]',
        )}>
          {value}
        </p>
      </CardContent>
    </Card>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between px-3 py-2 rounded bg-white/[0.02]">
      <span className="text-xs text-[#6B6459]">{label}</span>
      <span className="text-xs text-[#D8D2C8]">{value}</span>
    </div>
  )
}

function IconButton({
  children, onClick, title, tone = 'default',
}: {
  children: React.ReactNode
  onClick: () => void
  title: string
  tone?: 'default' | 'ok' | 'warn' | 'bad'
}) {
  const toneCls = {
    default: 'text-[#6B6459] hover:text-[#B8964A] hover:bg-[#B8964A]/10',
    ok: 'text-[#6B6459] hover:text-emerald-400 hover:bg-emerald-500/10',
    warn: 'text-[#6B6459] hover:text-amber-400 hover:bg-amber-500/10',
    bad: 'text-[#6B6459] hover:text-red-400 hover:bg-red-500/10',
  }[tone]

  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn('size-7 flex items-center justify-center rounded transition-colors', toneCls)}
    >
      {children}
    </button>
  )
}

function QuotaDialog({
  user, busy, onCancel, onSubmit,
}: {
  user: UserRow | null
  busy: boolean
  onCancel: () => void
  onSubmit: (delta: number | null, setTotal: number | null, reason: string) => void
}) {
  const [mode, setMode] = useState<'delta' | 'setTotal'>('delta')
  const [amount, setAmount] = useState('10')
  const [reason, setReason] = useState('')

  const parsed = Number(amount)
  // delta：非零即可（支持负数回收）；setTotal：必须非负
  const valid = Number.isInteger(parsed) && (mode === 'delta' ? parsed !== 0 : parsed >= 0)

  return (
    <Dialog open={!!user} onOpenChange={open => !open && onCancel()}>
      <DialogContent className="bg-[#1A1F2E] border-white/[0.08] text-[#EDE8DF] max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[#EDE8DF]">调整额度</DialogTitle>
          <DialogDescription className="text-[#6B6459]">
            {user?.username} · 当前 {user?.quotaRemaining} / {user?.quotaTotal}
            （已用 {user?.quotaUsed}）
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label className="text-[11px] text-[#6B6459] mb-1.5 block">调整方式</Label>
            <Select
              value={mode}
              onChange={e => setMode(e.target.value as 'delta' | 'setTotal')}
              className="h-9 bg-[#0A1118] border-white/[0.08]"
            >
              <option value="delta">增减额度（正数为赠送，负数请填减量后再选）</option>
              <option value="setTotal">直接设定总量</option>
            </Select>
          </div>
          <div>
            <Label className="text-[11px] text-[#6B6459] mb-1.5 block">
              {mode === 'delta' ? '增减数量' : '额度总量'}
            </Label>
            <Input
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className="h-9 bg-[#0A1118] border-white/[0.08] text-[#EDE8DF]"
            />
            {mode === 'delta' && (
              <p className="text-[11px] text-[#4A4540] mt-1">
                支持负数回收，例如 -10 表示扣回 10 次
              </p>
            )}
          </div>
          <div>
            <Label className="text-[11px] text-[#6B6459] mb-1.5 block">原因（写入审计日志）</Label>
            <Input
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="如：活动赠送 / 客诉补偿"
              className="h-9 bg-[#0A1118] border-white/[0.08] text-[#EDE8DF] placeholder:text-[#4A4540]"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} className="border-white/[0.08] text-[#A09888]">取消</Button>
          <Button
            disabled={!valid || busy}
            onClick={() => onSubmit(mode === 'delta' ? parsed : null, mode === 'setTotal' ? parsed : null, reason)}
            className="bg-[#B8964A] hover:bg-[#D8C08A] text-[#0A1118] font-medium"
          >
            {busy ? '提交中...' : '确认调整'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ResetPasswordDialog({
  user, busy, onCancel, onSubmit,
}: {
  user: UserRow | null
  busy: boolean
  onCancel: () => void
  onSubmit: (pwd: string) => void
}) {
  const [pwd, setPwd] = useState('')
  const [confirm, setConfirm] = useState('')
  const valid = pwd.length >= 6 && pwd === confirm

  return (
    <Dialog open={!!user} onOpenChange={open => !open && onCancel()}>
      <DialogContent className="bg-[#1A1F2E] border-white/[0.08] text-[#EDE8DF] max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[#EDE8DF]">重置密码</DialogTitle>
          <DialogDescription className="text-[#6B6459]">
            为 {user?.username} 设置新密码，重置后其所有登录设备将被强制下线
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label className="text-[11px] text-[#6B6459] mb-1.5 block">新密码（至少 6 位）</Label>
            <Input
              type="password"
              value={pwd}
              onChange={e => setPwd(e.target.value)}
              className="h-9 bg-[#0A1118] border-white/[0.08] text-[#EDE8DF]"
            />
          </div>
          <div>
            <Label className="text-[11px] text-[#6B6459] mb-1.5 block">确认新密码</Label>
            <Input
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              className="h-9 bg-[#0A1118] border-white/[0.08] text-[#EDE8DF]"
            />
          </div>
          {confirm && pwd !== confirm && (
            <p className="text-xs text-red-400">两次输入的密码不一致</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} className="border-white/[0.08] text-[#A09888]">取消</Button>
          <Button
            disabled={!valid || busy}
            onClick={() => onSubmit(pwd)}
            className="bg-[#B8964A] hover:bg-[#D8C08A] text-[#0A1118] font-medium"
          >
            {busy ? '提交中...' : '确认重置'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
