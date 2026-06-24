// ============================================================
// Phase 4 — Dashboard 仪表盘页面（玄青朱砂色板 · shadcn/ui 重构版）
// 文件：admin/modules/dashboard/DashboardPage.tsx
// ============================================================

import { useEffect, useState, useCallback } from 'react'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import {
  Server,
  Cpu,
  Database,
  FileText,
  Clock,
  Activity,
  HardDrive,
  LayoutDashboard,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  Zap,
  Shield,
  Users,
  Settings,
  ScrollText,
  Brain,
} from 'lucide-react'

// ═══════════════════════════════════════
// 类型定义
// ═══════════════════════════════════════

interface DashboardStats {
  uptimeSeconds: number
  uptimeHuman: string
  serverStartTime: string
  memory: {
    heapUsed: number
    heapTotal: number
    external: number
    rss: number
    heapUsedMb: number
    heapTotalMb: number
    rssMb: number
  }
  memoryPercent: number
  dbType: string
  dbStatus: 'connected' | 'disconnected' | 'unavailable'
  dbSizeBytes: number
  dbSizeMb: number
  auditCount: number
  auditToday: number
  activeSessions: number
  nodeVersion: string
  pid: number
  timestamp: string
}

interface RecentActivity {
  id: number
  action: string
  resource: string
  operator: string
  createdAt: string
  detail?: string
}

interface DashboardPageProps {
  apiHeaders: () => Record<string, string>
}

// ═══════════════════════════════════════
// 辅助函数
// ═══════════════════════════════════════

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

function memoryColor(pct: number): string {
  if (pct < 50) return 'bg-emerald-500'
  if (pct < 75) return 'bg-amber-500'
  return 'bg-red-500'
}

function memoryTextColor(pct: number): string {
  if (pct < 50) return 'text-emerald-400'
  if (pct < 75) return 'text-amber-400'
  return 'text-red-400'
}

