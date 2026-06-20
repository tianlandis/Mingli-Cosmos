// ============================================================
// Phase 4.4 — LLM 供应商管理 & 参数微调台（Split-pane 重设计）
// 文件：admin/modules/llm/LLMPage.tsx
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
  Thermometer,
  SlidersHorizontal,
  Zap,
  Hash,
  FlaskConical,
  Gauge,
  Activity,
  ChevronRight,
  HelpCircle,
  Sparkles,
  Lightbulb,
  BookOpen,
} from 'lucide-react'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
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
  topP?: number | null
  frequencyPenalty?: number | null
  streamEnabled?: number
  isActive: number
  supportedTools: string[]
  testStatus: string
  testLatency?: number | null
  createdAt: string
  updatedAt: string
}

interface LLMPageProps {
  apiHeaders: () => Record<string, string>
}

// ═══════════════════════════════════════
// Provider 类型徽标
// ═══════════════════════════════════════

function ProviderBadge({ type }: { type: string }) {
  const map: Record<string, { label: string; color: string }> = {
    openai: { label: 'OpenAI', color: '#10A37F' },
    deepseek: { label: 'DeepSeek', color: '#4D6BFE' },
    siliconflow: { label: 'SiliconFlow', color: '#8250DF' },
    claude: { label: 'Claude', color: '#D97706' },
    local: { label: '本地部署', color: '#5B8C5A' },
  }
  const info = map[type] ?? { label: type, color: '#6B6459' }
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium"
      style={{ color: info.color, background: `${info.color}15` }}
    >
      {info.label}
    </span>
  )
}

// ═══════════════════════════════════════
// Slider 行
// ═══════════════════════════════════════

function SliderRow({
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
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Icon size={12} className="text-[#6B6459]" />
          <Tooltip>
            <TooltipTrigger asChild>
              <Label className="text-[10px] text-[#A09888] uppercase tracking-wider flex items-center gap-1 cursor-help">
                {label}
                {labelCN && <span className="text-[9px] normal-case text-[#4A4540]">({labelCN})</span>}
                {tooltip && <HelpCircle size={9} className="text-[#4A4540]" />}
              </Label>
            </TooltipTrigger>
            {tooltip && (
              <TooltipContent className="bg-[#1A1F2E] border border-[#3A3630] text-[#D8D2C8] max-w-56">
                <p className="text-[10px]">{tooltip}</p>
              </TooltipContent>
            )}
          </Tooltip>
        </div>
        <div className="flex items-baseline gap-0.5">
          <span className="text-xs font-bold font-mono tabular-nums text-[#EDE8DF]">
            {step < 1 ? value.toFixed(2) : value}
          </span>
          {unit && <span className="text-[9px] text-[#4A4540]">{unit}</span>}
        </div>
      </div>
      <Slider value={value} min={min} max={max} step={step} onValueChange={onChange} />
      {hint && <p className="text-[9px] text-[#4A4540]">{hint}</p>}
    </div>
  )
}

// ═══════════════════════════════════════
// Provider 类型最佳预设（OpenClaw 风格 —— 换供应商自动同步）
// ═══════════════════════════════════════

interface ProviderPreset {
  temp: number
  topP: number
  freqPenalty: number
  maxTokens: number
  desc: string
  systemPromptHint: string
  personality: string
}

