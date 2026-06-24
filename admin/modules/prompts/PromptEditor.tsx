// ============================================================
// Phase 5 — Prompt 引擎 · Dify 级高密度 Workspace
// 文件：admin/modules/prompts/PromptEditor.tsx
// 布局：三栏 Resizable · GuardPanel 内嵌 · Slider 调参 · Debug Sandbox
// ============================================================

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Lock,
  Save,
  Plus,
  Trash2,
  History,
  RotateCcw,
  AlertTriangle,
  FileText,
  CheckCircle2,
  XCircle,
  RefreshCw,
  PenLine,
  Shield,
  GitBranch,
  Send,
  Play,
  Loader2,
  Bot,
  ChevronRight,
  Thermometer,
  Gauge,
  Hash,
  SlidersHorizontal,
  PanelLeftClose,
  PanelLeft,
  PanelRightClose,
  PanelRight,
  Info,
  Layout,
  Code2,
  FlaskConical,
  Database,
  HelpCircle,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Slider } from '@/components/ui/slider'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable'
import { api } from '../../lib/api'
import GuardPanel from './GuardPanel'

// ═══════════════════════════════════════
// CodeMirror 6 imports
// ═══════════════════════════════════════
import { EditorView, keymap, lineNumbers, highlightActiveLine } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { oneDark } from '@codemirror/theme-one-dark'
import { markdown } from '@codemirror/lang-markdown'
import { defaultKeymap, history as cmHistory, historyKeymap } from '@codemirror/commands'
import { autocompletion, type CompletionContext } from '@codemirror/autocomplete'
import {
  syntaxHighlighting,
  defaultHighlightStyle,
  bracketMatching,
  foldGutter,
  indentOnInput,
} from '@codemirror/language'

// ═══════════════════════════════════════
// 类型定义
// ═══════════════════════════════════════

interface PromptRow {
  id: number
  name: string
  displayName: string
  content: string
  version: number
  isActive: number
  category: string
  isBuiltin: number
  description: string | null
  variables: string | null
}

interface VersionRow {
  id: number
  promptId: number
  version: number
  content: string
  changeNote: string | null
  createdBy: string
  createdAt: string
}

interface PromptEditorProps {
  apiHeaders?: () => Record<string, string>
}

// ═══════════════════════════════════════
// 不可删除的系统身份前缀
// ═══════════════════════════════════════

const LOCKED_SYSTEM_PREFIX = [
  '你是一个专业的八字命理分析系统——"墨白命理堂"首席命理师。',
  '',
  '核心原则：',
  '- 以严谨的天文历算和《渊海子平》《三命通会》《滴天髓》为根基',
  '- 只输出八字排盘及专业命理分析，不做超出范围的主观推测',
  '- 不涉及任何医疗建议、法律建议、投资建议',
  '- 引用典籍时须注明出处（书名+卷/章节）',
  '- 涉及不确定信息时必须标注"据传统命理观点"并建议用户理性看待',
  '',
  '输出结构：',
  '1. 八字排盘（年柱 月柱 日柱 时柱，含藏干十神纳音）',
  '2. 大运推算（起运年龄 + 当前大运 + 流年）',
  '3. 命局分析（日主强弱、格局、用神喜忌）',
  '4. 经典佐证（引用对应典籍原文）',
].join('\n')

const LOCKED_DELIMITER = '\n\n---\n\n'

function splitContent(content: string): { locked: string; editable: string } {
  if (content.startsWith(LOCKED_SYSTEM_PREFIX + LOCKED_DELIMITER)) {
    return {
      locked: LOCKED_SYSTEM_PREFIX + LOCKED_DELIMITER,
      editable: content.slice((LOCKED_SYSTEM_PREFIX + LOCKED_DELIMITER).length),
    }
  }
  if (content.startsWith(LOCKED_SYSTEM_PREFIX)) {
    return {
      locked: LOCKED_SYSTEM_PREFIX + LOCKED_DELIMITER,
      editable: content.slice(LOCKED_SYSTEM_PREFIX.length).replace(/^\n*/, ''),
    }
  }
  return { locked: LOCKED_SYSTEM_PREFIX + LOCKED_DELIMITER, editable: content }
}

function joinContent(locked: string, editable: string): string {
  return locked + editable
}

// ═══════════════════════════════════════
// {{variable}} 自动补全源
// ═══════════════════════════════════════

