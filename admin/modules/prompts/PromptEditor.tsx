// ============================================================
// Phase 4.5 — Prompt 引擎编辑器 [核心组件]
// 文件：admin/modules/prompts/PromptEditor.tsx
// 职责：CodeMirror 6 + 不可删除锁定区 + {{ 变量自动补全 + 版本回滚
// ============================================================

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
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
  ChevronDown,
  RefreshCw,
  PenLine,
  Shield,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
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
  apiHeaders: Record<string, string>
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

/**
 * 从完整 content 中拆分：lockedPrefix + editableSuffix
 * 若 content 未以 LOCKED_SYSTEM_PREFIX 开头，则 lockedPrefix 为空
 */
function splitContent(content: string): { locked: string; editable: string } {
  if (content.startsWith(LOCKED_SYSTEM_PREFIX + LOCKED_DELIMITER)) {
    return {
      locked: LOCKED_SYSTEM_PREFIX + LOCKED_DELIMITER,
      editable: content.slice((LOCKED_SYSTEM_PREFIX + LOCKED_DELIMITER).length),
    }
  }
  // 兼容旧数据：如果内容直接以 locked prefix 开头（无分隔符）
  if (content.startsWith(LOCKED_SYSTEM_PREFIX)) {
    return {
      locked: LOCKED_SYSTEM_PREFIX + LOCKED_DELIMITER,
      editable: content.slice(LOCKED_SYSTEM_PREFIX.length).replace(/^\n*/, ''),
    }
  }
  return { locked: LOCKED_SYSTEM_PREFIX + LOCKED_DELIMITER, editable: content }
}

/** 组装完整 content */
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
    options: variables.map(v => ({
      label: v.label,
      type: 'variable',
      detail: v.detail,
      info: v.info,
    })),
  }
}

// ═══════════════════════════════════════
// CodeMirror Hook — 管理 EditorView 生命周期
// ═══════════════════════════════════════

function useCodeMirror(
  containerRef: React.RefObject<HTMLDivElement | null>,
  value: string,
  onChange: (value: string) => void,
) {
  const viewRef = useRef<EditorView | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    // 已有 view 则仅更新内容
    if (viewRef.current) {
      const currentContent = viewRef.current.state.doc.toString()
      if (value !== currentContent) {
        viewRef.current.dispatch({
          changes: {
            from: 0,
            to: currentContent.length,
            insert: value,
          },
        })
      }
      return
    }

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        onChange(update.state.doc.toString())
      }
    })

    const state = EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        bracketMatching(),
        foldGutter(),
        indentOnInput(),
        markdown(),
        oneDark,
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        cmHistory(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        autocompletion({
          override: [variableCompletions],
          activateOnTyping: true,
          defaultKeymap: true,
          icons: false,
        }),
        updateListener,
        EditorView.theme({
          '&': {
            backgroundColor: '#12100E',
            fontSize: '13px',
            fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
          },
          '.cm-scroller': {
            fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
            lineHeight: '1.7',
          },
          '.cm-gutters': {
            backgroundColor: '#0E0D0B',
            color: '#3E3A33',
            border: 'none',
            fontSize: '11px',
          },
          '.cm-activeLineGutter': {
            backgroundColor: '#1A1816',
            color: '#6B6459',
          },
          '.cm-activeLine': {
            backgroundColor: '#1A181630',
          },
          '.cm-cursor': {
            borderLeftColor: '#B8964A',
          },
          '.cm-selectionBackground': {
            backgroundColor: '#B8964A30 !important',
          },
          '.cm-matchingBracket': {
            backgroundColor: '#1A1816',
            outline: '1px solid #3A3630',
            color: '#B8964A',
          },
          '.cm-tooltip': {
            backgroundColor: '#1A1816',
            border: '1px solid #3A3630',
            borderRadius: '6px',
            color: '#EDE8DF',
            fontSize: '12px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          },
          '.cm-tooltip-autocomplete': {
            '& .cm-completionIcon': {
              width: '0.8em',
              marginRight: '0.5em',
            },
            '& .cm-completionLabel': {
              color: '#EDE8DF',
            },
            '& .cm-completionDetail': {
              color: '#A09888',
              fontStyle: 'normal',
            },
            '& .cm-completionInfo': {
              color: '#6B6459',
              fontSize: '11px',
              fontStyle: 'italic',
            },
            '& .cm-completionMatchedText': {
              color: '#B8964A',
              textDecoration: 'none',
              fontWeight: '600',
            },
            '& li[aria-selected]': {
              backgroundColor: '#B8964A20',
              '& .cm-completionLabel': { color: '#B8964A' },
            },
          },
        }),
      ],
    })

    const view = new EditorView({
      state,
      parent: containerRef.current,
    })

    viewRef.current = view
    return () => {
      view.destroy()
      viewRef.current = null
    }
  }, [containerRef, value, onChange])
}

