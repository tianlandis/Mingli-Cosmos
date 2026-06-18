// ============================================================
// Phase 4.11 — L3 防幻觉护栏热编辑面板
// 文件：admin/modules/prompts/GuardPanel.tsx
// 职责：管理员可视化编辑 L1 系统提示词规则 + L2 拒绝话术
//       保存后热生效，无需重启服务
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
} from 'lucide-react'

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

interface GuardPanelProps {
  apiHeaders: Record<string, string>
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
// GuardPanel 主组件
// ═══════════════════════════════════════

export default function GuardPanel({ apiHeaders }: GuardPanelProps) {
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
      const res = await fetch(API_BASE, { headers: apiHeaders })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      if (json.success && json.data) {
        setRules(json.data.l1Rules)
        setRejectMsg(json.data.l1RejectMessage)
        setSource(json.source || 'builtin')
        setUpdatedAt(json.updatedAt || null)
        setDirty(false)
      }
    } catch (e: any) {
      setError(`加载护栏配置失败: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }, [apiHeaders])

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
      const res = await fetch(API_BASE, {
        method: 'PUT',
        headers: { ...apiHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!json.success) {
        throw new Error(json.error?.message || '保存失败')
      }
      setSuccessMsg(json.message || '护栏规则已保存')
      setUpdatedAt(json.updatedAt || new Date().toISOString())
      setSource('db')
      setDirty(false)
      setTimeout(() => setSuccessMsg(null), 4000)
    } catch (e: any) {
      setError(`保存失败: ${e.message}`)
    } finally {
      setSaving(false)
    }
  }, [rules, rejectMsg, apiHeaders])

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
      <div className="flex items-center justify-center h-64">
        <RefreshCw size={20} className="animate-spin text-[#6B6459]" />
        <span className="ml-3 text-sm text-[#6B6459]">加载护栏配置中...</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* ── 顶部状态栏 ── */}
      <div className="shrink-0 px-5 py-3 flex items-center justify-between border-b border-[#2A2622]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#C04030]/10 border border-[#C04030]/25 flex items-center justify-center">
            <Shield size={16} className="text-[#C04030]" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[#EDE8DF]">
              L3 全局防幻觉与安全护栏
            </h2>
            <div className="flex items-center gap-2 mt-0.5">
              {/* 来源标记 */}
              <span
                className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-px rounded-full border ${
                  source === 'db'
                    ? 'border-[#5B8C5A]/40 bg-[#5B8C5A]/10 text-[#5B8C5A]'
                    : 'border-[#4A4540] bg-[#1A1816] text-[#6B6459]'
                }`}
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
                <span className="text-[10px] text-[#4A4540]">
                  上次更新: {new Date(updatedAt).toLocaleString('zh-CN')}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-[#A09888] hover:text-[#EDE8DF] bg-[#1A1816] border border-[#2A2622] rounded-md hover:border-[#3A3630] transition-colors disabled:opacity-40"
          >
            <RotateCcw size={13} />
            重置默认
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !dirty}
            className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium rounded-md transition-all ${
              dirty
                ? 'bg-[#C04030] hover:bg-[#A03028] text-white shadow-lg shadow-[#C04030]/25'
                : 'bg-[#2A2622] text-[#4A4540] cursor-not-allowed'
            }`}
          >
            {saving ? (
              <>
                <RefreshCw size={13} className="animate-spin" />
                保存中...
              </>
            ) : (
              <>
                <Save size={13} />
                保存并热生效
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── 提示信息 ── */}
      {error && (
        <div className="shrink-0 mx-5 mt-3 flex items-center gap-2 px-3 py-2 bg-[#D04040]/10 border border-[#D04040]/25 rounded-lg text-xs text-[#D04040]">
          <AlertTriangle size={14} />
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-auto text-[#D04040]/60 hover:text-[#D04040]"
          >
            ✕
          </button>
        </div>
      )}
      {successMsg && (
        <div className="shrink-0 mx-5 mt-3 flex items-center gap-2 px-3 py-2 bg-[#5B8C5A]/10 border border-[#5B8C5A]/25 rounded-lg text-xs text-[#5B8C5A]">
          <CheckCircle2 size={14} />
          {successMsg}
        </div>
      )}

      {/* ── L2 拒绝话术（顶部独立卡片）── */}
      <div className="shrink-0 mx-5 mt-4">
        <div className="admin-card border-l-2 border-l-[#C04030] p-4">
          <div className="flex items-center gap-2 mb-3">
            <MessageSquareOff size={15} className="text-[#C04030]" />
            <h3 className="text-xs font-semibold text-[#EDE8DF] tracking-wide">
              L2 · 排盘拒绝话术
            </h3>
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
            className="w-full px-3 py-2.5 bg-[#12100E] border border-[#2A2622] rounded-lg text-sm text-[#EDE8DF] placeholder:text-[#4A4540] resize-none focus:outline-none focus:border-[#C04030]/60 transition-colors"
            placeholder="输入拒绝排盘的标准话术..."
          />
          <p className="text-[10px] text-[#4A4540] mt-1.5">
            此话术同时在 L1 System Prompt 和 L2 输入拦截中使用
          </p>
        </div>
      </div>

      {/* ── L1 规则列表 ── */}
      <div className="flex-1 px-5 py-4 space-y-3 overflow-y-auto">
        <div className="flex items-center gap-2 mb-4">
          <Globe size={14} className="text-[#B8964A]" />
          <h3 className="text-xs font-semibold text-[#EDE8DF] tracking-wide">
            L1 · System Prompt 防越权规则（注入 LLM 意识层）
          </h3>
          <span className="text-[10px] text-[#6B6459]">
            {rules.length} 条规则
          </span>
        </div>

        {rules.map((rule, idx) => {
          const isExpanded = expanded.has(rule.name)
          return (
            <div
              key={rule.name}
              className={`admin-card border-l-2 transition-all ${
                isExpanded
                  ? 'border-l-[#B8964A]'
                  : 'border-l-[#2A2622] hover:border-l-[#3A3630]'
              }`}
            >
              {/* ── 规则头部 ── */}
              <button
                onClick={() => toggleExpand(rule.name)}
                className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-[#1A1816]/50 transition-colors rounded-tr-lg"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-5 h-5 rounded-full bg-[#B8964A]/10 border border-[#B8964A]/20 flex items-center justify-center shrink-0 text-[10px] font-mono text-[#B8964A]">
                    {idx + 1}
                  </span>
                  <span className="text-xs font-medium text-[#EDE8DF] truncate">
                    {rule.label}
                  </span>
                  {rule.content !==
                    BUILTIN_DEFAULTS.l1Rules.find(r => r.name === rule.name)
                      ?.content && (
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#C08040] shrink-0" />
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-[#4A4540]">
                    {rule.content.length} 字
                  </span>
                  {isExpanded ? (
                    <ChevronUp size={14} className="text-[#4A4540] shrink-0" />
                  ) : (
                    <ChevronDown size={14} className="text-[#4A4540] shrink-0" />
                  )}
                </div>
              </button>

              {/* ── 规则内容（展开时）── */}
              {isExpanded && (
                <div className="px-4 pb-4">
                  <textarea
                    value={rule.content}
                    onChange={e => updateRule(rule.name, e.target.value)}
                    rows={6}
                    className="w-full px-3 py-2.5 bg-[#12100E] border border-[#2A2622] rounded-lg text-sm text-[#EDE8DF] placeholder:text-[#4A4540] resize-none focus:outline-none focus:border-[#B8964A]/60 transition-colors font-mono text-[13px] leading-relaxed"
                  />
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[10px] text-[#4A4540] font-mono">
                      rule: {rule.name}
                    </span>
                    <span className="text-[10px] text-[#4A4540]">
                      {rule.content.length} 字符
                    </span>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ── 底部操作说明 ── */}
      <div className="shrink-0 px-5 py-3 border-t border-[#2A2622]">
        <div className="flex items-start gap-2 text-[10px] text-[#4A4540]">
          <Shield size={12} className="mt-0.5 shrink-0" />
          <span>
            L3 护栏规则保存后将在<strong className="text-[#6B6459]">下一轮对话</strong>
            中自动生效。所有修改均记录审计日志，可在「审计日志」页面查看。
          </span>
        </div>
      </div>
    </div>
  )
}
