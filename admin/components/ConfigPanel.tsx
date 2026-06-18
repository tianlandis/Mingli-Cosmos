import { useState, useEffect, useCallback } from 'react'

interface ConfigRow {
  id: number
  key: string
  value: string
  displayName: string | null
  description: string | null
}

export default function ConfigPanel({ apiHeaders }: { apiHeaders: () => Record<string, string> }) {
  const [configs, setConfigs] = useState<ConfigRow[]>([])
  const [usingDb, setUsingDb] = useState(false)
  const [newKey, setNewKey] = useState('')
  const [newValue, setNewValue] = useState('')
  const [status, setStatus] = useState('')

  const load = useCallback(async () => {
    const res = await fetch('/api/v1/admin/config', { headers: apiHeaders() })
    const data = await res.json()
    // V1 API wraps response in { success, data: { configs, usingDb } }
    setConfigs(data.data?.configs || [])
    setUsingDb(data.data?.usingDb || false)
  }, [apiHeaders])

  useEffect(() => { load() }, [load])

  const handleAdd = async () => {
    if (!newKey || !newValue) return
    await fetch('/api/v1/admin/config', {
      method: 'POST',
      headers: apiHeaders(),
      body: JSON.stringify({ key: newKey, value: newValue, displayName: newKey }),
    })
    setNewKey('')
    setNewValue('')
    setStatus('已保存')
    load()
    setTimeout(() => setStatus(''), 2000)
  }

  const handleReload = async () => {
    const res = await fetch('/api/v1/admin/config/reload', { method: 'POST', headers: apiHeaders() })
    const data = await res.json()
    setStatus(`配置已刷新，来源: ${data.data?.source || data.source || 'unknown'}`)
    load()
  }

  const handleDelete = async (key: string) => {
    await fetch(`/api/v1/admin/config/${key}`, { method: 'DELETE', headers: apiHeaders() })
    load()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-slate-800">系统配置</h2>
        <div className="flex items-center gap-3">
          <span className={`text-sm px-2 py-0.5 rounded ${usingDb ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
            {usingDb ? 'DB 模式' : '.env 回退'}
          </span>
          <button onClick={handleReload} className="text-sm text-amber-600 hover:text-amber-800">
            刷新缓存
          </button>
        </div>
      </div>

      {status && <p className="text-sm text-green-600 mb-4">{status}</p>}

      {/* Add form */}
      <div className="bg-white rounded-lg p-4 mb-6 shadow-sm border border-slate-200">
        <h3 className="text-sm font-medium text-slate-700 mb-3">新增配置</h3>
        <div className="flex gap-3">
          <input value={newKey} onChange={e => setNewKey(e.target.value)}
            placeholder="配置键" className="flex-1 px-3 py-1.5 border rounded text-sm" />
          <input value={newValue} onChange={e => setNewValue(e.target.value)}
            placeholder="值" className="flex-1 px-3 py-1.5 border rounded text-sm" />
          <button onClick={handleAdd}
            className="px-4 py-1.5 bg-amber-600 text-white rounded text-sm hover:bg-amber-700">
            保存
          </button>
        </div>
      </div>

      {/* Config list */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="text-left px-4 py-2 font-medium text-slate-600">键</th>
              <th className="text-left px-4 py-2 font-medium text-slate-600">值</th>
              <th className="text-left px-4 py-2 font-medium text-slate-600 w-20">操作</th>
            </tr>
          </thead>
          <tbody>
            {configs.map(c => (
              <tr key={c.id} className="border-b last:border-0 hover:bg-slate-50">
                <td className="px-4 py-2 font-mono text-xs text-slate-700">{c.key}</td>
                <td className="px-4 py-2 text-slate-600">{c.value}</td>
                <td className="px-4 py-2">
                  <button onClick={() => handleDelete(c.key)}
                    className="text-red-500 hover:text-red-700 text-xs">删除</button>
                </td>
              </tr>
            ))}
            {configs.length === 0 && (
              <tr><td colSpan={3} className="px-4 py-6 text-center text-slate-400">暂无配置</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
