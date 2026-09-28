// ============================================================
// Phase 4a-R3 — Prompt 调试沙盒（独立组件）
// 文件：admin/modules/prompts/DebugPanel.tsx
//
// 两种调试来源：
//   ① 编辑器内容 — 当前 CodeMirror 里的模板文本（快速试写）
//   ② 运行时真实 Prompt — 后端用样例命例渲染的真实 System Prompt
//      （含命盘数据 + L3 动态护栏 + 管理员自定义指令），用于闭环复验
//
// 闭环路径：沙盒调试 → 保存模板 → 切到「运行时真实 Prompt」再验一次
// ============================================================

import { useState, useEffect, useCallback } from 'react'
import {
  Bot,
  Send,
  Loader2,
  XCircle,
  Thermometer,
  Gauge,
  Hash,
  RefreshCw,
  Layers,
  Zap,
  Eye,
  ChevronDown,
  ChevronUp,
  HelpCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { api } from '../../lib/api'

interface SampleMeta {
  id: string
  label: string
  description: string
}

type DebugSource = 'editor' | 'runtime'

export default function DebugPanel({
  editorContent,
  temperature,
  topP,
  maxTokens,
}: {
  editorContent: string
  temperature: number
  topP: number
  maxTokens: number
}) {
  const [source, setSource] = useState<DebugSource>('editor')
  const [samples, setSamples] = useState<SampleMeta[]>([])
  const [sampleId, setSampleId] = useState('')
  const [runtimePrompt, setRuntimePrompt] = useState('')
  const [rendering, setRendering] = useState(false)
  const [renderError, setRenderError] = useState('')

  const [input, setInput] = useState('')
  const [response, setResponse] = useState('')
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')
  const [history, setHistory] = useState<{ role: string; content: string; source: DebugSource }[]>([])
  const [showPrompt, setShowPrompt] = useState(false)

  // ── 加载调试样例 ──
  useEffect(() => {
    ;(async () => {
      const res = await api.get<SampleMeta[]>('/api/v1/admin/prompts/samples')
      if (res.success && Array.isArray(res.data) && res.data.length > 0) {
        setSamples(res.data)
        setSampleId(res.data[0].id)
      }
    })()
  }, [])

  // ── 渲染运行时真实 Prompt ──
  const renderRuntime = useCallback(async (id: string) => {
    if (!id) return
    setRendering(true)
    setRenderError('')
    const res = await api.post<{ systemPrompt: string; label: string; length: number }>(
      '/api/v1/admin/prompts/render',
      { sampleId: id },
    )
    if (res.success && res.data) {
      setRuntimePrompt(res.data.systemPrompt)
    } else {
      setRenderError(res.error?.message ?? '渲染失败')
      setRuntimePrompt('')
    }
    setRendering(false)
  }, [])

  // ── 切到运行时模式时自动渲染一次 ──
  useEffect(() => {
    if (source === 'runtime' && sampleId && !runtimePrompt && !rendering) {
      renderRuntime(sampleId)
    }
  }, [source, sampleId, runtimePrompt, rendering, renderRuntime])

  const activePrompt = source === 'editor' ? editorContent : runtimePrompt
  const canDebug = Boolean(activePrompt.trim()) && Boolean(input.trim()) && !running

  const handleDebug = async () => {
    if (!canDebug) return
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
        prompt: activePrompt,
        userInput: input,
        temperature,
        topP,
        maxTokens,
      })

      if (res.success && res.data) {
        const out = res.data.output ?? '(空响应)'
        setResponse(out)
        setHistory(prev => [
          ...prev,
          { role: 'user', content: input, source },
          { role: 'assistant', content: out, source },
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
        <TooltipProvider delayDuration={400}>
          <Tooltip>
            <TooltipTrigger asChild>
              <HelpCircle size={11} className="text-[#6B6459] cursor-help" />
            </TooltipTrigger>
            <TooltipContent className="max-w-72">
              <p className="text-xs leading-relaxed">
                沙盒仅用于验证效果，<strong>不会写入数据库</strong>。
                保存模板后请切到「运行时真实 Prompt」再验一次，确认改动已进入真实对话链路。
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <span className="text-[10px] text-[#6B6459] ml-auto font-mono">Debug</span>
      </div>

      {/* ── 来源切换 ── */}
      <div className="px-5 py-3 border-b border-white/[0.04] shrink-0 space-y-3">
        <div className="flex items-center gap-1 p-0.5 rounded-lg bg-[#0A1118] border border-white/[0.06]">
          {([
            { key: 'editor' as const, icon: Layers, label: '编辑器内容' },
            { key: 'runtime' as const, icon: Zap, label: '运行时真实 Prompt' },
          ]).map(tab => (
            <button
              key={tab.key}
              onClick={() => setSource(tab.key)}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-[11px] transition-colors',
                source === tab.key
                  ? 'bg-[#B8964A]/15 text-[#B8964A]'
                  : 'text-[#6B6459] hover:text-[#A09888]',
              )}
            >
              <tab.icon size={11} />
              {tab.label}
            </button>
          ))}
        </div>

        {source === 'runtime' && (
          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-1">
              <Label className="text-[10px] text-[#6B6459] uppercase tracking-wider">调试命例</Label>
              <select
                value={sampleId}
                onChange={e => { setSampleId(e.target.value); setRuntimePrompt('') }}
                className="w-full h-8 px-2 rounded-md bg-[#0A1118] border border-white/[0.08] text-xs text-[#D8D2C8] focus:outline-none focus:border-[#B8964A]/50"
              >
                {samples.map(s => (
                  <option key={s.id} value={s.id}>{s.label} — {s.description}</option>
                ))}
              </select>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => renderRuntime(sampleId)}
              disabled={rendering || !sampleId}
              className="gap-1.5 text-xs"
            >
              {rendering ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
              渲染
            </Button>
          </div>
        )}

        {/* ── Prompt 预览 ── */}
        <div className="space-y-1.5">
          <button
            onClick={() => setShowPrompt(v => !v)}
            className="flex items-center gap-1.5 text-[10px] text-[#6B6459] uppercase tracking-wider hover:text-[#A09888] transition-colors"
          >
            <Eye size={10} />
            当前送入 LLM 的 Prompt
            {showPrompt ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
          </button>
          {showPrompt ? (
            <pre className="text-[11px] text-[#A09888] font-mono leading-relaxed bg-[#0A1118] rounded-md p-2.5 border border-white/[0.04] max-h-40 overflow-auto whitespace-pre-wrap">
              {activePrompt || '(空)'}
            </pre>
          ) : (
            <blockquote className="text-[11px] text-[#6B6459] font-mono leading-relaxed line-clamp-2 bg-[#0A1118] rounded-md p-2 border border-white/[0.04]">
              {activePrompt || '未选择模板'}
            </blockquote>
          )}
          {source === 'runtime' && renderError && (
            <p className="text-[11px] text-[#C04030]">{renderError}</p>
          )}
        </div>

        <div className="flex items-center gap-3 text-[11px] text-[#6B6459] font-mono">
          <span className="inline-flex items-center gap-1"><Thermometer size={10} /> T={temperature.toFixed(2)}</span>
          <span className="inline-flex items-center gap-1"><Gauge size={10} /> P={topP.toFixed(2)}</span>
          <span className="inline-flex items-center gap-1"><Hash size={10} /> Max={maxTokens}</span>
          <span className="ml-auto">{activePrompt.length} 字</span>
        </div>
      </div>

      {/* ── 对话历史 ── */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="px-5 py-4 space-y-3">
          {history.length === 0 && (
            <div className="flex flex-col items-center justify-center py-14 gap-3">
              <Bot size={22} className="text-[#6B6459]" />
              <p className="text-xs text-[#6B6459] text-center max-w-52">
                {activePrompt ? '输入测试消息开始调试' : '请先选择模板或渲染运行时 Prompt'}
              </p>
            </div>
          )}
          {history.map((msg, i) => (
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
                {msg.role === 'user' && (
                  <span className="text-[10px] text-[#6B6459]">
                    {msg.source === 'runtime' ? '运行时 Prompt' : '编辑器内容'}
                  </span>
                )}
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
          {response && history.length === 0 && (
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
          <Button size="icon" onClick={handleDebug} disabled={!canDebug} className="shrink-0 self-end">
            {running ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          </Button>
        </div>
        <p className="text-[10px] text-[#6B6459] mt-2 text-right">Ctrl+Enter 发送</p>
      </div>
    </div>
  )
}
