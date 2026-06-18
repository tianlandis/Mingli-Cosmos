import { useState, useEffect, useCallback } from 'react'

interface AuditRow {
  id: number
  action: string
  resource: string
  resourceId: number | null
  detail: string | null
  operator: string
  createdAt: string
}

export default function AuditLog({ apiHeaders }: { apiHeaders: () => Record<string, string> }) {
  const [logs, setLogs] = useState<AuditRow[]>([])

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/audit', { headers: apiHeaders() })
    // audit API not yet implemented; placeholder
  }, [apiHeaders])

  useEffect(() => { load() }, [load])

  return (
    <div>
      <h2 className="text-xl font-bold text-slate-800 mb-6">操作日志</h2>
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="text-left px-4 py-2 font-medium text-slate-600">时间</th>
              <th className="text-left px-4 py-2 font-medium text-slate-600">操作</th>
              <th className="text-left px-4 py-2 font-medium text-slate-600">资源</th>
              <th className="text-left px-4 py-2 font-medium text-slate-600">操作者</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-400">暂无操作记录</td></tr>
            ) : (
              logs.map(l => (
                <tr key={l.id} className="border-b last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-2 text-slate-500">{l.createdAt}</td>
                  <td className="px-4 py-2">
                    <span className={`px-1.5 py-0.5 rounded text-xs ${
                      l.action === 'create' ? 'bg-green-100 text-green-700' :
                      l.action === 'delete' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                    }`}>{l.action}</span>
                  </td>
                  <td className="px-4 py-2 text-slate-600">{l.resource}</td>
                  <td className="px-4 py-2 text-slate-500">{l.operator}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
