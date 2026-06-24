// ============================================================
// Phase 4d — ToolCallingPanel：Agent Tool Calling 工具配置
// 文件：admin/modules/llm/ToolCallingPanel.tsx
// 职责：3 项 Tool Calling 能力 Checkbox 开关
// 数据流：onChange → 即时 PUT /api/v1/admin/llm/:id/tool-calling → tools 字段
// ============================================================

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Wrench,
  RefreshCw,
  Calculator,
  BookOpen,
  Send,
  Bot,
  CheckCircle2,
  AlertTriangle,
  Loader2,
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
// 工具函数：归一化 tools 字段（防御 JSON 字符串 / 数组混传）
// ═══════════════════════════════════════

function normalizeToolsArray(raw: unknown): string[] {
  if (!raw) return []
  // 情况 1：已是纯数组
  if (Array.isArray(raw)) {
    return raw.filter((v): v is string => typeof v === 'string')
  }
  // 情况 2：JSON 字符串（DB 直读未解析）
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        return parsed.filter((v): v is string => typeof v === 'string')
      }
    } catch { /* 不是合法 JSON，返回空 */ }
  }
  // 情况 3：其他类型 → 空数组
  return []
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
  const [globalError, setGlobalError] = useState('')
  const [savingTools, setSavingTools] = useState<Set<string>>(new Set())       // 正在保存的工具
  const [savedBlinks, setSavedBlinks] = useState<Set<string>>(new Set())       // 保存成功闪烁
  const blinkTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  useEffect(() => {
    // ── 关键修复：归一化 tools 字段，兼容 JSON 字符串 / 数组混合传参 ──
    const normalized = normalizeToolsArray(initialActiveTools)
    setLocalActive(new Set(normalized))
    setGlobalError('')
    setSavingTools(new Set())
    setSavedBlinks(new Set())
    // 清理旧的 blink timers
    blinkTimers.current.forEach(t => clearTimeout(t))
    blinkTimers.current.clear()
  }, [initialActiveTools, providerId])

  // ── 切换 + 即时保存 ──
  const toggleTool = useCallback(async (toolId: string) => {
    // 1. 乐观更新本地状态
    const newActive = new Set(localActive.has(toolId)
      ? [...localActive].filter(id => id !== toolId)
      : [...localActive, toolId])
    setLocalActive(newActive)
    setGlobalError('')

    // 2. 标记正在保存
    setSavingTools(prev => new Set([...prev, toolId]))

    // 3. 即时 PUT API
    try {
      const toolsArr = Array.from(newActive)
      const res = await fetch(`/api/v1/admin/llm/${providerId}/tool-calling`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...apiHeaders() },
        body: JSON.stringify({ tools: toolsArr }),
      })

      const result = await res.json()

      if (!result.success) {
        // 回滚本地状态
        setLocalActive(new Set(localActive))
        setGlobalError(result?.error?.message ?? `保存 "${toolId}" 失败`)
        return
      }

      // 4. 保存成功 → 闪烁对勾
      setSavedBlinks(prev => {
        const next = new Set([...prev, toolId])
        // 1.5s 后移除闪烁
        const existing = blinkTimers.current.get(toolId)
        if (existing) clearTimeout(existing)
        blinkTimers.current.set(toolId, setTimeout(() => {
          setSavedBlinks(prev2 => {
            const n = new Set(prev2)
            n.delete(toolId)
            return n
          })
        }, 1500))
        return next
      })

      onSaved?.()
    } catch {
      // 网络异常 → 回滚
      setLocalActive(new Set(localActive))
      setGlobalError('网络异常，请检查连接后重试')
    } finally {
      setSavingTools(prev => {
        const next = new Set(prev)
        next.delete(toolId)
        return next
      })
    }
  }, [localActive, providerId, apiHeaders, onSaved])

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
          <span className="text-sm text-[#5B8C5A] bg-[#5B8C5A]/10 px-1.5 py-0.5 rounded border border-[#5B8C5A]/15">
            即时生效 · 已激活 {localActive.size}/{TC_TOOLS.length}
          </span>
        </div>
      </div>

      {/* 说明 */}
      <p className="text-xs text-[#4A4540] leading-relaxed">
        拨动开关即时调用 PUT API 写入数据库。AI 引擎将在下次请求时自动读取最新配置。
      </p>

      {/* 全局错误 */}
      {globalError && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-[#C04030]/10 border border-[#C04030]/20 text-[#D06050] text-xs">
          <AlertTriangle size={12} />
          {globalError}
        </div>
      )}

      {/* 工具列表 */}
      <div className="space-y-2">
        {TC_TOOLS.map((tool) => {
          const isActive = localActive.has(tool.id)
          const isSaving = savingTools.has(tool.id)
          const isSaved = savedBlinks.has(tool.id)
          const IconComp = ICON_MAP[tool.icon] ?? Wrench
          const catColor = CATEGORY_COLORS[tool.category] ?? '#6B6459'

          return (
            <div
              key={tool.id}
              className={`flex items-center gap-3 p-3 rounded-lg border transition-all duration-200 ${
                isActive
                  ? 'bg-white/[0.04] border-white/[0.10]'
                  : 'bg-[#1A1816] border-[#2A2622] opacity-100 cursor-pointer'
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
                    className="text-sm px-1 py-0.5 rounded"
                    style={{
                      background: `${catColor}18`,
                      color: catColor,
                      border: `0.5px solid ${catColor}30`,
                    }}
                  >
                    {tool.category}
                  </span>
                </div>
                <p className={`text-sm leading-relaxed mt-0.5 ${isActive ? 'text-[#A09888]' : 'text-[#4A4540]'}`}>
                  {tool.description}
                </p>
              </div>

              {/* 状态指示器 + Switch */}
              <div className="flex items-center gap-2 shrink-0">
                {isSaving ? (
                  <Loader2 size={12} className="animate-spin text-[#B8964A]" />
                ) : isSaved ? (
                  <CheckCircle2 size={12} className="text-[#5B8C5A] animate-in fade-in" />
                ) : (
                  <span className="w-3" />
                )}
                <Switch
                  checked={isActive}
                  disabled={isSaving}
                  onCheckedChange={() => toggleTool(tool.id)}
                  className={isActive ? '!bg-[#5B8C5A]' : '!bg-[#2A2622]'}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
