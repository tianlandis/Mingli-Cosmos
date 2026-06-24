// ============================================================
// Phase 4 — Dashboard 仪表盘页面（玄青朱砂色板）
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
import { Progress } from '@/components/ui/progress'
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

interface DashboardPageProps {
  apiHeaders: () => Record<string, string>
}

// ═══════════════════════════════════════
// 辅助：获取统计数据
// ═══════════════════════════════════════

async function fetchStats(headers: Record<string, string>): Promise<DashboardStats> {
  const res = await fetch('/api/v1/admin/dashboard/stats', { headers })
  if (!res.ok) throw new Error('获取统计数据失败')
  const json = await res.json()
  if (!json.success) throw new Error(json.error?.message || '未知错误')
  return json.data as DashboardStats
}

// ═══════════════════════════════════════
// 格式化工具
// ═══════════════════════════════════════

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

function memoryColor(pct: number): string {
  if (pct < 50) return 'bg-[#5B8C5A]'
  if (pct < 75) return 'bg-[#B8964A]'
  return 'bg-[#C04030]'
}

function memoryTextColor(pct: number): string {
  if (pct < 50) return 'text-[#5B8C5A]'
  if (pct < 75) return 'text-[#B8964A]'
  return 'text-[#C04030]'
}

// ═══════════════════════════════════════
// 指标卡片子组件
// ═══════════════════════════════════════

