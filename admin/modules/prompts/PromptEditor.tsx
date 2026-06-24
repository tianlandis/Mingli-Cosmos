// ============================================================
// Phase 5.2 — Prompt 驾驶舱 · 百分比三栏 · 完美闭合版
// 文件：admin/modules/prompts/PromptEditor.tsx
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
  X,
  XCircle,
  RefreshCw,
  PenLine,
  GitBranch,
  Send,
  Loader2,
  Bot,
  Thermometer,
  Gauge,
  Hash,
  SlidersHorizontal,
  Info,
  Layout,
  Code2,
  FlaskConical,
  HelpCircle,
  Search,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { api } from '../../lib/api'

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

// ═══════════════════════════════════════
// 模型参数预设定义
// ═══════════════════════════════════════
interface ParamPreset {
  label: string
  description: string
  temperature: number
  topP: number
  maxTokens: number
}

const PARAM_PRESETS: ParamPreset[] = [
  { label: '创意', description: '高发散 · 适合头脑风暴', temperature: 1.2, topP: 0.95, maxTokens: 4096 },
  { label: '精确', description: '极低随机性 · 适合事实查询', temperature: 0.1, topP: 0.1, maxTokens: 2048 },
  { label: '对话', description: '平衡对话感', temperature: 0.8, topP: 0.9, maxTokens: 2048 },
  { label: '代码', description: '确定性输出', temperature: 0, topP: 0.1, maxTokens: 4096 },
]

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
  if (!content || typeof content !== 'string') {
    return { locked: LOCKED_SYSTEM_PREFIX + LOCKED_DELIMITER, editable: '' }
  }
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
          '&': { backgroundColor: '#0D1520', fontSize: '13px', fontFamily: '"JetBrains Mono","Fira Code","Cascadia Code",monospace' },
          '.cm-scroller': { fontFamily: '"JetBrains Mono","Fira Code","Cascadia Code",monospace', lineHeight: '1.7' },
          '.cm-gutters': { backgroundColor: '#0A1118', color: '#52525b', border: 'none', fontSize: '11px' },
          '.cm-activeLineGutter': { backgroundColor: '#18181b', color: '#a1a1aa' },
          '.cm-activeLine': { backgroundColor: '#18181b40' },
          '.cm-cursor': { borderLeftColor: '#B8964A' },
          '.cm-selectionBackground': { backgroundColor: '#B8964A30 !important' },
          '.cm-matchingBracket': { backgroundColor: '#18181b', outline: '1px solid #3f3f46', color: '#B8964A' },
          '.cm-tooltip': { backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '6px', color: '#e4e4e7', fontSize: '12px', boxShadow: '0 8px 24px rgba(0,0,0,0.5)' },
          '.cm-tooltip-autocomplete': {
            '& .cm-completionLabel': { color: '#e4e4e7' },
            '& .cm-completionDetail': { color: '#a1a1aa', fontStyle: 'normal' },
            '& .cm-completionInfo': { color: '#71717a', fontSize: '11px', fontStyle: 'italic' },
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
// DebugPanel — 实时 LLM 调试沙盒（右栏）
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
    <div className="flex flex-col h-full bg-[#1A2332]">
      {/* ── 标题栏 ── */}
      <div className="flex items-center gap-2 px-5 py-3 border-b border-white/[0.06] shrink-0">
        <div className="size-1.5 rounded-full bg-emerald-500" />
        <span className="text-xs font-semibold text-[#EDE8DF] tracking-wider">实时沙盒</span>
        <span className="text-[10px] text-[#6B6459] ml-auto font-mono">Debug</span>
      </div>

      {/* ── Prompt 预览 ── */}
      <div className="px-5 py-3 border-b border-white/[0.04] shrink-0 space-y-2">
        <Label className="text-[11px] text-[#6B6459] uppercase tracking-wider">当前 Prompt</Label>
        <blockquote className="text-xs text-[#6B6459] font-mono leading-relaxed line-clamp-3 bg-[#0A1118] rounded-md p-2.5 border border-white/[0.04]">
          {promptContent || '未选择模板'}
        </blockquote>
        <div className="flex items-center gap-3 text-[11px] text-[#6B6459] font-mono">
          <span className="inline-flex items-center gap-1">
            <Thermometer size={10} /> T={temperature.toFixed(2)}
          </span>
          <span className="inline-flex items-center gap-1">
            <Gauge size={10} /> P={topP.toFixed(2)}
          </span>
          <span className="inline-flex items-center gap-1">
            <Hash size={10} /> Max={maxTokens}
          </span>
        </div>
      </div>

      {/* ── 对话历史 ── */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="px-5 py-4 space-y-3">
          {debugHistory.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Bot size={22} className="text-[#6B6459]" />
              <p className="text-xs text-[#6B6459] text-center max-w-48">
                {promptContent ? '输入测试消息开始调试' : '请先选择模板'}
              </p>
            </div>
          )}
          {debugHistory.map((msg, i) => (
            <div
              key={i}
              className={cn(
                'rounded-lg px-3.5 py-3 text-xs leading-relaxed',
                msg.role === 'user'
                  ? 'bg-[#C04030]/5 border border-[#C04030]/10'
                  : 'bg-white/[0.03] border border-white/[0.06]',
              )}
            >
              <div className="flex items-center gap-1.5 mb-2">
                <span className={cn(
                  'text-[11px] font-semibold tracking-wider',
                  msg.role === 'user' ? 'text-[#C04030]' : 'text-emerald-500',
                )}>
                  {msg.role === 'user' ? 'YOU' : 'LLM'}
                </span>
              </div>
              <p className="text-[#A09888] font-mono whitespace-pre-wrap">{msg.content.slice(0, 800)}</p>
            </div>
          ))}
          {error && (
            <div className="rounded-lg px-3.5 py-3 bg-[#C04030]/5 border border-[#C04030]/10">
              <div className="flex items-center gap-1.5 mb-1.5">
                <XCircle size={11} className="text-red-400" />
                <span className="text-[11px] font-semibold text-red-400 tracking-wider">ERROR</span>
              </div>
              <p className="text-xs text-red-400">{error}</p>
            </div>
          )}
          {response && debugHistory.length === 0 && (
            <div className="rounded-lg px-3.5 py-3 bg-white/[0.03] border border-white/[0.06]">
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="text-[11px] font-semibold text-emerald-500 tracking-wider">LLM</span>
              </div>
              <p className="text-xs text-[#A09888] font-mono whitespace-pre-wrap">{response.slice(0, 800)}</p>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* ── 输入区 ── */}
      <div className="shrink-0 px-5 py-4 border-t border-white/[0.06] bg-[#0A1118]/80">
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="输入模拟用户消息…"
            rows={2}
            className="flex-1 min-h-0 text-xs font-mono resize-none bg-[#1A2332] border-white/[0.08]"
            onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleDebug() }}
          />
          <Button
            size="icon"
            onClick={handleDebug}
            disabled={!input.trim() || running}
            className="shrink-0 self-end"
          >
            {running ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          </Button>
        </div>
        <p className="text-[10px] text-[#6B6459] mt-2 text-right">
          Ctrl+Enter 发送
        </p>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════
// ParamSlider — 单行参数控制器
// ═══════════════════════════════════════
function ParamSlider({
  icon: Icon,
  label,
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
    <div className="space-y-2.5">
      {/* 标签行 */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Icon size={12} className="text-[#6B6459] shrink-0" />
          <Label className="text-xs text-[#A09888] font-medium truncate">{label}</Label>
          {tooltip && (
            <TooltipProvider delayDuration={500}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle size={10} className="text-[#6B6459] shrink-0 cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-64">
                  <p className="text-xs leading-relaxed">{tooltip}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        <span className="text-xs font-bold font-mono tabular-nums text-[#EDE8DF] shrink-0">
          {step < 1 ? value.toFixed(2) : value}
          {unit && <span className="text-[#6B6459] font-normal ml-0.5">{unit}</span>}
        </span>
      </div>
      {/* 滑块 */}
      <Slider value={value} min={min} max={max} step={step} onValueChange={onChange} />
      {/* 提示 */}
      {hint && <p className="text-[11px] text-[#6B6459] leading-relaxed">{hint}</p>}
    </div>
  )
}

// ═══════════════════════════════════════
// 主组件 — 百分比三栏 · 全局调色对齐 · 滑块收紧
// ═══════════════════════════════════════
export default function PromptEditor() {
  const [prompts, setPrompts] = useState<PromptRow[]>([])
  const [initialLoading, setInitialLoading] = useState(true)
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
  const [rollbackLoading, setRollbackLoading] = useState(false)

  const [temperature, setTemperature] = useState(0.7)
  const [topP, setTopP] = useState(0.9)
  const [maxTokens, setMaxTokens] = useState(2048)

  const [searchQuery, setSearchQuery] = useState('')

  const editorRef = useRef<HTMLDivElement>(null)

  // ═══════════════════════════════
  // 数据加载
  // ═══════════════════════════════
  const load = useCallback(async (isInitial = false) => {
    if (isInitial) setInitialLoading(true)
    const res = await api.get<PromptRow[]>('/api/v1/admin/prompts')
    if (res.success && Array.isArray(res.data)) {
      setPrompts(res.data)
    } else if (!res.success && res.error?.code !== 'UNAUTHORIZED') {
      flashStatus('err', '加载模板列表失败')
    }
    if (isInitial) setInitialLoading(false)
  }, [])

  useEffect(() => { load(true) }, [load])

  const flashStatus = (type: 'ok' | 'err', msg: string) => {
    setStatus({ type, msg })
    setTimeout(() => setStatus(null), 2500)
  }

  const selectPrompt = useCallback((p: PromptRow) => {
    try {
      setSelected(p)
      setShowNew(false)
      const { locked, editable } = splitContent(p.content)
      setLockedPrefix(locked)
      setEditableContent(editable)
      setEditDisplayName(p.displayName)
      setEditDescription(p.description ?? '')
      setEditIsActive(p.isActive === 1)
      setDirty(false)
    } catch (e) {
      console.error('selectPrompt error:', e)
      flashStatus('err', '切换模板时出错，请刷新页面')
    }
  }, [])

  useEffect(() => {
    if (!initialLoading && prompts.length > 0 && !selected) {
      selectPrompt(prompts[0])
    }
  }, [initialLoading, prompts, selected, selectPrompt])

  const loadVersions = useCallback(async () => {
    if (!selected) return
    setVersionsLoading(true)
    const res = await api.get<VersionRow[]>(`/api/v1/admin/prompts/${selected.id}/versions`)
    if (res.success) setVersions(res.data ?? [])
    else flashStatus('err', '加载版本历史失败')
    setVersionsLoading(false)
  }, [selected])

  useEffect(() => {
    if (selected) loadVersions()
  }, [selected, loadVersions])

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
      loadVersions()
    } else {
      flashStatus('err', res.error?.message ?? '保存失败')
    }
  }, [selected, lockedPrefix, editableContent, editDisplayName, editDescription, editIsActive, load, loadVersions])

  const handleEditorChange = useCallback((value: string) => { setEditableContent(value); setDirty(true) }, [])

  const handleCreate = async () => {
    if (!newForm.name.trim() || !newForm.content.trim()) { flashStatus('err', '标识和内容为必填项'); return }
    const res = await api.post<PromptRow>('/api/v1/admin/prompts', {
      name: newForm.name,
      displayName: newForm.displayName || newForm.name,
      content: joinContent(LOCKED_SYSTEM_PREFIX + LOCKED_DELIMITER, newForm.content),
      description: newForm.description || null,
    })
    if (res.success && res.data) {
      setShowNew(false)
      setNewForm({ name: '', displayName: '', content: '', description: '' })
      await load()
      selectPrompt(res.data)
      flashStatus('ok', '模板已创建')
    } else if (res.success) {
      setShowNew(false)
      setNewForm({ name: '', displayName: '', content: '', description: '' })
      await load()
      flashStatus('ok', '模板已创建')
    } else {
      flashStatus('err', res.error?.message ?? '创建失败')
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('确定删除此 Prompt 模板？此操作不可撤销。')) return
    const res = await api.delete(`/api/v1/admin/prompts/${id}`)
    if (res.success) {
      if (selected?.id === id) {
        const idx = prompts.findIndex(p => p.id === id)
        if (idx >= 0 && idx + 1 < prompts.length) {
          selectPrompt(prompts[idx + 1])
        } else if (idx > 0) {
          selectPrompt(prompts[idx - 1])
        } else {
          setSelected(null)
        }
      }
      flashStatus('ok', '已删除')
      await load()
    } else {
      flashStatus('err', res.error?.message ?? '删除失败')
    }
  }

  const handleRollback = useCallback(async (version: VersionRow) => {
    if (!selected) return
    setRollbackLoading(true)
    const res = await api.post(`/api/v1/admin/prompts/${selected.id}/rollback/${version.version}`)
    if (res.success) {
      flashStatus('ok', (res as any).message ?? '回滚成功')
      const refreshed = await api.get<PromptRow>(`/api/v1/admin/prompts/${selected.id}`)
      if (refreshed.success && refreshed.data) selectPrompt(refreshed.data)
      load()
      loadVersions()
      setRollbackTarget(null)
    } else {
      flashStatus('err', res.error?.message ?? '回滚失败')
    }
    setRollbackLoading(false)
  }, [selected, selectPrompt, load, loadVersions])

  useCodeMirror(editorRef, editableContent, handleEditorChange)

  // Ctrl+S 保存
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); if (dirty && selected) handleSave() }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [dirty, selected, handleSave])

  const filteredPrompts = prompts.filter(p => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return p.displayName.toLowerCase().includes(q) || p.name.toLowerCase().includes(q)
  })

  // ── 加载态 ──
  if (initialLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <RefreshCw size={20} className="animate-spin text-[#6B6459]" />
      </div>
    )
  }

  // ── 空状态 ──
  if (prompts.length === 0 && !showNew) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-4">
        <Card className="max-w-lg w-full bg-[#1A1F2E] border-white/[0.06]">
          <CardHeader>
            <div className="flex items-start gap-4">
              <div className="size-12 flex items-center justify-center rounded-lg bg-[#B8964A]/10 border border-[#B8964A]/20 shrink-0">
                <Layout size={22} className="text-[#B8964A]" />
              </div>
              <div>
                <CardTitle className="text-base tracking-wider text-[#EDE8DF]">Prompt 驾驶舱</CardTitle>
                <CardDescription className="mt-1.5 leading-relaxed text-[#A09888]">
                  此模块用于热编辑 AI 的核心系统指令与防越权护栏。所有模板数据持久化保存在 <code className="text-[#B8964A] bg-[#B8964A]/10 px-1.5 py-0.5 rounded text-xs font-mono">prompt_templates</code> 数据库表中。
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              {[
                { icon: GitBranch, color: 'text-[#B8964A]', bg: 'bg-[#B8964A]/10', title: '左侧栏', desc: '选择 Prompt 模板版本，编辑元数据与回滚历史' },
                { icon: Code2, color: 'text-emerald-500', bg: 'bg-emerald-500/10', title: '中间编辑区', desc: 'CodeMirror 编辑器 + L3 护栏面板 + 模型参数调参' },
                { icon: FlaskConical, color: 'text-blue-400', bg: 'bg-blue-400/10', title: '右侧沙盒', desc: '输入测试用例，带着当前 Prompt + 参数实时请求 LLM 验证效果' },
              ].map(item => (
                <div key={item.title} className="bg-white/[0.03] border border-white/[0.04] rounded-lg p-3 text-center">
                  <div className={cn('size-8 flex items-center justify-center rounded-lg mx-auto mb-2', item.bg)}>
                    <item.icon size={14} className={item.color} />
                  </div>
                  <p className="text-xs font-medium text-[#EDE8DF] mb-0.5">{item.title}</p>
                  <p className="text-[11px] text-[#6B6459] leading-snug">{item.desc}</p>
                </div>
              ))}
            </div>
            <div className="bg-white/[0.02] border border-white/[0.04] rounded-lg p-3 space-y-2">
              <p className="text-[11px] font-medium text-[#6B6459] tracking-wider">键盘快捷键</p>
              <div className="flex flex-wrap gap-3">
                {[
                  { key: 'Ctrl+S', desc: '保存' },
                  { key: 'Ctrl+Enter', desc: '沙盒发送' },
                  { key: '{{', desc: '变量补全' },
                ].map(item => (
                  <span key={item.key} className="inline-flex items-center gap-1.5 text-xs text-[#6B6459]">
                    <kbd className="px-1.5 py-0.5 rounded bg-[#1A2332] border border-white/[0.06] text-[11px] font-mono text-[#EDE8DF]">{item.key}</kbd>
                    {item.desc}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex items-start gap-2.5 bg-[#B8964A]/5 border border-[#B8964A]/15 rounded-lg p-3">
              <Info size={13} className="text-[#B8964A] shrink-0 mt-0.5" />
              <p className="text-xs text-[#A09888] leading-relaxed">
                <span className="font-medium text-[#EDE8DF]">数据持久化说明：</span>
                所有 Prompt 模板、版本历史、护栏规则均存储在 SQLite 的 <code className="text-[#B8964A] bg-[#B8964A]/10 px-1 rounded text-[11px] font-mono">prompt_templates</code> 与 <code className="text-[#B8964A] bg-[#B8964A]/10 px-1 rounded text-[11px] font-mono">prompt_versions</code> 表中。内置模板标记为 <code className="text-[#B8964A] bg-[#B8964A]/10 px-1 rounded text-[11px] font-mono">isBuiltin=1</code>，不可删除但可覆盖编辑。每次保存自动生成新版本。
              </p>
            </div>
            <div className="flex justify-center pt-2">
              <Button onClick={() => setShowNew(true)} variant="destructive" className="gap-2 shadow-lg shadow-[#C04030]/20">
                <Plus size={14} />
                创建第一个模板
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ── 新建表单（无模板时全屏） ──
  if (showNew && prompts.length === 0) {
    return (
      <div className="flex items-start justify-center pt-12 pb-8 overflow-y-auto px-4 h-full">
        <div className="w-full max-w-xl">
          <Card className="bg-[#1A1F2E] border-white/[0.06]">
            <CardHeader>
              <div className="flex items-start gap-3">
                <div className="size-10 flex items-center justify-center rounded-lg bg-[#C04030]/10 border border-[#C04030]/15 shrink-0">
                  <Plus size={18} className="text-[#C04030]" />
                </div>
                <div>
                  <CardTitle className="text-sm tracking-wider text-[#EDE8DF]">新建 Prompt 模板</CardTitle>
                  <CardDescription className="mt-1 leading-relaxed text-xs text-[#A09888]">
                    创建一个新的系统指令模板。系统身份前缀（角色设定与护栏规则）会自动附加在您编写的内容之前。
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>{renderNewForm()}</CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════
  // 主三栏百分比布局 (3:5:4)
  // ═══════════════════════════════════════
  return (
    <div className="h-full flex flex-col gap-2 px-1.5 pt-1.5 pb-1.5">
      {/* ═══ 页面头部 ═══ */}
      <div className="flex items-center justify-between shrink-0 px-2">
        <div>
          <h2 className="text-base font-semibold text-[#EDE8DF] flex items-center gap-2 tracking-[0.04em]">
            <FileText size={16} className="text-[#B8964A]" />
            Prompt 驾驶舱
          </h2>
          <p className="text-[10px] text-[#6B6459] mt-0.5">
            {prompts.length} 个模板 · 边写边调边测 · Ctrl+S 保存
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setShowNew(true); setSelected(null) }}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-[#EDE8DF] bg-[#C04030] hover:bg-[#A03024] rounded-md transition-colors"
          >
            <Plus size={12} /> 新建
          </button>
        </div>
      </div>

      {/* ── 状态消息 ── */}
      {status && (
        <div className={`shrink-0 mx-2 px-3 py-1.5 rounded-md text-[10px] flex items-center gap-1.5 ${
          status.type === 'ok' ? 'bg-[#5B8C5A]/10 border border-[#5B8C5A]/20 text-[#5B8C5A]'
          : 'bg-[#C04030]/10 border border-[#C04030]/20 text-[#D06050]'
        }`}>
          {status.type === 'ok' ? <CheckCircle2 size={11} /> : <AlertTriangle size={11} />}
          {status.msg}
        </div>
      )}

      {/* ═══ 主内容区 ═══ */}
      <div className="flex-1 min-h-0 grid grid-cols-12 w-full max-w-[1600px] mx-auto overflow-hidden">
        {/* ═══ 左栏 col-span-3 (25%) ═══ */}
        <div className="col-span-3 h-full border-r border-white/[0.06]">
          <LeftPanel
            prompts={filteredPrompts}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            selected={selected}
            onSelect={selectPrompt}
            onDelete={handleDelete}
            onNew={() => { setShowNew(true); setSelected(null) }}
            versions={versions}
            versionsLoading={versionsLoading}
            onRollback={setRollbackTarget}
          />
        </div>

        {/* ═══ 中栏 col-span-5 (~42%) ═══ */}
        <div className="col-span-5 h-full">
          <ScrollArea className="h-full">
            <div className="p-6 space-y-6 min-h-full">
              {showNew ? (
                <Card className="bg-[#1A1F2E] border-white/[0.06]">
                  <CardHeader>
                    <div className="flex items-start gap-3">
                      <div className="size-10 flex items-center justify-center rounded-lg bg-[#C04030]/10 border border-[#C04030]/15 shrink-0">
                        <Plus size={18} className="text-[#C04030]" />
                      </div>
                      <div>
                        <CardTitle className="text-sm tracking-wider text-[#EDE8DF]">新建 Prompt 模板</CardTitle>
                        <CardDescription className="mt-1 leading-relaxed text-xs text-[#A09888]">
                          创建一个新的系统指令模板。系统身份前缀（角色设定与护栏规则）会自动附加在您编写的内容之前。
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>{renderNewForm()}</CardContent>
                </Card>
              ) : selected ? (
                <>
                  {/* ── 基础配置区 ── */}
                  <div className="bg-[#1A1F2E] border border-white/[0.06] rounded-lg p-4 space-y-3">
                    {/* 第一行：名称 + 版本 + 内置标记 + 启用开关 + 删除 */}
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <Input
                          value={editDisplayName}
                          onChange={e => { setEditDisplayName(e.target.value); setDirty(true) }}
                          className="bg-transparent border-0 text-sm font-semibold text-[#EDE8DF] placeholder:text-[#6B6459] w-40 focus-visible:ring-0 p-0 h-auto"
                        />
                        <Badge variant="outline" className="text-[10px] font-mono text-[#6B6459] shrink-0">
                          {selected.name} · v{selected.version}
                        </Badge>
                        {selected.isBuiltin === 1 && (
                          <Badge variant="secondary" className="text-[10px] shrink-0">内置</Badge>
                        )}
                        {dirty && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0 animate-pulse" title="未保存" />}
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="flex items-center gap-1.5">
                          <Label className="text-[11px] text-[#6B6459]">启用</Label>
                          <Switch checked={editIsActive} onCheckedChange={v => { setEditIsActive(v); setDirty(true) }} />
                        </div>
                        <Button
                          onClick={handleSave}
                          disabled={!dirty}
                          size="sm"
                          variant={dirty ? 'default' : 'ghost'}
                          className={cn('gap-1.5 text-xs', !dirty && 'text-[#6B6459]')}
                        >
                          <Save size={11} />
                          {dirty ? '保存' : '已最新'}
                        </Button>
                        {selected.isBuiltin !== 1 && (
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => handleDelete(selected.id)}
                            className="text-[#6B6459] hover:text-[#C04030]"
                            title="删除"
                          >
                            <Trash2 size={12} />
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* 第二行：描述 */}
                    <div className="flex items-center gap-2">
                      <Info size={11} className="text-[#6B6459] shrink-0" />
                      <Input
                        value={editDescription}
                        onChange={e => { setEditDescription(e.target.value); setDirty(true) }}
                        placeholder="用途说明…"
                        className="flex-1 h-7 text-xs bg-[#0A1118] border-white/[0.08] focus-visible:border-[#B8964A]"
                      />
                    </div>
                  </div>

                  {/* ── 模型参数区域 ── */}
                  <div className="bg-[#1A1F2E] border border-white/[0.06] rounded-lg p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <SlidersHorizontal size={14} className="text-[#B8964A]" />
                        <span className="text-xs font-semibold text-[#EDE8DF] tracking-wider">模型参数预设</span>
                      </div>
                      <span className="text-[11px] text-[#6B6459]">影响 Debug 沙盒</span>
                    </div>

                    {/* 滑块 — 收紧宽度，防止横跨满屏 */}
                    <div className="space-y-4 max-w-xl">
                      <ParamSlider
                        icon={Thermometer}
                        label="Temperature"
                        value={temperature}
                        min={0} max={2} step={0.01}
                        onChange={setTemperature}
                        tooltip="值越大（如 0.8），AI 回答越发散有创意；值越小（如 0.2），回答越严谨保守。范围 0~2"
                        hint={temperature < 0.3 ? '极低随机性 · 输出确定性高' : temperature > 1.5 ? '极高创造力 · 输出可能偏离预期' : '平衡创造性与一致性'}
                      />
                      <ParamSlider
                        icon={Gauge}
                        label="Top P"
                        value={topP}
                        min={0} max={1} step={0.01}
                        onChange={setTopP}
                        tooltip="核采样阈值：只从累计概率达 P 的候选词中采样。值越低输出越保守聚焦"
                        hint="控制候选词范围 · 0.1=极保守 ｜ 0.95=高多样性"
                      />
                      <ParamSlider
                        icon={Hash}
                        label="Max Tokens"
                        value={maxTokens}
                        min={256} max={32768} step={256}
                        onChange={setMaxTokens}
                        tooltip="AI 单次输出最多的 token 数量。1 token ≈ 0.7 汉字。值越大回复越完整但成本越高"
                        hint="输出长度上限 · 影响回复完整度与 API 成本"
                      />
                    </div>

                    <Separator className="bg-white/[0.06]" />

                    {/* 快捷预设按钮组 */}
                    <div className="space-y-2">
                      <Label className="text-[11px] text-[#6B6459]">快捷预设</Label>
                      <div className="flex flex-wrap gap-1.5">
                        {PARAM_PRESETS.map(preset => {
                          const isActive = temperature === preset.temperature && topP === preset.topP
                          return (
                            <TooltipProvider key={preset.label} delayDuration={500}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant={isActive ? 'default' : 'outline'}
                                    size="xs"
                                    onClick={() => {
                                      setTemperature(preset.temperature)
                                      setTopP(preset.topP)
                                      setMaxTokens(preset.maxTokens)
                                    }}
                                    className="gap-1.5 text-xs"
                                  >
                                    {preset.label}
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="text-xs">
                                    {preset.description}<br />
                                    <span className="text-[#6B6459] font-mono">
                                      T{preset.temperature} · P{preset.topP} · Max{preset.maxTokens}
                                    </span>
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )
                        })}
                      </div>
                    </div>
                  </div>

                  {/* ── 系统身份锁定区 ── */}
                  <div className="rounded-lg border border-white/[0.06] bg-[#1A1F2E] overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2 bg-white/[0.03] border-b border-white/[0.04]">
                      <div className="flex items-center gap-2">
                        <Lock size={10} className="text-[#B8964A]" />
                        <span className="text-[11px] font-medium text-[#EDE8DF]">系统身份锁定区</span>
                      </div>
                      <span className="text-[10px] text-[#6B6459]">保存时自动拼接</span>
                    </div>
                    <div className="px-4 py-2.5 font-mono text-xs text-[#A09888] leading-relaxed whitespace-pre-wrap select-none max-h-20 overflow-y-auto">
                      {lockedPrefix}
                    </div>
                  </div>

                  {/* ── 变量分隔线 ── */}
                  <div className="flex items-center gap-3">
                    <Separator className="flex-1 bg-white/[0.04]" />
                    <div className="flex items-center gap-1.5 text-[11px] text-[#6B6459] shrink-0">
                      <PenLine size={9} />
                      输入 {'{{'} 补全变量
                    </div>
                    <Separator className="flex-1 bg-white/[0.04]" />
                  </div>

                  {/* ═══ CodeMirror 编辑器 ═══ */}
                  <div
                    ref={editorRef}
                    className="min-h-[400px] rounded-lg border border-white/[0.06] overflow-hidden"
                  />
                </>
              ) : (
                /* ── 未选中模板 ── */
                <div className="flex-1 flex items-center justify-center min-h-[300px]">
                  <div className="text-center space-y-3">
                    <GitBranch size={32} className="text-[#6B6459] mx-auto" />
                    <div>
                      <p className="text-sm text-[#6B6459]">请从左侧选择一个模板开始编辑</p>
                      <p className="text-xs text-[#6B6459] mt-1">共 {prompts.length} 个模板可用</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* ═══ 右栏 col-span-4 (~33%)：实时沙盒 ═══ */}
        <div className="col-span-4 h-full border-l border-white/[0.06]">
          <DebugPanel
            promptContent={selected ? joinContent(lockedPrefix, editableContent) : ''}
            temperature={temperature}
            topP={topP}
            maxTokens={maxTokens}
          />
        </div>

        {/* ═══ 版本回滚预览弹窗 ═══ */}
        {rollbackTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => { if (!rollbackLoading) setRollbackTarget(null) }}
            />
            <div className="relative bg-[#1A1F2E] border border-white/[0.06] rounded-lg max-w-3xl w-full mx-4 shadow-2xl flex flex-col max-h-[85vh]">
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.04] shrink-0">
                <div className="flex items-center gap-3">
                  <div className="size-9 flex items-center justify-center rounded-lg bg-[#C04030]/10 border border-[#C04030]/15">
                    <History size={16} className="text-[#C04030]" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-[#EDE8DF]">版本预览 — v{rollbackTarget.version}</h4>
                    <p className="text-xs text-[#6B6459] mt-0.5">
                      {new Date(rollbackTarget.createdAt).toLocaleDateString('zh-CN', {
                        year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
                      })}
                      {rollbackTarget.createdBy ? ` · ${rollbackTarget.createdBy}` : ''}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => { if (!rollbackLoading) setRollbackTarget(null) }}
                >
                  <X size={15} />
                </Button>
              </div>

              {rollbackTarget.changeNote && (
                <div className="px-5 pt-4 shrink-0 space-y-1">
                  <Label className="text-[11px] text-[#6B6459] uppercase tracking-wider flex items-center gap-1.5">
                    <Info size={10} />
                    更新说明
                  </Label>
                  <p className="text-sm text-[#A09888]">{rollbackTarget.changeNote}</p>
                </div>
              )}

              <div className="px-5 pt-3 flex-1 min-h-0 flex flex-col">
                <Label className="text-[11px] text-[#6B6459] uppercase tracking-wider flex items-center gap-1.5 mb-2 shrink-0">
                  <Code2 size={10} />
                  完整 Prompt 内容（只读）
                </Label>
                <div className="flex-1 min-h-0 mb-4 rounded-lg border border-white/[0.06] bg-white/[0.02] overflow-hidden">
                  <Textarea
                    readOnly
                    value={rollbackTarget.content}
                    className="w-full h-full min-h-[240px] resize-none border-0 bg-transparent text-xs font-mono text-[#A09888] leading-relaxed focus-visible:ring-0"
                    style={{ caretColor: 'transparent' }}
                  />
                </div>
              </div>

              <div className="shrink-0 px-5 py-4 border-t border-white/[0.04] flex items-center justify-between">
                <p className="text-xs text-[#6B6459]">回滚将自动存档当前版本，此操作可追溯</p>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setRollbackTarget(null)}
                    disabled={rollbackLoading}
                  >
                    取消
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleRollback(rollbackTarget)}
                    disabled={rollbackLoading}
                    className="gap-1.5 shadow-lg shadow-[#C04030]/20"
                  >
                    {rollbackLoading ? (
                      <>
                        <Loader2 size={12} className="animate-spin" />
                        回滚中…
                      </>
                    ) : (
                      <>
                        <RotateCcw size={12} />
                        确认回滚至此版本
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )

  // ═══════════════════════════════════════
  // 内联渲染函数：新建表单
  // ═══════════════════════════════════════
  function renderNewForm() {
    return (
      <div className="space-y-5">
        <div className="space-y-2">
          <Label className="text-xs text-[#6B6459] font-medium flex items-center gap-1.5">
            <Code2 size={11} />
            模板标识 (Template ID)
          </Label>
          <Input
            value={newForm.name}
            onChange={e => setNewForm(f => ({ ...f, name: e.target.value }))}
            placeholder="如：bazi_core_prompt"
            className="text-xs font-mono bg-[#1A2332] border-white/[0.08]"
          />
          <p className="text-[11px] text-[#6B6459] leading-relaxed">
            在代码中调用的唯一键名，必须为英文字母、数字或下划线，例如：<code className="text-[#B8964A] bg-[#B8964A]/10 px-1 rounded text-[11px] font-mono">bazi_core_prompt</code>
          </p>
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-[#6B6459] font-medium flex items-center gap-1.5">
            <PenLine size={11} />
            显示名称 (Display Name)
          </Label>
          <Input
            value={newForm.displayName}
            onChange={e => setNewForm(f => ({ ...f, displayName: e.target.value }))}
            placeholder="如：防幻觉指令"
            className="text-xs bg-[#1A2332] border-white/[0.08]"
          />
          <p className="text-[11px] text-[#6B6459] leading-relaxed">
            在模板列表中展示的人类可读名称，支持中文。留空则自动使用模板标识。
          </p>
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-[#6B6459] font-medium flex items-center gap-1.5">
            <Info size={11} />
            用途描述 (Description)
          </Label>
          <Input
            value={newForm.description}
            onChange={e => setNewForm(f => ({ ...f, description: e.target.value }))}
            placeholder="简要说明此模板的用途..."
            className="text-xs bg-[#1A2332] border-white/[0.08]"
          />
          <p className="text-[11px] text-[#6B6459] leading-relaxed">
            可选。在左侧元数据卡片中展示，帮助团队成员理解模板用途。
          </p>
        </div>

        <div className="space-y-2">
          <TooltipProvider delayDuration={400}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Label className="text-xs text-[#6B6459] font-medium flex items-center gap-1.5 cursor-help">
                  <FileText size={11} />
                  用户可编辑内容 (Editable Content)
                  <HelpCircle size={9} className="text-[#6B6459]" />
                </Label>
              </TooltipTrigger>
              <TooltipContent className="max-w-64">
                <p className="text-xs">系统身份前缀（角色·护栏·输出结构）会自动附加在此内容之前，最终拼接成完整的 System Prompt 发送给 AI</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Textarea
            value={newForm.content}
            onChange={e => setNewForm(f => ({ ...f, content: e.target.value }))}
            placeholder="在此编写模板的可编辑部分... 支持使用 {{变量名}} 注入动态数据。"
            rows={8}
            className="text-xs font-mono bg-[#1A2332] border-white/[0.08] resize-none leading-relaxed"
          />
          <p className="text-[11px] text-[#6B6459] leading-relaxed">
            输入核心系统指令。支持使用 <code className="text-[#B8964A] bg-[#B8964A]/10 px-1 rounded text-[11px] font-mono">{'{{变量名}}'}</code> 注入动态数据（如 {'{{chart.dayMaster}}'} {'{{annotation.patternName}}'} 等），输入 {'{{'} 即可触发自动补全。
          </p>
        </div>

        <div className="rounded-lg border border-white/[0.06] bg-[#1A1F2E] overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 bg-white/[0.03] border-b border-white/[0.04]">
            <div className="flex items-center gap-2">
              <Lock size={10} className="text-[#B8964A]" />
              <span className="text-[11px] font-medium text-[#EDE8DF]">系统前缀预览</span>
            </div>
            <span className="text-[10px] text-[#6B6459]">保存时自动拼接</span>
          </div>
          <div className="px-4 py-2.5 font-mono text-xs text-[#A09888] leading-relaxed max-h-24 overflow-y-auto">
            {LOCKED_SYSTEM_PREFIX + LOCKED_DELIMITER}
            <span className="text-[#B8964A]">{'(← 您的内容将拼接在此处)'}</span>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="ghost" size="sm" onClick={() => setShowNew(false)}>取消</Button>
          <Button variant="destructive" size="sm" onClick={handleCreate} className="gap-1.5 shadow-lg shadow-[#C04030]/20">
            <Plus size={12} />
            创建模板
          </Button>
        </div>
      </div>
    )
  }
}

// ═══════════════════════════════════════
// LeftPanel — 左栏：模板列表 + 版本历史（全高度单列）
// ═══════════════════════════════════════
function LeftPanel({
  prompts,
  searchQuery,
  onSearchChange,
  selected,
  onSelect,
  onDelete,
  onNew,
  versions,
  versionsLoading,
  onRollback,
}: {
  prompts: PromptRow[]
  searchQuery: string
  onSearchChange: (v: string) => void
  selected: PromptRow | null
  onSelect: (p: PromptRow) => void
  onDelete: (id: number) => void
  onNew: () => void
  versions: VersionRow[]
  versionsLoading: boolean
  onRollback: (v: VersionRow) => void
}) {
  return (
    <div className="flex flex-col h-full bg-[#1A2332]">
      {/* 搜索 + 新建 */}
      <div className="shrink-0 px-4 pt-4 pb-2">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <GitBranch size={13} className="text-[#B8964A]" />
            <span className="text-xs uppercase tracking-wider text-[#6B6459] font-medium">
              模板列表
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Badge variant="outline" className="text-[10px] font-mono">{prompts.length}</Badge>
            <Button variant="ghost" size="icon-xs" onClick={onNew} className="text-[#6B6459] hover:text-[#EDE8DF]" title="新建模板">
              <Plus size={13} />
            </Button>
          </div>
        </div>
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#4A4540]" />
          <Input
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="搜索模板…"
            className="h-7 text-xs pl-7 bg-[#0A1118] border-white/[0.04] focus-visible:ring-0"
          />
        </div>
      </div>

      {/* 模板列表 */}
      <div className="flex-1 min-h-0 border-b border-white/[0.06]">
        <ScrollArea className="h-full">
          <div className="px-2 py-1">
            {prompts.length === 0 && (
              <div className="py-12 text-center">
                <GitBranch size={16} className="text-[#4A4540] mx-auto mb-2" />
                <p className="text-xs text-[#6B6459]">无匹配模板</p>
              </div>
            )}
            {prompts.map(p => {
              const isSelected = selected?.id === p.id
              return (
                <div
                  key={p.id}
                  className={cn(
                    'group flex items-center text-xs transition-colors rounded-lg mb-0.5',
                    isSelected
                      ? 'bg-[#B8964A]/10 border-l-2 border-l-[#B8964A]'
                      : 'hover:bg-white/[0.03] border-l-2 border-l-transparent',
                  )}
                >
                  <button
                    onClick={() => onSelect(p)}
                    className="flex-1 text-left px-3 py-2.5 min-w-0"
                  >
                    <div className="font-medium text-[#EDE8DF] leading-tight truncate">
                      {p.displayName || p.name}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-[#6B6459] font-mono">v{p.version}</span>
                      {p.isBuiltin === 1 && (
                        <Badge variant="secondary" className="text-[9px] py-0">内置</Badge>
                      )}
                      {p.isActive !== 1 && (
                        <Badge variant="outline" className="text-[9px] py-0 text-[#6B6459]">停用</Badge>
                      )}
                    </div>
                  </button>
                  <span
                    className={cn(
                      'p-1.5 shrink-0 transition-opacity rounded-lg',
                      p.isBuiltin === 1
                        ? 'text-[#4A4540] cursor-not-allowed'
                        : 'text-[#6B6459] hover:text-[#C04030] hover:bg-[#C04030]/5 cursor-pointer opacity-0 group-hover:opacity-100',
                    )}
                    onClick={p.isBuiltin === 1 ? undefined : (e) => { e.stopPropagation(); onDelete(p.id) }}
                    title={p.isBuiltin === 1 ? '系统内置模板不可删除' : '删除模板'}
                  >
                    <Trash2 size={11} />
                  </span>
                </div>
              )
            })}
          </div>
        </ScrollArea>
      </div>

      {/* 版本历史 */}
      <div className="shrink-0 max-h-[40%] flex flex-col">
        <div className="shrink-0 px-4 pt-3 pb-1.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History size={11} className="text-[#B8964A]" />
            <span className="text-xs uppercase tracking-wider text-[#6B6459] font-medium">
              版本历史
            </span>
          </div>
          {versionsLoading && <RefreshCw size={10} className="animate-spin text-[#6B6459]" />}
        </div>
        <div className="flex-1 min-h-0">
          <ScrollArea className="h-full">
            <div className="px-3 pb-3 space-y-1.5">
              {versions.length === 0 && !versionsLoading && (
                <div className="text-xs text-[#6B6459] text-center py-10 space-y-2">
                  <p>修改并按</p>
                  <kbd className="inline-block px-1.5 py-0.5 rounded bg-[#1A2332] border border-white/[0.06] text-[11px] font-mono text-[#A09888]">
                    Ctrl+S
                  </kbd>
                  <p>保存后生成历史版本</p>
                </div>
              )}
              {versions.map(v => (
                <div
                  key={v.id}
                  className={cn(
                    'p-2 rounded-lg border text-xs transition-colors cursor-pointer',
                    v.version === selected?.version
                      ? 'border-emerald-500/15 bg-emerald-500/5'
                      : 'border-transparent hover:border-white/[0.06] hover:bg-white/[0.02]',
                  )}
                  onClick={() => onRollback(v)}
                >
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="font-mono font-medium text-[#D8D2C8] text-[11px]">
                      v{v.version}
                    </span>
                    <RotateCcw size={10} className="text-[#4A4540] opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  {v.changeNote && (
                    <p className="text-[#6B6459] truncate text-[10px]">{v.changeNote}</p>
                  )}
                  <p className="text-[#4A4540] text-[10px] mt-0.5">
                    {new Date(v.createdAt).toLocaleDateString('zh-CN', {
                      month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
                    })}
                  </p>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      </div>

    </div>
  )
}