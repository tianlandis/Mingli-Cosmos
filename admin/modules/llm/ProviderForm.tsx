// ============================================================
// Phase 4.4 — LLM Provider 表单组件
// 文件：admin/modules/llm/ProviderForm.tsx
// 职责：新增 / 编辑 Provider（API Key、Base URL、模型参数）
// ============================================================

import { useState, useEffect } from 'react'
import { X, Key, Globe, Cpu, Thermometer, Hash } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'

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
}

// ═══════════════════════════════════════
// 预设 Provider
// ═══════════════════════════════════════

const PROVIDER_PRESETS: Record<string, { baseUrl?: string; model?: string }> = {
  openai: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o' },
  deepseek: { baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
  siliconflow: { baseUrl: 'https://api.siliconflow.cn/v1', model: 'deepseek-ai/DeepSeek-V3' },
  claude: { baseUrl: 'https://api.anthropic.com/v1', model: 'claude-sonnet-4-20250514' },
  local: { baseUrl: 'http://localhost:11434/v1', model: 'qwen2.5-coder:7b' },
  custom: {},
}

const PROVIDER_OPTIONS = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'deepseek', label: 'DeepSeek' },
  { value: 'siliconflow', label: 'SiliconFlow' },
  { value: 'claude', label: 'Anthropic Claude' },
  { value: 'local', label: '本地部署 (Ollama/vLLM)' },
  { value: 'custom', label: '自定义' },
]

// ═══════════════════════════════════════
// 组件
// ═══════════════════════════════════════

export default function ProviderForm({ open, onClose, onSave, initialData }: ProviderFormProps) {
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
    }))
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
          </div>

          {/* 显示名 */}
          <div className="space-y-1.5">
            <Label className="text-[#A09888] text-xs flex items-center gap-1.5">
              <Key size={12} />
              显示名称
            </Label>
            <Input
              value={form.label}
              onChange={e => setForm(p => ({ ...p, label: e.target.value }))}
              placeholder="如：SiliconFlow-DeepSeekV3"
              className="bg-[#12100E] border-[#3A3630] text-[#EDE8DF] placeholder:text-[#4A4540]"
            />
          </div>

          {/* API Key */}
          <div className="space-y-1.5">
            <Label className="text-[#A09888] text-xs flex items-center gap-1.5">
              <Key size={12} />
              API Key
            </Label>
            <Input
              type="password"
              value={form.apiKey}
              onChange={e => setForm(p => ({ ...p, apiKey: e.target.value }))}
              placeholder={isEdit ? '留空则保留原 Key' : 'sk-...'}
              className="bg-[#12100E] border-[#3A3630] text-[#EDE8DF] placeholder:text-[#4A4540]"
            />
          </div>

          {/* Base URL */}
          <div className="space-y-1.5">
            <Label className="text-[#A09888] text-xs flex items-center gap-1.5">
              <Globe size={12} />
              Base URL
            </Label>
            <Input
              value={form.baseUrl ?? ''}
              onChange={e => setForm(p => ({ ...p, baseUrl: e.target.value || undefined }))}
              placeholder="http://localhost:11434/v1"
              className="bg-[#12100E] border-[#3A3630] text-[#EDE8DF] placeholder:text-[#4A4540] font-mono text-xs"
            />
          </div>

          {/* 模型名 */}
          <div className="space-y-1.5">
            <Label className="text-[#A09888] text-xs flex items-center gap-1.5">
              <Cpu size={12} />
              默认模型
            </Label>
            <Input
              value={form.model ?? ''}
              onChange={e => setForm(p => ({ ...p, model: e.target.value || undefined }))}
              placeholder="qwen2.5-coder:14b"
              className="bg-[#12100E] border-[#3A3630] text-[#EDE8DF] placeholder:text-[#4A4540] font-mono text-xs"
            />
          </div>

          {/* Temperature + MaxTokens 并排 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[#A09888] text-xs flex items-center gap-1.5">
                <Thermometer size={12} />
                Temperature
              </Label>
              <Input
                type="number"
                step="0.1"
                min="0"
                max="2"
                value={form.temperature ?? 0.7}
                onChange={e => setForm(p => ({ ...p, temperature: parseFloat(e.target.value) || 0.7 }))}
                className="bg-[#12100E] border-[#3A3630] text-[#EDE8DF]"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[#A09888] text-xs flex items-center gap-1.5">
                <Hash size={12} />
                Max Tokens
              </Label>
              <Input
                type="number"
                step="256"
                min="256"
                value={form.maxTokens ?? 2048}
                onChange={e => setForm(p => ({ ...p, maxTokens: parseInt(e.target.value) || 2048 }))}
                className="bg-[#12100E] border-[#3A3630] text-[#EDE8DF]"
              />
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
