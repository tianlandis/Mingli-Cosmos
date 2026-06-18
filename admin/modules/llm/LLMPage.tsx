// ============================================================
// Phase 4.4 — LLM 供应商管理主页面
// 文件：admin/modules/llm/LLMPage.tsx
// 职责：三区布局 — Provider 列表 | Provider 表单 | Skills 面板
// 数据流：GET /llm → 列表  ||  POST/PUT → 表单  ||  GET /tools + PUT /:id/tools → Skills
// ============================================================

import { useState, useEffect, useCallback } from 'react'
import {
  Plus,
  Trash2,
  Pencil,
  Cpu,
  CheckCircle2,
  XCircle,
  Circle,
  Wrench,
  Globe,
  Monitor,
  Keyboard,
  RefreshCw,
} from 'lucide-react'
import ProviderForm, { type ProviderFormData } from './ProviderForm'
import SkillsPanel from './SkillsPanel'

// ═══════════════════════════════════════
// 类型
// ═══════════════════════════════════════

interface Provider {
  id: number
  provider: string
  label: string
  baseUrl?: string | null
  model?: string | null
  temperature: number
  maxTokens: number
  isActive: number
  supportedTools: string[]
  testStatus: string
  testLatency?: number | null
  createdAt: string
  updatedAt: string
}

interface LLMPageProps {
  apiHeaders: Record<string, string>
}

// ═══════════════════════════════════════
// Provider 类型徽标
// ═══════════════════════════════════════

function ProviderBadge({ type }: { type: string }) {
  const map: Record<string, { label: string; icon: typeof Cpu; color: string }> = {
    openai: { label: 'OpenAI', icon: Cpu, color: '#10A37F' },
    deepseek: { label: 'DeepSeek', icon: Cpu, color: '#4D6BFE' },
    siliconflow: { label: 'SiliconFlow', icon: Cpu, color: '#8250DF' },
    claude: { label: 'Claude', icon: Cpu, color: '#D97706' },
    local: { label: '本地部署', icon: Monitor, color: '#5B8C5A' },
  }
  const info = map[type] ?? { label: type, icon: Globe, color: '#6B6459' }
  const Icon = info.icon
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium"
      style={{ color: info.color, background: `${info.color}15` }}
    >
      <Icon size={10} />
      {info.label}
    </span>
  )
}

// ═══════════════════════════════════════
// 主组件
// ═══════════════════════════════════════

