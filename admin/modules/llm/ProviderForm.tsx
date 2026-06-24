// ============================================================
// Phase 4.4 — LLM Provider 表单组件
// 文件：admin/modules/llm/ProviderForm.tsx
// 职责：新增 / 编辑 Provider（API Key、Base URL、模型参数）
// ============================================================

import { useState, useEffect } from 'react'
import { X, Key, Globe, Cpu, Thermometer, Hash, HelpCircle, Sparkles, Download, RotateCw, CheckCircle2, AlertTriangle, ChevronDown } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'

// ═══════════════════════════════════════
// 类型
// ═══════════════════════════════════════

export interface ProviderFormData {
  provider: string
  label: string
  apiKey: string
  baseUrl?: string
  model?: string
  temperature?: number
  maxTokens?: number
}

interface ProviderFormProps {
  open: boolean
  onClose: () => void
  onSave: (data: ProviderFormData) => Promise<void>
  initialData?: ProviderFormData & { id?: number }
  apiHeaders: () => Record<string, string>
}

// ═══════════════════════════════════════
// 全生态厂商预设（OpenClaw 级别 —— 含推荐 Base URL / Model / Temperature / MaxTokens）
// ═══════════════════════════════════════

const PROVIDER_PRESETS: Record<string, { baseUrl?: string; model?: string; temperature?: number; maxTokens?: number }> = {
  openai:     { baseUrl: 'https://api.openai.com/v1',                          model: 'gpt-4o',                     temperature: 0.7, maxTokens: 4096 },
  deepseek:   { baseUrl: 'https://api.deepseek.com/v1',                        model: 'deepseek-chat',              temperature: 0.3, maxTokens: 8192 },
  siliconflow:{ baseUrl: 'https://api.siliconflow.cn/v1',                      model: 'Qwen/Qwen3.5-122B',          temperature: 0.5, maxTokens: 8192 },
  claude:     { baseUrl: 'https://api.anthropic.com/v1',                       model: 'claude-sonnet-4-20250514',   temperature: 0.7, maxTokens: 4096 },
  ollama:     { baseUrl: 'http://127.0.0.1:11434/v1',                          model: 'qwen2.5-coder:14b',          temperature: 0.8, maxTokens: 2048 },
  xai:        { baseUrl: 'https://api.x.ai/v1',                                model: 'grok-3-beta',                temperature: 0.7, maxTokens: 4096 },
  google:     { baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-2.5-flash',    temperature: 0.7, maxTokens: 4096 },
  custom:     {},
}

const PROVIDER_OPTIONS = [
  { value: 'openai',      label: 'OpenAI' },
  { value: 'deepseek',    label: 'DeepSeek（深度求索）' },
  { value: 'siliconflow', label: 'SiliconFlow（硅基流动）' },
  { value: 'claude',      label: 'Anthropic Claude' },
  { value: 'ollama',      label: 'Ollama（本地私有化）' },
  { value: 'xai',         label: 'xAI / Grok' },
  { value: 'google',      label: 'Google AI Pro (Gemini)' },
  { value: 'custom',      label: '自定义（OpenAI 兼容）' },
]

// ═══════════════════════════════════════
// 组件
// ═══════════════════════════════════════

export default function ProviderForm({ open, onClose, onSave, initialData, apiHeaders }: ProviderFormProps) {
  const [form, setForm] = useState<ProviderFormData>({
    provider: initialData?.provider ?? 'siliconflow',
    label: initialData?.label ?? '',
    apiKey: initialData?.apiKey ?? '',
    baseUrl: initialData?.baseUrl ?? '',
    model: initialData?.model ?? '',
    temperature: initialData?.temperature ?? 0.7,
    maxTokens: initialData?.maxTokens ?? 2048,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [autoSynced, setAutoSynced] = useState<boolean>(false)

  // ── 模型列表提取状态 ──
  const [fetchingModels, setFetchingModels] = useState(false)
  const [fetchedModels, setFetchedModels] = useState<string[]>([])
  const [fetchError, setFetchError] = useState('')
  const [modelSelectMode, setModelSelectMode] = useState<'text' | 'select'>('text')

  const isEdit = !!initialData

  // 当 initialData 变化时同步表单
  useEffect(() => {
    if (initialData) {
      setForm({
        provider: initialData.provider,
        label: initialData.label,
        apiKey: initialData.apiKey,
        baseUrl: initialData.baseUrl,
        model: initialData.model,
        temperature: initialData.temperature ?? 0.7,
        maxTokens: initialData.maxTokens ?? 2048,
      })
    }
  }, [initialData])

  function handleProviderChange(value: string) {
    const preset = PROVIDER_PRESETS[value]
    setForm(prev => ({
      ...prev,
      provider: value,
      baseUrl: preset?.baseUrl ?? prev.baseUrl,
      model: preset?.model ?? prev.model,
      temperature: preset?.temperature ?? prev.temperature,
      maxTokens: preset?.maxTokens ?? prev.maxTokens,
    }))
    // 闪动提示：自动同步完成
    setAutoSynced(true)
    setTimeout(() => setAutoSynced(false), 2000)
    // 切换供应商时重置模型提取状态
    setFetchedModels([])
    setFetchError('')
    setModelSelectMode('text')
  }

  // ── 获取模型列表（走后端代理，避免跨域）──
  async function handleFetchModels() {
    const baseUrl = form.baseUrl?.trim()
    const apiKey = form.apiKey?.trim()

    // 基础校验
    if (!baseUrl) {
      setFetchError('请先填写 Base URL')
      return
    }

    // 编辑模式下 apiKey 可能为空（用户保留了原 Key），尝试通过 providerId 走后端查询
    const providerId = (initialData as any)?.id as number | undefined

    if (!apiKey && !providerId) {
      setFetchError('请先填写 API Key（编辑模式下如保留原 Key，系统将自动从数据库读取）')
      return
    }

    setFetchingModels(true)
    setFetchError('')
    setFetchedModels([])

    try {
      // 如果 apiKey 为空但 providerId 存在（编辑模式），走后端按 ID 代理
      const payload: Record<string, any> = { baseUrl }
      if (apiKey) {
        payload.apiKey = apiKey
      } else if (providerId) {
        payload.providerId = providerId
      }

      const res = await fetch('/api/v1/admin/llm/fetch-models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...apiHeaders() },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (data?.success && data.data?.models?.length > 0) {
        setFetchedModels(data.data.models)
        setModelSelectMode('select')
      } else {
        setFetchError(data?.error?.message ?? '未获取到模型列表，请检查 API Key 和 Base URL')
      }
    } catch (err: any) {
      setFetchError(err?.message ?? '网络请求失败')
    } finally {
      setFetchingModels(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!form.label.trim() || !form.apiKey.trim()) {
      setError('Provider 名称和 API Key 为必填项')
      return
    }

    setLoading(true)
    try {
      await onSave(form)
      onClose()
    } catch (err: any) {
      setError(err?.message ?? '保存失败')
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 遮罩 */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* 表单面板 */}
      <div className="relative w-full max-w-lg mx-4 bg-[#1A1816] border border-[#3A3630] rounded-xl shadow-2xl">
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2A2622]">
          <div>
            <h2 className="text-lg font-semibold text-[#EDE8DF]">
              {isEdit ? '编辑' : '新增'} LLM 供应商
            </h2>
            <p className="text-xs text-[#6B6459] mt-0.5">
              {isEdit ? `修改 ${initialData?.label} 的配置` : '接入 API 后端以驱动 AI 排盘'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-[#6B6459] hover:text-[#EDE8DF] hover:bg-[#211F1C] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* 表单体 */}
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {error && (
            <div className="px-3 py-2 rounded-md bg-[#C04030]/10 border border-[#C04030]/30 text-[#D06050] text-xs">
              {error}
            </div>
          )}

          {/* Provider 类型 */}
          <div className="space-y-1.5">
            <Label className="text-[#A09888] text-xs flex items-center gap-1.5">
              <Cpu size={12} />
              供应商类型
            </Label>
            <Select
              value={form.provider}
              onChange={e => handleProviderChange(e.target.value)}
              disabled={isEdit}
            >
              {PROVIDER_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </Select>
            <div className="flex items-center gap-2">
              <p className="text-[9px] text-[#4A4540]">选择 AI 服务商品牌，Base URL、推荐模型、Temperature 和 MaxTokens 将自动填入（与微调台预设一致）</p>
              {autoSynced && (
                <span className="inline-flex items-center gap-1 text-[8px] text-[#4D6BFE] bg-[#4D6BFE]/8 px-1.5 py-0.5 rounded-full border border-[#4D6BFE]/20 animate-pulse">
                  <Sparkles size={8} />
                  已自动填入
                </span>
              )}
            </div>
          </div>

          {/* 显示名 */}
          <div className="space-y-1.5">
            <Label className="text-[#A09888] text-xs flex items-center gap-1.5">
              <Key size={12} />
              显示名称 (Display Name)
            </Label>
            <Input
              value={form.label}
              onChange={e => setForm(p => ({ ...p, label: e.target.value }))}
              placeholder="如：SiliconFlow-DeepSeekV3"
              className="bg-[#12100E] border-[#3A3630] text-[#EDE8DF] placeholder:text-[#4A4540]"
            />
            <p className="text-[9px] text-[#4A4540]">在后台列表中展示的名称，方便区分不同供应商</p>
          </div>

          {/* API Key */}
          <div className="space-y-1.5">
            <Label className="text-[#A09888] text-xs flex items-center gap-1.5">
              <Key size={12} />
              API Key（接口密钥）
            </Label>
            <Input
              type="password"
              value={form.apiKey}
              onChange={e => setForm(p => ({ ...p, apiKey: e.target.value }))}
              placeholder={isEdit ? '留空则保留原 Key' : 'sk-...'}
              className="bg-[#12100E] border-[#3A3630] text-[#EDE8DF] placeholder:text-[#4A4540]"
            />
            <p className="text-[9px] text-[#4A4540]">
              {isEdit ? '留空则保留当前密钥不修改；填入新值将覆盖原密钥' : '从 AI 服务商控制台获取的鉴权密钥，用于验证 API 调用身份'}
            </p>
          </div>

          {/* Base URL */}
          <div className="space-y-1.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <Label className="text-[#A09888] text-xs flex items-center gap-1.5 cursor-help">
                  <Globe size={12} />
                  Base URL（接口地址）
                  <HelpCircle size={10} className="text-[#4A4540]" />
                </Label>
              </TooltipTrigger>
              <TooltipContent className="bg-[#1A1F2E] border border-[#3A3630] text-[#D8D2C8] max-w-56">
                <p className="text-[10px]">AI 服务商的 API 端点地址（Endpoint）；支持 OpenAI 兼容接口以及本地 Ollama/vLLM 部署地址</p>
              </TooltipContent>
            </Tooltip>
            <Input
              value={form.baseUrl ?? ''}
              onChange={e => setForm(p => ({ ...p, baseUrl: e.target.value || undefined }))}
              placeholder="http://localhost:11434/v1"
              className="bg-[#12100E] border-[#3A3630] text-[#EDE8DF] placeholder:text-[#4A4540] font-mono text-xs"
            />
            <p className="text-[9px] text-[#4A4540]">AI 服务商的 API 端点地址。切换供应商时自动填入推荐值，也可手动覆盖</p>
          </div>

          {/* 模型名 — 双态切换：文本输入 / 下拉选择 */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-[#A09888] text-xs flex items-center gap-1.5">
                <Cpu size={12} />
                默认模型 (Default Model)
              </Label>
              {modelSelectMode === 'select' && fetchedModels.length > 0 && (
                <button
                  type="button"
                  onClick={() => setModelSelectMode('text')}
                  className="text-[9px] text-[#4D6BFE] hover:text-[#6B8AFF] transition-colors"
                >
                  切回手动输入
                </button>
              )}
            </div>

            {/* 获取模型按钮 + 状态 */}
            <div className="flex items-center gap-2 mb-2">
              <button
                type="button"
                onClick={handleFetchModels}
                disabled={fetchingModels}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all ${
                  fetchingModels
                    ? 'bg-[#3A3630] text-[#6B6459] cursor-wait'
                    : fetchedModels.length > 0
                      ? 'bg-[#5B8C5A]/10 text-[#5B8C5A] border border-[#5B8C5A]/25 hover:bg-[#5B8C5A]/20'
                      : 'bg-[#4D6BFE]/10 text-[#4D6BFE] border border-[#4D6BFE]/25 hover:bg-[#4D6BFE]/20'
                }`}
              >
                {fetchingModels ? (
                  <RotateCw size={12} className="animate-spin" />
                ) : fetchedModels.length > 0 ? (
                  <CheckCircle2 size={12} />
                ) : (
                  <Download size={12} />
                )}
                {fetchingModels
                  ? '正在获取...'
                  : fetchedModels.length > 0
                    ? `已获取 ${fetchedModels.length} 个模型`
                    : '获取模型列表'}
              </button>
              {modelSelectMode === 'select' && fetchedModels.length > 0 && (
                <span className="text-[9px] text-[#5B8C5A] bg-[#5B8C5A]/8 px-1.5 py-0.5 rounded border border-[#5B8C5A]/15">
                  下拉选择
                </span>
              )}
            </div>

            {/* 模型输入 / 选择 */}
            {modelSelectMode === 'select' && fetchedModels.length > 0 ? (
              <Select
                value={form.model ?? ''}
                onChange={e => setForm(p => ({ ...p, model: e.target.value }))}
              >
                <option value="">-- 请选择模型 --</option>
                {fetchedModels.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </Select>
            ) : (
              <Input
                value={form.model ?? ''}
                onChange={e => setForm(p => ({ ...p, model: e.target.value || undefined }))}
                placeholder="qwen2.5-coder:14b"
                className="bg-[#12100E] border-[#3A3630] text-[#EDE8DF] placeholder:text-[#4A4540] font-mono text-xs"
              />
            )}

            {/* 获取失败提示 */}
            {fetchError && (
              <div className="flex items-start gap-1.5 mt-1 px-2 py-1.5 rounded bg-[#C04030]/8 border border-[#C04030]/20 text-[#D06050] text-[9px]">
                <AlertTriangle size={10} className="shrink-0 mt-0.5" />
                <span>{fetchError}</span>
              </div>
            )}

            <p className="text-[9px] text-[#4A4540]">
              点击「获取模型列表」将通过后端代理请求厂商 /v1/models 接口，无需担心跨域；获取成功后自动切换为下拉选择
            </p>
          </div>

          {/* Temperature + MaxTokens 并排 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Label className="text-[#A09888] text-xs flex items-center gap-1.5 cursor-help">
                    <Thermometer size={12} />
                    Temperature（发散度）
                    <HelpCircle size={10} className="text-[#4A4540]" />
                  </Label>
                </TooltipTrigger>
                <TooltipContent className="bg-[#1A1F2E] border border-[#3A3630] text-[#D8D2C8] max-w-56">
                  <p className="text-[10px]">值越大（如 0.8），AI 回答越发散有创意；值越小（如 0.2），回答越严谨保守。范围 0~2</p>
                </TooltipContent>
              </Tooltip>
              <Input
                type="number"
                step="0.1"
                min="0"
                max="2"
                value={form.temperature ?? 0.7}
                onChange={e => setForm(p => ({ ...p, temperature: parseFloat(e.target.value) || 0.7 }))}
                className="bg-[#12100E] border-[#3A3630] text-[#EDE8DF]"
              />
              <p className="text-[9px] text-[#4A4540]">切换供应商时自动填入推荐值。0~0.3 严谨保守，0.7~1.0 均衡，1.0~2.0 创意发散</p>
            </div>
            <div className="space-y-1.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Label className="text-[#A09888] text-xs flex items-center gap-1.5 cursor-help">
                    <Hash size={12} />
                    Max Tokens（最大回复长度）
                    <HelpCircle size={10} className="text-[#4A4540]" />
                  </Label>
                </TooltipTrigger>
                <TooltipContent className="bg-[#1A1F2E] border border-[#3A3630] text-[#D8D2C8] max-w-56">
                  <p className="text-[10px]">AI 单次输出最多能生成的 token 数量（约 1 token ≈ 0.7 个汉字）。值越大回复越完整但成本越高</p>
                </TooltipContent>
              </Tooltip>
              <Input
                type="number"
                step="256"
                min="256"
                value={form.maxTokens ?? 2048}
                onChange={e => setForm(p => ({ ...p, maxTokens: parseInt(e.target.value) || 2048 }))}
                className="bg-[#12100E] border-[#3A3630] text-[#EDE8DF]"
              />
              <p className="text-[9px] text-[#4A4540]">单次回复最大 token 数。256~4096 适合对话，8192+ 适合长文分析</p>
            </div>
          </div>

          {/* 按钮 */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-[#A09888] hover:text-[#EDE8DF] hover:bg-[#211F1C] rounded-md transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 text-sm font-medium text-[#EDE8DF] bg-[#C04030] hover:bg-[#A03024] rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '保存中...' : isEdit ? '更新 Provider' : '创建 Provider'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
