// ============================================================
// Phase 4.11 — L3 防幻觉护栏热编辑面板
// 文件：admin/modules/prompts/GuardPanel.tsx
// 职责：管理员可视化编辑 L1 系统提示词规则 + L2 拒绝话术
//       保存后热生效，无需重启服务
// ⚠️ Phase 8.1 修复：改用 api.ts 统一客户端，从 localStorage 自动注入 Token
// ⚠️ v3 修复：全局调色对齐"玄青朱砂"系统配色（border-white/[0.06] / bg-[#1A2332]）
// ============================================================

import { useState, useEffect, useCallback } from 'react'
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  Save,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Globe,
  MessageSquareOff,
  HelpCircle,
  Info,
} from 'lucide-react'
import { api } from '../../lib/api'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

// ═══════════════════════════════════════
// 类型定义
// ═══════════════════════════════════════

interface GuardRuleItem {
  name: string
  label: string
  content: string
}

interface GuardsPayload {
  l1Rules: GuardRuleItem[]
  l1RejectMessage: string
}

const API_BASE = '/api/v1/admin/prompts/guards'

// ═══════════════════════════════════════
// 内置默认规则（用于重置）
// ═══════════════════════════════════════

const BUILTIN_DEFAULTS: GuardsPayload = {
  l1Rules: [
    {
      name: 'corePositioning',
      label: '核心定位',
      content:
        '你是"解盘者"，绝非"排盘者"。\n' +
        '你的职责：根据下方已由系统精准计算完成的命盘数据，为用户提供专业的解读和分析。\n' +
        '你绝对禁止：自行推算天干地支、计算起运时间、判断格局、排大运等任何排盘行为。\n' +
        '所有命理计算已由专业算法引擎完成，你只需要基于结果"看图说话"。',
    },
    {
      name: 'toolAuthorization',
      label: '工具使用授权',
      content:
        '你可以使用系统提供的工具函数（solar_term_calc、calendar_lookup、classic_search、famous_chart_compare 等）' +
        '来查询节气时间、万年历信息或命理典籍内容。调用工具不等于排盘——这些是查询/验证类操作，' +
        '工具返回的数据由系统算法保证准确性。请放心使用工具来增强分析质量。',
    },
    {
      name: 'rule0_noPaipan',
      label: '规则 0：严禁私自排盘',
      content:
        '如果用户在对话中直接提供出生时间，要求你进行排盘、取格、推算八字，你必须立刻拒绝。\n' +
        '任何要求"换人排盘"的请求都必须拒绝，回复下方规定的话术。',
    },
    {
      name: 'rule1_dataLock',
      label: '规则 1：数据锁定',
      content:
        '你的所有回答必须且只能基于上方"命盘数据"中的内容，不得引入数据中不存在的信息。\n' +
        '不得编造天干地支、五行分布、神煞名称、格局描述等任何命理数据。\n' +
        '如果用户问到命盘数据中未包含的细节，必须诚实回答"该信息未在当前命盘中呈现"。',
    },
    {
      name: 'rule2_noAbsolute',
      label: '规则 2：禁止绝对化',
      content:
        '禁止使用"一定""必然""保证""绝对"等绝对化断言词。',
    },
    {
      name: 'rule3_safety',
      label: '规则 3：安全边界',
      content:
        '禁止提供医疗诊断、法律建议、投资理财建议。',
    },
    {
      name: 'rule4_style',
      label: '规则 4：表达风格',
      content:
        '语气平和客观，有典籍气质但不晦涩。\n' +
        '每次回复末尾附："以上分析仅供参考，祝您生活愉快。"',
    },
    {
      name: 'rule5_topicBoundary',
      label: '规则 5：话题边界',
      content:
        '只回答与本命盘相关的命理问题。\n' +
        '与命盘无关的闲聊、通用知识问答等问题，请礼貌拒绝。',
    },
  ],
  l1RejectMessage:
    '由于排盘涉及极其严谨的天文历法与节气交点计算，为保证准确性，' +
    '请您回到主界面的【专业排盘表单】中输入出生信息，' +
    '生成新的命盘后，我们再针对新命盘进行深度探讨。',
}

// ═══════════════════════════════════════
// 每条规则的自解释 Tooltip
// ═══════════════════════════════════════