export default function LLMPage({ apiHeaders }: LLMPageProps) {
  const [providers, setProviders] = useState<Provider[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // 表单状态
  const [formOpen, setFormOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Provider | null>(null)

  // Skills 面板：当前选中的 Provider
  const [selectedId, setSelectedId] = useState<number | null>(null)

  // ═══════════════════════════════
  // 拉取 Provider 列表
  // ═══════════════════════════════
  const fetchProviders = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/admin/llm', { headers: apiHeaders })
      const data = await res.json()
      if (data?.success) {
        setProviders(data.data)
        // 若当前选中项被删除，默认选第一个
        if (selectedId && !data.data.find((p: Provider) => p.id === selectedId)) {
          setSelectedId(data.data[0]?.id ?? null)
        } else if (!selectedId && data.data.length > 0) {
          setSelectedId(data.data[0].id)
        }
      }
    } catch {
      setError('加载失败，请检查网络连接')
    } finally {
      setLoading(false)
    }
  }, [apiHeaders, selectedId])

  useEffect(() => { fetchProviders() }, [])

  // ═══════════════════════════════
  // 新增 Provider
  // ═══════════════════════════════
  const handleCreate = useCallback(async (data: ProviderFormData) => {
    const res = await fetch('/api/v1/admin/llm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...apiHeaders },
      body: JSON.stringify(data),
    })
    const result = await res.json()
    if (!result.success) throw new Error(result?.error?.message ?? '创建失败')
    await fetchProviders()
  }, [apiHeaders, fetchProviders])

  // ═══════════════════════════════
  // 更新 Provider
  // ═══════════════════════════════
  const handleUpdate = useCallback(async (data: ProviderFormData) => {
    if (!editTarget) return
    const res = await fetch(`/api/v1/admin/llm/${editTarget.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...apiHeaders },
      body: JSON.stringify(data),
    })
    const result = await res.json()
    if (!result.success) throw new Error(result?.error?.message ?? '更新失败')
    setEditTarget(null)
    await fetchProviders()
  }, [editTarget, apiHeaders, fetchProviders])

  // ═══════════════════════════════
  // 删除 Provider
  // ═══════════════════════════════
  const handleDelete = useCallback(async (id: number) => {
    if (!confirm('确认删除此 Provider？此操作不可撤销。')) return
    await fetch(`/api/v1/admin/llm/${id}`, { method: 'DELETE', headers: apiHeaders })
    if (selectedId === id) setSelectedId(null)
    await fetchProviders()
  }, [apiHeaders, fetchProviders, selectedId])

  // ═══════════════════════════════
  // 选中 Provider
  // ═══════════════════════════════
  const selected = providers.find(p => p.id === selectedId) ?? null

  // ── 加载态 ──
  if (loading) {
    return (
      <div className="admin-card p-6 flex items-center gap-2 text-[#4A4540]">
        <RefreshCw size={14} className="animate-spin" />
        <span className="text-xs">加载 LLM 供应商列表...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ── 页面标题 ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[#EDE8DF] flex items-center gap-2">
            <Cpu size={18} className="text-[#B8964A]" />
            LLM 供应商管理
          </h2>
          <p className="text-xs text-[#6B6459] mt-0.5">
            配置 AI 模型后端，管理 Tool Calling 工具能力
          </p>
        </div>
        <button
          onClick={() => { setEditTarget(null); setFormOpen(true) }}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-[#EDE8DF] bg-[#C04030] hover:bg-[#A03024] rounded-md transition-colors"
        >
          <Plus size={14} />
          新增 Provider
        </button>
      </div>

      {error && (
        <div className="px-3 py-2 rounded-md bg-[#C04030]/10 border border-[#C04030]/20 text-[#D06050] text-xs">
          {error}
          <button onClick={fetchProviders} className="ml-2 underline">重试</button>
        </div>
      )}

      {/* ── 主内容：Provider 列表 + Skills 面板 ── */}
      {providers.length === 0 ? (
        <div className="admin-card p-12 text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-[#1A1816] border border-[#2A2622] flex items-center justify-center">
            <Keyboard size={22} className="text-[#4A4540]" />
          </div>
          <p className="text-[#6B6459] text-sm mb-1">尚未配置任何 LLM 供应商</p>
          <p className="text-[#4A4540] text-xs">
            点击右上角"新增 Provider"接入第一个 AI 后端，支持 OpenAI / DeepSeek / 本地 Ollama
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          {/* ── 左侧：Provider 列表 ── */}
          <div className="xl:col-span-1 space-y-2">
            <div className="flex items-center gap-2 mb-2 px-1">
              <span className="text-[10px] uppercase tracking-wider text-[#4A4540] font-medium">已接入 Provider</span>
              <span className="text-[10px] text-[#A09888]">{providers.length} 个</span>
            </div>

            {providers.map((p) => {
              const isSelected = p.id === selectedId
              return (
                <div
                  key={p.id}
                  onClick={() => setSelectedId(p.id)}
                  className={`
                    admin-card p-4 cursor-pointer transition-all duration-150
                    ${isSelected
                      ? 'border-[#B8964A]/60 shadow-[0_0_12px_rgba(184,150,74,0.08)] bg-[#1A1816]'
                      : 'border-[#2A2622] hover:border-[#3A3630] bg-[#1A1816]'
                    }
                  `}
                >
                  {/* 头部：名称 + 状态 + 操作 */}
                  <div className="flex items-start justify-between mb-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-sm font-medium text-[#EDE8DF] truncate">{p.label}</h4>
                        {p.testStatus === 'ok' ? (
                          <CheckCircle2 size={12} className="text-[#5B8C5A] shrink-0" />
                        ) : p.testStatus === 'failed' ? (
                          <XCircle size={12} className="text-[#C04030] shrink-0" />
                        ) : (
                          <Circle size={12} className="text-[#4A4540] shrink-0" />
                        )}
                      </div>
                      <ProviderBadge type={p.provider} />
                    </div>

                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setEditTarget(p)
                          setFormOpen(true)
                        }}
                        className="p-1 rounded text-[#4A4540] hover:text-[#A09888] hover:bg-[#211F1C] transition-colors"
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDelete(p.id)
                        }}
                        className="p-1 rounded text-[#4A4540] hover:text-[#D06050] hover:bg-[#C04030]/10 transition-colors"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>

                  {/* 模型信息 */}
                  {p.model && (
                    <p className="text-[10px] text-[#6B6459] font-mono mb-2 truncate">{p.model}</p>
                  )}

                  {/* 工具计数 */}
                  <div className="flex items-center gap-1.5 text-[10px] text-[#4A4540]">
                    <Wrench size={10} />
                    <span>{p.supportedTools?.length ?? 0} 个工具已绑定</span>
                  </div>

                  {/* 选中指示 */}
                  {isSelected && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-8 bg-[#B8964A] rounded-r" />
                  )}
                </div>
              )
            })}
          </div>

          {/* ── 右侧：Skills 面板 ── */}
          <div className="xl:col-span-2">
            <SkillsPanel
              providerId={selectedId}
              activeTools={selected?.supportedTools ?? []}
              apiHeaders={apiHeaders}
              onSaved={fetchProviders}
            />
          </div>
        </div>
      )}

      {/* ── Provider 表单弹窗 ── */}
      <ProviderForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditTarget(null) }}
        onSave={editTarget ? handleUpdate : handleCreate}
        initialData={
          editTarget
            ? {
                provider: editTarget.provider,
                label: editTarget.label,
                apiKey: '', // 编辑时留空，后端保留原 Key
                baseUrl: editTarget.baseUrl ?? undefined,
                model: editTarget.model ?? undefined,
                temperature: editTarget.temperature,
                maxTokens: editTarget.maxTokens,
                id: editTarget.id,
              }
            : undefined
        }
      />
    </div>
  )
}