const PROVIDER_PRESETS: Record<string, ProviderPreset> = {
  openai: { temp: 0.7, topP: 1.0, freqPenalty: 0, maxTokens: 4096,
    desc: 'GPT 系列推荐：平衡创意与准确性',
    systemPromptHint: 'You are an expert in Chinese metaphysics and BaZi (八字) analysis.',
    personality: '🌐 通才型' },
  deepseek: { temp: 0.3, topP: 0.9, freqPenalty: 0.1, maxTokens: 8192,
    desc: 'DeepSeek 推荐：精确推理 · 逻辑严密',
    systemPromptHint: '你是一位精通八字命理与五行生克制化的玄学大师，分析严谨，引经据典。',
    personality: '🧠 推理型' },
  siliconflow: { temp: 0.5, topP: 0.9, freqPenalty: 0.1, maxTokens: 8192,
    desc: 'Qwen3.5-122B 推荐：阿里通义千问 · 中文推理顶尖',
    systemPromptHint: '你是一位精通八字命理与五行生克制化的玄学大师，分析严谨，引经据典。',
    personality: '🧠 推理型' },
  claude: { temp: 0.7, topP: 1.0, freqPenalty: 0, maxTokens: 4096,
    desc: 'Claude 推荐：自然对话 · 深度思考',
    systemPromptHint: 'You are an erudite BaZi consultant who explains complex metaphysical concepts with clarity and depth.',
    personality: '🎨 人文型' },
  local: { temp: 0.8, topP: 0.95, freqPenalty: 0.2, maxTokens: 2048,
    desc: '本地模型推荐：创意偏向 · 适应泛化',
    systemPromptHint: '你是八字命理助手，请根据输入信息给出专业、清晰的命理分析。',
    personality: '🔧 泛化型' },
  custom: { temp: 0.7, topP: 1.0, freqPenalty: 0, maxTokens: 4096,
    desc: '自定义供应商：默认参数',
    systemPromptHint: '请在 Prompt 模板中配置适用于此供应商的系统指令。',
    personality: '⚙️ 自定义' },
}