function formatTime(iso: string): string {
  if (!iso) return '-'
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return '刚刚'
  if (diffMin < 60) return `${diffMin} 分钟前`
  if (diffMin < 1440) return `${Math.floor(diffMin / 60)} 小时前`
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function getActionStyle(action: string): string {
  const map: Record<string, string> = {
    create: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    update: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    delete: 'bg-red-500/10 text-red-400 border-red-500/20',
    login: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
    logout: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
    revoke: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    session_rejected: 'bg-red-500/10 text-red-400 border-red-500/20',
    session_revoked: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  }
  return map[action] || 'bg-slate-500/10 text-slate-400 border-slate-500/20'
}

// ═══════════════════════════════════════
// 统计卡片
// ═══════════════════════════════════════

function StatCard({
  icon: Icon,
  title,
  value,
  subtitle,
  trend,
  trendValue,
  iconColor = 'text-[#B8964A]',
  iconBg = 'bg-[#B8964A]/8',
}: {
  icon: React.ElementType
  title: string
  value: string | number
  subtitle?: string
  trend?: 'up' | 'down' | 'neutral'
  trendValue?: string
  iconColor?: string
  iconBg?: string
}) {
  return (
    <Card className="bg-[#1A1F2E] border-white/[0.06] hover:border-white/[0.10] hover:shadow-[0_4px_24px_rgba(0,0,0,0.3)] transition-all duration-300">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className={cn('size-9 flex items-center justify-center rounded-lg border border-white/[0.06]', iconBg)}>
                <Icon className={cn('size-4', iconColor)} />
              </div>
              <p className="text-sm text-[#6B6459] font-medium">{title}</p>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-[#EDE8DF] font-mono tabular-nums">{value}</span>
              {trend && (
                <span className={cn(
                  'inline-flex items-center gap-0.5 text-xs font-medium',
                  trend === 'up' ? 'text-emerald-400' : trend === 'down' ? 'text-red-400' : 'text-[#6B6459]',
                )}>
                  {trend === 'up' ? <ArrowUpRight size={12} /> : trend === 'down' ? <ArrowDownRight size={12} /> : null}
                  {trendValue}
                </span>
              )}
            </div>
            {subtitle && <p className="text-xs text-[#6B6459]">{subtitle}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ═══════════════════════════════════════
// 快速操作
// ═══════════════════════════════════════

const QUICK_ACTIONS = [
  { label: '系统配置', icon: Settings, href: '/admin/config', color: 'text-[#B8964A]', bg: 'bg-[#B8964A]/8' },
  { label: '审计日志', icon: ScrollText, href: '/admin/audit', color: 'text-[#4D6BFE]', bg: 'bg-[#4D6BFE]/8' },
  { label: 'Prompt 管理', icon: Brain, href: '/admin/prompts', color: 'text-emerald-400', bg: 'bg-emerald-500/8' },
  { label: 'LLM 供应商', icon: Cpu, href: '/admin/llm', color: 'text-amber-400', bg: 'bg-amber-500/8' },
]

// ═══════════════════════════════════════
// 主页面
// ═══════════════════════════════════════

const REFRESH_INTERVAL = 15_000

export default function DashboardPage({ apiHeaders }: DashboardPageProps) {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [activities, setActivities] = useState<RecentActivity[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const headers = apiHeaders()
      // 并行拉取统计 + 最近活动
      const [statsRes, auditRes] = await Promise.all([
        fetch('/api/v1/admin/dashboard/stats', { headers }),
        fetch('/api/v1/admin/audit?limit=8', { headers }),
      ])

      if (!statsRes.ok) throw new Error('获取统计数据失败')
      const statsJson = await statsRes.json()
      if (!statsJson.success) throw new Error(statsJson.error?.message || '未知错误')
      setStats(statsJson.data as DashboardStats)

      if (auditRes.ok) {
        const auditJson = await auditRes.json()
        setActivities(auditJson.data || [])
      }

      setError(null)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [apiHeaders])

  useEffect(() => {
    load()
    const timer = setInterval(load, REFRESH_INTERVAL)
    return () => clearInterval(timer)
  }, [load])

  // ── 加载骨架 ──
  if (loading && !stats) {
    return (
      <div className="space-y-6 animate-in fade-in-50 duration-500">
        <PageHeader loading />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i} className="bg-[#1A1F2E] border-white/[0.06]">
              <CardContent className="p-5 space-y-3">
                <Skeleton className="h-4 w-24 bg-white/[0.06]" />
                <Skeleton className="h-8 w-16 bg-white/[0.06]" />
                <Skeleton className="h-3 w-32 bg-white/[0.04]" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card className="bg-[#1A1F2E] border-white/[0.06]">
          <CardContent className="p-6 space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <Skeleton key={i} className="h-10 w-full bg-white/[0.04]" />
            ))}
          </CardContent>
        </Card>
      </div>
    )
  }

  // ── 错误态 ──
  if (error && !stats) {
    return (
      <div className="space-y-6 animate-in fade-in-50 duration-500">
        <PageHeader />
        <Card className="bg-[#1A1F2E] border-red-500/20">
          <CardContent className="py-10 text-center space-y-3">
            <div className="size-14 mx-auto flex items-center justify-center rounded-full bg-red-500/10 border border-red-500/20">
              <Server size={24} className="text-red-400" />
            </div>
            <div>
              <p className="text-red-400 text-base font-medium">无法获取统计数据</p>
              <p className="text-[#6B6459] text-sm mt-1">{error}</p>
            </div>
            <Button
              onClick={load}
              variant="outline"
              className="border-[#B8964A]/30 text-[#B8964A] hover:bg-[#B8964A]/10"
            >
              <RefreshCw size={14} className="mr-2" />
              重试
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const s = stats!
  const pct = s.memoryPercent
  const isRunning = s.dbStatus === 'connected'

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-500">
      {/* ═══ 页面标题 ═══ */}
      <PageHeader stats={s} onRefresh={load} />

      {/* ═══ 4 卡片统计网格 ═══ */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 服务状态 */}
        <StatCard
          icon={Server}
          title="服务状态"
          value={isRunning ? '运行中' : '异常'}
          subtitle={`PID ${s.pid} · ${s.nodeVersion}`}
          iconColor={isRunning ? 'text-emerald-400' : 'text-red-400'}
          iconBg={isRunning ? 'bg-emerald-500/8' : 'bg-red-500/8'}
          trend={isRunning ? 'up' : 'down'}
          trendValue={s.uptimeHuman}
        />

        {/* 内存使用 */}
        <StatCard
          icon={Cpu}
          title="内存使用"
          value={`${pct.toFixed(1)}%`}
          subtitle={`${s.memory.heapUsedMb.toFixed(1)} / ${s.memory.heapTotalMb.toFixed(1)} MB`}
          iconColor={memoryTextColor(pct)}
          iconBg={pct < 50 ? 'bg-emerald-500/8' : pct < 75 ? 'bg-amber-500/8' : 'bg-red-500/8'}
          trend={pct > 75 ? 'down' : 'neutral'}
          trendValue={pct > 75 ? '偏高' : undefined}
        />

        {/* 数据库 */}
        <StatCard
          icon={Database}
          title="数据库"
          value={s.dbType}
          subtitle={`${s.dbSizeMb > 0 ? `${s.dbSizeMb.toFixed(2)} MB` : '—'} · ${s.activeSessions} 会话`}
          iconColor={s.dbStatus === 'connected' ? 'text-emerald-400' : 'text-red-400'}
          iconBg={s.dbStatus === 'connected' ? 'bg-emerald-500/8' : 'bg-red-500/8'}
          trend={s.dbStatus === 'connected' ? 'up' : 'down'}
          trendValue={s.dbStatus === 'connected' ? '已连接' : '未连接'}
        />

        {/* 审计日志 */}
        <StatCard
          icon={FileText}
          title="审计日志"
          value={s.auditCount.toLocaleString()}
          subtitle={`今日新增 ${s.auditToday.toLocaleString()} 条`}
          iconColor="text-[#4D6BFE]"
          iconBg="bg-[#4D6BFE]/8"
          trend={s.auditToday > 0 ? 'up' : 'neutral'}
          trendValue={s.auditToday > 0 ? `+${s.auditToday}` : undefined}
        />
      </div>

      {/* ═══ 下半区：内存监控 + 最近活动 ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 内存详情 + 系统信息 */}
        <Card className="bg-[#1A1F2E] border-white/[0.06] lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium text-[#D8D2C8] flex items-center gap-2">
              <Activity size={16} className="text-[#B8964A]" />
              系统资源
            </CardTitle>
            <CardDescription className="text-xs text-[#6B6459]">
              实时内存 &amp; 进程信息
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 内存进度条 */}
            <div className="space-y-2">
              <div className="flex justify-between items-baseline">
                <span className={cn('text-3xl font-bold font-mono tabular-nums', memoryTextColor(pct))}>
                  {pct.toFixed(1)}%
                </span>
                <span className="text-sm text-[#6B6459]">
                  {s.memory.heapUsedMb.toFixed(1)} / {s.memory.heapTotalMb.toFixed(1)} MB
                </span>
              </div>
              <Progress
                value={pct}
                max={100}
                className="h-2 bg-white/[0.06] rounded-full"
                indicatorClassName={cn(memoryColor(pct), 'shadow-sm rounded-full transition-all duration-500')}
              />
            </div>

            {/* 内存细分 */}
            <div className="space-y-1.5">
              {[
                { label: 'RSS', value: `${s.memory.rssMb.toFixed(1)} MB` },
                { label: '堆外内存', value: formatBytes(s.memory.external) },
                { label: '运行时长', value: s.uptimeHuman },
                { label: 'Node 版本', value: s.nodeVersion },
              ].map(row => (
                <div key={row.label} className="flex justify-between py-1.5 px-2.5 rounded-md bg-white/[0.02]">
                  <span className="text-sm text-[#6B6459]">{row.label}</span>
                  <span className="text-sm text-[#D8D2C8] font-mono tabular-nums">{row.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 最近活动表格 */}
        <Card className="bg-[#1A1F2E] border-white/[0.06] lg:col-span-2 overflow-hidden">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-medium text-[#D8D2C8] flex items-center gap-2">
                  <Clock size={16} className="text-[#B8964A]" />
                  最近活动
                </CardTitle>
                <CardDescription className="text-xs text-[#6B6459]">
                  最近 8 条操作记录
                </CardDescription>
              </div>
              <a
                href="/admin/audit"
                className="text-xs text-[#B8964A] hover:text-[#D8C08A] transition-colors flex items-center gap-1"
              >
                查看全部
                <ArrowUpRight size={12} />
              </a>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {activities.length === 0 ? (
              <div className="py-10 text-center">
                <div className="size-12 mx-auto flex items-center justify-center rounded-full bg-white/[0.03] border border-white/[0.06] mb-3">
                  <Clock size={18} className="text-[#4A4540]" />
                </div>
                <p className="text-sm text-[#6B6459]">暂无操作记录</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-white/[0.06]">
                    <TableHead className="text-[11px] text-[#6B6459] font-medium">时间</TableHead>
                    <TableHead className="text-[11px] text-[#6B6459] font-medium">操作</TableHead>
                    <TableHead className="text-[11px] text-[#6B6459] font-medium">资源</TableHead>
                    <TableHead className="text-[11px] text-[#6B6459] font-medium hidden md:table-cell">操作者</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activities.map(a => (
                    <TableRow key={a.id} className="border-white/[0.03] hover:bg-white/[0.02]">
                      <TableCell className="text-xs text-[#6B6459] font-mono whitespace-nowrap">
                        {formatTime(a.createdAt)}
                      </TableCell>
                      <TableCell>
                        <Badge className={cn('text-[10px] font-medium border', getActionStyle(a.action))}>
                          {a.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-[#A09888] max-w-[160px] truncate">
                        {a.resource}
                      </TableCell>
                      <TableCell className="text-xs text-[#D8D2C8] hidden md:table-cell">
                        {a.operator}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ═══ 快捷操作 + 功能矩阵 ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 快捷操作 */}
        <Card className="bg-[#1A1F2E] border-white/[0.06]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium text-[#D8D2C8] flex items-center gap-2">
              <Zap size={16} className="text-[#B8964A]" />
              快捷操作
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2">
              {QUICK_ACTIONS.map(action => (
                <a
                  key={action.label}
                  href={action.href}
                  className={cn(
                    'flex items-center gap-2.5 p-3 rounded-lg border border-white/[0.04]',
                    'hover:border-white/[0.10] hover:bg-white/[0.03] transition-all duration-200',
                    'group',
                  )}
                >
                  <div className={cn('size-8 flex items-center justify-center rounded-lg', action.bg)}>
                    <action.icon size={14} className={cn(action.color, 'group-hover:scale-110 transition-transform')} />
                  </div>
                  <span className="text-sm text-[#D8D2C8] font-medium group-hover:text-[#EDE8DF] transition-colors">
                    {action.label}
                  </span>
                  <ArrowUpRight size={12} className="ml-auto text-[#4A4540] group-hover:text-[#B8964A] transition-colors" />
                </a>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 系统功能矩阵 */}
        <Card className="bg-[#1A1F2E] border-white/[0.06]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium text-[#D8D2C8] flex items-center gap-2">
              <Shield size={16} className="text-[#B8964A]" />
              系统功能矩阵
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2">
              {[
                { emoji: '🗄️', label: '数据持久层', value: '8 张表', desc: 'SQLite + Drizzle ORM' },
                { emoji: '🔧', label: '工具系统', value: '5 大工具', desc: '节气/日历/经典/名人/搜索' },
                { emoji: '🛡️', label: 'L3 防幻觉', value: '热编辑', desc: 'L1/L2/L3 三层护栏' },
                { emoji: '🤖', label: 'Multi-Agent', value: '4 Agent', desc: 'Router→墨言/墨行/墨缘/墨白' },
              ].map(feat => (
                <div
                  key={feat.label}
                  className="bg-white/[0.02] border border-white/[0.04] rounded-lg p-3 hover:bg-white/[0.04] hover:border-white/[0.08] transition-all duration-200"
                >
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span className="text-sm">{feat.emoji}</span>
                    <span className="text-[11px] text-[#6B6459]">{feat.label}</span>
                  </div>
                  <div className="text-sm font-bold text-[#EDE8DF]">{feat.value}</div>
                  <p className="text-[11px] text-[#6B6459] mt-0.5">{feat.desc}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════
// 页面标题子组件
// ═══════════════════════════════════════

function PageHeader({
  stats,
  loading,
  onRefresh,
}: {
  stats?: DashboardStats
  loading?: boolean
  onRefresh?: () => void
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <div className="flex items-center gap-2.5">
          <div className="size-8 flex items-center justify-center rounded-lg bg-[#B8964A]/10 border border-[#B8964A]/20">
            <LayoutDashboard size={16} className="text-[#B8964A]" />
          </div>
          <h2 className="text-xl font-semibold text-[#EDE8DF] tracking-[0.04em]">仪表盘</h2>
        </div>
        {stats && (
          <p className="text-sm text-[#6B6459] mt-1 ml-[42px]">
            刷新间隔 15s · 最后更新 {new Date(stats.timestamp).toLocaleTimeString('zh-CN')}
          </p>
        )}
      </div>
      {!loading && (
        <button
          onClick={onRefresh}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm',
            'bg-white/[0.03] border border-white/[0.06] text-[#A09888]',
            'hover:bg-white/[0.06] hover:text-[#D8D2C8] hover:border-white/[0.10]',
            'transition-all duration-200',
          )}
        >
          <RefreshCw size={13} />
          刷新
        </button>
      )}
    </div>
  )
}
