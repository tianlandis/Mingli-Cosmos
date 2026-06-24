// ============================================================
// Phase 4d — ToolCallingPanel：Agent Tool Calling 工具配置
// 文件：admin/modules/llm/ToolCallingPanel.tsx
// 职责：3 项 Tool Calling 能力 Checkbox 开关
// 数据流：PUT /api/v1/admin/llm/:id/tool-calling → tools 字段
// ============================================================

import { useState, useEffect, useCallback } from 'react'
import {
  Wrench,
  Save,
  RefreshCw,
  Calculator,
  BookOpen,
  Send,
  Bot,
} from 'lucide-react'
import { Switch } from '@/components/ui/switch'

// ═══════════════════════════════════════
// Tool Calling 工具定义（Agent 逻辑未来实现）
// ═══════════════════════════════════════

interface TcToolDefinition {
  id: string
  name: string
  description: string
  icon: string  // 'calculator' | 'book' | 'send'
  category: string
}

const TC_TOOLS: TcToolDefinition[] = [
  {
    id: 'bazi_calculator',
    name: '八字核心排盘引擎',
    description: 'Agent 可调用本地排盘引擎完成四柱、大运、流年、神煞等核心计算，无需依赖外部 API',
    icon: 'calculator',
    category: '核心引擎',
  },
  {
    id: 'knowledge_dict_lookup',
    name: '动态规则字典查阅',
    description: 'Agent 可实时查询命理知识字典（35 项规则资产），获取藏干、神煞、格局等权威数据',
    icon: 'book',
    category: '知识检索',
  },
  {
    id: 'feishu_bot_notifier',
    name: '飞书机器人推送',
    description: '分析完成后通过飞书 Bot 自动推送命理报告摘要，支持 Webhook 配置与模板消息',
    icon: 'send',
    category: '消息通知',
  },
]

const ICON_MAP: Record<string, React.ElementType> = {
  calculator: Calculator,
  book: BookOpen,
  send: Send,
}

const CATEGORY_COLORS: Record<string, string> = {
  '核心引擎': '#B8964A',
  '知识检索': '#5B8C5A',
  '消息通知': '#4D6BFE',
}

// ═══════════════════════════════════════
// Props
// ═══════════════════════════════════════

interface ToolCallingPanelProps {
  providerId: number | null
  activeTools: string[]
  apiHeaders: () => Record<string, string>
  onSaved?: () => void
}

// ═══════════════════════════════════════
// 组件
// ═══════════════════════════════════════

export default function ToolCallingPanel({
  providerId,
  activeTools: initialActiveTools,
  apiHeaders,
  onSaved,
}: ToolCallingPanelProps) {
  const [localActive, setLocalActive] = useState<Set<string>>(new Set(initialActiveTools))
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  useEffect(() => {
    setLocalActive(new Set(initialActiveTools))
    setDirty(false)
    setError('')
    setSuccessMsg('')
  }, [initialActiveTools, providerId])

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

  const handleSave = useCallback(async () => {
    if (providerId === null || !dirty) return

    setSaving(true)
    setError('')
    setSuccessMsg('')

    try {
      const toolsArr = Array.from(localActive)
      const res = await fetch(`/api/v1/admin/llm/${providerId}/tool-calling`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...apiHeaders() },
        body: JSON.stringify({ tools: toolsArr }),
      })

      const result = await res.json()

      if (!result.success) {
        setError(result?.error?.message ?? '保存失败')
        return
      }

      setDirty(false)
      setSuccessMsg(`已保存 ${toolsArr.length} 个 Tool Calling 配置`)
      onSaved?.()
    } catch {
      setError('网络异常，请检查连接后重试')
    } finally {
      setSaving(false)
    }
  }, [providerId, dirty, localActive, apiHeaders, onSaved])

  if (providerId === null) {
    return (
      <div className="p-6 text-center">
        <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-[#1A1816] border border-[#2A2622] flex items-center justify-center">
          <Bot size={16} className="text-[#4A4540]" />
        </div>
        <p className="text-[#6B6459] text-xs">请先在左侧选择一个 LLM 供应商</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot size={14} className="text-[#B8964A]" />
          <h3 className="text-sm font-semibold text-[#EDE8DF]">Agent Tool Calling</h3>
          <span className="text-[9px] text-[#6B6459] bg-[#1A1816] px-1.5 py-0.5 rounded border border-[#2A2622]">
            存储层就绪 · Agent 逻辑未来实现
          </span>
        </div>

        <button
          onClick={handleSave}
          disabled={!dirty || saving}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-medium transition-all duration-200 ${
            dirty
              ? 'bg-[#5B8C5A] text-[#EDE8DF] hover:bg-[#4A7348] shadow-[0_0_12px_rgba(91,140,90,0.25)]'
              : 'bg-[#211F1C] text-[#4A4540] cursor-not-allowed'
          }`}
        >
          {saving ? (
            <>
              <RefreshCw size={12} className="animate-spin" />
              保存中...
            </>
          ) : (
            <>
              <Save size={12} />
              {dirty ? '保存配置' : '已是最新'}
            </>
          )}
        </button>
      </div>

      {/* 说明 */}
      <p className="text-[10px] text-[#4A4540] leading-relaxed">
        勾选需要 Agent 启用的 Tool Calling 能力。当前仅作配置存储，Agent 调用逻辑将在后续版本实现。
      </p>

      {/* 消息 */}
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

      {/* 工具列表 */}
      <div className="space-y-2">
        {TC_TOOLS.map((tool) => {
          const isActive = localActive.has(tool.id)
          const IconComp = ICON_MAP[tool.icon] ?? Wrench
          const catColor = CATEGORY_COLORS[tool.category] ?? '#6B6459'

          return (
            <div
              key={tool.id}
              className={`flex items-center gap-3 p-3 rounded-lg border transition-all duration-200 ${
                isActive
                  ? 'bg-white/[0.04] border-white/[0.10]'
                  : 'bg-[#1A1816] border-[#2A2622] opacity-50'
              }`}
            >
              {/* 图标 */}
              <div
                className="size-8 flex items-center justify-center rounded-md shrink-0"
                style={{
                  background: isActive ? `${catColor}18` : 'transparent',
                  border: `1px solid ${isActive ? `${catColor}30` : '#2A2622'}`,
                }}
              >
                <IconComp size={14} style={{ color: isActive ? catColor : '#4A4540' }} />
              </div>

              {/* 信息 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className={`text-sm font-medium ${isActive ? 'text-[#EDE8DF]' : 'text-[#4A4540]'}`}>
                    {tool.name}
                  </h4>
                  <span
                    className="text-[8px] px-1 py-0.5 rounded"
                    style={{
                      background: `${catColor}18`,
                      color: catColor,
                      border: `0.5px solid ${catColor}30`,
                    }}
                  >
                    {tool.category}
                  </span>
                </div>
                <p className={`text-[11px] leading-relaxed mt-0.5 ${isActive ? 'text-[#A09888]' : 'text-[#4A4540]'}`}>
                  {tool.description}
                </p>
              </div>

              {/* Switch */}
              <Switch
                checked={isActive}
                onCheckedChange={() => toggleTool(tool.id)}
                className={isActive ? '!bg-[#5B8C5A]' : '!bg-[#2A2622]'}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
