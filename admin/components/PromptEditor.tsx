import { useState, useEffect, useCallback } from 'react'

interface PromptRow {
  id: number
  name: string
  displayName: string
  content: string
  version: number
  isActive: number
  description: string | null
}

export default function PromptEditor({ apiHeaders }: { apiHeaders: () => Record<string, string> }) {
  const [prompts, setPrompts] = useState<PromptRow[]>([])
  const [selected, setSelected] = useState<PromptRow | null>(null)
  const [editingContent, setEditingContent] = useState('')
  const [status, setStatus] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [newPrompt, setNewPrompt] = useState({ name: '', displayName: '', content: '' })

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/prompts', { headers: apiHeaders() })
    const data = await res.json()
    setPrompts(data.prompts || [])
  }, [apiHeaders])

  useEffect(() => { load() }, [load])

  const selectPrompt = (p: PromptRow) => {
    setSelected(p)
    setEditingContent(p.content)
    setShowNew(false)
  }

  const handleSave = async () => {
    if (!selected) return
    await fetch(`/api/admin/prompts/${selected.id}`, {
      method: 'PUT',
      headers: apiHeaders(),
      body: JSON.stringify({ content: editingContent }),
    })
    setStatus('已保存')
    load()
    setTimeout(() => setStatus(''), 2000)
  }

  const handleCreate = async () => {
    if (!newPrompt.name || !newPrompt.content) return
    await fetch('/api/admin/prompts', {
      method: 'POST',
      headers: apiHeaders(),
      body: JSON.stringify(newPrompt),
    })
    setShowNew(false)
    setNewPrompt({ name: '', displayName: '', content: '' })
    setStatus('已创建')
    load()
  }

  const handleDelete = async (id: number) => {
    if (!confirm('确定删除？')) return
    await fetch(`/api/admin/prompts/${id}`, { method: 'DELETE', headers: apiHeaders() })
    if (selected?.id === id) setSelected(null)
    load()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-slate-800">Prompt 模板</h2>
        <button onClick={() => { setShowNew(true); setSelected(null) }}
          className="px-3 py-1.5 bg-amber-600 text-white rounded text-sm hover:bg-amber-700">
          + 新建模板
        </button>
      </div>

      {status && <p className="text-sm text-green-600 mb-4">{status}</p>}

      <div className="flex gap-6">
        {/* Left: list */}
        <div className="w-64 flex-shrink-0">
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
            {prompts.map(p => (
              <button key={p.id}
                onClick={() => selectPrompt(p)}
                className={`w-full text-left px-4 py-2.5 border-b last:border-0 text-sm transition-colors ${
                  selected?.id === p.id ? 'bg-amber-50 border-l-2 border-l-amber-500 text-amber-800' : 'hover:bg-slate-50 text-slate-700'
                }`}>
                <div className="font-medium">{p.displayName || p.name}</div>
                <div className="text-xs text-slate-400">v{p.version} {p.isActive ? '· 启用' : '· 禁用'}</div>
              </button>
            ))}
            {prompts.length === 0 && (
              <div className="px-4 py-6 text-center text-slate-400 text-sm">暂无模板</div>
            )}
          </div>
        </div>

        {/* Right: editor */}
        <div className="flex-1">
          {showNew ? (
            <div className="bg-white rounded-lg p-4 shadow-sm border border-slate-200 space-y-3">
              <input value={newPrompt.name} onChange={e => setNewPrompt(p => ({ ...p, name: e.target.value }))}
                placeholder="模板标识 (如 anti-hallucination)" className="w-full px-3 py-1.5 border rounded text-sm" />
              <input value={newPrompt.displayName} onChange={e => setNewPrompt(p => ({ ...p, displayName: e.target.value }))}
                placeholder="显示名称 (如 防幻觉指令)" className="w-full px-3 py-1.5 border rounded text-sm" />
              <textarea value={newPrompt.content} onChange={e => setNewPrompt(p => ({ ...p, content: e.target.value }))}
                placeholder="模板内容..." rows={8} className="w-full px-3 py-1.5 border rounded text-sm font-mono" />
              <button onClick={handleCreate}
                className="px-4 py-1.5 bg-amber-600 text-white rounded text-sm hover:bg-amber-700">创建</button>
            </div>
          ) : selected ? (
            <div className="bg-white rounded-lg shadow-sm border border-slate-200">
              <div className="px-4 py-3 border-b flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-slate-800">{selected.displayName}</h3>
                  <p className="text-xs text-slate-400">ID: {selected.name} · v{selected.version}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={handleSave} className="px-3 py-1 bg-amber-600 text-white rounded text-xs hover:bg-amber-700">保存</button>
                  <button onClick={() => handleDelete(selected.id)} className="px-3 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600">删除</button>
                </div>
              </div>
              <textarea value={editingContent} onChange={e => setEditingContent(e.target.value)}
                rows={20} className="w-full px-4 py-3 font-mono text-sm border-0 resize-none focus:outline-none" />
            </div>
          ) : (
            <div className="bg-white rounded-lg p-8 text-center text-slate-400 shadow-sm border border-slate-200">
              选择一个模板开始编辑
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
