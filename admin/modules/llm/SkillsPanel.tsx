// ============================================================
// Phase 4.4 — SkillsPanel：工具开关面板 [核心组件]
// 文件：admin/modules/llm/SkillsPanel.tsx
// 职责：渲染工具卡片网格 × Switch 联动 × 一次性提交
// 数据流：tools-registry (source) → GET /tools (fetch) → useState (local) → PUT /:id/tools (submit)
// ============================================================

import { useState, useEffect, useCallback } from 'react'
import {
  Zap,
  Wrench,
  Save,
  RefreshCw,
  Star,
  Calendar,
  BookOpen,
  BarChart3,
  Globe,
} from 'lucide-react'
import { Switch } from '@/components/ui/switch'

// ═══════════════════════════════════════
// 类型定义
// ═══════════════════════════════════════

interface ToolDefinition {
  id: string
  name: string
  description: string
  category: 'astronomy' | 'calendar' | 'knowledge' | 'search' | 'analysis'
  requires?: string
}

interface SkillsPanelProps {
  /** 当前选中的 Provider ID */
  providerId: number | null
  /** Provider 当前已激活的工具 Key 列表 */
  activeTools: string[]
  /** API 请求头工厂（含 JWT） */
  apiHeaders: () => Record<string, string>
  /** 保存成功后回调 */
  onSaved?: () => void
}

// ═══════════════════════════════════════
// 类别 → 视觉映射
// ═══════════════════════════════════════

const CATEGORY_STYLE: Record<string, {
  label: string
  icon: typeof Zap
  activeBorder: string
  activeBg: string
  activeGlow: string
  inactiveBorder: string
}> = {
  astronomy: {
    label: '天文计算',
    icon: Star,
    activeBorder: 'border-[#B8964A]/80',
    activeBg: 'bg-[#B8964A]/6',
    activeGlow: 'shadow-[0_0_12px_rgba(184,150,74,0.15)]',
    inactiveBorder: 'border-[#2A2622]',
  },
  calendar: {
    label: '历法查询',
    icon: Calendar,
    activeBorder: 'border-[#C08040]/80',
    activeBg: 'bg-[#C08040]/6',
    activeGlow: 'shadow-[0_0_12px_rgba(192,128,64,0.15)]',
    inactiveBorder: 'border-[#2A2622]',
  },
  knowledge: {
    label: '典籍检索',
    icon: BookOpen,
    activeBorder: 'border-[#5B8C5A]/80',
    activeBg: 'bg-[#5B8C5A]/6',
    activeGlow: 'shadow-[0_0_12px_rgba(91,140,90,0.15)]',
    inactiveBorder: 'border-[#2A2622]',
  },
  search: {
    label: '联网搜索',
    icon: Globe,
    activeBorder: 'border-[#5B8C5A]/80',
    activeBg: 'bg-[#5B8C5A]/6',
    activeGlow: 'shadow-[0_0_12px_rgba(91,140,90,0.15)]',
    inactiveBorder: 'border-[#2A2622]',
  },
  analysis: {
    label: '智能分析',
    icon: BarChart3,
    activeBorder: 'border-[#8A5BB8]/80',
    activeBg: 'bg-[#8A5BB8]/6',
    activeGlow: 'shadow-[0_0_12px_rgba(138,91,184,0.15)]',
    inactiveBorder: 'border-[#2A2622]',
  },
}

// ═══════════════════════════════════════
// 组件
// ═══════════════════════════════════════

