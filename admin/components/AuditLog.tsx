import { useState, useEffect, useCallback } from 'react'
import { ScrollText, RefreshCw, Clock, User, FileText, Tag } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'

interface AuditRow {
  id: number
  action: string
  resource: string
  resourceId: number | null
  detail: string | null
  operator: string
  ip?: string
  createdAt: string
}

function formatTime(iso: string): string {
  if (!iso) return '-'
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
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

export default function AuditLog({ apiHeaders }: { apiHeaders: () => Record<string, string> }) {
  const [logs, setLogs] = useState<AuditRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/v1/admin/audit', { headers: apiHeaders() })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setLogs(data.data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [apiHeaders])

  useEffect(() => { load() }, [load])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-[#EDE8DF] flex items-center gap-2 tracking-[0.04em]">
            <div className="size-8 flex items-center justify-center rounded-lg bg-[#B8964A]/10 border border-[#B8964A]/20">
              <ScrollText size={16} className="text-[#B8964A]" />
            </div>
            操作日志
          </h2>
          <p className="text-sm text-[#6B6459] mt-1 ml-[42px]">系统操作审计与安全追溯</p>
        </div>
        <Button
          onClick={load}
          disabled={loading}
          variant="ghost"
          className="text-[#B8964A] hover:text-[#D8C08A] hover:bg-[#B8964A]/10 border border-[#B8964A]/15"
        >
          <RefreshCw size={12} className={cn('mr-1.5', loading && 'animate-spin')} />
          {loading ? '刷新中...' : '刷新'}
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
          <span className="size-1.5 rounded-full bg-red-400" />
          {error}
          <button onClick={load} className="ml-auto underline hover:text-red-300">重试</button>
        </div>
      )}

      {/* Table — 使用 shadcn Table 组件 */}
      <Card className="bg-[#1A1F2E] border-white/[0.06] overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-white/[0.06] bg-[#1A2332]/60 hover:bg-[#1A2332]/60">
                <TableHead className="text-[11px] text-[#6B6459] font-medium uppercase tracking-[0.08em] whitespace-nowrap">
                  <span className="flex items-center gap-1"><Clock size={10} />时间</span>
                </TableHead>
                <TableHead className="text-[11px] text-[#6B6459] font-medium uppercase tracking-[0.08em]">
                  <span className="flex items-center gap-1"><Tag size={10} />操作</span>
                </TableHead>
                <TableHead className="text-[11px] text-[#6B6459] font-medium uppercase tracking-[0.08em]">
                  <span className="flex items-center gap-1"><FileText size={10} />资源</span>
                </TableHead>
                <TableHead className="text-[11px] text-[#6B6459] font-medium uppercase tracking-[0.08em] hidden md:table-cell">
                  详情
                </TableHead>
                <TableHead className="text-[11px] text-[#6B6459] font-medium uppercase tracking-[0.08em]">
                  <span className="flex items-center gap-1"><User size={10} />操作者</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && logs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-[#4A4540] text-sm">
                    <RefreshCw size={14} className="animate-spin inline mr-2" />
                    加载中...
                  </TableCell>
                </TableRow>
              )}
              {!loading && logs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-[#4A4540] text-sm">
                    暂无操作记录
                  </TableCell>
                </TableRow>
              )}
              {logs.map(l => (
                <TableRow key={l.id} className="border-white/[0.03] hover:bg-white/[0.02]">
                  <TableCell className="text-xs text-[#6B6459] font-mono whitespace-nowrap">
                    {formatTime(l.createdAt)}
                  </TableCell>
                  <TableCell>
                    <Badge className={cn('text-[10px] font-medium border', getActionStyle(l.action))}>
                      {l.action}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-[#A09888]">{l.resource}</TableCell>
                  <TableCell className="text-[13px] text-[#6B6459] max-w-[260px] truncate hidden md:table-cell" title={l.detail || undefined}>
                    {l.detail || '-'}
                  </TableCell>
                  <TableCell className="text-sm text-[#D8D2C8]">{l.operator}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
