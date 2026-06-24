import { useState, useEffect, useCallback } from 'react'
import { ScrollText, RefreshCw, Clock, User, FileText, Tag } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

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
    create: 'bg-[#5B8C5A]/15 text-[#7AB87A] border-[#5B8C5A]/25',
    update: 'bg-[#4D6BFE]/15 text-[#7B90FF] border-[#4D6BFE]/25',
    delete: 'bg-[#D04040]/15 text-[#F07070] border-[#D04040]/25',
    login: 'bg-[#10A37F]/15 text-[#3EC9A7] border-[#10A37F]/25',
    logout: 'bg-[#6B6459]/15 text-[#A09888] border-[#6B6459]/25',
    revoke: 'bg-[#C08040]/15 text-[#E0A060] border-[#C08040]/25',
    session_rejected: 'bg-[#D04040]/15 text-[#F07070] border-[#D04040]/25',
    session_revoked: 'bg-[#C08040]/15 text-[#E0A060] border-[#C08040]/25',
  }
  return map[action] || 'bg-[#6B6459]/15 text-[#A09888] border-[#6B6459]/25'
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
            <ScrollText size={18} className="text-[#B8964A]" />
            操作日志
          </h2>
          <p className="text-sm text-[#6B6459] mt-0.5">系统操作审计与安全追溯</p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-[#B8964A] hover:text-[#D8C08A] bg-[#B8964A]/8 hover:bg-[#B8964A]/12 border border-[#B8964A]/15 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          {loading ? '刷新中...' : '刷新'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="px-3 py-2.5 rounded-lg bg-[#C04030]/10 border border-[#C04030]/20 text-[#D06050] text-sm flex items-center gap-2">
          <span className="size-1.5 rounded-full bg-[#C04030]" />
          {error}
          <button onClick={load} className="ml-auto underline hover:text-[#F07070]">重试</button>
        </div>
      )}

      {/* Table */}
      <Card className="bg-[#1A1F2E] border-white/[0.06] overflow-hidden">
        <CardContent className="p-0">
        <table className="w-full text-base">
          <thead>
            <tr className="border-b border-white/[0.06] bg-[#1A2332]/60">
              <th className="text-left px-5 py-3 text-[12px] font-medium text-[#6B6459] uppercase tracking-[0.08em]">
                <span className="flex items-center gap-1"><Clock size={10} />时间</span>
              </th>
              <th className="text-left px-5 py-3 text-[12px] font-medium text-[#6B6459] uppercase tracking-[0.08em]">
                <span className="flex items-center gap-1"><Tag size={10} />操作</span>
              </th>
              <th className="text-left px-5 py-3 text-[12px] font-medium text-[#6B6459] uppercase tracking-[0.08em]">
                <span className="flex items-center gap-1"><FileText size={10} />资源</span>
              </th>
              <th className="text-left px-5 py-3 text-[12px] font-medium text-[#6B6459] uppercase tracking-[0.08em]">详情</th>
              <th className="text-left px-5 py-3 text-[12px] font-medium text-[#6B6459] uppercase tracking-[0.08em]">
                <span className="flex items-center gap-1"><User size={10} />操作者</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {loading && logs.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-12 text-center text-[#4A4540] text-sm">
                  <RefreshCw size={14} className="animate-spin inline mr-2" />
                  加载中...
                </td>
              </tr>
            )}
            {!loading && logs.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-12 text-center text-[#4A4540] text-sm">
                  暂无操作记录
                </td>
              </tr>
            )}
            {logs.map(l => (
              <tr key={l.id} className="border-b border-white/[0.03] last:border-0 hover:bg-white/[0.02] transition-colors">
                <td className="px-5 py-3 text-[#6B6459] font-mono text-[13px] whitespace-nowrap">
                  {formatTime(l.createdAt)}
                </td>
                <td className="px-5 py-3">
                  <span className={`inline-flex px-2 py-0.5 rounded text-[12px] font-medium border ${getActionStyle(l.action)}`}>
                    {l.action}
                  </span>
                </td>
                <td className="px-5 py-3 text-[#A09888] text-sm">{l.resource}</td>
                <td className="px-5 py-3 text-[#6B6459] text-[13px] max-w-[260px] truncate" title={l.detail || undefined}>
                  {l.detail || '-'}
                </td>
                <td className="px-5 py-3 text-[#D8D2C8] text-sm">{l.operator}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </CardContent>
      </Card>
    </div>
  )
}