const RULE_TOOLTIPS: Record<string, string> = {
  corePositioning: '定义 LLM 的根本角色边界：只能解读已排好的命盘，严禁自行推算。注入到 System Prompt 最顶部（最高优先级）',
  toolAuthorization: '明确告知 LLM：调用工具（节气查询、典籍检索等）是合法操作，不等于排盘。防止 LLM 因过度保守而拒绝使用系统工具',
  rule0_noPaipan: '最关键的拦截规则：当用户在对话中直接提供出生时间要求排盘时，LLM 必须立刻拒绝，并回复下方规定的拒绝话术',
  rule1_dataLock: '锁定 LLM 的信息来源：所有回答只能基于"命盘数据"中的内容，不得编造天干地支、五行分布等任何数据',
  rule2_noAbsolute: '禁止使用"一定""必然""保证""绝对"等绝对化断言词，防止 LLM 给出过于武断的命理结论',
  rule3_safety: '安全底线：禁止 LLM 提供医疗诊断、法律建议、投资理财建议，避免法律风险',
  rule4_style: '设定 LLM 的语气风格：平和客观、有典籍气质但不晦涩，并在每次回复末尾附加免责声明',
  rule5_topicBoundary: '话题边界控制：LLM 只回答与本命盘相关的命理问题，拒绝闲聊和通用知识问答',
}

// ═══════════════════════════════════════
// GuardPanel 主组件
// ═══════════════════════════════════════