export default function SkillsPanel({
  providerId,
  activeTools: initialActiveTools,
  apiHeaders,
  onSaved,
}: SkillsPanelProps) {
  // ── Layer 1: 工具注册表（从后端拉取）──
  const [registry, setRegistry] = useState<ToolDefinition[]>([])
  const [registryLoading, setRegistryLoading] = useState(true)

  // ── Layer 2: 本地状态（乐观更新）──
  const [localActive, setLocalActive] = useState<Set<string>>(new Set(initialActiveTools))
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  // ── 同步外部 activeTools 变化 ──
  useEffect(() => {
    setLocalActive(new Set(initialActiveTools))
    setDirty(false)
    setError('')
    setSuccessMsg('')
  }, [initialActiveTools, providerId])

  // ── 拉取工具注册表 ──
  useEffect(() => {
    let cancelled = false
    setRegistryLoading(true)

    fetch('/api/v1/admin/llm/tools', { headers: apiHeaders() })
      .then(r => r.json())
      .then(data => {
        if (!cancelled && data?.success && Array.isArray(data.data)) {
          setRegistry(data.data)
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setRegistryLoading(false)
      })

    return () => { cancelled = true }
  }, [apiHeaders])

  // ── Switch 切换处理 ──
  const toggleTool = useCallback((toolId: string) => {
    setLocalActive(prev => {
      const next = new Set(prev)
      if (next.has(toolId)) {
        next.delete(toolId)
      } else {
        next.add(toolId)
      }
      return next
    })
    setDirty(true)
    setSuccessMsg('')
    setError('')
  }, [])

  // ── 提交保存 ──
  const handleSave = useCallback(async () => {
    if (providerId === null || !dirty) return

    setSaving(true)
    setError('')
    setSuccessMsg('')

    try {
      const toolsArr = Array.from(localActive)
      const res = await fetch(`/api/v1/admin/llm/${providerId}/tools`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...apiHeaders() },
        body: JSON.stringify({ supportedTools: toolsArr }),
      })

      const result = await res.json()

      if (!result.success) {
        setError(result?.error?.message ?? '保存失败')
        if (result?.error?.details?.invalidKeys?.length) {
          setError(`保存失败：工具 Key [${result.error.details.invalidKeys.join(', ')}] 未在注册表中`)
        }
        return
      }

      setDirty(false)
      setSuccessMsg(`已保存 ${toolsArr.length} 个工具配置`)
      onSaved?.()
    } catch {
      setError('网络异常，请检查连接后重试')
    } finally {
      setSaving(false)
    }
  }, [providerId, dirty, localActive, apiHeaders, onSaved])

  // ── 未选择 Provider ──
  if (providerId === null) {
    return (
      <div className="admin-card p-8 text-center">
        <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[#1A1816] border border-[#2A2622] flex items-center justify-center">
          <Wrench size={20} className="text-[#4A4540]" />
        </div>
        <p className="text-[#6B6459] text-sm">请先在左侧选择一个 LLM 供应商</p>
      </div>
    )
  }

  // ── 加载中 ──
  if (registryLoading) {
    return (
      <div className="admin-card p-6">
        <div className="flex items-center gap-2 text-[#4A4540]">
          <RefreshCw size={14} className="animate-spin" />
          <span className="text-xs">加载工具注册表...</span>
        </div>
      </div>
    )
  }

  // ── 渲染工具卡片网格 ──
  return (
    <div className="space-y-4">
      {/* 头部：标题 + 保存按钮 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wrench size={16} className="text-[#B8964A]" />
          <h3 className="text-sm font-semibold text-[#EDE8DF]">工具能力配置</h3>
          <span className="text-xs text-[#6B6459]">
            {localActive.size} / {registry.length} 已启用
          </span>
        </div>

        <button
          onClick={handleSave}
          disabled={!dirty || saving}
          className={`
            flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-medium
            transition-all duration-200
            ${dirty
              ? 'bg-[#5B8C5A] text-[#EDE8DF] hover:bg-[#4A7348] shadow-[0_0_12px_rgba(91,140,90,0.25)]'
              : 'bg-[#211F1C] text-[#4A4540] cursor-not-allowed'
            }
            disabled:cursor-not-allowed
          `}
        >
          {saving ? (
            <>
              <RefreshCw size={12} className="animate-spin" />
              保存中...
            </>
          ) : (
            <>
              <Save size={12} />
              {dirty ? '保存工具配置' : '已是最新'}
            </>
          )}
        </button>
      </div>

      {/* 提示信息 */}
      {error && (
        <div className="px-3 py-2 rounded-md bg-[#C04030]/10 border border-[#C04030]/20 text-[#D06050] text-xs">
          {error}
        </div>
      )}
      {successMsg && (
        <div className="px-3 py-2 rounded-md bg-[#5B8C5A]/10 border border-[#5B8C5A]/20 text-[#5B8C5A] text-xs">
          {successMsg}
        </div>
      )}

      {/* 工具卡片网格 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {registry.map((tool) => {
          const isActive = localActive.has(tool.id)
          const cat = CATEGORY_STYLE[tool.category] ?? CATEGORY_STYLE.knowledge
          const CatIcon = cat.icon

          return (
            <div
              key={tool.id}
              className={`
                relative rounded-lg border p-4 transition-all duration-200
                ${isActive
                  ? `${cat.activeBorder} ${cat.activeBg} ${cat.activeGlow}`
                  : `${cat.inactiveBorder} bg-[#1A1816]`
                }
              `}
            >
              {/* 卡片内容 */}
              <div className={isActive ? '' : 'opacity-50 saturate-0'}>
                {/* 类别标签 */}
                <div className="flex items-center gap-1.5 mb-2">
                  <CatIcon
                    size={14}
                    className={isActive ? 'text-[#B8964A]' : 'text-[#4A4540]'}
                  />
                  <span
                    className={`text-xs font-medium uppercase tracking-wider ${
                      isActive ? 'text-[#A09888]' : 'text-[#4A4540]'
                    }`}
                  >
                    {cat.label}
                  </span>
                </div>

                {/* 工具名 + 描述 */}
                <h4
                  className={`text-sm font-semibold mb-1 ${
                    isActive ? 'text-[#EDE8DF]' : 'text-[#4A4540]'
                  }`}
                >
                  {tool.name}
                </h4>
                <p
                  className={`text-sm leading-relaxed ${
                    isActive ? 'text-[#A09888]' : 'text-[#4A4540]'
                  }`}
                >
                  {tool.description}
                </p>

                {/* 依赖提示 */}
                {tool.requires && (
                  <span
                    className={`inline-block mt-2 text-xs px-1.5 py-0.5 rounded ${
                      isActive
                        ? 'bg-[#B8964A]/10 text-[#B8964A]'
                        : 'bg-[#2A2622] text-[#4A4540]'
                    }`}
                  >
                    requires: {tool.requires}
                  </span>
                )}
              </div>

              {/* Switch 开关 */}
              <div className="mt-3 flex items-center justify-between pt-3 border-t border-[#2A2622]">
                <span
                  className={`text-xs font-medium ${
                    isActive ? 'text-[#5B8C5A]' : 'text-[#4A4540]'
                  }`}
                >
                  {isActive ? '● 已激活' : '○ 未启用'}
                </span>
                <Switch
                  checked={isActive}
                  onCheckedChange={() => toggleTool(tool.id)}
                  className={
                    isActive
                      ? '!bg-[#5B8C5A]'
                      : '!bg-[#2A2622]'
                  }
                />
              </div>

              {/* 激活态脉冲指示器 */}
              {isActive && (
                <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-[#5B8C5A] shadow-[0_0_6px_rgba(91,140,90,0.6)] animate-pulse-dot" />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
