import { useState, useEffect, useCallback } from 'react'

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
  // 2026-06-19T01:43:00.000Z → 06-19 01:43
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function getActionBadge(action: string) {
  const map: Record<string, string> = {
    create: 'bg-green-100 text-green-700',
    update: 'bg-blue-100 text-blue-700',
    delete: 'bg-red-100 text-red-700',
    login: 'bg-emerald-100 text-emerald-700',
    logout: 'bg-slate-100 text-slate-600',
    revoke: 'bg-orange-100 text-orange-700',
    session_rejected: 'bg-red-100 text-red-700',
    session_revoked: 'bg-orange-100 text-orange-700',
  }
  return map[action] || 'bg-gray-100 text-gray-600'
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
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }
      const data = await res.json()
      // V1 API wraps response in { success: true, data: [...] }
      setLogs(data.data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [apiHeaders])

  useEffect(() => { load() }, [load])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-[#F5E6D3]">操作日志</h2>
        <button
          onClick={load}
          disabled={loading}
          className="text-sm text-amber-400 hover:text-amber-300 disabled:opacity-50"
        >
          {loading ? '刷新中...' : '刷新'}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-900/30 border border-red-800/50 rounded text-red-300 text-sm">
          {error}
        </div>
      )}

      <div className="bg-[#1A1510]/80 rounded-lg shadow-sm border border-[#3D3625]/50 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#2A2318] border-b border-[#3D3625]/50">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-[#8B7E6A]">时间</th>
              <th className="text-left px-4 py-3 font-medium text-[#8B7E6A]">操作</th>
              <th className="text-left px-4 py-3 font-medium text-[#8B7E6A]">资源</th>
              <th className="text-left px-4 py-3 font-medium text-[#8B7E6A]">详情</th>
              <th className="text-left px-4 py-3 font-medium text-[#8B7E6A]">操作者</th>
            </tr>
          </thead>
          <tbody>
            {loading && logs.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-[#6B6459]">
                  加载中...
                </td>
              </tr>
            )}
            {!loading && logs.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-[#6B6459]">
                  暂无操作记录
                </td>
              </tr>
            )}
            {logs.map(l => (
              <tr key={l.id} className="border-b border-[#3D3625]/30 last:border-0 hover:bg-[#2A2318]/50 transition-colors">
                <td className="px-4 py-3 text-[#8B7E6A] font-mono text-xs whitespace-nowrap">
                  {formatTime(l.createdAt)}
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${getActionBadge(l.action)}`}>
                    {l.action}
                  </span>
                </td>
                <td className="px-4 py-3 text-[#C4B393]">{l.resource}</td>
                <td className="px-4 py-3 text-[#6B6459] text-xs max-w-[200px] truncate" title={l.detail || undefined}>
                  {l.detail || '-'}
                </td>
                <td className="px-4 py-3 text-[#F5E6D3]">{l.operator}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
