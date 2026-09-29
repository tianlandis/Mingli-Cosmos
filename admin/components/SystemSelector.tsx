// ============================================================
// [ADR-011] 体系（应用）选择器
// 文件：admin/components/SystemSelector.tsx
//
// 解决：后台此前**没有任何可供管理员选定应用/体系的入口** ——
//   引擎注册表早已注册 bazi / astro / mbti，C 端也有 SystemSwitcher，
//   唯独后台既无 API 也无 UI 能感知体系概念。
//
// 数据全部来自后端权威源：
//   GET  /api/v1/admin/systems  → 注册清单 + 当前选择（中文名由服务端 meta 下发）
//   PUT  /api/v1/admin/systems  → 保存「默认体系 + 启用清单」
// 请求统一走 admin/lib/api.ts（带全局 401 拦截），不使用裸 fetch。
// ============================================================

import { useState, useEffect, useCallback } from 'react'
import { Layers, Check, Loader2, Save, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { api } from '../lib/api'
import { cn } from '@/lib/utils'

interface SystemItem {
  id: string
  label: string
  desc: string
  version: string
  enabled: boolean
  isDefault: boolean
}

interface SystemsPayload {
  systems: SystemItem[]
  defaultSystem: string
  enabledSystems: string[]
}

export default function SystemSelector() {
  const [systems, setSystems] = useState<SystemItem[]>([])
  const [defaultSystem, setDefaultSystem] = useState<string>('')
  const [enabled, setEnabled] = useState<string[]>([])
  const [baseline, setBaseline] = useState<string>('')   // 用于判断是否有未保存改动
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const res = await api.get<SystemsPayload>('/api/v1/admin/systems')
    if (!res.success || !res.data) {
      setError(res.error?.message ?? '加载体系清单失败')
      setLoading(false)
      return
    }
    const d = res.data
    setSystems(d.systems ?? [])
    setDefaultSystem(d.defaultSystem ?? '')
    setEnabled(d.enabledSystems ?? [])
    setBaseline(JSON.stringify([d.defaultSystem, d.enabledSystems]))
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const dirty = baseline !== JSON.stringify([defaultSystem, enabled])

  /** 选为默认应用：顺带确保它被启用（后端也会校验默认必须在启用清单内） */
  const selectDefault = (id: string) => {
    setDefaultSystem(id)
    setEnabled(prev => (prev.includes(id) ? prev : [...prev, id]))
    setStatus('')
  }

  /** 启停：不允许停用当前默认体系（会导致无可用默认应用） */
  const toggleEnabled = (id: string) => {
    if (id === defaultSystem) {
      setError('不能停用当前默认应用，请先切换默认到其他体系')
      return
    }
    setError('')
    setEnabled(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]))
    setStatus('')
  }

  const handleSave = async () => {
    setSaving(true)
    setError('')
    setStatus('')
    const res = await api.put<{ defaultSystem: string; enabledSystems: string[] }>(
      '/api/v1/admin/systems',
      { defaultSystem, enabledSystems: enabled },
    )
    setSaving(false)
    if (!res.success) {
      setError(res.error?.message ?? '保存失败')
      return
    }
    setStatus(`已保存：默认应用 = ${systems.find(s => s.id === defaultSystem)?.label ?? defaultSystem}`)
    await load()
    setTimeout(() => setStatus(''), 2500)
  }

  return (
    <Card className="bg-[#1A1F2E] border-white/[0.06]">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="size-7 flex items-center justify-center rounded-lg bg-[#B8964A]/8 border border-[#B8964A]/15 shrink-0">
              <Layers size={12} className="text-[#B8964A]" />
            </div>
            <div>
              <CardTitle className="text-sm text-[#EDE8DF] tracking-[0.04em]">默认应用（体系）</CardTitle>
              <CardDescription className="text-[11px] text-[#6B6459] mt-0.5">
                选择 C 端默认使用的命理体系，并控制各体系是否对 C 端开放
              </CardDescription>
            </div>
          </div>
          <Button
            onClick={handleSave}
            disabled={saving || loading || !dirty}
            className={cn(
              'px-4 py-2 text-sm font-medium rounded-lg border transition-colors',
              dirty
                ? 'bg-[#C04030] hover:bg-[#A03024] text-[#EDE8DF] border-transparent'
                : 'bg-transparent text-[#4A4540] border-white/[0.06] cursor-not-allowed',
            )}
          >
            {saving
              ? <Loader2 size={13} className="mr-1.5 animate-spin" />
              : <Save size={13} className="mr-1.5" />}
            {dirty ? '保存设置' : '已是最新'}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="pb-4 space-y-3">
        {/* 加载态 */}
        {loading && (
          <div className="flex items-center justify-center gap-2 py-8 text-[#6B6459] text-sm">
            <Loader2 size={14} className="animate-spin" />
            正在读取后端体系注册表...
          </div>
        )}

        {/* 空态 */}
        {!loading && systems.length === 0 && (
          <div className="py-8 text-center text-sm text-[#4A4540]">
            后端未注册任何体系（registry 为空）
          </div>
        )}

        {/* 体系卡片 */}
        {!loading && systems.length > 0 && (
          <div className="grid gap-3 md:grid-cols-3">
            {systems.map(s => {
              const isDefault = s.id === defaultSystem
              const isEnabled = enabled.includes(s.id)
              return (
                <div
                  key={s.id}
                  className={cn(
                    'relative rounded-lg border p-4 transition-colors',
                    isDefault
                      ? 'border-[#B8964A]/45 bg-[#B8964A]/[0.07]'
                      : 'border-white/[0.06] bg-[#1A2332]/60',
                    !isEnabled && 'opacity-55',
                  )}
                >
                  {/* 选中角标 */}
                  {isDefault && (
                    <span className="absolute top-2.5 right-2.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#B8964A]/15 border border-[#B8964A]/25">
                      <Check size={10} className="text-[#B8964A]" />
                      <span className="text-[10px] text-[#B8964A] font-medium">默认</span>
                    </span>
                  )}

                  <div className="flex items-baseline gap-2 pr-14">
                    <h4 className="text-base font-semibold text-[#EDE8DF] tracking-[0.04em]">{s.label}</h4>
                    <code className="text-[11px] text-[#6B6459] font-mono">{s.id}</code>
                  </div>
                  <p className="text-[12px] text-[#6B6459] leading-relaxed mt-1.5 min-h-[32px]">{s.desc}</p>
                  <p className="text-[11px] text-[#4A4540] font-mono mt-1">引擎版本 {s.version}</p>

                  <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-white/[0.06]">
                    <Button
                      onClick={() => selectDefault(s.id)}
                      disabled={isDefault}
                      className={cn(
                        'px-3 py-1.5 text-[12px] rounded-md border transition-colors',
                        isDefault
                          ? 'bg-[#B8964A]/10 text-[#B8964A] border-[#B8964A]/20 cursor-default'
                          : 'bg-transparent text-[#A09888] border-white/[0.08] hover:text-[#EDE8DF] hover:border-white/20',
                      )}
                    >
                      {isDefault ? '当前默认' : '选为默认'}
                    </Button>

                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <span className="text-[12px] text-[#6B6459]">{isEnabled ? '已启用' : '已停用'}</span>
                      <Switch
                        checked={isEnabled}
                        onCheckedChange={() => toggleEnabled(s.id)}
                        disabled={isDefault}
                        aria-label={`启用或停用体系 ${s.label}`}
                      />
                    </label>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* 错误态 / 成功态 */}
        {error && (
          <div className="flex items-start gap-2 px-3 py-2 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {status && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">
            <span className="size-1.5 rounded-full bg-emerald-400" />
            {status}
          </div>
        )}

        {!loading && (
          <p className="text-[11px] text-[#4A4540] leading-relaxed">
            说明：清单来自后端引擎注册表（新增体系 = 注册一行），中文名由服务端下发，此处不维护副本。
            停用后 C 端不可见；默认应用不可停用，需先切换默认。
            {dirty && <span className="text-[#B8964A]"> · 有未保存的改动</span>}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
