// ============================================================
// Phase 7 — 命理规则字典：知识资产超市
// 文件：admin/modules/knowledge-dict/KnowledgeDictPage.tsx
// 职责：分类侧边栏 + 数据录入表格的通用 CRUD 管理窗口
// ============================================================

import { useState, useEffect, useCallback } from 'react'
import {
  Library,
  Plus,
  Trash2,
  Pencil,
  Save,
  X,
  RefreshCw,
  BookOpen,
  Shield,
  Brain,
  Database,
  Network,
  Search,
  ChevronRight,
  Info,
  CheckCircle2,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { Switch } from '@/components/ui/switch'
import { Select } from '@/components/ui/select'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { api } from '../../lib/api'

// ═══════════════════════════════════════
// 类型
// ═══════════════════════════════════════

interface KnowledgeAsset {
  id: number
  category: string
  key: string
  value: string
  description: string | null
  sortOrder: number
  version: number
  isActive: number
  createdAt: string
  updatedAt: string
}

interface CategoryDef {
  name: string
  label: string
  icon: React.ElementType
  color: string
  desc: string
}

const CATEGORIES: CategoryDef[] = [
  { name: 'classics', label: '古籍经典', icon: BookOpen, color: '#C06050', desc: '渊海子平、三命通会、滴天髓等经典条目' },
  { name: 'shensha', label: '神煞规则', icon: Shield, color: '#C04030', desc: '天乙贵人、文昌、驿马等 40+ 神煞判定条件' },
  { name: 'personality', label: '16 人格映射', icon: Brain, color: '#4D6BFE', desc: 'MBTI 16 型人格与八字日主/五行/十神映射' },
  { name: 'bazi', label: '八字基础', icon: Database, color: '#B8964A', desc: '天干地支、五行生克、十神关系等基础数据' },
  { name: 'pattern', label: '格局判定', icon: Network, color: '#5B8C5A', desc: '月令取格法、会合取格法、特殊格局条件' },
]

const CAT_LABELS: Record<string, string> = Object.fromEntries(CATEGORIES.map(c => [c.name, c.label]))

// ═══════════════════════════════════════
// 主组件
// ═══════════════════════════════════════

export default function KnowledgeDictPage() {
  const [assets, setAssets] = useState<KnowledgeAsset[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeCat, setActiveCat] = useState<string>('classics')

  // ── 新增/编辑状态 ──
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState({
    category: 'classics' as string,
    key: '',
    value: '',
    description: '',
    sortOrder: 0,
  })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  // ═══════════════════════════════
  // 拉取数据
  // ═══════════════════════════════
  const fetchAssets = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get<KnowledgeAsset[]>(`/api/v1/admin/knowledge`)
      if (res.success && res.data) {
        setAssets(res.data)
      } else {
        setError(res.error?.message || '加载失败')
      }
    } catch {
      setError('网络连接失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAssets() }, [fetchAssets])

  // 过滤当前分类
  const filtered = assets.filter(a => a.category === activeCat)
  const catInfo = CATEGORIES.find(c => c.name === activeCat)!

  // ═══════════════════════════════
  // 打开新增表单
  // ═══════════════════════════════
  function openCreate() {
    setEditingId(null)
    setForm({ category: activeCat, key: '', value: '', description: '', sortOrder: 0 })
    setFormError('')
    setFormOpen(true)
  }

  function openEdit(asset: KnowledgeAsset) {
    setEditingId(asset.id)
    setForm({
      category: asset.category,
      key: asset.key,
      value: asset.value,
      description: asset.description ?? '',
      sortOrder: asset.sortOrder ?? 0,
    })
    setFormError('')
    setFormOpen(true)
  }

  // ═══════════════════════════════
  // 保存
  // ═══════════════════════════════
  async function handleSave() {
    if (!form.key.trim() || !form.value.trim()) {
      setFormError('Key 和 Value 为必填项')
      return
    }
    setSaving(true)
    setFormError('')

    try {
      if (editingId !== null) {
        const res = await api.put(`/api/v1/admin/knowledge/${editingId}`, {
          key: form.key,
          value: form.value,
          description: form.description || undefined,
          sortOrder: form.sortOrder,
        })
        if (!res.success) throw new Error(res.error?.message || '更新失败')
      } else {
        const res = await api.post('/api/v1/admin/knowledge', {
          category: form.category,
          key: form.key,
          value: form.value,
          description: form.description || undefined,
          sortOrder: form.sortOrder,
        })
        if (!res.success) throw new Error(res.error?.message || '创建失败')
      }
      setFormOpen(false)
      await fetchAssets()
    } catch (err: any) {
      setFormError(err.message || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  // ═══════════════════════════════
  // 删除
  // ═══════════════════════════════
  async function handleDelete(id: number) {
    if (!confirm('确认删除此知识资产？此操作不可撤销。')) return
    try {
      await api.delete(`/api/v1/admin/knowledge/${id}`)
      await fetchAssets()
    } catch {
      alert('删除失败')
    }
  }

  // ═══════════════════════════════
  // 切换启用/禁用
  // ═══════════════════════════════
  async function toggleActive(asset: KnowledgeAsset) {
    const newVal = asset.isActive === 1 ? 0 : 1
    try {
      await api.put(`/api/v1/admin/knowledge/${asset.id}`, { isActive: newVal })
      await fetchAssets()
    } catch {
      // ignore
    }
  }

  // ═══════════════════════════════
  // 渲染
  // ═══════════════════════════════

  if (error && assets.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="px-4 py-3 rounded-lg bg-[#C04030]/10 border border-[#C04030]/20 text-[#D06050] text-xs">
          {error}
          <button onClick={fetchAssets} className="ml-3 underline text-[#B8964A]">重试</button>
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
            <Library size={18} className="text-[#5B8C5A]" />
            命理规则字典
          </h2>
          <p className="text-[10px] text-[#6B6459] mt-0.5 italic">
            {assets.length} 条知识资产 · 5 个分类 · API-First 动态管理 · 大模型实时消费底层规则
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-[#EDE8DF] bg-[#C04030] hover:bg-[#A03024] rounded-lg transition-colors"
        >
          <Plus size={14} />
          新增资产
        </button>
      </div>

      {/* ── 主内容：左分类 + 右表格 ── */}
      <div className="flex-1 min-h-0 flex gap-3">
        {/* ═══ 左侧：分类导航 ═══ */}
        <div className="w-56 shrink-0 flex flex-col gap-2">
          <span className="text-[10px] uppercase tracking-wider text-[#4A4540] font-medium px-1">知识分类</span>
          <div className="flex-1 overflow-y-auto space-y-1">
            {CATEGORIES.map(cat => {
              const count = assets.filter(a => a.category === cat.name).length
              const isActive = cat.name === activeCat
              return (
                <button
                  key={cat.name}
                  onClick={() => {
                    setActiveCat(cat.name)
                    setFormOpen(false)
                  }}
                  className={`w-full text-left p-3 rounded-lg border transition-all duration-150 ${
                    isActive
                      ? 'border-[#5B8C5A]/60 bg-[#222839] shadow-[0_0_12px_rgba(91,140,90,0.06)]'
                      : 'border-white/[0.04] bg-[#1A1F2E] hover:border-white/[0.10] hover:bg-[#1E2435]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <cat.icon size={14} style={{ color: cat.color }} />
                      <span className="text-xs font-medium text-[#EDE8DF]">{cat.label}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Badge className="text-[9px] bg-white/[0.04] text-[#6B6459] border-white/[0.06] px-1.5 h-4">
                        {count}
                      </Badge>
                      <ChevronRight size={10} className="text-[#4A4540]" />
                    </div>
                  </div>
                  <p className="text-[9px] text-[#4A4540] mt-1 line-clamp-1">{cat.desc}</p>
                </button>
              )
            })}
          </div>
        </div>

        {/* ═══ 右侧：数据表格 + 表单 ═══ */}
        <div className="flex-1 min-w-0 overflow-y-auto space-y-3">
          {/* 分类信息卡 */}
          <Card className="bg-[#1A1F2E] border-white/[0.06]">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="size-10 flex items-center justify-center rounded-lg" style={{ background: `${catInfo.color}10`, border: `1px solid ${catInfo.color}20` }}>
                  <catInfo.icon size={18} style={{ color: catInfo.color }} />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold text-[#EDE8DF]">{catInfo.label}</h3>
                  <p className="text-[10px] text-[#6B6459] mt-0.5">{catInfo.desc}</p>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-[#4A4540]">
                  <span>{filtered.filter(a => a.isActive === 1).length} 启用</span>
                  <span className="text-[#2A2622]">|</span>
                  <span>{filtered.filter(a => a.isActive === 0).length} 禁用</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── 新增/编辑表单 ── */}
          {formOpen && (
            <Card className="bg-[#1A1F2E] border-[#B8964A]/15 shadow-[0_0_20px_rgba(184,150,74,0.03)]">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="size-7 flex items-center justify-center rounded-lg bg-[#B8964A]/8 border border-[#B8964A]/15">
                      {editingId !== null ? <Pencil size={12} className="text-[#B8964A]" /> : <Plus size={12} className="text-[#B8964A]" />}
                    </div>
                    <CardTitle className="text-xs text-[#EDE8DF] tracking-[0.04em]">
                      {editingId !== null ? '编辑知识资产' : '新增知识资产'}
                    </CardTitle>
                  </div>
                  <CardDescription className="text-[9px] text-[#6B6459]">
                    填写知识条目的结构化数据，引擎与大模型将实时读取
                  </CardDescription>
                  <button onClick={() => setFormOpen(false)} className="p-1 rounded text-[#4A4540] hover:text-[#EDE8DF] hover:bg-white/[0.04]">
                    <X size={14} />
                  </button>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {formError && (
                  <div className="px-3 py-2 rounded-md bg-[#C04030]/10 border border-[#C04030]/30 text-[#D06050] text-[10px]">
                    {formError}
                  </div>
                )}

                {/* 分类选择 */}
                <div className="space-y-1.5">
                  <Label className="text-[10px] text-[#6B6459] font-medium flex items-center gap-1.5">
                    分类 <span className="text-[#C04030] text-[8px] font-medium">*必填</span>
                  </Label>
                  <Select
                    value={form.category}
                    onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                    disabled={editingId !== null}
                  >
                    {CATEGORIES.map(c => (
                      <option key={c.name} value={c.name}>{c.label}</option>
                    ))}
                  </Select>
                  {editingId !== null ? (
                    <p className="text-[9px] text-[#4A4540] italic flex items-center gap-1">
                      <Info size={10} className="text-[#4A4540]" />
                      编辑模式下不可更改分类 — 确保数据分类迁移一致性
                    </p>
                  ) : (
                    <p className="text-[9px] text-[#6B6459] font-medium">
                      ⚑ 必填。用于大类隔离，例如填入：古籍、神煞、16人格
                    </p>
                  )}
                </div>

                {/* Key + Sort Order 并排 */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] text-[#6B6459] font-medium flex items-center gap-1.5">
                      资产键 <span className="text-[#C04030] text-[8px] font-medium">*必填</span>
                    </Label>
                    <Input
                      value={form.key}
                      onChange={e => setForm(f => ({ ...f, key: e.target.value }))}
                      placeholder="如：tianyi_gui_ren"
                      className="bg-[#0A1118] border-white/[0.08] text-[#EDE8DF] placeholder:text-[#3E3A33] text-xs font-mono"
                    />
                    <p className="text-[9px] text-[#6B6459] font-medium">
                      英文唯一标识符，推荐 snake_case，同分类下不可重复。大模型按此 key 精确检索对应规则。
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] text-[#6B6459] font-medium">排序权重</Label>
                    <Input
                      type="number"
                      value={form.sortOrder}
                      onChange={e => setForm(f => ({ ...f, sortOrder: parseInt(e.target.value) || 0 }))}
                      className="bg-[#0A1118] border-white/[0.08] text-[#EDE8DF] text-xs"
                    />
                    <p className="text-[9px] text-[#6B6459] font-medium">
                      数字越大排序越靠前。同分类下多项资产按此权重排列显示顺序。
                    </p>
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                  <Label className="text-[10px] text-[#6B6459] font-medium flex items-center gap-1.5">
                    中文说明 <Badge className="text-[7px] bg-white/[0.04] text-[#4A4540] border-white/[0.06] px-1 h-3">可选</Badge>
                  </Label>
                  <Input
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="如：天乙贵人查法——以年干或日干查四地支"
                    className="bg-[#0A1118] border-white/[0.08] text-[#EDE8DF] placeholder:text-[#3E3A33] text-xs"
                  />
                  <p className="text-[9px] text-[#6B6459] font-medium">
                    帮助团队成员理解该资产用途，也会被大模型读取作为上下文提示。建议填写。
                  </p>
                </div>

                {/* Value (JSON) */}
                <div className="space-y-1.5">
                  <Label className="text-[10px] text-[#6B6459] font-medium flex items-center gap-1.5">
                    资产值 <span className="text-[#C04030] text-[8px] font-medium">*必填</span>
                    <Badge className="text-[7px] bg-[#B8964A]/10 text-[#B8964A] border-[#B8964A]/20 px-1 h-3">JSON</Badge>
                  </Label>
                  <textarea
                    value={form.value}
                    onChange={e => setForm(f => ({ ...f, value: e.target.value }))}
                    placeholder={`{"dayGan": "甲", "checkBranchs": ["丑","未"], "level": "吉", "star": 5, "desc": "天乙贵人..."}`}
                    rows={5}
                    className="w-full px-3 py-2 bg-[#0A1118] border border-white/[0.08] rounded-lg text-[#EDE8DF] placeholder:text-[#3E3A33] text-xs font-mono resize-none focus:outline-none focus:border-[#B8964A]/60 leading-relaxed"
                  />
                  <p className="text-[9px] text-[#6B6459] font-medium">
                    严格 JSON 格式的结构化数据。引擎与大模型将解析此 JSON 获取具体规则。示例字段：dayGan（日干查法）、checkBranchs（查地支）、level（吉凶等级）、star（星级评分）、desc（详细说明）。
                  </p>
                </div>
              </CardContent>

              {/* 操作按钮 */}
              <CardFooter className="flex justify-end gap-3 pt-0">
                <button onClick={() => setFormOpen(false)} className="px-4 py-2 text-xs text-[#A09888] hover:text-[#EDE8DF] hover:bg-white/[0.04] rounded-lg">
                  取消
                </button>
                <button onClick={handleSave} disabled={saving}
                  className="px-5 py-2 text-xs font-medium text-[#EDE8DF] bg-[#C04030] hover:bg-[#A03024] rounded-lg transition-colors disabled:opacity-50">
                  {saving ? '保存中...' : editingId !== null ? '更新资产' : '创建资产'}
                </button>
              </CardFooter>
            </Card>
          )}

          {/* ── 加载中 ── */}
          {loading ? (
            <Card className="bg-[#1A1F2E] border-white/[0.04]">
              <CardContent className="flex items-center justify-center py-12 gap-2">
                <RefreshCw size={16} className="animate-spin text-[#B8964A]" />
                <span className="text-[10px] text-[#6B6459] italic">正在加载知识资产...</span>
              </CardContent>
            </Card>
          ) : filtered.length === 0 ? (
            <Card className="bg-[#1A1F2E] border-white/[0.04]">
              <CardContent className="p-8 flex flex-col items-center gap-3">
                <div className="size-12 flex items-center justify-center rounded-full bg-white/[0.02] border border-white/[0.04]">
                  <Library size={20} className="text-[#4A4540]" />
                </div>
                <p className="text-[#6B6459] text-xs">此分类暂无知识资产</p>
                <p className="text-[#6B6459] text-[10px] italic">点击右上角「新增资产」为 {catInfo.label} 添加第一条规则</p>
                {!formOpen && (
                  <button onClick={openCreate} className="mt-1 px-4 py-2 text-xs font-medium text-[#EDE8DF] bg-[#C04030] hover:bg-[#A03024] rounded-lg transition-colors">
                    新增第一条资产
                  </button>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-[#1A1F2E] border-white/[0.04] overflow-hidden">
              <CardContent className="p-0">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/[0.04]">
                    <th className="text-left px-4 py-2.5 text-[9px] text-[#4A4540] uppercase tracking-wider font-medium w-8">#</th>
                    <th className="text-left px-4 py-2.5 text-[9px] text-[#4A4540] uppercase tracking-wider font-medium">Key</th>
                    <th className="text-left px-4 py-2.5 text-[9px] text-[#4A4540] uppercase tracking-wider font-medium">说明</th>
                    <th className="text-left px-4 py-2.5 text-[9px] text-[#4A4540] uppercase tracking-wider font-medium w-24">Value (预览)</th>
                    <th className="text-center px-4 py-2.5 text-[9px] text-[#4A4540] uppercase tracking-wider font-medium w-14">版本</th>
                    <th className="text-center px-4 py-2.5 text-[9px] text-[#4A4540] uppercase tracking-wider font-medium w-16">状态</th>
                    <th className="text-right px-4 py-2.5 text-[9px] text-[#4A4540] uppercase tracking-wider font-medium w-20">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((a, i) => {
                    let preview = ''
                    try {
                      const p = JSON.parse(a.value)
                      preview = JSON.stringify(p).slice(0, 60) + (JSON.stringify(p).length > 60 ? '…' : '')
                    } catch {
                      preview = a.value.slice(0, 60) + (a.value.length > 60 ? '…' : '')
                    }

                    return (
                      <tr key={a.id} className={`border-b border-white/[0.02] hover:bg-white/[0.02] transition-colors ${a.isActive === 0 ? 'opacity-40' : ''}`}>
                        <td className="px-4 py-3 text-[10px] text-[#4A4540] font-mono">{i + 1}</td>
                        <td className="px-4 py-3">
                          <code className="text-[10px] text-[#B8964A] bg-[#B8964A]/8 px-1.5 py-0.5 rounded font-mono">{a.key}</code>
                        </td>
                        <td className="px-4 py-3 text-[10px] text-[#A09888] max-w-48 truncate">{a.description || '-'}</td>
                        <td className="px-4 py-3">
                          <code className="text-[9px] text-[#6B6459] font-mono truncate block max-w-24" title={a.value}>{preview || '…'}</code>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-[9px] text-[#4A4540] font-mono">v{a.version}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex justify-center">
                            <Switch
                              checked={a.isActive === 1}
                              onCheckedChange={() => toggleActive(a)}
                            />
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => openEdit(a)}
                              className="p-1.5 rounded text-[#4A4540] hover:text-[#B8964A] hover:bg-white/[0.04] transition-colors">
                              <Pencil size={12} />
                            </button>
                            <button onClick={() => handleDelete(a.id)}
                              className="p-1.5 rounded text-[#4A4540] hover:text-[#D06050] hover:bg-[#C04030]/10 transition-colors">
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