function TuningPanel({
  provider,
  onSave,
  saving,
  apiHeaders,
}: {
  provider: Provider
  onSave: () => void
  saving: boolean
  apiHeaders: () => Record<string, string>
}) {
  const [temp, setTemp] = useState(provider.temperature ?? 0.7)
  const [topP, setTopP] = useState(provider.topP ?? 1.0)
  const [freqPenalty, setFreqPenalty] = useState(provider.frequencyPenalty ?? 0)
  const [maxTokens, setMaxTokens] = useState(provider.maxTokens ?? 2048)
  const [stream, setStream] = useState((provider as any).streamEnabled === 1)
  const [dirty, setDirty] = useState(false)
  const [status, setStatus] = useState<'idle' | 'saving' | 'ok' | 'err'>('idle')
  const [syncedPreset, setSyncedPreset] = useState<string | null>(null)

  // ── Provider 切换时自动加载该类型的推荐预设（OpenClaw 自动同步）──
  useEffect(() => {
    const preset = PROVIDER_PRESETS[provider.provider]
    if (preset) {
      setTemp(preset.temp)
      setTopP(preset.topP)
      setFreqPenalty(preset.freqPenalty)
      setMaxTokens(preset.maxTokens)
      setSyncedPreset(provider.provider)
    } else {
      setTemp(provider.temperature ?? 0.7)
      setTopP(provider.topP ?? 1.0)
      setFreqPenalty(provider.frequencyPenalty ?? 0)
      setMaxTokens(provider.maxTokens ?? 2048)
      setSyncedPreset(null)
    }
    setStream((provider as any).streamEnabled === 1)
    setDirty(false)
    setStatus('idle')
  }, [provider.id, provider.provider])

  const handleSave = async () => {
    setStatus('saving')
    try {
      const res = await fetch(`/api/v1/admin/llm/${provider.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...apiHeaders() },
        body: JSON.stringify({
          temperature: temp,
          topP,
          frequencyPenalty: freqPenalty,
          maxTokens,
          streamEnabled: stream ? 1 : 0,
        }),
      })
      const data = await res.json()
      if (data?.success) {
        setStatus('ok')
        setDirty(false)
        onSave()
        setTimeout(() => setStatus('idle'), 1500)
      } else {
        setStatus('err')
      }
    } catch {
      setStatus('err')
    }
  }

  const preset = PROVIDER_PRESETS[provider.provider]
  const autoApplied = syncedPreset && dirty === false

  return (
    <div className="bg-[#1A1F2E] border border-white/[0.06] rounded-xl p-5 space-y-5">
      {/* 标题 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SlidersHorizontal size={16} className="text-[#B8964A]" />
          <h3 className="text-sm font-semibold text-[#EDE8DF] tracking-[0.04em]">AI 调优驾驶舱</h3>
          {autoApplied && (
            <Badge className="text-[7px] bg-[#4D6BFE]/10 text-[#4D6BFE] border-[#4D6BFE]/20 px-1.5 h-4">
              <Sparkles size={7} /> 自动同步
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {dirty && (
            <span className="w-1.5 h-1.5 rounded-full bg-[#C08040] animate-pulse" title="未保存" />
          )}
          <button
            onClick={handleSave}
            disabled={!dirty || status === 'saving'}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              dirty
                ? 'bg-[#B8964A] text-[#0A1118] hover:bg-[#D8C08A] shadow-[0_0_12px_rgba(184,150,74,0.2)]'
                : 'bg-white/[0.04] text-[#4A4540] cursor-not-allowed'
            }`}
          >
            {status === 'saving' ? '保存中...' : status === 'ok' ? '✓ 已保存' : status === 'err' ? '✗ 失败' : '应用参数'}
          </button>
        </div>
      </div>

      {/* Provider 推荐预设卡 */}
      {preset && (
        <div className="bg-[#0A1118] border border-white/[0.04] rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Lightbulb size={11} className="text-[#B8964A]" />
              <span className="text-[9px] text-[#A09888] uppercase tracking-wider">Provider 推荐预设</span>
              <Badge className="text-[7px] bg-white/[0.04] text-[#6B6459] border-white/[0.06] px-1 h-3">{preset.personality}</Badge>
            </div>
            <span className="text-[8px] text-[#4A4540]">切换供应商时自动同步</span>
          </div>
          <p className="text-[10px] text-[#6B6459]">{preset.desc}</p>
          <div className="bg-[#1A1F2E] border border-white/[0.04] rounded-md p-2 flex items-start gap-1.5">
            <BookOpen size={10} className="text-[#4A4540] mt-0.5 shrink-0" />
            <p className="text-[8px] text-[#4A4540] leading-relaxed font-mono break-all">{preset.systemPromptHint}</p>
          </div>
        </div>
      )}

      {/* Temperature */}
      <SliderRow icon={Thermometer} label="Temperature" labelCN="发散度" value={temp} min={0} max={2} step={0.01}
        onChange={v => { setTemp(v); setDirty(true) }}
        tooltip="值越大（如 0.8），AI 回答越发散有创意；值越小（如 0.2），回答越严谨保守。范围 0~2"
        hint={temp < 0.3 ? '极低随机性，适合代码/数学' : temp > 1.5 ? '极高创造力，可能产生幻觉' : '平衡创意与准确性'} />

      {/* Top P */}
      <SliderRow icon={Gauge} label="Top P" labelCN="核采样" value={topP} min={0} max={1} step={0.01}
        onChange={v => { setTopP(v); setDirty(true) }}
        tooltip="核采样阈值（Nucleus Sampling）：只从累计概率达 P 的候选词中采样。值越低，输出越保守聚焦；值设为 1.0 则无约束"
        hint="核采样阈值，越低越保守" />

      {/* Frequency Penalty */}
      <SliderRow icon={Activity} label="Freq Penalty" labelCN="频率惩罚" value={freqPenalty} min={-2} max={2} step={0.01}
        onChange={v => { setFreqPenalty(v); setDirty(true) }}
        tooltip="对已出现词汇施加惩罚，降低重复率。正值减少重复，负值允许更多重复，0 为无惩罚"
        hint={freqPenalty > 0 ? '降低重复率' : freqPenalty < 0 ? '允许重复' : '无惩罚'} />

      {/* Max Tokens */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Hash size={12} className="text-[#6B6459]" />
            <Tooltip>
              <TooltipTrigger asChild>
                <Label className="text-[10px] text-[#A09888] uppercase tracking-wider flex items-center gap-1 cursor-help">
                  Max Tokens <span className="text-[9px] normal-case text-[#4A4540]">(最大回复长度)</span>
                  <HelpCircle size={9} className="text-[#4A4540]" />
                </Label>
              </TooltipTrigger>
              <TooltipContent className="bg-[#1A1F2E] border border-[#3A3630] text-[#D8D2C8] max-w-56">
                <p className="text-[10px]">AI 单次输出最多能生成的 token 数量。约 1 token ≈ 0.7 个汉字。值越大回复越完整但成本越高</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <span className="text-xs font-bold font-mono tabular-nums text-[#EDE8DF]">{maxTokens}</span>
        </div>
        <Slider value={maxTokens} min={256} max={32768} step={256}
          onValueChange={v => { setMaxTokens(v); setDirty(true) }} />
        <p className="text-[9px] text-[#4A4540]">单次输出最大 token 数，影响回复长度与成本</p>
      </div>

      {/* Stream Toggle */}
      <div className="flex items-center justify-between pt-2 border-t border-white/[0.04]">
        <div className="flex items-center gap-2">
          <Zap size={13} className="text-[#6B6459]" />
          <div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Label className="text-[10px] text-[#A09888] uppercase tracking-wider flex items-center gap-1 cursor-help">
                  流式输出 (Stream)
                  <HelpCircle size={9} className="text-[#4A4540]" />
                </Label>
              </TooltipTrigger>
              <TooltipContent className="bg-[#1A1F2E] border border-[#3A3630] text-[#D8D2C8] max-w-56">
                <p className="text-[10px]">开启后，AI 回复通过 SSE（Server-Sent Events）逐 token 推送，用户可实时看到生成过程，体验更流畅</p>
              </TooltipContent>
            </Tooltip>
            <p className="text-[9px] text-[#4A4540]">启用 SSE 逐 token 推送</p>
          </div>
        </div>
        <Switch
          checked={stream}
          onCheckedChange={v => { setStream(v); setDirty(true) }}
        />
      </div>

      {/* 快速预设 */}
      <div className="pt-2 border-t border-white/[0.04]">
        <Label className="text-[10px] text-[#4A4540] uppercase tracking-wider mb-2 block">快速预设</Label>
        <div className="flex flex-wrap gap-1.5">
          {[
            { label: '创意写作', t: 1.2, p: 0.95, f: 0.3 },
            { label: '精确分析', t: 0.1, p: 0.1, f: 0 },
            { label: '对话聊天', t: 0.8, p: 0.9, f: 0.5 },
            { label: '代码生成', t: 0, p: 0.1, f: 0 },
          ].map(preset => (
            <button
              key={preset.label}
              onClick={() => {
                setTemp(preset.t); setTopP(preset.p); setFreqPenalty(preset.f); setDirty(true)
              }}
              className="px-2 py-1 rounded text-[9px] bg-white/[0.04] border border-white/[0.06] text-[#A09888] hover:text-[#EDE8DF] hover:border-white/[0.12] transition-colors"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════
// 主组件
// ═══════════════════════════════════════

export default function LLMPage({ apiHeaders }: LLMPageProps) {
  const [providers, setProviders] = useState<Provider[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [formOpen, setFormOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Provider | null>(null)

  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

  // ═══════════════════════════════
  // 拉取 Provider 列表
  // ═══════════════════════════════
  const fetchProviders = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/admin/llm', { headers: apiHeaders() })
      const data = await res.json()
      if (data?.success) {
        setProviders(data.data)
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
  const handleCreate = useCallback(async (data: ProviderFormData) => {
    const res = await fetch('/api/v1/admin/llm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...apiHeaders() },
      body: JSON.stringify(data),
    })
    const result = await res.json()
    if (!result.success) throw new Error(result?.error?.message ?? '创建失败')
    await fetchProviders()
  }, [apiHeaders, fetchProviders])

  const handleUpdate = useCallback(async (data: ProviderFormData) => {
    if (!editTarget) return
    const res = await fetch(`/api/v1/admin/llm/${editTarget.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...apiHeaders() },
      body: JSON.stringify(data),
    })
    const result = await res.json()
    if (!result.success) throw new Error(result?.error?.message ?? '更新失败')
    setEditTarget(null)
    await fetchProviders()
  }, [editTarget, apiHeaders, fetchProviders])

  const handleDelete = useCallback(async (id: number) => {
    if (!confirm('确认删除此 Provider？此操作不可撤销。')) return
    await fetch(`/api/v1/admin/llm/${id}`, { method: 'DELETE', headers: apiHeaders() })
    if (selectedId === id) setSelectedId(null)
    await fetchProviders()
  }, [apiHeaders, fetchProviders, selectedId])

  const selected = providers.find(p => p.id === selectedId) ?? null

  // ── 加载态 ──
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw size={18} className="animate-spin text-[#B8964A]" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <div className="px-4 py-3 rounded-lg bg-[#C04030]/10 border border-[#C04030]/20 text-[#D06050] text-xs">
          {error}
          <button onClick={fetchProviders} className="ml-3 underline text-[#B8964A] hover:text-[#D8C08A]">重试</button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col gap-3">
      {/* ── 页面标题 ── */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-lg font-semibold text-[#EDE8DF] flex items-center gap-2 tracking-[0.04em]">
            <Cpu size={18} className="text-[#B8964A]" />
            LLM 供应商管理
          </h2>
          <p className="text-xs text-[#6B6459] mt-0.5">
            {providers.length} 个 Provider · 配置参数 & 工具能力
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

      {/* ── 主内容 ── */}
      {providers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 flex-1">
          <div className="size-16 flex items-center justify-center rounded-full bg-[#1A1F2E] border border-white/[0.06] mb-4">
            <Keyboard size={24} className="text-[#4A4540]" />
          </div>
          <p className="text-[#6B6459] text-sm mb-1">尚未配置任何 LLM 供应商</p>
          <p className="text-[#4A4540] text-xs">
            点击右上角"新增 Provider"接入第一个 AI 后端
          </p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex gap-3">
          {/* ═══ 左侧：Provider 列表 ═══ */}
          <div className="w-64 shrink-0 flex flex-col gap-2">
            <div className="flex items-center gap-2 px-1">
              <span className="text-[10px] uppercase tracking-wider text-[#4A4540] font-medium">Provider</span>
              <span className="text-[10px] text-[#A09888]">{providers.length} 个</span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
              {providers.map((p) => {
                const isSelected = p.id === selectedId
                const isOnline = p.isActive === 1
                return (
                  <button
                    key={p.id}
                    onClick={() => setSelectedId(p.id)}
                    className={`w-full text-left p-3 rounded-lg border transition-all duration-150 relative ${
                      isSelected
                        ? 'border-[#B8964A]/60 bg-[#222839] shadow-[0_0_12px_rgba(184,150,74,0.06)]'
                        : 'border-white/[0.04] bg-[#1A1F2E] hover:border-white/[0.10] hover:bg-[#1E2435]'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-1.5">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <h4 className="text-xs font-medium text-[#EDE8DF] truncate">{p.label}</h4>
                          {p.testStatus === 'ok' ? (
                            <CheckCircle2 size={10} className="text-[#5B8C5A] shrink-0" />
                          ) : p.testStatus === 'failed' ? (
                            <XCircle size={10} className="text-[#C04030] shrink-0" />
                          ) : (
                            <Circle size={10} className="text-[#4A4540] shrink-0" />
                          )}
                        </div>
                        <ProviderBadge type={p.provider} />
                      </div>
                      {/* 在线/离线状态指示 */}
                      <span
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium shrink-0 ${
                          isOnline
                            ? 'text-[#5B8C5A] bg-[#5B8C5A]/10 border border-[#5B8C5A]/20'
                            : 'text-[#4A4540] bg-white/[0.03] border border-white/[0.04]'
                        }`}
                      >
                        <span className={`size-1.5 rounded-full ${isOnline ? 'bg-[#5B8C5A] shadow-[0_0_4px_rgba(91,140,90,0.5)]' : 'bg-[#4A4540]'}`} />
                        {isOnline ? '在线' : '离线'}
                      </span>
                    </div>
                    {p.model && (
                      <p className="text-[10px] text-[#6B6459] font-mono truncate mb-1.5">{p.model}</p>
                    )}
                    <div className="flex items-center gap-1.5 text-[9px] text-[#4A4540]">
                      <Wrench size={9} />
                      <span>{p.supportedTools?.length ?? 0} 工具</span>
                      <span className="ml-auto text-[#A09888] font-mono">T={p.temperature?.toFixed(1)}</span>
                    </div>

                    {/* 操作按钮栏 — 始终可见 */}
                    <div className="flex items-center gap-1 mt-2 pt-2 border-t border-white/[0.04]">
                      <button
                        onClick={(e) => { e.stopPropagation(); setEditTarget(p); setFormOpen(true) }}
                        className="flex items-center gap-1 px-2 py-1 rounded text-[9px] text-[#6B6459] hover:text-[#EDE8DF] hover:bg-white/[0.06] transition-colors"
                        title="编辑此供应商"
                      >
                        <Pencil size={9} />
                        编辑
                      </button>
                      <button
                        onClick={async (e) => {
                          e.stopPropagation()
                          // 切换在线/离线
                          const newActive = isOnline ? 0 : 1
                          await fetch(`/api/v1/admin/llm/${p.id}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json', ...apiHeaders() },
                            body: JSON.stringify({ isActive: newActive }),
                          })
                          fetchProviders()
                        }}
                        className={`flex items-center gap-1 px-2 py-1 rounded text-[9px] transition-colors ${
                          isOnline
                            ? 'text-[#A09888] hover:text-[#C08040] hover:bg-[#C08040]/10'
                            : 'text-[#4A4540] hover:text-[#5B8C5A] hover:bg-[#5B8C5A]/10'
                        }`}
                        title={isOnline ? '点击下线' : '点击上线'}
                      >
                        <Circle size={9} className={isOnline ? 'fill-[#5B8C5A] text-[#5B8C5A]' : ''} />
                        {isOnline ? '下线' : '上线'}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(p.id) }}
                        className="flex items-center gap-1 ml-auto px-2 py-1 rounded text-[9px] text-[#4A4540] hover:text-[#D06050] hover:bg-[#C04030]/10 transition-colors"
                        title="删除此供应商"
                      >
                        <Trash2 size={9} />
                        删除
                      </button>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* ═══ 右侧：参数微调 + Skills ═══ */}
          <div className="flex-1 min-w-0 overflow-y-auto space-y-3">
            {selected ? (
              <>
                {/* Provider 信息卡 */}
                <div className="bg-[#1A1F2E] border border-white/[0.06] rounded-xl p-4">
                  <div className="flex items-center gap-3">
                    <div className="size-10 flex items-center justify-center rounded-lg bg-white/[0.04] border border-white/[0.06]">
                      <Cpu size={18} className="text-[#B8964A]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-semibold text-[#EDE8DF]">{selected.label}</h3>
                        <ProviderBadge type={selected.provider} />
                        {selected.isActive === 1 ? (
                          <Badge className="bg-[#5B8C5A]/15 text-[#5B8C5A] border-[#5B8C5A]/25 text-[9px]">
                            <span className="size-1.5 rounded-full bg-[#5B8C5A] shadow-[0_0_4px_rgba(91,140,90,0.5)] mr-1 inline-block" />
                            在线
                          </Badge>
                        ) : (
                          <Badge className="bg-white/[0.03] text-[#4A4540] border-white/[0.05] text-[9px]">
                            <span className="size-1.5 rounded-full bg-[#4A4540] mr-1 inline-block" />
                            离线
                          </Badge>
                        )}
                        {selected.testStatus === 'ok' && (
                          <Badge className="bg-[#5B8C5A]/10 text-[#4A8A4A] border-[#5B8C5A]/15 text-[9px]">
                            <CheckCircle2 size={8} /> 连接正常
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-[10px] text-[#6B6459]">
                        <span className="font-mono">{selected.model || '未指定'}</span>
                        <ChevronRight size={10} />
                        <span className="font-mono text-[#4A4540]">{selected.baseUrl || '默认端点'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 参数微调台 */}
                <TuningPanel
                  provider={selected}
                  onSave={fetchProviders}
                  saving={saving}
                  apiHeaders={apiHeaders}
                />

                {/* Tool Calling 工具面板 */}
                <div className="bg-[#1A1F2E] border border-white/[0.06] rounded-xl overflow-hidden">
                  <div className="px-5 py-3 border-b border-white/[0.04]">
                    <div className="flex items-center gap-2">
                      <Wrench size={14} className="text-[#B8964A]" />
                      <h3 className="text-sm font-semibold text-[#EDE8DF] tracking-[0.04em]">Tool Calling 工具集</h3>
                    </div>
                  </div>
                  <div className="p-5">
                    <SkillsPanel
                      providerId={selectedId}
                      activeTools={selected?.supportedTools ?? []}
                      apiHeaders={apiHeaders}
                      onSaved={fetchProviders}
                    />
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 flex-1">
                <div className="size-14 flex items-center justify-center rounded-full bg-[#1A1F2E] border border-white/[0.06] mb-3">
                  <FlaskConical size={20} className="text-[#4A4540]" />
                </div>
                <p className="text-[#6B6459] text-sm">选择左侧 Provider 进行参数调优</p>
                <p className="text-[#4A4540] text-xs mt-1">支持 Temperature、Top P、Max Tokens 等核心参数实时调整</p>
              </div>
            )}
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
                apiKey: '',
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
