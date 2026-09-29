// ============================================================
// 后台：计费设置（免费模式 + 各功能额度成本）
// 文件：admin/components/BillingPanel.tsx
//
// 解决：此前「排盘/命书/合盘 消耗多少额度」只能靠手改数据库或代码，
//   后台既无入口也无展示；测试期也无法一键全免费。
//
// 数据来自后端权威源（src/server/lib/billing.ts 是唯一解释者）：
//   GET  /api/v1/admin/billing  → { freeMode, costs, effectiveCosts, labels, ... }
//   PUT  /api/v1/admin/billing  → 保存免费开关 + 各功能成本（热生效）
// 请求统一走 admin/lib/api.ts（带全局 401 拦截）。
// ============================================================

import { useState, useEffect, useCallback } from 'react'
import { Coins, Loader2, Save, AlertTriangle, Gift } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { api } from '../lib/api'
import { cn } from '@/lib/utils'

interface BillingPayload {
  freeMode: boolean
  /** 后台配置中的成本（免费模式下仍为真实配置值） */
  costs: Record<string, number>
  /** 当前实际生效的成本（免费模式下全为 0） */
  effectiveCosts: Record<string, number>
  features: string[]
  labels: Record<string, string>
  defaults: Record<string, number>
}

export default function BillingPanel() {
  const [freeMode, setFreeMode] = useState(false)
  const [costs, setCosts] = useState<Record<string, number>>({})
  const [effectiveCosts, setEffectiveCosts] = useState<Record<string, number>>({})
  const [features, setFeatures] = useState<string[]>(['chart', 'report', 'synastry', 'chat'])
  const [labels, setLabels] = useState<Record<string, string>>({})
  const [baseline, setBaseline] = useState('')      // 判断是否有未保存改动
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const res = await api.get<BillingPayload>('/api/v1/admin/billing')
    if (!res.success || !res.data) {
      setError(res.error?.message ?? '加载计费设置失败')
      setLoading(false)
      return
    }
    const d = res.data
    setFreeMode(!!d.freeMode)
    setCosts(d.costs ?? {})
    setEffectiveCosts(d.effectiveCosts ?? {})
    setFeatures(d.features ?? ['chart', 'report', 'synastry', 'chat'])
    setLabels(d.labels ?? {})
    setBaseline(JSON.stringify([!!d.freeMode, d.costs ?? {}]))
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const dirty = baseline !== JSON.stringify([freeMode, costs])

  const setCost = (f: string, v: string) => {
    const n = v === '' ? 0 : Math.max(0, Math.floor(Number(v)))
    setCosts(prev => ({ ...prev, [f]: Number.isFinite(n) ? n : 0 }))
    setStatus('')
  }

  const handleSave = async () => {
    setSaving(true)
    setError('')
    setStatus('')
    const res = await api.put<BillingPayload>('/api/v1/admin/billing', { freeMode, costs })
    setSaving(false)
    if (!res.success) {
      setError(res.error?.message ?? '保存失败')
      return
    }
    if (res.data) {
      setCosts(res.data.costs ?? costs)
      setEffectiveCosts(res.data.effectiveCosts ?? {})
    }
    setStatus(freeMode ? '已保存：全站免费模式已开启，所有功能不扣额度' : '已保存：计费设置已更新')
    await load()
    setTimeout(() => setStatus(''), 3000)
  }

  return (
    <Card className="bg-[#1A1F2E] border-white/[0.06]">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="size-7 flex items-center justify-center rounded-lg bg-[#B8964A]/8 border border-[#B8964A]/15 shrink-0">
              <Coins size={12} className="text-[#B8964A]" />
            </div>
            <div>
              <CardTitle className="text-sm text-[#EDE8DF] tracking-[0.04em]">计费设置</CardTitle>
              <CardDescription className="text-[11px] text-[#6B6459] mt-0.5">
                控制各功能消耗的额度；测试期可一键开启全站免费
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
        {loading && (
          <div className="flex items-center justify-center gap-2 py-8 text-[#6B6459] text-sm">
            <Loader2 size={14} className="animate-spin" />
            正在读取计费配置...
          </div>
        )}

        {!loading && (
          <>
            {/* ── 全站免费模式 ── */}
            <div className={cn(
              'flex items-center justify-between gap-3 rounded-lg border p-4 transition-colors',
              freeMode
                ? 'border-emerald-500/30 bg-emerald-500/[0.06]'
                : 'border-white/[0.06] bg-[#1A2332]/60',
            )}>
              <div className="flex items-start gap-3">
                <Gift size={16} className={cn('mt-0.5 shrink-0', freeMode ? 'text-emerald-400' : 'text-[#6B6459]')} />
                <div>
                  <p className="text-sm text-[#EDE8DF] font-medium">全站免费模式</p>
                  <p className="text-[11px] text-[#6B6459] mt-0.5 leading-relaxed">
                    开启后排盘、命书、合盘、对话均不扣额度（测试期推荐开启）
                  </p>
                </div>
              </div>
              <Switch
                checked={freeMode}
                onCheckedChange={v => { setFreeMode(v); setStatus('') }}
                aria-label="全站免费模式"
              />
            </div>

            {/* ── 各功能额度成本 ── */}
            <div className="space-y-2">
              {features.map(f => (
                <div
                  key={f}
                  className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.06] bg-[#1A2332]/40 px-4 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="text-[13px] text-[#D8D2C8]">{labels[f] ?? f}</p>
                    <p className="text-[10px] text-[#4A4540] font-mono truncate">{f}_quota_cost</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[10px] text-[#4A4540] whitespace-nowrap">
                      当前生效{' '}
                      <span className={cn('font-mono', freeMode ? 'text-emerald-400' : 'text-[#B8964A]')}>
                        {effectiveCosts[f] ?? 0}
                      </span>
                    </span>
                    <div className="flex items-center gap-1.5">
                      <Input
                        type="number"
                        min={0}
                        value={String(costs[f] ?? 0)}
                        onChange={e => setCost(f, e.target.value)}
                        className="h-8 w-20 bg-[#0A1118] border-white/[0.08] text-[#EDE8DF] text-right"
                      />
                      <span className="text-[11px] text-[#6B6459] whitespace-nowrap">额度/次</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <p className="text-[11px] text-[#4A4540] leading-relaxed">
              0 表示免费。免费模式开启时配置值仍会保留，关闭免费后按配置值生效。
              {dirty && <span className="text-[#B8964A]"> · 有未保存的改动</span>}
            </p>
          </>
        )}

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
      </CardContent>
    </Card>
  )
}