function variableCompletions(context: CompletionContext) {
  const word = context.matchBefore(/\{\{\w*$/)
  if (!word) return null
  if (word.from === word.to && !context.explicit) return null

  const variables = [
    { label: '{{chart.dayMaster}}', detail: '日主天干', info: '例：甲、乙、丙、丁' },
    { label: '{{chart.yearPillar}}', detail: '年柱', info: '例：甲子' },
    { label: '{{chart.monthPillar}}', detail: '月柱', info: '例：丙寅' },
    { label: '{{chart.dayPillar}}', detail: '日柱', info: '例：戊辰' },
    { label: '{{chart.hourPillar}}', detail: '时柱', info: '例：庚申' },
    { label: '{{chart.gender}}', detail: '性别', info: '男 / 女' },
    { label: '{{chart.birthDate}}', detail: '出生日期', info: '公历日期' },
    { label: '{{chart.birthTime}}', detail: '出生时辰', info: '地支时辰' },
    { label: '{{chart.birthPlace}}', detail: '出生地点', info: '省市' },
    { label: '{{annotation.patternName}}', detail: '格局名称', info: '正官格、七杀格等' },
    { label: '{{annotation.dayStrength}}', detail: '日主强弱', info: '身强 / 身弱' },
    { label: '{{annotation.favorable}}', detail: '用神', info: '喜用五行' },
    { label: '{{annotation.unfavorable}}', detail: '忌神', info: '忌讳五行' },
    { label: '{{classic.quote}}', detail: '典籍引用', info: '渊海子平等原文引用' },
    { label: '{{famous.chartName}}', detail: '名人命例', info: '历史名人八字对比' },
  ]

  return {
    from: word.from,
    filter: false,
    options: variables.map(v => ({ label: v.label, type: 'variable', detail: v.detail, info: v.info })),
  }
}

// ═══════════════════════════════════════
// CodeMirror Hook
// ═══════════════════════════════════════

function useCodeMirror(
  containerRef: React.RefObject<HTMLDivElement | null>,
  value: string,
  onChange: (value: string) => void,
) {
  const viewRef = useRef<EditorView | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    if (viewRef.current) {
      const currentContent = viewRef.current.state.doc.toString()
      if (value !== currentContent) {
        viewRef.current.dispatch({
          changes: { from: 0, to: currentContent.length, insert: value },
        })
      }
      return
    }

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) onChange(update.state.doc.toString())
    })

    const state = EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(), highlightActiveLine(), bracketMatching(), foldGutter(), indentOnInput(),
        markdown(), oneDark,
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        cmHistory(), keymap.of([...defaultKeymap, ...historyKeymap]),
        autocompletion({ override: [variableCompletions], activateOnTyping: true, defaultKeymap: true, icons: false }),
        updateListener,
        EditorView.theme({
          '&': { backgroundColor: '#0A1118', fontSize: '13px', fontFamily: '"JetBrains Mono","Fira Code","Cascadia Code",monospace' },
          '.cm-scroller': { fontFamily: '"JetBrains Mono","Fira Code","Cascadia Code",monospace', lineHeight: '1.7' },
          '.cm-gutters': { backgroundColor: '#0D1520', color: '#3E3A33', border: 'none', fontSize: '11px' },
          '.cm-activeLineGutter': { backgroundColor: '#1A1F2E', color: '#6B6459' },
          '.cm-activeLine': { backgroundColor: '#1A1F2E40' },
          '.cm-cursor': { borderLeftColor: '#B8964A' },
          '.cm-selectionBackground': { backgroundColor: '#B8964A30 !important' },
          '.cm-matchingBracket': { backgroundColor: '#1A1F2E', outline: '1px solid #3A3630', color: '#B8964A' },
          '.cm-tooltip': { backgroundColor: '#1A1F2E', border: '1px solid #222839', borderRadius: '6px', color: '#EDE8DF', fontSize: '12px', boxShadow: '0 8px 24px rgba(0,0,0,0.5)' },
          '.cm-tooltip-autocomplete': {
            '& .cm-completionLabel': { color: '#EDE8DF' },
            '& .cm-completionDetail': { color: '#A09888', fontStyle: 'normal' },
            '& .cm-completionInfo': { color: '#6B6459', fontSize: '11px', fontStyle: 'italic' },
            '& .cm-completionMatchedText': { color: '#B8964A', textDecoration: 'none', fontWeight: '600' },
            '& li[aria-selected]': { backgroundColor: '#B8964A20', '& .cm-completionLabel': { color: '#B8964A' } },
          },
        }),
      ],
    })

    const view = new EditorView({ state, parent: containerRef.current })
    viewRef.current = view
    return () => { view.destroy(); viewRef.current = null }
  }, [containerRef, value, onChange])
}

// ═══════════════════════════════════════
// Debug Panel — 实时 LLM 调试沙盒
// ═══════════════════════════════════════