function StatCard({
  icon: Icon,
  title,
  description,
  children,
  className,
}: {
  icon: React.ElementType
  title: string
  description?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <Card
      className={cn(
        'bg-[#1A1F2E] border-white/[0.06]',
        'hover:border-white/[0.10] hover:shadow-[0_4px_20px_rgba(0,0,0,0.3)] transition-all duration-300',
        className,
      )}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className={cn(
            'size-9 flex items-center justify-center rounded-lg',
            'bg-white/[0.04] border border-white/[0.06]',
          )}>
            <Icon className="size-4 text-[#A09888]" />
          </div>
          <div>
            <CardTitle className="text-base font-medium text-[#D8D2C8]">
              {title}
            </CardTitle>
            {description && (
              <CardDescription className="text-sm text-[#6B6459] mt-0.5">
                {description}
              </CardDescription>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {children}
      </CardContent>
    </Card>
  )
}

// ═══════════════════════════════════════
// 卡片一：服务状态
// ═══════════════════════════════════════

function ServiceStatusCard({ stats }: { stats: DashboardStats }) {
  const isRunning = stats.dbStatus === 'connected'

  return (
    <StatCard icon={Server} title="服务状态" description={`PID ${stats.pid} · ${stats.nodeVersion}`}>
      <div className="flex items-center gap-3 mb-3">
        <span className="relative flex size-3">
          <span className={cn(
            'absolute inline-flex h-full w-full rounded-full opacity-75',
            isRunning ? 'bg-[#5B8C5A] animate-pulse-dot' : 'bg-[#D04040]',
          )} />
          <span className={cn(
            'relative inline-flex rounded-full size-3',
            isRunning ? 'bg-[#5B8C5A]' : 'bg-[#D04040]',
          )} />
        </span>
        <span className={cn('text-base font-medium', isRunning ? 'text-[#5B8C5A]' : 'text-[#D04040]')}>
          {isRunning ? '运行中' : '异常'}
        </span>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-1.5 text-[#6B6459]"><Clock className="size-3" />运行时长</span>
          <span className="text-[#D8D2C8] font-mono tabular-nums">{stats.uptimeHuman}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-1.5 text-[#6B6459]"><Activity className="size-3" />启动时间</span>
          <span className="text-[#A09888] font-mono tabular-nums text-sm">
            {new Date(stats.serverStartTime).toLocaleString('zh-CN')}
          </span>
        </div>
      </div>
    </StatCard>
  )
}

// ═══════════════════════════════════════
// 卡片二：内存使用率
// ═══════════════════════════════════════

function MemoryCard({ stats }: { stats: DashboardStats }) {
  const pct = stats.memoryPercent

  return (
    <StatCard icon={Cpu} title="内存使用率" description={pct >= 75 ? '注意：内存使用较高' : '堆内存监控'}>
      <div className="mb-3">
        <div className="flex justify-between items-baseline mb-2">
          <span className={cn('text-3xl font-bold font-mono tabular-nums', memoryTextColor(pct))}>
            {pct.toFixed(1)}%
          </span>
          <span className="text-sm text-[#6B6459]">
            {stats.memory.heapUsedMb.toFixed(1)} / {stats.memory.heapTotalMb.toFixed(1)} MB
          </span>
        </div>
        <Progress
          value={pct}
          max={100}
          className="h-2 bg-white/[0.06] rounded-full"
          indicatorClassName={cn(memoryColor(pct), 'shadow-sm rounded-full')}
        />
      </div>
      <div className="grid grid-cols-2 gap-2 text-[13px]">
        <div className="flex justify-between px-2 py-1 rounded bg-white/[0.03]">
          <span className="text-[#6B6459]">RSS</span>
          <span className="text-[#D8D2C8] font-mono tabular-nums">{stats.memory.rssMb.toFixed(1)} MB</span>
        </div>
        <div className="flex justify-between px-2 py-1 rounded bg-white/[0.03]">
          <span className="text-[#6B6459]">External</span>
          <span className="text-[#A09888] font-mono tabular-nums">{formatBytes(stats.memory.external)}</span>
        </div>
      </div>
    </StatCard>
  )
}

// ═══════════════════════════════════════
// 卡片三：数据库
// ═══════════════════════════════════════

function DatabaseCard({ stats }: { stats: DashboardStats }) {
  return (
    <StatCard icon={Database} title="数据库" description={stats.dbType}>
      <div className="flex items-center gap-2 mb-3">
        <div className={cn('size-2 rounded-full', stats.dbStatus === 'connected' ? 'bg-[#5B8C5A]' : 'bg-[#D04040]')} />
        <span className={cn('text-base', stats.dbStatus === 'connected' ? 'text-[#5B8C5A]' : 'text-[#D04040]')}>
          {stats.dbStatus === 'connected' ? '已连接' : '未连接'}
        </span>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-1.5 text-[#6B6459]"><Activity className="size-3" />活跃会话</span>
          <span className={cn('text-base font-bold font-mono tabular-nums', stats.activeSessions > 0 ? 'text-[#B8964A]' : 'text-[#D8D2C8]')}>
            {stats.activeSessions}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-1.5 text-[#6B6459]"><HardDrive className="size-3" />库文件大小</span>
          <span className="text-[#A09888] font-mono tabular-nums">
            {stats.dbSizeMb > 0 ? `${stats.dbSizeMb.toFixed(2)} MB` : '—'}
          </span>
        </div>
      </div>
    </StatCard>
  )
}

// ═══════════════════════════════════════
// 卡片四：近期审计日志
// ═══════════════════════════════════════

function AuditSummaryCard({ stats }: { stats: DashboardStats }) {
  return (
    <StatCard icon={FileText} title="审计日志" description="操作记录概览">
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col items-center py-2.5 px-3 rounded-lg bg-white/[0.03] border border-white/[0.04]">
          <span className="text-3xl font-bold font-mono tabular-nums text-[#EDE8DF]">
            {stats.auditCount.toLocaleString()}
          </span>
          <span className="text-xs text-[#6B6459] mt-1">总计</span>
        </div>
        <div className="flex flex-col items-center py-2.5 px-3 rounded-lg bg-white/[0.03] border border-white/[0.04]">
          <span className={cn('text-3xl font-bold font-mono tabular-nums', stats.auditToday > 0 ? 'text-[#B8964A]' : 'text-[#6B6459]')}>
            {stats.auditToday.toLocaleString()}
          </span>
          <span className="text-xs text-[#6B6459] mt-1">今日新增</span>
        </div>
      </div>
      {stats.auditToday > 0 && (
        <p className="text-[12px] text-[#6B6459] mt-3 text-center">
          今日有 {stats.auditToday.toLocaleString()} 条操作记录
        </p>
      )}
    </StatCard>
  )
}

// ═══════════════════════════════════════
// Feature Badge
// ═══════════════════════════════════════

function FeatureBadge({
  emoji, label, value, detail,
}: {
  emoji: string
  label: string
  value: string
  detail: string
}) {
  return (
    <div className="bg-[#222839] border border-white/[0.04] rounded-lg p-3.5 hover:bg-[#2A3040] hover:border-white/[0.08] transition-all duration-200">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">{emoji}</span>
        <span className="text-sm text-[#6B6459]">{label}</span>
        <div className="ml-auto size-1.5 rounded-full bg-[#5B8C5A]" />
      </div>
      <div className="text-base font-bold text-[#EDE8DF] mb-1.5">{value}</div>
      <p className="text-sm text-[#6B6459] leading-relaxed line-clamp-2">{detail}</p>
    </div>
  )
}

// ═══════════════════════════════════════
// 主页面
// ═══════════════════════════════════════

const REFRESH_INTERVAL = 15_000

export default function DashboardPage({ apiHeaders }: DashboardPageProps) {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const data = await fetchStats(apiHeaders())
      setStats(data)
      setError(null)
    } catch (e: any) {
      setError(e.message)
    }
  }, [apiHeaders])

  useEffect(() => {
    load()
    const timer = setInterval(load, REFRESH_INTERVAL)
    return () => clearInterval(timer)
  }, [load])

  // ── 加载骨架 ──
  if (!stats && !error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2.5">
          <LayoutDashboard size={20} className="text-[#B8964A]" />
          <h2 className="text-xl font-semibold text-[#EDE8DF] tracking-[0.04em]">仪表盘</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-[#1A1F2E] border border-white/[0.04] rounded-xl p-6 animate-pulse">
              <div className="h-4 w-20 bg-white/[0.04] rounded mb-4" />
              <div className="h-8 w-16 bg-white/[0.04] rounded" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ── 错误态 ──
  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2.5">
          <LayoutDashboard size={20} className="text-[#B8964A]" />
          <h2 className="text-xl font-semibold text-[#EDE8DF] tracking-[0.04em]">仪表盘</h2>
        </div>
        <Card className="bg-[#1A1F2E] border-[#D04040]/20">
          <CardContent className="py-8 text-center">
            <p className="text-[#D04040] text-base">无法获取统计数据：{error}</p>
            <button
              onClick={load}
              className="mt-3 text-sm text-[#B8964A] hover:text-[#D8C08A] transition-colors"
            >
              点击重试
            </button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ── 正常态 ──
  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <LayoutDashboard size={20} className="text-[#B8964A]" />
            <h2 className="text-xl font-semibold text-[#EDE8DF] tracking-[0.04em]">仪表盘</h2>
          </div>
          <p className="text-sm text-[#6B6459] mt-1">
            刷新间隔 15s · 最后更新 {new Date(stats!.timestamp).toLocaleTimeString('zh-CN')}
          </p>
        </div>
        <button
          onClick={load}
          className="px-3 py-1.5 rounded-lg text-sm bg-white/[0.03] border border-white/[0.06] text-[#A09888] hover:bg-white/[0.06] hover:text-[#D8D2C8] transition-colors"
        >
          刷新
        </button>
      </div>

      {/* 4 卡片网格 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <ServiceStatusCard stats={stats!} />
        <MemoryCard stats={stats!} />
        <DatabaseCard stats={stats!} />
        <AuditSummaryCard stats={stats!} />
      </div>

      {/* Phase 4 功能状态面板 */}
      <div className="bg-[#1A1F2E] border border-white/[0.06] rounded-xl p-5">
        <h3 className="text-base font-semibold text-[#EDE8DF] tracking-[0.04em] mb-4 flex items-center gap-2">
          <span className="size-1.5 rounded-full bg-[#B8964A]" />
          Phase 4 系统功能矩阵
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <FeatureBadge emoji="🗄️" label="数据持久层" value="8 张表"
            detail="api_keys / prompt_templates / versions / app_configs / sessions / admin_sessions / audit_logs / module_settings" />
          <FeatureBadge emoji="🔧" label="满血工具系统" value="5 大工具"
            detail="solar_term_calc / calendar_lookup / classic_search / famous_chart_compare / web_search" />
          <FeatureBadge emoji="🛡️" label="L3 防幻觉护栏" value="热编辑"
            detail="L1 8条规则提示词 + L2 排盘拦截 + L3 管理后台热配置" />
          <FeatureBadge emoji="🤖" label="Multi-Agent" value="4 Agent"
            detail="Router(qwen2.5:7b) → 墨言(性格) / 墨行(事业) / 墨缘(婚姻) / 墨白(综合)" />
        </div>
      </div>
    </div>
  )
}