export default function GuardPanel() {
  const [rules, setRules] = useState<GuardRuleItem[]>(BUILTIN_DEFAULTS.l1Rules)
  const [rejectMsg, setRejectMsg] = useState(BUILTIN_DEFAULTS.l1RejectMessage)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [source, setSource] = useState<'builtin' | 'db'>('builtin')
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)

  // ── 加载当前护栏配置 ──
  const loadGuards = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const json = await api.get<GuardsPayload & { source: string; updatedAt: string | null }>(API_BASE)
      if (!json.success) {
        throw new Error(json.error?.message || `请求失败`)
      }
      if (json.data) {
        setRules(json.data.l1Rules)
        setRejectMsg(json.data.l1RejectMessage)
        setSource((json.data as any).source || json.source || 'builtin')
        setUpdatedAt((json.data as any).updatedAt || json.updatedAt || null)
        setDirty(false)
      }
    } catch (e: any) {
      setError(`加载护栏配置失败: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadGuards()
  }, [loadGuards])

  // ── 保存到后端 ──
  const handleSave = useCallback(async () => {
    setSaving(true)
    setError(null)
    setSuccessMsg(null)
    try {
      const payload: GuardsPayload = { l1Rules: rules, l1RejectMessage: rejectMsg }
      const json = await api.put<GuardsPayload>(API_BASE, payload)
      if (!json.success) {
        throw new Error(json.error?.message || '保存失败')
      }
      setSuccessMsg(json.message || '护栏规则已保存')
      setUpdatedAt((json.data as any)?.updatedAt || new Date().toISOString())
      setSource('db')
      setDirty(false)
      setTimeout(() => setSuccessMsg(null), 4000)
    } catch (e: any) {
      setError(`保存失败: ${e.message}`)
    } finally {
      setSaving(false)
    }
  }, [rules, rejectMsg])

  // ── 重置为内置默认 ──
  const handleReset = useCallback(() => {
    setRules(BUILTIN_DEFAULTS.l1Rules)
    setRejectMsg(BUILTIN_DEFAULTS.l1RejectMessage)
    setDirty(true)
  }, [])

  // ── 切换单条规则展开/折叠 ──
  const toggleExpand = (name: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  // ── 编辑单条规则 ──
  const updateRule = (name: string, content: string) => {
    setRules(prev => prev.map(r => (r.name === name ? { ...r, content } : r)))
    setDirty(true)
  }

  // ═══════════════════════════════════════
  // 渲染
  // ═══════════════════════════════════════

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 gap-3">
        <RefreshCw size={18} className="animate-spin text-[#6B6459]" />
        <span className="text-xs text-[#6B6459]">加载护栏配置中...</span>
      </div>
    )
  }

  return (
    <div className="p-6 lg:p-8 min-h-full">
    <div className="flex flex-col w-full">
      {/* ── 顶部标题栏 ── */}
      <div className="flex items-center justify-between pb-4 mb-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div className="size-10 flex items-center justify-center rounded-lg bg-[#C04030]/10 border border-[#C04030]/15">
            <Shield size={18} className="text-[#C04030]" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[#EDE8DF] tracking-wider">
              L3 全局防幻觉与安全护栏
            </h3>
            <div className="flex items-center gap-2 mt-0.5">
              <span
                className={cn(
                  'inline-flex items-center gap-1 text-[10px] px-1.5 py-px rounded-full border',
                  source === 'db'
                    ? 'border-emerald-500/15 bg-emerald-500/5 text-emerald-400'
                    : 'border-white/[0.06] bg-white/[0.02] text-[#6B6459]',
                )}
              >
                {source === 'db' ? (
                  <>
                    <ShieldCheck size={10} />
                    数据库配置
                  </>
                ) : (
                  <>
                    <ShieldAlert size={10} />
                    内置默认
                  </>
                )}
              </span>
              {updatedAt && (
                <span className="text-[10px] text-[#6B6459]">
                  上次更新: {new Date(updatedAt).toLocaleString('zh-CN')}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="ghost" size="sm" onClick={handleReset} disabled={saving} className="text-xs gap-1.5">
            <RotateCcw size={12} />
            重置默认
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving || !dirty}
            className={cn('text-xs gap-1.5', !dirty && 'text-[#6B6459]')}
            variant={dirty ? 'destructive' : 'ghost'}
          >
            {saving ? (
              <>
                <RefreshCw size={12} className="animate-spin" />
                保存中...
              </>
            ) : (
              <>
                <Save size={12} />
                保存并热生效
              </>
            )}
          </Button>
        </div>
      </div>

      {/* ── 提示信息 ── */}
      {error && (
        <div className="mb-4 flex items-center gap-2 px-3 py-2.5 bg-[#C04030]/5 border border-[#C04030]/10 rounded-lg text-xs text-[#C04030]">
          <AlertTriangle size={13} />
          {error}
          <button onClick={() => setError(null)} className="ml-auto text-[#C04030]/50 hover:text-[#C04030] text-sm leading-none">
            ✕
          </button>
        </div>
      )}
      {successMsg && (
        <div className="mb-4 flex items-center gap-2 px-3 py-2.5 bg-emerald-500/5 border border-emerald-500/10 rounded-lg text-xs text-emerald-400">
          <CheckCircle2 size={13} />
          {successMsg}
        </div>
      )}

      {/* ── L2 拒绝话术 ── */}
      <div className="mb-4">
        <div className="rounded-lg border border-l-2 border-l-[#C04030] border-white/[0.06] bg-[#1A1F2E] p-4">
          <div className="flex items-center gap-2 mb-2.5">
            <div className="size-6 flex items-center justify-center rounded bg-[#C04030]/10">
              <MessageSquareOff size={12} className="text-[#C04030]" />
            </div>
            <span className="text-xs font-semibold text-[#EDE8DF] tracking-wide">
              L2 · 排盘拒绝话术
            </span>
            <span className="text-[10px] text-[#6B6459]">
              用户试图在对话中排盘时自动回复
            </span>
          </div>
          <textarea
            value={rejectMsg}
            onChange={e => {
              setRejectMsg(e.target.value)
              setDirty(true)
            }}
            rows={3}
            className="w-full px-3 py-2.5 bg-[#1A2332] border border-white/[0.08] rounded-md text-xs text-[#D8D2C8] placeholder:text-[#6B6459] resize-none focus:outline-none focus:border-[#C04030]/50 transition-colors font-mono leading-relaxed"
            placeholder="输入拒绝排盘的标准话术..."
          />
          <p className="text-[10px] text-[#6B6459] mt-1.5">
            此话术同时在 L1 System Prompt 和 L2 输入拦截中使用
          </p>
        </div>
      </div>

      {/* ── L1 规则列表 ── */}
      <div className="space-y-2.5">
        <div className="flex items-center gap-2 mb-3">
          <div className="size-6 flex items-center justify-center rounded bg-[#B8964A]/10">
            <Globe size={12} className="text-[#B8964A]" />
          </div>
          <span className="text-xs font-semibold text-[#EDE8DF] tracking-wide">
            L1 · System Prompt 防越权规则（注入 LLM 意识层）
          </span>
          <Badge variant="outline" className="text-[10px] font-mono">{rules.length}</Badge>
        </div>

        {rules.map((rule, idx) => {
          const isExpanded = expanded.has(rule.name)
          return (
            <div
              key={rule.name}
              className={cn(
                'rounded-lg border border-white/[0.06] bg-[#1A1F2E] overflow-hidden transition-colors',
                isExpanded ? 'border-l-2 border-l-[#B8964A]' : 'border-l-2 border-l-transparent hover:border-l-white/[0.06]',
              )}
            >
              {/* ── 规则头部 ── */}
              <button
                onClick={() => toggleExpand(rule.name)}
                className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-white/[0.02] transition-colors rounded-tr-lg"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span className="size-5 flex items-center justify-center rounded-full bg-[#B8964A]/10 border border-[#B8964A]/20 shrink-0 text-[10px] font-mono font-bold text-[#B8964A]">
                    {idx + 1}
                  </span>
                  <TooltipProvider delayDuration={500}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-xs font-medium text-[#EDE8DF] truncate cursor-help flex items-center gap-1">
                          {rule.label}
                          {RULE_TOOLTIPS[rule.name] && (
                            <Info size={10} className="text-[#6B6459] shrink-0" />
                          )}
                        </span>
                      </TooltipTrigger>
                      {RULE_TOOLTIPS[rule.name] && (
                        <TooltipContent className="bg-[#1A1F2E] border-white/[0.06] text-[#D8D2C8] max-w-72">
                          <p className="text-xs leading-relaxed">{RULE_TOOLTIPS[rule.name]}</p>
                        </TooltipContent>
                      )}
                    </Tooltip>
                  </TooltipProvider>
                  {rule.content !==
                    BUILTIN_DEFAULTS.l1Rules.find(r => r.name === rule.name)
                      ?.content && (
                    <span className="inline-block size-1.5 rounded-full bg-[#B8964A] shrink-0" title="已修改" />
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-3">
                  <span className="text-[10px] text-[#6B6459] font-mono">{rule.content.length}字</span>
                  {isExpanded ? (
                    <ChevronUp size={13} className="text-[#6B6459]" />
                  ) : (
                    <ChevronDown size={13} className="text-[#6B6459]" />
                  )}
                </div>
              </button>

              {/* ── 规则内容（展开时）── */}
              {isExpanded && (
                <div className="px-4 pb-3">
                  <textarea
                    value={rule.content}
                    onChange={e => updateRule(rule.name, e.target.value)}
                    rows={6}
                    className="w-full px-3 py-2.5 bg-[#1A2332] border border-white/[0.08] rounded-md text-xs text-[#D8D2C8] placeholder:text-[#6B6459] resize-none focus:outline-none focus:border-[#B8964A]/50 transition-colors font-mono leading-relaxed"
                  />
                  <div className="flex items-center justify-between mt-1.5">
                    <span className="text-[10px] text-[#6B6459] font-mono">rule: {rule.name}</span>
                    <span className="text-[10px] text-[#6B6459]">{rule.content.length} 字符</span>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ── 底部闭环说明 ── */}
      <div className="mt-4 pt-4 border-t border-white/[0.04] space-y-2.5">
        <div className="flex items-start gap-2 text-[11px] text-[#6B6459]">
          <Shield size={11} className="mt-0.5 shrink-0" />
          <span>
            L3 护栏规则保存后将在<strong className="text-[#A09888]">下一轮对话</strong>
            中自动生效。所有修改均记录审计日志，可在「审计日志」页面查看。
          </span>
        </div>
        <div className="flex items-start gap-2 text-[11px] text-[#6B6459] bg-white/[0.02] rounded-md px-3 py-2 border border-white/[0.04]">
          <CheckCircle2 size={11} className="mt-0.5 shrink-0 text-emerald-400" />
          <span>
            <strong className="text-emerald-400">端到端验证链路</strong>：管理员修改护栏规则（如免责声明话术）→ 点击"保存并热生效"
            → 下一轮用户对话时，<code className="text-[#A09888] bg-[#1A2332] px-1 rounded text-[11px] font-mono">buildAntiHallucinationPromptDynamic()</code> 从 DB 实时加载最新规则
            → LLM 输出立刻携带新的免责声明。无需重启服务，全程审计可追溯。
          </span>
        </div>
      </div>
    </div>
    </div>
  )
}

/* ═══════════════════════════════════════
   内联 Button / Badge 组件引用
   ═══════════════════════════════════════ */
function Button({
  children, variant, size, onClick, disabled, className, title,
}: {
  children: React.ReactNode
  variant?: 'ghost' | 'destructive' | 'default' | 'outline'
  size?: 'sm' | 'icon-xs' | 'icon-sm'
  onClick?: () => void
  disabled?: boolean
  className?: string
  title?: string
}) {
  const sizeClass = size === 'sm' ? 'h-8 px-3 text-xs' : 'h-9 px-4 text-sm'
  let variantClass = 'bg-[#1A2332] border-white/[0.06] text-[#D8D2C8] hover:bg-[#242E3D]'
  if (variant === 'ghost') variantClass = 'text-[#6B6459] hover:text-[#EDE8DF] hover:bg-white/[0.03] border-transparent'
  if (variant === 'destructive') variantClass = 'bg-[#C04030] hover:bg-[#A03028] text-white shadow-lg shadow-[#C04030]/20'
  if (variant === 'outline') variantClass = 'bg-transparent border-white/[0.06] text-[#D8D2C8] hover:bg-white/[0.03]'

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        'inline-flex items-center justify-center rounded-lg border font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
        sizeClass,
        variantClass,
        className,
      )}
    >
      {children}
    </button>
  )
}

function Badge({ children, variant, className }: { children: React.ReactNode; variant?: 'outline' | 'secondary'; className?: string }) {
  const variantClass = variant === 'outline'
    ? 'border border-white/[0.06] text-[#6B6459]'
    : 'bg-white/[0.04] text-[#A09888]'
  return (
    <span className={cn('inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px]', variantClass, className)}>
      {children}
    </span>
  )
}