function DebugPanel({
  promptContent,
  temperature,
  topP,
  maxTokens,
}: {
  promptContent: string
  temperature: number
  topP: number
  maxTokens: number
}) {
  const [input, setInput] = useState('')
  const [response, setResponse] = useState('')
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')
  const [debugHistory, setDebugHistory] = useState<{ role: string; content: string }[]>([])

  const handleDebug = async () => {
    if (!input.trim() || running) return
    setRunning(true)
    setError('')
    setResponse('')

    try {
      const res = await api.post<{
        output: string
        model: string
        provider: string
        usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number } | null
      }>('/api/v1/admin/prompts/debug', {
        prompt: promptContent,
        userInput: input,
        temperature,
        topP,
        maxTokens,
      })

      if (res.success && res.data) {
        setResponse(res.data.output ?? '(空响应)')
        setDebugHistory(prev => [
          ...prev,
          { role: 'user', content: input },
          { role: 'assistant', content: res.data!.output ?? '(空响应)' },
        ])
        setInput('')
      } else {
        setError(res.error?.message ?? '调试请求失败')
      }
    } catch {
      setError('网络异常，请确认后端已启用')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* 标题 */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/[0.06] bg-[#1A1F2E] shrink-0">
        <Play size={13} className="text-[#5B8C5A]" />
        <span className="text-xs font-semibold text-[#EDE8DF] tracking-[0.04em]">实时沙盒</span>
        <Badge className="bg-[#5B8C5A]/15 text-[#5B8C5A] border-[#5B8C5A]/25 text-sm ml-auto">Debug</Badge>
      </div>

      {/* Prompt 预览 */}
      <div className="px-4 py-2.5 border-b border-white/[0.04] shrink-0">
        <Label className="text-sm text-[#4A4540] uppercase tracking-wider mb-1 block">当前 Prompt</Label>
        <div className="text-sm text-[#6B6459] font-mono leading-relaxed line-clamp-3 max-h-14 overflow-hidden bg-[#0A1118] rounded p-2 border border-white/[0.04]">
          {promptContent || '未选择模板'}
        </div>
        {/* 当前参数指示 */}
        <div className="flex items-center gap-2 mt-1.5 text-sm text-[#4A4540] font-mono">
          <span>T={temperature.toFixed(2)}</span>
          <span>P={topP.toFixed(2)}</span>
          <span>Max={maxTokens}</span>
        </div>
      </div>

      {/* 对话历史 */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-2 space-y-2">
        {debugHistory.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <Bot size={18} className="text-[#3E3A33]" />
            <p className="text-xs text-[#3E3A33] text-center">
              {promptContent ? '输入测试消息开始调试' : '请先选择模板'}
            </p>
          </div>
        )}
        {debugHistory.map((msg, i) => (
          <div
            key={i}
            className={`rounded-lg p-2.5 text-xs leading-relaxed ${
              msg.role === 'user'
                ? 'bg-[#B8964A]/8 border border-[#B8964A]/15 ml-4'
                : 'bg-[#0A1118] border border-white/[0.04] mr-4'
            }`}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <span className={`text-sm font-medium ${msg.role === 'user' ? 'text-[#B8964A]' : 'text-[#5B8C5A]'}`}>
                {msg.role === 'user' ? 'YOU' : 'LLM'}
              </span>
            </div>
            <p className="text-[#D8D2C8] font-mono whitespace-pre-wrap">{msg.content.slice(0, 800)}</p>
          </div>
        ))}
        {error && (
          <div className="rounded-lg p-2.5 bg-[#C04030]/8 border border-[#C04030]/15">
            <div className="flex items-center gap-1.5 mb-1">
              <XCircle size={10} className="text-[#D06050]" />
              <span className="text-sm font-medium text-[#D06050]">ERROR</span>
            </div>
            <p className="text-xs text-[#D06050]">{error}</p>
          </div>
        )}
        {response && debugHistory.length === 0 && (
          <div className="rounded-lg p-2.5 bg-[#0A1118] border border-white/[0.04]">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-sm font-medium text-[#5B8C5A]">LLM</span>
            </div>
            <p className="text-xs text-[#D8D2C8] font-mono whitespace-pre-wrap">{response.slice(0, 800)}</p>
          </div>
        )}
      </div>

      {/* 输入区 */}
      <div className="shrink-0 px-4 py-3 border-t border-white/[0.04] bg-[#1A1F2E]/50">
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="输入模拟用户消息…"
            rows={2}
            className="flex-1 px-3 py-2 bg-[#0A1118] border border-white/[0.08] rounded-md text-[#EDE8DF] placeholder:text-[#3E3A33] text-xs font-mono resize-none focus:outline-none focus:border-[#B8964A]/60"
            onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleDebug() }}
          />
          <button
            onClick={handleDebug}
            disabled={!input.trim() || running}
            className="shrink-0 w-9 h-9 flex items-center justify-center rounded-md bg-[#B8964A] text-[#0A1118] hover:bg-[#D8C08A] transition-colors disabled:opacity-40 disabled:cursor-not-allowed self-end"
            title="发送 (Ctrl+Enter)"
          >
            {running ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          </button>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════
// Slider 行组件（用于 Prompt 调参区）
// ═══════════════════════════════════════

function ParamSlider({
  icon: Icon,
  label,
  labelCN,
  value,
  min,
  max,
  step,
  unit,
  onChange,
  hint,
  tooltip,
}: {
  icon: React.ElementType
  label: string
  labelCN?: string
  value: number
  min: number
  max: number
  step: number
  unit?: string
  onChange: (v: number) => void
  hint?: string
  tooltip?: string
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Icon size={10} className="text-[#6B6459]" />
          <Tooltip>
            <TooltipTrigger asChild>
              <Label className="text-sm text-[#A09888] uppercase tracking-wider flex items-center gap-1 cursor-help">
                {label}
                {labelCN && <span className="text-sm normal-case text-[#4A4540]">({labelCN})</span>}
                {tooltip && <HelpCircle size={8} className="text-[#4A4540]" />}
              </Label>
            </TooltipTrigger>
            {tooltip && (
              <TooltipContent className="bg-[#1A1F2E] border border-[#3A3630] text-[#D8D2C8] max-w-52">
                <p className="text-xs">{tooltip}</p>
              </TooltipContent>
            )}
          </Tooltip>
        </div>
        <div className="flex items-baseline gap-0.5">
          <span className="text-xs font-bold font-mono tabular-nums text-[#EDE8DF]">
            {step < 1 ? value.toFixed(2) : value}
          </span>
          {unit && <span className="text-sm text-[#4A4540]">{unit}</span>}
        </div>
      </div>
      <Slider value={value} min={min} max={max} step={step} onValueChange={onChange} />
      {hint && <p className="text-sm text-[#4A4540]">{hint}</p>}
    </div>
  )
}

// ═══════════════════════════════════════
// 主组件
// ═══════════════════════════════════════

export default function PromptEditor(_props: PromptEditorProps) {
  const [prompts, setPrompts] = useState<PromptRow[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<PromptRow | null>(null)

  const [editableContent, setEditableContent] = useState('')
  const [lockedPrefix, setLockedPrefix] = useState(LOCKED_SYSTEM_PREFIX + LOCKED_DELIMITER)

  const [editDisplayName, setEditDisplayName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editIsActive, setEditIsActive] = useState(true)

  const [status, setStatus] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null)
  const [dirty, setDirty] = useState(false)

  const [showNew, setShowNew] = useState(false)
  const [newForm, setNewForm] = useState({ name: '', displayName: '', content: '', description: '' })

  const [versions, setVersions] = useState<VersionRow[]>([])
  const [versionsLoading, setVersionsLoading] = useState(false)

  const [rollbackTarget, setRollbackTarget] = useState<VersionRow | null>(null)

  // ═══ 面板折叠状态 & Tab ═══
  const [leftCollapsed, setLeftCollapsed] = useState(false)
  const [rightCollapsed, setRightCollapsed] = useState(false)
  const [activeTab, setActiveTab] = useState<'editor' | 'guard'>('editor')

  // ═══ 模型参数（Session 级预设） ═══
  const [temperature, setTemperature] = useState(0.7)
  const [topP, setTopP] = useState(0.9)
  const [maxTokens, setMaxTokens] = useState(2048)

  const editorRef = useRef<HTMLDivElement>(null)

  // ═══════════════════════════════
  // 数据加载（使用统一 API 客户端）
  // ═══════════════════════════════
  const load = useCallback(async () => {
    setLoading(true)
    const res = await api.get<PromptRow[]>('/api/v1/admin/prompts')
    if (res.success && Array.isArray(res.data)) {
      setPrompts(res.data)
    } else if (!res.success && res.error?.code !== 'UNAUTHORIZED') {
      flashStatus('err', '加载模板列表失败')
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const flashStatus = (type: 'ok' | 'err', msg: string) => {
    setStatus({ type, msg })
    setTimeout(() => setStatus(null), 2500)
  }

  const selectPrompt = useCallback((p: PromptRow) => {
    setSelected(p)
    setShowNew(false)
    const { locked, editable } = splitContent(p.content)
    setLockedPrefix(locked)
    setEditableContent(editable)
    setEditDisplayName(p.displayName)
    setEditDescription(p.description ?? '')
    setEditIsActive(p.isActive === 1)
    setDirty(false)
  }, [])

  // ═══ 保存 ═══
  const handleSave = useCallback(async () => {
    if (!selected) return
    const fullContent = joinContent(lockedPrefix, editableContent)
    const res = await api.put(`/api/v1/admin/prompts/${selected.id}`, {
      content: fullContent,
      displayName: editDisplayName,
      description: editDescription,
      isActive: editIsActive ? 1 : 0,
      changeNote: '编辑更新',
    })
    if (res.success) {
      flashStatus('ok', `已保存 (v${(res.data as any)?.version ?? '?'})`)
      setDirty(false)
      load()
    } else {
      flashStatus('err', res.error?.message ?? '保存失败')
    }
  }, [selected, lockedPrefix, editableContent, editDisplayName, editDescription, editIsActive, load])

  const handleEditorChange = useCallback((value: string) => { setEditableContent(value); setDirty(true) }, [])

  // ═══ 创建 ═══
  const handleCreate = async () => {
    if (!newForm.name.trim() || !newForm.content.trim()) { flashStatus('err', '标识和内容为必填项'); return }
    const res = await api.post('/api/v1/admin/prompts', {
      name: newForm.name,
      displayName: newForm.displayName || newForm.name,
      content: joinContent(LOCKED_SYSTEM_PREFIX + LOCKED_DELIMITER, newForm.content),
      description: newForm.description || null,
    })
    if (res.success) {
      setShowNew(false)
      setNewForm({ name: '', displayName: '', content: '', description: '' })
      flashStatus('ok', '模板已创建')
      load()
    } else {
      flashStatus('err', res.error?.message ?? '创建失败')
    }
  }

  // ═══ 删除 ═══
  const handleDelete = async (id: number) => {
    if (!confirm('确定删除此模板？此操作不可撤销。')) return
    await api.delete(`/api/v1/admin/prompts/${id}`)
    if (selected?.id === id) setSelected(null)
    flashStatus('ok', '已删除')
    load()
  }

  // ═══ 版本历史 ═══
  const loadVersions = useCallback(async () => {
    if (!selected) return
    setVersionsLoading(true)
    const res = await api.get<VersionRow[]>(`/api/v1/admin/prompts/${selected.id}/versions`)
    if (res.success) setVersions(res.data ?? [])
    else flashStatus('err', '加载版本历史失败')
    setVersionsLoading(false)
  }, [selected])

  // 选中模板时自动加载版本
  useEffect(() => {
    if (selected) loadVersions()
  }, [selected, loadVersions])

  const handleRollback = async (version: VersionRow) => {
    if (!selected) return
    setRollbackTarget(null)
    const res = await api.post(`/api/v1/admin/prompts/${selected.id}/rollback/${version.version}`)
    if (res.success) {
      flashStatus('ok', (res as any).message ?? '回滚成功')
      const refreshed = await api.get<PromptRow>(`/api/v1/admin/prompts/${selected.id}`)
      if (refreshed.success && refreshed.data) selectPrompt(refreshed.data)
      load()
      loadVersions()
    } else {
      flashStatus('err', res.error?.message ?? '回滚失败')
    }
  }

  useCodeMirror(editorRef, editableContent, handleEditorChange)

  // Ctrl+S 保存
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); if (dirty && selected) handleSave() }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [dirty, selected, handleSave])

  // ── 加载态 ──
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw size={18} className="animate-spin text-[#B8964A]" />
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col gap-2 px-1.5 pt-1.5 pb-1.5">
      {/* ═══ 页面头部 + Tab 切换 ═══ */}
      <div className="flex items-center justify-between shrink-0 px-2">
        <div>
          <h2 className="text-base font-semibold text-[#EDE8DF] flex items-center gap-2 tracking-[0.04em]">
            <FileText size={16} className="text-[#B8964A]" />
            Prompt 驾驶舱
          </h2>
          <p className="text-xs text-[#6B6459] mt-0.5">
            {prompts.length} 个模板 · 边写边调边测 · Ctrl+S 保存
          </p>
        </div>
        <div className="flex items-center gap-2">
          {activeTab === 'editor' && (
            <>
              {/* 面板折叠按钮 */}
              <button
                onClick={() => setLeftCollapsed(!leftCollapsed)}
                className="p-1.5 rounded text-[#4A4540] hover:text-[#A09888] hover:bg-white/[0.04] transition-colors"
                title={leftCollapsed ? '展开侧栏' : '折叠侧栏'}
              >
                {leftCollapsed ? <PanelLeft size={14} /> : <PanelLeftClose size={14} />}
              </button>
              <button
                onClick={() => setRightCollapsed(!rightCollapsed)}
                className="p-1.5 rounded text-[#4A4540] hover:text-[#A09888] hover:bg-white/[0.04] transition-colors"
                title={rightCollapsed ? '展开沙盒' : '折叠沙盒'}
              >
                {rightCollapsed ? <PanelRight size={14} /> : <PanelRightClose size={14} />}
              </button>
              <button
                onClick={() => { setShowNew(true); setSelected(null) }}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-[#EDE8DF] bg-[#C04030] hover:bg-[#A03024] rounded-md transition-colors"
              >
                <Plus size={12} /> 新建
              </button>
            </>
          )}
        </div>
      </div>

      {/* ═══ Tab 切换栏 ═══ */}
      <div className="shrink-0 px-2 flex gap-0.5">
        <button
          onClick={() => setActiveTab('editor')}
          className={`flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-t-lg border transition-all ${
            activeTab === 'editor'
              ? 'bg-[#1A1F2E] border-[#B8964A]/30 text-[#EDE8DF] border-b-transparent -mb-px relative z-10'
              : 'bg-transparent border-transparent text-[#4A4540] hover:text-[#A09888] hover:bg-white/[0.02]'
          }`}
        >
          <Code2 size={12} />
          Prompt 编辑
        </button>
        <button
          onClick={() => { setActiveTab('guard'); setSelected(null) }}
          className={`flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-t-lg border transition-all ${
            activeTab === 'guard'
              ? 'bg-[#1A1F2E] border-[#C04030]/40 text-[#EDE8DF] border-b-transparent -mb-px relative z-10'
              : 'bg-transparent border-transparent text-[#4A4540] hover:text-[#B06050] hover:bg-white/[0.02]'
          }`}
        >
          <Shield size={12} className={activeTab === 'guard' ? 'text-[#C04030]' : ''} />
          L3 防幻觉护栏
        </button>
      </div>

      {/* 状态消息 */}
      {status && (
        <div className={`shrink-0 mx-2 px-3 py-1.5 rounded-md text-xs flex items-center gap-1.5 ${
          status.type === 'ok' ? 'bg-[#5B8C5A]/10 border border-[#5B8C5A]/20 text-[#5B8C5A]'
          : 'bg-[#C04030]/10 border border-[#C04030]/20 text-[#D06050]'
        }`}>
          {status.type === 'ok' ? <CheckCircle2 size={11} /> : <AlertTriangle size={11} />}
          {status.msg}
        </div>
      )}

      {/* ═══ 主内容区 ═══ */}
      {activeTab === 'guard' ? (
        <div className="flex-1 min-h-0 overflow-y-auto px-2">
          <GuardPanel />
        </div>
      ) : showNew ? (
        <div className="flex-1 overflow-y-auto flex items-start justify-center pt-6 pb-8">
          <div className="w-full max-w-xl mx-4">
            <div className="bg-[#1A1F2E] border border-[#B8964A]/15 rounded-xl p-6 shadow-[0_0_30px_rgba(184,150,74,0.04)]">
              {/* 标题区 */}
              <div className="flex items-start gap-3 mb-6">
                <div className="size-10 flex items-center justify-center rounded-xl bg-[#C04030]/10 border border-[#C04030]/15 shrink-0">
                  <Plus size={18} className="text-[#C04030]" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-[#EDE8DF] tracking-[0.04em]">新建 Prompt 模板</h3>
                  <p className="text-xs text-[#6B6459] mt-0.5 leading-relaxed">
                    创建一个新的系统指令模板。系统身份前缀（角色设定与护栏规则）会自动附加在您编写的内容之前。
                  </p>
                </div>
              </div>

              {/* 表单 */ }
              <div className="space-y-4">
                {/* 模板标识 */}
                <div className="space-y-2">
                  <Label className="text-[#A09888] text-xs font-medium flex items-center gap-1.5">
                    <Code2 size={11} className="text-[#4A4540]" />
                    模板标识 (Template ID)
                  </Label>
                  <Input value={newForm.name} onChange={e => setNewForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="如：bazi_core_prompt"
                    className="bg-[#0A1118] border-white/[0.08] text-[#EDE8DF] placeholder:text-[#3E3A33] text-xs font-mono focus:border-[#B8964A]/60 focus:ring-1 focus:ring-[#B8964A]/20" />
                  <p className="text-sm text-[#4A4540]">
                    在代码中调用的唯一键名，必须为英文字母、数字或下划线，例如：<code className="text-[#B8964A] bg-[#B8964A]/8 px-1 rounded text-sm font-mono">bazi_core_prompt</code>
                  </p>
                </div>

                {/* 显示名称 */}
                <div className="space-y-2">
                  <Label className="text-[#A09888] text-xs font-medium flex items-center gap-1.5">
                    <PenLine size={11} className="text-[#4A4540]" />
                    显示名称 (Display Name)
                  </Label>
                  <Input value={newForm.displayName} onChange={e => setNewForm(f => ({ ...f, displayName: e.target.value }))}
                    placeholder="如：防幻觉指令"
                    className="bg-[#0A1118] border-white/[0.08] text-[#EDE8DF] placeholder:text-[#3E3A33] text-xs focus:border-[#B8964A]/60 focus:ring-1 focus:ring-[#B8964A]/20" />
                  <p className="text-sm text-[#4A4540]">
                    在模板列表中展示的人类可读名称，支持中文。留空则自动使用模板标识。
                  </p>
                </div>

                {/* 描述 */}
                <div className="space-y-2">
                  <Label className="text-[#A09888] text-xs font-medium flex items-center gap-1.5">
                    <Info size={11} className="text-[#4A4540]" />
                    用途描述 (Description)
                  </Label>
                  <Input value={newForm.description} onChange={e => setNewForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="简要说明此模板的用途..."
                    className="bg-[#0A1118] border-white/[0.08] text-[#EDE8DF] placeholder:text-[#3E3A33] text-xs focus:border-[#B8964A]/60 focus:ring-1 focus:ring-[#B8964A]/20" />
                  <p className="text-sm text-[#4A4540]">
                    可选。在左侧元数据卡片中展示，帮助团队成员理解模板用途。
                  </p>
                </div>

                {/* 可编辑内容 */}
                <div className="space-y-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Label className="text-[#A09888] text-xs font-medium flex items-center gap-1.5 cursor-help">
                        <FileText size={11} className="text-[#4A4540]" />
                        用户可编辑内容 (Editable Content)
                        <HelpCircle size={9} className="text-[#4A4540]" />
                      </Label>
                    </TooltipTrigger>
                    <TooltipContent className="bg-[#1A1F2E] border border-[#3A3630] text-[#D8D2C8] max-w-64">
                      <p className="text-xs">系统身份前缀（角色·护栏·输出结构）会自动附加在此内容之前，最终拼接成完整的 System Prompt 发送给 AI</p>
                    </TooltipContent>
                  </Tooltip>
                  <textarea value={newForm.content} onChange={e => setNewForm(f => ({ ...f, content: e.target.value }))}
                    placeholder="在此编写模板的可编辑部分... 支持使用 {{变量名}} 注入动态数据。"
                    rows={8}
                    className="w-full px-3 py-2.5 bg-[#0A1118] border border-white/[0.08] rounded-lg text-[#EDE8DF] placeholder:text-[#3E3A33] text-xs font-mono resize-none focus:outline-none focus:border-[#B8964A]/60 focus:ring-1 focus:ring-[#B8964A]/20 leading-relaxed" />
                  <p className="text-sm text-[#4A4540]">
                    输入核心系统指令。支持使用 <code className="text-[#B8964A] bg-[#B8964A]/8 px-1 rounded text-sm font-mono">{'{{变量名}}'}</code> 注入动态数据（如 {'{{chart.dayMaster}}'} {'{{annotation.patternName}}'} 等），输入 {'{{'} 即可触发自动补全。
                  </p>
                </div>

                {/* 系统前缀预览 */}
                <div className="rounded-lg border border-[#B8964A]/20 bg-[#0D1520] overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-1.5 bg-[#B8964A]/8 border-b border-[#B8964A]/15">
                    <div className="flex items-center gap-1.5">
                      <Lock size={10} className="text-[#B8964A]" />
                      <span className="text-sm font-medium text-[#B8964A]">系统前缀预览</span>
                    </div>
                    <span className="text-sm text-[#4A4540]">保存时自动拼接</span>
                  </div>
                  <div className="px-3 py-2 font-mono text-sm text-[#6B6459] leading-relaxed max-h-24 overflow-y-auto">
                    {LOCKED_SYSTEM_PREFIX + LOCKED_DELIMITER}
                    <span className="text-[#B8964A]">{'(← 您的内容将拼接在此处)'}</span>
                  </div>
                </div>

                {/* 按钮 */}
                <div className="flex justify-end gap-3 pt-2">
                  <button onClick={() => setShowNew(false)}
                    className="px-4 py-2 text-sm text-[#A09888] hover:text-[#EDE8DF] hover:bg-white/[0.04] rounded-lg transition-colors">取消</button>
                  <button onClick={handleCreate}
                    className="px-5 py-2 text-sm font-medium text-[#EDE8DF] bg-[#C04030] hover:bg-[#A03024] rounded-lg transition-colors shadow-[0_2px_8px_rgba(192,64,48,0.2)]">创建模板</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : selected ? (
        <div className="flex-1 min-h-0 flex gap-2 px-2">
          {/* ═══════ Resizable 三栏布局 ═══════ */}
          <ResizablePanelGroup className="gap-0">
            {/* ═══ 左栏 20%：资产导航 ═══ */}
            {!leftCollapsed && (
              <>
                <ResizablePanel defaultSize={20} minSize={15} maxSize={30}>
                  <div className="h-full flex flex-col gap-2 pr-1">
                    {/* 模板选择器 */}
                    <div className="admin-card overflow-hidden flex-shrink-0">
                      <div className="px-3 py-2 border-b border-white/[0.04] flex items-center gap-2">
                        <GitBranch size={11} className="text-[#4A4540]" />
                        <span className="text-sm uppercase tracking-wider text-[#4A4540] font-medium">模板列表</span>
                        <span className="text-sm text-[#6B6459] ml-auto">{prompts.length}</span>
                      </div>
                      <div className="max-h-36 overflow-y-auto">
                        {prompts.map(p => {
                          const isSelected = selected?.id === p.id
                          return (
                            <button key={p.id} onClick={() => selectPrompt(p)}
                              className={`w-full text-left px-3 py-2 border-b border-white/[0.02] text-xs transition-colors ${
                                isSelected ? 'bg-[#B8964A]/10 border-l-2 border-l-[#B8964A]' : 'hover:bg-white/[0.02] border-l-2 border-l-transparent'
                              }`}>
                              <div className="font-medium text-[#EDE8DF] truncate">{p.displayName || p.name}</div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-sm text-[#4A4540]">v{p.version}</span>
                                {p.isBuiltin === 1 && <Badge className="bg-[#B8964A]/15 text-[#B8964A] border-[#B8964A]/25 text-sm">内置</Badge>}
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    {/* 元数据卡片 */}
                    <div className="admin-card p-3 space-y-2.5 shrink-0">
                      <div className="flex items-center gap-1.5">
                        <PenLine size={10} className="text-[#4A4540]" />
                        <span className="text-sm uppercase tracking-wider text-[#4A4540] font-medium">元数据</span>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[#6B6459] text-sm">描述</Label>
                        <textarea value={editDescription} onChange={e => { setEditDescription(e.target.value); setDirty(true) }}
                          placeholder="用途说明..." rows={2}
                          className="w-full px-2 py-1.5 bg-[#0A1118] border border-white/[0.06] rounded text-[#A09888] placeholder:text-[#3E3A33] text-sm resize-none focus:outline-none focus:border-[#B8964A]/60" />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label className="text-[#6B6459] text-sm">启用</Label>
                        <Switch checked={editIsActive} onCheckedChange={v => { setEditIsActive(v); setDirty(true) }} />
                      </div>
                    </div>

                    {/* 版本历史 */}
                    <div className="admin-card p-3 flex-1 overflow-hidden flex flex-col min-h-0">
                      <div className="flex items-center justify-between mb-2 shrink-0">
                        <div className="flex items-center gap-1.5">
                          <History size={10} className="text-[#4A4540]" />
                          <span className="text-sm uppercase tracking-wider text-[#4A4540] font-medium">版本历史</span>
                        </div>
                        {versionsLoading && <RefreshCw size={9} className="animate-spin text-[#4A4540]" />}
                      </div>
                      <div className="flex-1 overflow-y-auto space-y-1">
                        {versions.length === 0 && !versionsLoading && (
                          <p className="text-sm text-[#3E3A33] text-center py-4">暂无历史</p>
                        )}
                        {versions.map(v => (
                          <div key={v.id}
                            className={`p-1.5 rounded border text-sm ${
                              v.version === selected.version ? 'border-[#5B8C5A]/40 bg-[#5B8C5A]/5' : 'border-white/[0.04] bg-[#0A1118]'
                            }`}>
                            <div className="flex items-center justify-between mb-0.5">
                              <span className="font-mono font-medium text-[#A09888]">v{v.version}</span>
                              <button onClick={() => setRollbackTarget(v)}
                                className="p-0.5 rounded text-[#4A4540] hover:text-[#B8964A] hover:bg-[#B8964A]/10 transition-colors"
                                title={`回滚至 v${v.version}`}>
                                <RotateCcw size={8} />
                              </button>
                            </div>
                            {v.changeNote && <p className="text-[#6B6459] truncate">{v.changeNote}</p>}
                            <p className="text-[#3E3A33] text-sm mt-0.5">
                              {new Date(v.createdAt).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </ResizablePanel>
                <ResizableHandle />
              </>
            )}

            {/* ═══ 中栏 50%：核心调优区 ═══ */}
            <ResizablePanel defaultSize={rightCollapsed ? 80 : 50} minSize={30} maxSize={75}>
              <div className="h-full flex flex-col gap-2 overflow-y-auto pr-1">
                {/* 工具栏 */}
                <div className="admin-card px-3 py-2 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <Input value={editDisplayName} onChange={e => { setEditDisplayName(e.target.value); setDirty(true) }}
                      className="bg-transparent border-none text-sm font-semibold text-[#EDE8DF] placeholder:text-[#3E3A33] w-36 focus:outline-none p-0 h-auto" />
                    {selected.isBuiltin === 1 && (
                      <Badge className="bg-[#B8964A]/15 text-[#B8964A] border-[#B8964A]/25 text-sm shrink-0">内置</Badge>
                    )}
                    <span className="text-sm text-[#4A4540] font-mono">{selected.name} · v{selected.version}</span>
                    {dirty && <span className="w-1.5 h-1.5 rounded-full bg-[#C08040]" title="未保存" />}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button onClick={handleSave} disabled={!dirty}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                        dirty ? 'bg-[#5B8C5A] text-[#EDE8DF] hover:bg-[#4A7348] shadow-[0_0_10px_rgba(91,140,90,0.2)]'
                        : 'bg-white/[0.04] text-[#3E3A33] cursor-not-allowed'
                      }`}>
                      <Save size={10} /> {dirty ? '保存' : '已最新'}
                    </button>
                    {selected.isBuiltin !== 1 && (
                      <button onClick={() => handleDelete(selected.id)}
                        className="p-1 rounded text-[#4A4540] hover:text-[#D06050] hover:bg-[#C04030]/10 transition-colors" title="删除">
                        <Trash2 size={11} />
                      </button>
                    )}
                  </div>
                </div>

                {/* ═══ 模型参数调优区（Slider） ═══ */}
                <div className="admin-card p-3 space-y-2.5 shrink-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <SlidersHorizontal size={12} className="text-[#B8964A]" />
                    <span className="text-xs font-semibold text-[#EDE8DF] tracking-[0.04em]">模型参数预设</span>
                    <span className="text-sm text-[#4A4540] ml-auto">影响 Debug 沙盒</span>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <ParamSlider
                      icon={Thermometer} label="Temperature" labelCN="发散度" value={temperature}
                      min={0} max={2} step={0.01}
                      onChange={setTemperature}
                      tooltip="值越大（如 0.8），AI 回答越发散有创意；值越小（如 0.2），回答越严谨保守。范围 0~2"
                      hint={temperature < 0.3 ? '极低随机性' : temperature > 1.5 ? '极高创造力' : '平衡'}
                    />
                    <ParamSlider
                      icon={Gauge} label="Top P" labelCN="核采样" value={topP}
                      min={0} max={1} step={0.01}
                      onChange={setTopP}
                      tooltip="核采样阈值：只从累计概率达 P 的候选词中采样。值越低输出越保守聚焦"
                      hint="核采样阈值"
                    />
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          <Hash size={10} className="text-[#6B6459]" />
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Label className="text-sm text-[#A09888] uppercase tracking-wider flex items-center gap-1 cursor-help">
                                Max Tokens <span className="text-sm normal-case text-[#4A4540]">(最大长度)</span>
                                <HelpCircle size={8} className="text-[#4A4540]" />
                              </Label>
                            </TooltipTrigger>
                            <TooltipContent className="bg-[#1A1F2E] border border-[#3A3630] text-[#D8D2C8] max-w-52">
                              <p className="text-xs">AI 单次输出最多的 token 数量。1 token ≈ 0.7 汉字。值越大回复越完整但成本越高</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <span className="text-xs font-bold font-mono text-[#EDE8DF]">{maxTokens}</span>
                      </div>
                      <Slider value={maxTokens} min={256} max={32768} step={256} onValueChange={setMaxTokens} />
                      <p className="text-sm text-[#4A4540]">输出长度上限 · 影响回复长度与 API 成本</p>
                    </div>
                  </div>
                  {/* 快捷预设 */}
                  <div className="flex flex-wrap gap-1 pt-1 border-t border-white/[0.04]">
                    <span className="text-sm text-[#4A4540] mr-1 self-center">预设:</span>
                    {[
                      { label: '创意', t: 1.2, p: 0.95 },
                      { label: '精确', t: 0.1, p: 0.1 },
                      { label: '对话', t: 0.8, p: 0.9 },
                      { label: '代码', t: 0, p: 0.1 },
                    ].map(preset => (
                      <button key={preset.label} onClick={() => { setTemperature(preset.t); setTopP(preset.p) }}
                        className="px-1.5 py-0.5 rounded text-sm bg-white/[0.04] border border-white/[0.06] text-[#A09888] hover:text-[#EDE8DF] hover:border-white/[0.12] transition-colors">
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 锁定区 */}
                <div className="rounded-lg border border-[#B8964A]/25 bg-[#0D1520] overflow-hidden shrink-0">
                  <div className="flex items-center justify-between px-3 py-1.5 bg-[#B8964A]/8 border-b border-[#B8964A]/15">
                    <div className="flex items-center gap-1.5">
                      <Lock size={10} className="text-[#B8964A]" />
                      <span className="text-xs font-medium text-[#B8964A]">系统身份锁定区</span>
                    </div>
                    <span className="text-sm text-[#4A4540]">保存时自动拼接</span>
                  </div>
                  <div className="px-3 py-2 font-mono text-sm text-[#6B6459] leading-relaxed whitespace-pre-wrap select-none max-h-20 overflow-y-auto">
                    {lockedPrefix}
                  </div>
                </div>

                {/* 分隔线 */}
                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex-1 h-px bg-white/[0.06]" />
                  <div className="flex items-center gap-1 text-sm text-[#4A4540]">
                    <PenLine size={8} /> 输入 {'{{'} 补全变量
                  </div>
                  <div className="flex-1 h-px bg-white/[0.06]" />
                </div>

                {/* CodeMirror 编辑器 */}
                <div ref={editorRef} className="flex-1 min-h-[200px] rounded-lg border border-white/[0.06] overflow-hidden" />
              </div>
            </ResizablePanel>

            {/* ═══ 右栏 30%：实时沙盒 ═══ */}
            {!rightCollapsed && (
              <>
                <ResizableHandle />
                <ResizablePanel defaultSize={30} minSize={22} maxSize={45}>
                  <div className="h-full admin-card overflow-hidden flex flex-col">
                    <DebugPanel
                      promptContent={joinContent(lockedPrefix, editableContent)}
                      temperature={temperature}
                      topP={topP}
                      maxTokens={maxTokens}
                    />
                  </div>
                </ResizablePanel>
              </>
            )}
          </ResizablePanelGroup>
        </div>
      )       : (
        /* ── 引导式空状态 ── */
        <div className="flex-1 flex flex-col items-center justify-center px-4">
          {/* 主信息卡 */}
          <div className="max-w-lg w-full bg-[#1A1F2E] border border-[#B8964A]/15 rounded-xl p-6 shadow-[0_0_30px_rgba(184,150,74,0.04)]">
            {/* 标题 */}
            <div className="flex items-start gap-4 mb-5">
              <div className="size-12 flex items-center justify-center rounded-xl bg-[#B8964A]/10 border border-[#B8964A]/15 shrink-0">
                <Layout size={22} className="text-[#B8964A]" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-[#EDE8DF] tracking-[0.04em]">Prompt 驾驶舱</h3>
                <p className="text-sm text-[#6B6459] mt-1 leading-relaxed">
                  此模块用于热编辑 AI 的核心系统指令与防越权护栏。所有模板数据持久化保存在 <code className="text-[#B8964A] bg-[#B8964A]/8 px-1.5 py-0.5 rounded text-xs font-mono">prompt_templates</code> 数据库表中。
                </p>
              </div>
            </div>

            {/* 三栏工作流说明 */}
            <div className="grid grid-cols-3 gap-3 mb-5">
              <div className="bg-[#0A1118] border border-white/[0.04] rounded-lg p-3 text-center">
                <div className="size-8 flex items-center justify-center rounded-lg bg-[#B8964A]/8 mx-auto mb-2">
                  <GitBranch size={14} className="text-[#B8964A]" />
                </div>
                <p className="text-xs font-medium text-[#EDE8DF] mb-0.5">左侧栏</p>
                <p className="text-sm text-[#6B6459] leading-relaxed">选择 Prompt 模板版本，编辑元数据与回滚历史</p>
              </div>
              <div className="bg-[#0A1118] border border-white/[0.04] rounded-lg p-3 text-center">
                <div className="size-8 flex items-center justify-center rounded-lg bg-[#5B8C5A]/10 mx-auto mb-2">
                  <Code2 size={14} className="text-[#5B8C5A]" />
                </div>
                <p className="text-xs font-medium text-[#EDE8DF] mb-0.5">中间编辑区</p>
                <p className="text-sm text-[#6B6459] leading-relaxed">CodeMirror 编辑器 + L3 护栏面板 + 模型参数 Slider 调参</p>
              </div>
              <div className="bg-[#0A1118] border border-white/[0.04] rounded-lg p-3 text-center">
                <div className="size-8 flex items-center justify-center rounded-lg bg-[#4D6BFE]/10 mx-auto mb-2">
                  <FlaskConical size={14} className="text-[#4D6BFE]" />
                </div>
                <p className="text-xs font-medium text-[#EDE8DF] mb-0.5">右侧沙盒</p>
                <p className="text-sm text-[#6B6459] leading-relaxed">输入测试用例，带着当前 Prompt + 参数实时请求 LLM 验证效果</p>
              </div>
            </div>

            {/* 键盘快捷键 */}
            <div className="bg-[#0A1118] border border-white/[0.04] rounded-lg p-3 mb-4">
              <p className="text-xs font-medium text-[#6B6459] mb-2 tracking-[0.04em]">键盘快捷键</p>
              <div className="flex flex-wrap gap-3">
                <span className="inline-flex items-center gap-1.5 text-sm text-[#A09888]">
                  <kbd className="px-1.5 py-0.5 rounded bg-[#1A1F2E] border border-white/[0.08] text-xs font-mono text-[#EDE8DF]">Ctrl+S</kbd> 保存
                </span>
                <span className="inline-flex items-center gap-1.5 text-sm text-[#A09888]">
                  <kbd className="px-1.5 py-0.5 rounded bg-[#1A1F2E] border border-white/[0.08] text-xs font-mono text-[#EDE8DF]">Ctrl+Enter</kbd> 沙盒发送
                </span>
                <span className="inline-flex items-center gap-1.5 text-sm text-[#A09888]">
                  <kbd className="px-1.5 py-0.5 rounded bg-[#1A1F2E] border border-white/[0.08] text-xs font-mono text-[#EDE8DF]">{'{{'}</kbd> 变量补全
                </span>
              </div>
            </div>

            {/* 提示 */}
            <div className="flex items-start gap-2.5 bg-[#B8964A]/5 border border-[#B8964A]/10 rounded-lg p-3">
              <Info size={13} className="text-[#B8964A] shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-[#A09888] leading-relaxed">
                  <span className="font-medium text-[#EDE8DF]">数据持久化说明：</span>
                  所有 Prompt 模板、版本历史、护栏规则均存储在 SQLite 的 <code className="text-[#B8964A] bg-[#B8964A]/8 px-1 rounded text-sm font-mono">prompt_templates</code> 与 <code className="text-[#B8964A] bg-[#B8964A]/8 px-1 rounded text-sm font-mono">prompt_versions</code> 表中。内置模板标记为 <code className="text-[#B8964A] bg-[#B8964A]/8 px-1 rounded text-sm font-mono">isBuiltin=1</code>，不可删除但可覆盖编辑。每次保存自动生成新版本。
                </p>
              </div>
            </div>
          </div>

          {/* 底部操作引导 */}
          <div className="mt-4 flex items-center gap-3 text-xs text-[#4A4540]">
            <span>{prompts.length > 0 ? `已有 ${prompts.length} 个模板` : '暂无模板'}</span>
            <span>·</span>
            <button onClick={() => setShowNew(true)} className="text-[#B8964A] hover:text-[#D8C08A] transition-colors">
              创建第一个模板 →
            </button>
          </div>
        </div>
      )}

      {/* ═══ 回滚确认弹窗 ═══ */}
      {rollbackTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setRollbackTarget(null)} />
          <div className="relative bg-[#1A1F2E] border border-white/[0.10] rounded-xl p-6 max-w-sm mx-4 shadow-2xl">
            <div className="flex items-start gap-3 mb-4">
              <div className="size-8 flex items-center justify-center rounded-full bg-[#C08040]/10 shrink-0">
                <AlertTriangle size={16} className="text-[#C08040]" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-[#EDE8DF]">确认回滚至 v{rollbackTarget.version}？</h4>
                <p className="text-xs text-[#6B6459] mt-1">
                  当前内容将自动存档为新版本，然后被 v{rollbackTarget.version} 的内容覆盖。
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setRollbackTarget(null)}
                className="px-3 py-1.5 text-xs text-[#A09888] hover:text-[#EDE8DF] rounded-md transition-colors">取消</button>
              <button onClick={() => handleRollback(rollbackTarget)}
                className="px-3 py-1.5 text-xs font-medium text-[#EDE8DF] bg-[#C08040] hover:bg-[#A06830] rounded-md transition-colors">确认回滚</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
