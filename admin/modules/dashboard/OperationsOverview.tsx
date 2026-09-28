// ============================================================
// Phase 4b M-8 — 仪表盘运营概览区块
// 文件：admin/modules/dashboard/OperationsOverview.tsx
// 数据：GET /api/v1/admin/analytics/overview
// 内容：用户 / 活跃 / 商业化指标卡 + 近 7 天趋势图 + 事件分布
// ============================================================

import { useCallback, useEffect, useState } from 'react'
import {
  Card, CardHeader, CardTitle, CardDescription, CardContent,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { api } from '../../lib/api'
import {
  TrendingUp,
  UserPlus,
  Sparkles,
  MessageSquare,
  Wallet,
  Crown,
  Activity,
} from 'lucide-react'

// ═══════════════════════════════════════
// 类型
// ═══════════════════════════════════════

interface DailyPoint {
  date: string
  count: number
}

interface Overview {
  users: {
    total: number
    newToday: number
    newInRange: number
    activeInRange: number
  }
  activity: {
    paipanTotal: number
    paipanInRange: number
    chatTotal: number
    chatInRange: number
    reportViewTotal: number
    eventsTotal: number
  }
  business: {
    revenueCents: number
    revenueYuan: number
    paidOrders: number
    pendingOrders: number
    activeSubscriptions: number
  }
  charts: {
    registerTrend: DailyPoint[]
    paipanTrend: DailyPoint[]
    chatTrend: DailyPoint[]
    eventBreakdown: Array<{ event: string; count: number }>
  }
  range: { days: number; since: string; until: string }
}

const REFRESH_INTERVAL = 60_000

const EVENT_LABEL: Record<string, string> = {
  page_view: '页面浏览',
  register: '注册',
  login: '登录',
  paipan: '排盘',
  chat: 'AI 对话',
  report_view: '命书查看',
  order_create: '下单',
  order_pay: '支付',
  share: '分享',
}

// ═══════════════════════════════════════
// 主组件
// ═══════════════════════════════════════

export default function OperationsOverview() {
  const [data, setData] = useState<Overview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const res = await api.get<Overview>('/api/v1/admin/analytics/overview?days=7')
      if (!res.success) throw new Error(res.error?.message || '加载运营数据失败')
      setData(res.data ?? null)
      setError(null)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const timer = setInterval(load, REFRESH_INTERVAL)
    return () => clearInterval(timer)
  }, [load])

  if (loading && !data) {
    return (
      <Card className="bg-[#1A1F2E] border-white/[0.06]">
        <CardContent className="p-6 space-y-3">
          <Skeleton className="h-4 w-32 bg-white/[0.06]" />
          <Skeleton className="h-24 w-full bg-white/[0.04]" />
        </CardContent>
      </Card>
    )
  }

  if (error && !data) {
    return (
      <Card className="bg-[#1A1F2E] border-amber-500/20">
        <CardContent className="p-6 text-center">
          <p className="text-sm text-amber-400">运营数据暂不可用：{error}</p>
        </CardContent>
      </Card>
    )
  }

  const d = data!

  return (
    <Card className="bg-[#1A1F2E] border-white/[0.06]">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-medium text-[#D8D2C8] flex items-center gap-2">
              <TrendingUp size={16} className="text-[#B8964A]" />
              运营概览
            </CardTitle>
            <CardDescription className="text-xs text-[#6B6459]">
              C 端用户增长与商业化表现 · 近 {d.range.days} 天
            </CardDescription>
          </div>
          <Badge variant="outline" className="text-[10px] border-white/[0.08] text-[#6B6459]">
            60s 自动刷新
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* 指标卡 */}
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
          <Metric icon={UserPlus} label="用户总数" value={d.users.total} sub={`今日 +${d.users.newToday}`} />
          <Metric icon={Activity} label="活跃用户" value={d.users.activeInRange} sub={`近 ${d.range.days} 天`} />
          <Metric icon={Sparkles} label="排盘次数" value={d.activity.paipanTotal} sub={`近 ${d.range.days} 天 ${d.activity.paipanInRange}`} />
          <Metric icon={MessageSquare} label="AI 对话" value={d.activity.chatTotal} sub={`近 ${d.range.days} 天 ${d.activity.chatInRange}`} />
          <Metric
            icon={Wallet}
            label="累计收入"
            value={`¥${d.business.revenueYuan}`}
            sub={`${d.business.paidOrders} 笔已付`}
            tone="ok"
          />
          <Metric icon={Crown} label="有效订阅" value={d.business.activeSubscriptions} sub={`${d.business.pendingOrders} 笔待付`} />
        </div>

        {/* 趋势图 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <TrendChart title="新增用户" points={d.charts.registerTrend} color="#B8964A" />
          <TrendChart title="排盘次数" points={d.charts.paipanTrend} color="#4D6BFE" />
          <TrendChart title="AI 对话" points={d.charts.chatTrend} color="#10B981" />
        </div>

        {/* 事件分布 */}
        <div>
          <p className="text-[11px] uppercase tracking-wider text-[#6B6459] mb-2">
            事件分布（累计 {d.activity.eventsTotal} 条）
          </p>
          {d.charts.eventBreakdown.length === 0 ? (
            <p className="text-xs text-[#4A4540] px-2 py-3 rounded bg-white/[0.02]">
              暂无埋点数据，接入 POST /api/v1/app/track 后自动统计
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {d.charts.eventBreakdown.map(e => (
                <div
                  key={e.event}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-white/[0.02] border border-white/[0.04]"
                >
                  <span className="text-[11px] text-[#6B6459]">
                    {EVENT_LABEL[e.event] || e.event}
                  </span>
                  <span className="text-xs font-mono font-bold text-[#EDE8DF] tabular-nums">
                    {e.count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// ═══════════════════════════════════════
// 子组件
// ═══════════════════════════════════════

function Metric({
  icon: Icon, label, value, sub, tone,
}: {
  icon: React.ElementType
  label: string
  value: string | number
  sub?: string
  tone?: 'ok'
}) {
  return (
    <div className="bg-white/[0.02] border border-white/[0.04] rounded-lg p-3 hover:bg-white/[0.04] transition-colors">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon size={12} className="text-[#B8964A]" />
        <span className="text-[11px] text-[#6B6459]">{label}</span>
      </div>
      <p className={cn(
        'text-lg font-bold font-mono tabular-nums',
        tone === 'ok' ? 'text-emerald-400' : 'text-[#EDE8DF]',
      )}>
        {value}
      </p>
      {sub && <p className="text-[10px] text-[#4A4540] mt-0.5">{sub}</p>}
    </div>
  )
}

/**
 * 纯 SVG 柱状趋势图（无第三方图表依赖）
 * 高度固定 96px，宽度由父容器决定（viewBox + preserveAspectRatio）
 */
function TrendChart({
  title, points, color,
}: {
  title: string
  points: DailyPoint[]
  color: string
}) {
  const max = Math.max(1, ...points.map(p => p.count))
  const total = points.reduce((sum, p) => sum + p.count, 0)

  return (
    <div className="bg-white/[0.02] border border-white/[0.04] rounded-lg p-3">
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-[11px] text-[#6B6459]">{title}</span>
        <span className="text-xs font-mono font-bold text-[#EDE8DF] tabular-nums">{total}</span>
      </div>

      <svg
        viewBox="0 0 200 96"
        preserveAspectRatio="none"
        className="w-full h-24"
        role="img"
        aria-label={`${title}趋势图`}
      >
        {points.map((p, i) => {
          const barWidth = 200 / points.length
          const h = (p.count / max) * 72
          const x = i * barWidth + barWidth * 0.15
          const w = barWidth * 0.7
          return (
            <rect
              key={p.date}
              x={x}
              y={88 - h}
              width={w}
              height={Math.max(h, p.count > 0 ? 2 : 0)}
              rx={1.5}
              fill={color}
              opacity={p.count === 0 ? 0.15 : 0.85}
            >
              <title>{`${p.date}: ${p.count}`}</title>
            </rect>
          )
        })}
        {/* 基线 */}
        <line x1="0" y1="88" x2="200" y2="88" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
      </svg>

      <div className="flex justify-between mt-1">
        <span className="text-[10px] text-[#4A4540] font-mono">
          {points[0]?.date.slice(5)}
        </span>
        <span className="text-[10px] text-[#4A4540]">
          峰值 {max}
        </span>
        <span className="text-[10px] text-[#4A4540] font-mono">
          {points[points.length - 1]?.date.slice(5)}
        </span>
      </div>
    </div>
  )
}