// ═══════════════════════════════════════
// 主组件
// ═══════════════════════════════════════

export default function PromptEditor({ apiHeaders }: PromptEditorProps) {
  // ── 状态 ──
  const [prompts, setPrompts] = useState<PromptRow[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<PromptRow | null>(null)

  // 编辑器内容
  const [editableContent, setEditableContent] = useState('')
  const [lockedPrefix, setLockedPrefix] = useState(LOCKED_SYSTEM_PREFIX + LOCKED_DELIMITER)

  // 元数据编辑
  const [editDisplayName, setEditDisplayName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editIsActive, setEditIsActive] = useState(true)

  // 状态消息
  const [status, setStatus] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null)
  const [dirty, setDirty] = useState(false)

  // 新建表单
  const [showNew, setShowNew] = useState(false)
  const [newForm, setNewForm] = useState({ name: '', displayName: '', content: '', description: '' })

  // 版本面板
  const [showVersions, setShowVersions] = useState(false)
  const [versions, setVersions] = useState<VersionRow[]>([])
  const [versionsLoading, setVersionsLoading] = useState(false)

  // 确认弹窗
  const [rollbackTarget, setRollbackTarget] = useState<VersionRow | null>(null)

  // CodeMirror ref
  const editorRef = useRef<HTMLDivElement>(null)

  // ═══════════════════════════════
  // 数据加载
  // ═══════════════════════════════
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/v1/admin/prompts', { headers: apiHeaders })
      const data = await res.json()
      if (data?.success && Array.isArray(data.data)) {
        setPrompts(data.data)
      }
    } catch (e) {
      flashStatus('err', '加载模板列表失败')
    } finally {
      setLoading(false)
    }
  }, [apiHeaders])

  useEffect(() => { load() }, [load])

  const flashStatus = (type: 'ok' | 'err', msg: string) => {
    setStatus({ type, msg })
    setTimeout(() => setStatus(null), 2500)
  }

  // ═══════════════════════════════
  // 选中 Prompt
  // ═══════════════════════════════
  const selectPrompt = useCallback((p: PromptRow) => {
    setSelected(p)
    setShowNew(false)
    setShowVersions(false)

    const { locked, editable } = splitContent(p.content)
    setLockedPrefix(locked)
    setEditableContent(editable)
    setEditDisplayName(p.displayName)
    setEditDescription(p.description ?? '')
    setEditIsActive(p.isActive === 1)
    setDirty(false)
  }, [])

  // ═══════════════════════════════
  // 保存
  // ═══════════════════════════════
  const handleSave = useCallback(async () => {
    if (!selected) return
    const fullContent = joinContent(lockedPrefix, editableContent)

    try {
      const res = await fetch(`/api/v1/admin/prompts/${selected.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...apiHeaders },
        body: JSON.stringify({
          content: fullContent,
          displayName: editDisplayName,
          description: editDescription,
          isActive: editIsActive ? 1 : 0,
          changeNote: '编辑更新',
        }),
      })
      const result = await res.json()
      if (result?.success) {
        flashStatus('ok', `已保存 (v${result.data.version ?? '?'}) `)
        setDirty(false)
        load()
      } else {
        flashStatus('err', result?.error?.message ?? '保存失败')
      }
    } catch {
      flashStatus('err', '网络异常')
    }
  }, [selected, lockedPrefix, editableContent, editDisplayName, editDescription, editIsActive, apiHeaders, load])

  // 内容变更
  const handleEditorChange = useCallback((value: string) => {
    setEditableContent(value)
    setDirty(true)
  }, [])

  // ═══════════════════════════════
  // 新建
  // ═══════════════════════════════
  const handleCreate = async () => {
    if (!newForm.name.trim() || !newForm.content.trim()) {
      flashStatus('err', '标识和内容为必填项')
      return
    }
    try {
      const res = await fetch('/api/v1/admin/prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...apiHeaders },
        body: JSON.stringify({
          name: newForm.name,
          displayName: newForm.displayName || newForm.name,
          content: joinContent(LOCKED_SYSTEM_PREFIX + LOCKED_DELIMITER, newForm.content),
          description: newForm.description || null,
        }),
      })
      const result = await res.json()
      if (result?.success) {
        setShowNew(false)
        setNewForm({ name: '', displayName: '', content: '', description: '' })
        flashStatus('ok', '模板已创建')
        load()
      } else {
        flashStatus('err', result?.error?.message ?? '创建失败')
      }
    } catch {
      flashStatus('err', '网络异常')
    }
  }

  // ═══════════════════════════════
  // 删除
  // ═══════════════════════════════
  const handleDelete = async (id: number) => {
    if (!confirm('确定删除此模板？此操作不可撤销。')) return
    try {
      await fetch(`/api/v1/admin/prompts/${id}`, { method: 'DELETE', headers: apiHeaders })
      if (selected?.id === id) setSelected(null)
      flashStatus('ok', '已删除')
      load()
    } catch {
      flashStatus('err', '删除失败')
    }
  }

  // ═══════════════════════════════
  // 版本历史
  // ═══════════════════════════════
  const loadVersions = useCallback(async () => {
    if (!selected) return
    setVersionsLoading(true)
    try {
      const res = await fetch(`/api/v1/admin/prompts/${selected.id}/versions`, { headers: apiHeaders })
      const data = await res.json()
      if (data?.success) setVersions(data.data ?? [])
    } catch {
      flashStatus('err', '加载版本历史失败')
    } finally {
      setVersionsLoading(false)
    }
  }, [selected, apiHeaders])

  const toggleVersions = () => {
    if (!showVersions) {
      loadVersions()
    }
    setShowVersions(!showVersions)
  }

  const handleRollback = async (version: VersionRow) => {
    if (!selected) return
    setRollbackTarget(null)

    try {
      const res = await fetch(
        `/api/v1/admin/prompts/${selected.id}/rollback/${version.version}`,
        { method: 'POST', headers: apiHeaders },
      )
      const result = await res.json()
      if (result?.success) {
        flashStatus('ok', result.message ?? '回滚成功')
        // 刷新选中项
        const refreshed = await fetch(`/api/v1/admin/prompts/${selected.id}`, { headers: apiHeaders })
        const refreshedData = await refreshed.json()
        if (refreshedData?.success && refreshedData.data) {
          selectPrompt(refreshedData.data)
        }
        load()
        loadVersions()
      } else {
        flashStatus('err', result?.error?.message ?? '回滚失败')
      }
    } catch {
      flashStatus('err', '网络异常')
    }
  }

  // ═══════════════════════════════
  // CodeMirror Hook（仅在选中模板后激活）
  // ═══════════════════════════════
  useCodeMirror(editorRef, editableContent, handleEditorChange)

  // ═══════════════════════════════
  // 键盘快捷键
  // ═══════════════════════════════
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        if (dirty && selected) handleSave()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [dirty, selected, handleSave])

  // ═══════════════════════════════════════
  // 渲染
  // ═══════════════════════════════════════

  // ── 加载态 ──
  if (loading) {
    return (
      <div className="admin-card p-6 flex items-center gap-2 text-[#4A4540]">
        <RefreshCw size={14} className="animate-spin" />
        <span className="text-xs">加载 Prompt 模板列表...</span>
      </div>
    )
  }

  return (
    <Tabs defaultValue="editor" className="flex flex-col gap-0 h-full">
      {/* ── 子标签栏 ── */}
      <div className="shrink-0 px-2 pt-3">
        <TabsList className="bg-[#1A1816] border border-[#2A2622] p-1 gap-0">
          <TabsTrigger
            value="editor"
            className="data-[state=active]:bg-[#C04030] data-[state=active]:text-white data-[state=active]:shadow-md rounded-md px-3 py-1.5 text-xs"
          >
            <FileText size={13} />
            Prompt 模板编辑
          </TabsTrigger>
          <TabsTrigger
            value="guards"
            className="data-[state=active]:bg-[#C04030] data-[state=active]:text-white data-[state=active]:shadow-md rounded-md px-3 py-1.5 text-xs"
          >
            <Shield size={13} />
            L3 防幻觉护栏
          </TabsTrigger>
        </TabsList>
      </div>

      {/* ── 模板编辑器内容 ── */}
      <TabsContent value="editor" className="flex-1 overflow-y-auto px-2 pt-2">
        <div className="space-y-4">
      {/* 页面头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[#EDE8DF] flex items-center gap-2">
            <FileText size={18} className="text-[#B8964A]" />
            Prompt 模板引擎
          </h2>
          <p className="text-xs text-[#6B6459] mt-0.5">
            管理系统级 Prompt 与版本历史 · Ctrl+S 保存
          </p>
        </div>
        <button
          onClick={() => { setShowNew(true); setSelected(null) }}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-[#EDE8DF] bg-[#C04030] hover:bg-[#A03024] rounded-md transition-colors"
        >
          <Plus size={14} />
          新建模板
        </button>
      </div>

      {/* 状态消息 */}
      {status && (
        <div className={`px-3 py-2 rounded-md text-xs flex items-center gap-1.5 ${
          status.type === 'ok'
            ? 'bg-[#5B8C5A]/10 border border-[#5B8C5A]/20 text-[#5B8C5A]'
            : 'bg-[#C04030]/10 border border-[#C04030]/20 text-[#D06050]'
        }`}>
          {status.type === 'ok' ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
          {status.msg}
        </div>
      )}

      <div className="flex gap-4">
        {/* ── 左侧：模板列表 ── */}
        <div className="w-60 shrink-0">
          <div className="admin-card overflow-hidden">
            <div className="px-3 py-2 border-b border-[#2A2622]">
              <span className="text-[10px] uppercase tracking-wider text-[#4A4540] font-medium">
                模板列表 · {prompts.length}
              </span>
            </div>
            <div className="max-h-[calc(100vh-260px)] overflow-y-auto">
              {prompts.map(p => {
                const isSelected = selected?.id === p.id
                return (
                  <button
                    key={p.id}
                    onClick={() => selectPrompt(p)}
                    className={`w-full text-left px-3 py-2.5 border-b border-[#1A1614] text-sm transition-colors ${
                      isSelected
                        ? 'bg-[#B8964A]/8 border-l-2 border-l-[#B8964A]'
                        : 'hover:bg-[#1A1816] border-l-2 border-l-transparent'
                    }`}
                  >
                    <div className="font-medium text-[#EDE8DF] truncate text-xs">
                      {p.displayName || p.name}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-[#4A4540]">v{p.version}</span>
                      {p.isBuiltin === 1 && (
                        <span className="text-[9px] px-1 py-0.5 rounded bg-[#B8964A]/10 text-[#B8964A] font-medium">
                          内置
                        </span>
                      )}
                      {p.isActive === 0 && (
                        <span className="text-[9px] px-1 py-0.5 rounded bg-[#C04030]/10 text-[#D06050]">
                          禁用
                        </span>
                      )}
                    </div>
                  </button>
                )
              })}
              {prompts.length === 0 && (
                <div className="px-4 py-10 text-center text-[#4A4540] text-xs">
                  暂无模板，点击"新建模板"创建
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── 右侧：编辑器 ── */}
        <div className="flex-1 min-w-0">
          {showNew ? (
            /* ── 新建表单 ── */
            <div className="admin-card p-4 space-y-3">
              <h3 className="text-sm font-semibold text-[#EDE8DF]">新建 Prompt 模板</h3>

              <div className="space-y-1.5">
                <Label className="text-[#A09888] text-xs">模板标识</Label>
                <Input
                  value={newForm.name}
                  onChange={e => setNewForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="如 anti-hallucination"
                  className="bg-[#12100E] border-[#3A3630] text-[#EDE8DF] placeholder:text-[#4A4540] text-xs font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[#A09888] text-xs">显示名称</Label>
                <Input
                  value={newForm.displayName}
                  onChange={e => setNewForm(f => ({ ...f, displayName: e.target.value }))}
                  placeholder="如 防幻觉指令"
                  className="bg-[#12100E] border-[#3A3630] text-[#EDE8DF] placeholder:text-[#4A4540] text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[#A09888] text-xs">
                  用户可编辑内容（系统前缀会自动附加）
                </Label>
                <textarea
                  value={newForm.content}
                  onChange={e => setNewForm(f => ({ ...f, content: e.target.value }))}
                  placeholder="在此编写模板的可编辑部分..."
                  rows={6}
                  className="w-full px-3 py-2 bg-[#12100E] border border-[#3A3630] rounded-md text-[#EDE8DF] placeholder:text-[#4A4540] text-xs font-mono resize-none focus:outline-none focus:border-[#B8964A]/60"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowNew(false)}
                  className="px-3 py-1.5 text-xs text-[#A09888] hover:text-[#EDE8DF] rounded-md transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleCreate}
                  className="px-3 py-1.5 text-xs font-medium text-[#EDE8DF] bg-[#C04030] hover:bg-[#A03024] rounded-md transition-colors"
                >
                  创建模板
                </button>
              </div>
            </div>
          ) : selected ? (
            /* ── 编辑器主界面 ── */
            <div className="space-y-3">
              {/* 工具栏 */}
              <div className="admin-card px-4 py-2 flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <Input
                    value={editDisplayName}
                    onChange={e => { setEditDisplayName(e.target.value); setDirty(true) }}
                    className="bg-transparent border-none text-sm font-semibold text-[#EDE8DF] placeholder:text-[#4A4540] w-40 focus:outline-none p-0 h-auto"
                  />
                  {selected.isBuiltin === 1 && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#B8964A]/10 text-[#B8964A] font-medium shrink-0">
                      内置
                    </span>
                  )}
                  <span className="text-[10px] text-[#4A4540] font-mono">
                    {selected.name} · v{selected.version}
                  </span>
                  {dirty && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#C08040]" title="未保存" />
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={toggleVersions}
                    className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
                      showVersions
                        ? 'bg-[#B8964A]/15 text-[#B8964A]'
                        : 'text-[#6B6459] hover:text-[#A09888]'
                    }`}
                  >
                    <History size={12} />
                    版本 ({versions.length > 0 ? versions.length : '?'})
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={!dirty}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                      dirty
                        ? 'bg-[#5B8C5A] text-[#EDE8DF] hover:bg-[#4A7348] shadow-[0_0_12px_rgba(91,140,90,0.25)]'
                        : 'bg-[#211F1C] text-[#4A4540] cursor-not-allowed'
                    }`}
                  >
                    <Save size={11} />
                    {dirty ? '保存 (Ctrl+S)' : '已是最新'}
                  </button>
                  {selected.isBuiltin !== 1 && (
                    <button
                      onClick={() => handleDelete(selected.id)}
                      className="p-1.5 rounded text-[#4A4540] hover:text-[#D06050] hover:bg-[#C04030]/10 transition-colors"
                      title="删除模板"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              </div>

              {/* 内容区域：锁定区 + CodeMirror */}
              <div className="flex gap-3">
                <div className="flex-1 min-w-0 space-y-3">
                  {/* ── 锁定区：不可删除的系统身份前缀 ── */}
                  <div className="rounded-lg border border-[#B8964A]/25 bg-[#0E0D0B] overflow-hidden">
                    {/* 锁定标识栏 */}
                    <div className="flex items-center justify-between px-4 py-2 bg-[#B8964A]/8 border-b border-[#B8964A]/15">
                      <div className="flex items-center gap-2">
                        <Lock size={12} className="text-[#B8964A]" />
                        <span className="text-xs font-medium text-[#B8964A]">
                          系统身份锁定区 — 不可编辑
                        </span>
                      </div>
                      <span className="text-[9px] text-[#4A4540]">
                        受保护内容，保存时自动拼接
                      </span>
                    </div>

                    {/* 锁定内容预览 */}
                    <div className="px-4 py-3 font-mono text-xs text-[#A09888] leading-relaxed whitespace-pre-wrap select-none max-h-36 overflow-y-auto scrollbar-thin">
                      {lockedPrefix}
                    </div>
                  </div>

                  {/* ── 可编辑区分隔线 ── */}
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-px bg-[#2A2622]" />
                    <div className="flex items-center gap-1.5 text-[10px] text-[#4A4540]">
                      <PenLine size={10} />
                      <span>可编辑区域</span>
                      <span className="text-[#6B6459] text-[9px]">输入 {'{{'} 触发变量自动补全</span>
                    </div>
                    <div className="flex-1 h-px bg-[#2A2622]" />
                  </div>

                  {/* ── CodeMirror 编辑器 ── */}
                  <div
                    ref={editorRef}
                    className="min-h-[320px] rounded-lg border border-[#2A2622] overflow-hidden"
                  />
                </div>

                {/* ── 右侧面板：元数据 / 版本历史 ── */}
                <div className="w-52 shrink-0 space-y-3">
                  {/* 元数据卡片 */}
                  <div className="admin-card p-3 space-y-3">
                    <span className="text-[10px] uppercase tracking-wider text-[#4A4540] font-medium">
                      元数据
                    </span>

                    <div className="space-y-1.5">
                      <Label className="text-[#6B6459] text-[10px]">描述</Label>
                      <textarea
                        value={editDescription}
                        onChange={e => { setEditDescription(e.target.value); setDirty(true) }}
                        placeholder="用途说明..."
                        rows={3}
                        className="w-full px-2 py-1.5 bg-[#12100E] border border-[#2A2622] rounded text-[#A09888] placeholder:text-[#4A4540] text-[10px] resize-none focus:outline-none focus:border-[#B8964A]/60"
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label className="text-[#6B6459] text-[10px]">启用状态</Label>
                      <Switch
                        checked={editIsActive}
                        onCheckedChange={(v) => { setEditIsActive(v); setDirty(true) }}
                      />
                    </div>
                  </div>

                  {/* 版本历史面板 */}
                  {showVersions && (
                    <div className="admin-card p-3 space-y-2 max-h-80 overflow-y-auto">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase tracking-wider text-[#4A4540] font-medium">
                          版本历史
                        </span>
                        {versionsLoading && <RefreshCw size={10} className="animate-spin text-[#4A4540]" />}
                      </div>

                      {versions.length === 0 && !versionsLoading && (
                        <p className="text-[10px] text-[#4A4540]">暂无历史版本</p>
                      )}

                      {versions.map(v => (
                        <div
                          key={v.id}
                          className={`p-2 rounded border text-[10px] ${
                            v.version === selected.version
                              ? 'border-[#5B8C5A]/40 bg-[#5B8C5A]/5'
                              : 'border-[#2A2622] bg-[#12100E]'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="font-mono font-medium text-[#A09888]">v{v.version}</span>
                            <button
                              onClick={() => setRollbackTarget(v)}
                              className="p-0.5 rounded text-[#4A4540] hover:text-[#B8964A] hover:bg-[#B8964A]/10 transition-colors"
                              title={`回滚至 v${v.version}`}
                            >
                              <RotateCcw size={10} />
                            </button>
                          </div>
                          {v.changeNote && (
                            <p className="text-[#6B6459] truncate">{v.changeNote}</p>
                          )}
                          <p className="text-[#3E3A33] text-[9px] mt-0.5">
                            {new Date(v.createdAt).toLocaleDateString('zh-CN', {
                              month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
                            })}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* ── 空状态 ── */
            <div className="admin-card p-12 text-center">
              <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-[#1A1816] border border-[#2A2622] flex items-center justify-center">
                <FileText size={22} className="text-[#4A4540]" />
              </div>
              <p className="text-[#6B6459] text-sm mb-1">选择左侧模板开始编辑</p>
              <p className="text-[#4A4540] text-xs">
                或点击右上角创建新 Prompt 模板
              </p>
            </div>
          )}
        </div>

      </div>

      {/* ── 回滚确认弹窗 ── */}
      {rollbackTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setRollbackTarget(null)} />
          <div className="relative bg-[#1A1816] border border-[#3A3630] rounded-xl p-6 max-w-sm mx-4 shadow-2xl">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-[#C08040]/10 flex items-center justify-center shrink-0">
                <AlertTriangle size={16} className="text-[#C08040]" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-[#EDE8DF]">
                  确认回滚至 v{rollbackTarget.version}？
                </h4>
                <p className="text-xs text-[#6B6459] mt-1">
                  当前内容将自动存档为新版本，然后被 v{rollbackTarget.version} 的内容覆盖。
                </p>
                {rollbackTarget.changeNote && (
                  <p className="text-[10px] text-[#4A4540] mt-1 font-mono">
                    "{rollbackTarget.changeNote}"
                  </p>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setRollbackTarget(null)}
                className="px-3 py-1.5 text-xs text-[#A09888] hover:text-[#EDE8DF] rounded-md transition-colors"
              >
                取消
              </button>
              <button
                onClick={() => handleRollback(rollbackTarget)}
                className="px-3 py-1.5 text-xs font-medium text-[#EDE8DF] bg-[#C08040] hover:bg-[#A06830] rounded-md transition-colors"
              >
                确认回滚
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
      </TabsContent>

      {/* ── L3 护栏面板 ── */}
      <TabsContent value="guards" className="flex-1 overflow-y-auto">
        <GuardPanel apiHeaders={apiHeaders} />
      </TabsContent>
    </Tabs>
  )
}
