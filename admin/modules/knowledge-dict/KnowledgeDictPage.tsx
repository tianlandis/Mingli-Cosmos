// ============================================================
// Phase 7 — 命理规则字典：知识资产超市
// 文件：admin/modules/knowledge-dict/KnowledgeDictPage.tsx
// 职责：分类侧边栏 + 数据录入表格的通用 CRUD 管理窗口
// ============================================================

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Library,
  Plus,
  Trash2,
  Pencil,
  X,
  RefreshCw,
  BookOpen,
  Shield,
  Brain,
  Database,
  Network,
  ChevronRight,
  Info,
  CheckCircle2,
  Download,
  Upload,
  FileJson,
  AlertTriangle,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
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
// 拼音→中文 映射表（双轨制：底层 Key 为拼音，前端展示中文）
// 覆盖 5 个分类下常见命名，未匹配到的 Key 回退显示拼音本身
// ═══════════════════════════════════════
const KEY_TO_CHINESE: Record<string, string> = {
  // ── 古籍经典 ──
  yuan_hai_zi_ping: '渊海子平',
  san_ming_tong_hui: '三命通会',
  di_tian_sui: '滴天髓',
  qiong_tong_bao_jian: '穷通宝鉴',
  zi_ping_zhen_quan: '子平真诠',
  ming_li_tan_yuan: '命理探源',
  yuan_hai_zi_ping_ge_ju: '渊海子平·格局章',
  yuan_hai_zi_ping_shen_sha: '渊海子平·神煞章',
  yuan_hai_zi_ping_shi_shen: '渊海子平·十神章',
  san_ming_tong_hui_ge_ju: '三命通会·格局',
  san_ming_tong_hui_liu_qin: '三命通会·六亲',
  san_ming_tong_hui_nv_ming: '三命通会·女命',
  di_tian_sui_ti_yong: '滴天髓·体用',
  di_tian_sui_jing_wei: '滴天髓·经纬',
  di_tian_sui_shun_ni: '滴天髓·顺逆',
  qiong_tong_bao_jian_tiao_hou: '穷通宝鉴·调候',
  zi_ping_zhen_quan_lun_yong_shen: '子平真诠·论用神',
  // ── 神煞规则 ──
  tian_yi_gui_ren: '天乙贵人',
  tian_yi: '天乙贵人',
  wen_chang: '文昌',
  yi_ma: '驿马',
  tao_hua: '桃花',
  xian_chi: '咸池',
  yang_ren: '羊刃',
  jie_sha: '劫煞',
  zai_sha: '灾煞',
  gu_chen: '孤辰',
  gua_su: '寡宿',
  hua_gai: '华盖',
  tian_de: '天德贵人',
  yue_de: '月德贵人',
  tian_de_he: '天德合',
  yue_de_he: '月德合',
  fu_xing: '福星贵人',
  xue_tang: '学堂',
  ci_guan: '词馆',
  jiang_xing: '将星',
  jin_yu: '金舆',
  lu_shen: '禄神',
  gong_wang: '拱旺',
  wang_shen: '亡神',
  yuan_chen: '元辰',
  kong_wang: '空亡',
  tian_luo_di_wang: '天罗地网',
  tian_she: '天赦',
  san_qi: '三奇贵人',
  tai_ji_gui_ren: '太极贵人',
  guo_yin: '国印贵人',
  hong_luan: '红鸾',
  tian_xi: '天喜',
  kui_gang: '魁罡',
  jin_shen: '进神',
  tui_shen: '退神',
  jiao_tui: '交退',
  // ── 16 人格映射 ──
  intj: 'INTJ · 建筑师',
  intp: 'INTP · 逻辑学家',
  entj: 'ENTJ · 指挥官',
  entp: 'ENTP · 辩论家',
  infj: 'INFJ · 提倡者',
  infp: 'INFP · 调停者',
  enfj: 'ENFJ · 主人公',
  enfp: 'ENFP · 竞选者',
  istj: 'ISTJ · 物流师',
  isfj: 'ISFJ · 守卫者',
  estj: 'ESTJ · 总经理',
  esfj: 'ESFJ · 执政官',
  istp: 'ISTP · 鉴赏家',
  isfp: 'ISFP · 探险家',
  estp: 'ESTP · 企业家',
  esfp: 'ESFP · 表演者',
  // ── 八字基础 ──
  tian_gan: '十天干',
  di_zhi: '十二地支',
  wu_xing: '五行',
  wu_xing_sheng_ke: '五行生克',
  shi_shen: '十神',
  shi_shen_guan_xi: '十神关系',
  liu_qin: '六亲',
  na_yin: '纳音',
  jie_qi: '节气',
  jia_zi: '甲子',
  yi_chou: '乙丑',
  bing_yin: '丙寅',
  ding_mao: '丁卯',
  wu_chen: '戊辰',
  ji_si: '己巳',
  geng_wu: '庚午',
  xin_wei: '辛未',
  ren_shen: '壬申',
  gui_you: '癸酉',
  jia_xu: '甲戌',
  yi_hai: '乙亥',
  bing_zi: '丙子',
  ding_chou: '丁丑',
  wu_yin: '戊寅',
  ji_mao: '己卯',
  geng_chen: '庚辰',
  xin_si: '辛巳',
  ren_wu: '壬午',
  gui_wei: '癸未',
  jia_shen: '甲申',
  yi_you: '乙酉',
  bing_xu: '丙戌',
  ding_hai: '丁亥',
  wu_zi: '戊子',
  ji_chou: '己丑',
  geng_yin: '庚寅',
  xin_mao: '辛卯',
  ren_chen: '壬辰',
  gui_si: '癸巳',
  jia_wu: '甲午',
  yi_wei: '乙未',
  bing_shen: '丙申',
  ding_you: '丁酉',
  wu_xu: '戊戌',
  ji_hai: '己亥',
  geng_zi: '庚子',
  xin_chou: '辛丑',
  ren_yin: '壬寅',
  gui_mao: '癸卯',
  jia_chen: '甲辰',
  yi_si: '乙巳',
  bing_wu: '丙午',
  ding_wei: '丁未',
  wu_shen: '戊申',
  ji_you: '己酉',
  geng_xu: '庚戌',
  xin_hai: '辛亥',
  ren_zi: '壬子',
  gui_chou: '癸丑',
  jia_yin: '甲寅',
  yi_mao: '乙卯',
  bing_chen: '丙辰',
  ding_si: '丁巳',
  wu_wu: '戊午',
  ji_wei: '己未',
  geng_shen: '庚申',
  xin_you: '辛酉',
  ren_xu: '壬戌',
  gui_hai: '癸亥',
  bi_jian: '比肩',
  jie_cai: '劫财',
  shi_shen_2: '食神',
  shang_guan: '伤官',
  zheng_cai: '正财',
  pian_cai: '偏财',
  zheng_guan: '正官',
  qi_sha: '七杀',
  zheng_yin: '正印',
  pian_yin: '偏印',
  // ── 格局判定 ──
  yue_ling_qu_ge: '月令取格',
  hui_he_qu_ge: '会合取格',
  te_shu_ge_ju: '特殊格局',
  zheng_guan_ge: '正官格',
  qi_sha_ge: '七杀格',
  zheng_cai_ge: '正财格',
  pian_cai_ge: '偏财格',
  zheng_yin_ge: '正印格',
  pian_yin_ge: '偏印格',
  shi_shen_ge: '食神格',
  shang_guan_ge: '伤官格',
  jian_lu_ge: '建禄格',
  yang_ren_ge: '羊刃格',
  cong_ge: '从格',
  hua_ge: '化格',
  zhuan_wang_ge: '专旺格',
  liang_shen_cheng_xiang_ge: '两神成象格',
  san_qi_ge: '三奇格',
  gui_ge_quan_ti: '贵格全题',
}

/** 根据拼音 Key 获取中文名称，未匹配时返回空字符串 */
function getChineseName(key: string): string {
  return KEY_TO_CHINESE[key] || ''
}

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
  // 拉取数据（必须在所有依赖它的 callback 之前声明）
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

  // ── 导入/导出状态 ──
  const [importOpen, setImportOpen] = useState(false)
  const [importMode, setImportMode] = useState<'upsert' | 'skip' | 'overwrite'>('upsert')
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importPreview, setImportPreview] = useState<{ total: number; categories: string[] } | null>(null)
  const [importError, setImportError] = useState('')
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ created: number; updated: number; skipped: number } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── 导出 ──
  const handleExport = useCallback(async () => {
    try {
      const res = await api.get<any>(`/api/v1/admin/knowledge/export/all`)
      if (!res.success || !res.data) throw new Error(res.error?.message || '导出失败')
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `knowledge-dict-export-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err: any) {
      alert(`导出失败：${err.message || '请检查网络连接后重试'}`)
    }
  }, [])

  // ── 文件选择预览 ──
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    setImportError('')
    setImportPreview(null)
    setImportResult(null)
    if (!file) { setImportFile(null); return }
    setImportFile(file)

    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const json = JSON.parse(ev.target?.result as string)
        if (!json.assets || !Array.isArray(json.assets)) {
          throw new Error('JSON 格式错误：缺少 "assets" 数组字段')
        }
        if (json.assets.length > 500) {
          throw new Error(`单次最多导入 500 条，当前文件包含 ${json.assets.length} 条`)
        }
        const cats = [...new Set(json.assets.map((a: any) => a.category))] as string[]
        setImportPreview({ total: json.assets.length, categories: cats })
      } catch (err: any) {
        setImportError(err.message || 'JSON 解析失败')
        setImportFile(null)
      }
    }
    reader.onerror = () => {
      setImportError('文件读取失败')
      setImportFile(null)
    }
    reader.readAsText(file)
  }, [])

  // ── 执行导入 ──
  const handleImport = useCallback(async () => {
    if (!importFile) return
    setImporting(true)
    setImportError('')
    try {
      const text = await importFile.text()
      const json = JSON.parse(text)
      const res = await api.post<any>('/api/v1/admin/knowledge/import', {
        assets: json.assets,
        mode: importMode,
      })
      if (!res.success) throw new Error(res.error?.message || '导入失败')
      setImportResult(res.data || { created: 0, updated: 0, skipped: 0 })
      setImportFile(null)
      setImportPreview(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      await fetchAssets()
    } catch (err: any) {
      setImportError(err.message || '导入请求失败')
    } finally {
      setImporting(false)
    }
  }, [importFile, importMode, fetchAssets])

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
      const res = await api.delete<any>(`/api/v1/admin/knowledge/${id}`)
      if (!res.success) throw new Error(res.error?.message || '删除失败')
      await fetchAssets()
    } catch (err: any) {
      alert(`删除失败：${err.message || '请检查网络连接后重试'}`)
    }
  }

  // ═══════════════════════════════
  // 切换启用/禁用
  // ═══════════════════════════════
  async function toggleActive(asset: KnowledgeAsset) {
    const newVal = asset.isActive === 1 ? 0 : 1
    // 乐观更新：先切 UI，失败再回滚
    setAssets(prev => prev.map(a => a.id === asset.id ? { ...a, isActive: newVal } : a))
    try {
      const res = await api.put<any>(`/api/v1/admin/knowledge/${asset.id}`, { isActive: newVal })
      if (!res.success) throw new Error(res.error?.message || '状态切换失败')
    } catch (err: any) {
      // 回滚
      setAssets(prev => prev.map(a => a.id === asset.id ? { ...a, isActive: asset.isActive } : a))
      alert(`状态切换失败：${err.message || '请检查网络连接后重试'}`)
    }
  }

  // ═══════════════════════════════
  // 渲染
  // ═══════════════════════════════

  if (error && assets.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="px-4 py-3 rounded-lg bg-[#C04030]/10 border border-[#C04030]/20 text-[#D06050] text-sm">
          {error}
          <button onClick={fetchAssets} className="ml-3 underline text-[#C08040] hover:text-[#E0A050]">重试</button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col gap-3 bg-[#0B0F19] -m-6 lg:-m-8 p-6 lg:p-8">
      {/* ── 页面标题 ── */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-lg font-semibold text-[#EDE8DF] flex items-center gap-2 tracking-[0.04em]">
            <Library size={18} className="text-[#B8964A]" />
            命理规则字典
          </h2>
          <p className="text-sm text-[#9CA3AF] mt-0.5 italic">
            {assets.length} 条知识资产 · 5 个分类 · API-First 动态管理 · 大模型实时消费底层规则
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* 导出 JSON */}
          <button
            onClick={handleExport}
            title="导出全部 5 个分类的知识资产为 JSON 文件，可用于备份、迁移或批量编辑"
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-[#A09888] hover:text-[#EDE8DF] bg-[#1A1F2E] border border-white/[0.06] hover:border-white/[0.12] rounded-lg transition-colors"
          >
            <Download size={14} />
            导出 JSON
          </button>
          {/* 导入 JSON */}
          <button
            onClick={() => {
              setImportOpen(true)
              setImportFile(null)
              setImportPreview(null)
              setImportError('')
              setImportResult(null)
              setImportMode('upsert')
            }}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-[#A09888] hover:text-[#EDE8DF] bg-[#1A1F2E] border border-white/[0.06] hover:border-white/[0.12] rounded-lg transition-colors"
          >
            <Upload size={14} />
            导入 JSON
          </button>
          <button
            onClick={openCreate}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-[#B8964A] hover:bg-[#C8A85A] rounded-lg transition-colors shadow-[0_0_16px_rgba(184,150,74,0.15)]"
          >
            <Plus size={14} />
            新增资产
          </button>
        </div>
      </div>

      {/* ── 主内容：左分类 + 右表格 ── */}
      <div className="flex-1 min-h-0 flex gap-3">
        {/* ═══ 左侧：分类导航 ═══ */}
        <div className="w-56 shrink-0 flex flex-col gap-2">
          <span className="text-xs uppercase tracking-wider text-[#9CA3AF] font-medium px-1">知识分类</span>
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
                      ? 'border-[#B8964A]/60 bg-[#222839] shadow-[0_0_12px_rgba(184,150,74,0.06)]'
                      : 'border-white/[0.06] bg-[#1A1F2E] hover:border-white/[0.10] hover:bg-[#1E2435]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <cat.icon size={14} style={{ color: isActive ? cat.color : '#6B6459' }} />
                      <span className={`text-sm font-medium ${isActive ? 'text-[#EDE8DF]' : 'text-[#A09888]'}`}>{cat.label}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Badge className={`text-[11px] px-1.5 h-5 font-medium ${isActive ? 'bg-[#B8964A]/15 text-[#B8964A] border-[#B8964A]/25' : 'bg-white/[0.04] text-[#6B6459] border-white/[0.06]'}`}>
                        {count}
                      </Badge>
                      <ChevronRight size={10} className={isActive ? 'text-[#B8964A]' : 'text-[#4A4540]'} />
                    </div>
                  </div>
                  <p className="text-[11px] text-[#6B6459] mt-1 line-clamp-1">{cat.desc}</p>
                </button>
              )
            })}
          </div>
        </div>

        {/* ═══ 右侧：数据表格 + 表单 ═══ */}
        <div className="flex-1 min-w-0 overflow-y-auto space-y-3">
          {/* 分类信息卡 */}
          <Card className="bg-[#1A1F2E] border-white/[0.06] shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="size-10 flex items-center justify-center rounded-lg" style={{ background: `${catInfo.color}15`, border: `1px solid ${catInfo.color}30` }}>
                  <catInfo.icon size={18} style={{ color: catInfo.color }} />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-semibold text-[#EDE8DF]">{catInfo.label}</h3>
                  <p className="text-xs text-[#9CA3AF] mt-0.5">{catInfo.desc}</p>
                </div>
                <div className="flex items-center gap-2 text-xs text-[#9CA3AF]">
                  <span>{filtered.filter(a => a.isActive === 1).length} 启用</span>
                  <span className="text-[#4A4540]">|</span>
                  <span>{filtered.filter(a => a.isActive === 0).length} 禁用</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── 新增/编辑表单 ── */}
          {formOpen && (
            <Card className="bg-[#1A1F2E] border-white/[0.06] shadow-sm ring-1 ring-[#B8964A]/10">
              <CardHeader className="pb-2 border-b border-white/[0.04]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="size-7 flex items-center justify-center rounded-lg bg-[#B8964A]/10 border border-[#B8964A]/20">
                      {editingId !== null ? <Pencil size={12} className="text-[#B8964A]" /> : <Plus size={12} className="text-[#B8964A]" />}
                    </div>
                    <CardTitle className="text-sm text-[#EDE8DF] tracking-[0.04em]">
                      {editingId !== null ? '编辑知识资产' : '新增知识资产'}
                    </CardTitle>
                  </div>
                  <CardDescription className="text-[11px] text-[#9CA3AF]">
                    填写知识条目的结构化数据，引擎与大模型将实时读取
                  </CardDescription>
                  <button onClick={() => setFormOpen(false)} className="p-1 rounded text-[#A09888] hover:text-[#EDE8DF] hover:bg-white/[0.06] transition-colors">
                    <X size={14} />
                  </button>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {formError && (
                  <div className="px-3 py-2 rounded-md bg-[#C04030]/10 border border-[#C04030]/25 text-[#D06050] text-[12px] flex items-center gap-1.5">
                    <AlertTriangle size={12} className="shrink-0" />
                    {formError}
                  </div>
                )}

                {/* 分类选择 */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-[#9CA3AF] font-medium flex items-center gap-1.5">
                    知识分类 <span className="text-[#C08040] text-[11px] font-medium">*必填</span>
                  </Label>
                  <Select
                    value={form.category}
                    onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                    disabled={editingId !== null}
                    className="bg-[#0F1520] border-white/[0.10] text-[#EDE8DF] text-sm focus:border-[#B8964A]/60"
                  >
                    {CATEGORIES.map(c => (
                      <option key={c.name} value={c.name}>{c.label}</option>
                    ))}
                  </Select>
                  {editingId !== null ? (
                    <p className="text-[11px] text-[#6B6459] italic flex items-center gap-1">
                      <Info size={10} className="text-[#4A4540]" />
                      编辑模式下不可更改分类 — 防止误操作导致数据跨分类迁移，确保数据一致性
                    </p>
                  ) : (
                    <p className="text-[11px] text-[#6B6459] leading-relaxed">
                      决定该资产属于哪个知识大类（如"神煞规则""古籍经典"）。新建后不可更改，请仔细确认。可选分类：古籍经典、神煞规则、16人格映射、八字基础、格局判定。
                    </p>
                  )}
                </div>

                {/* Key + Sort Order 并排 */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-[#9CA3AF] font-medium flex items-center gap-1.5">
                      资产键（Key） <span className="text-[#C08040] text-[11px] font-medium">*必填</span>
                    </Label>
                    <Input
                      value={form.key}
                      onChange={e => setForm(f => ({ ...f, key: e.target.value }))}
                      placeholder="如：tian_yi_gui_ren"
                      className="bg-[#0F1520] border-white/[0.10] text-[#EDE8DF] placeholder:text-[#4A4540] text-sm font-mono focus:border-[#B8964A]/60 focus:ring-1 focus:ring-[#B8964A]/20"
                    />
                    {(() => {
                      const cn = getChineseName(form.key.trim())
                      return cn ? (
                        <p className="text-[12px] text-[#C08040] font-medium flex items-center gap-1.5">
                          <CheckCircle2 size={10} />
                          中文名称：{cn}
                        </p>
                      ) : (
                        <p className="text-[11px] text-[#6B6459] leading-relaxed">
                          资产的唯一标识符，由英文小写+下划线组成。<br/>同分类下不可重复，大模型将按此键名精确检索对应规则。例如神煞分类下填入 tian_yi_gui_ren 代表天乙贵人的查法规则。
                        </p>
                      )
                    })()}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-[#9CA3AF] font-medium">排序权重</Label>
                    <Input
                      type="number"
                      value={form.sortOrder}
                      onChange={e => setForm(f => ({ ...f, sortOrder: parseInt(e.target.value) || 0 }))}
                      placeholder="0"
                      className="bg-[#0F1520] border-white/[0.10] text-[#EDE8DF] text-sm focus:border-[#B8964A]/60"
                    />
                    <p className="text-[11px] text-[#6B6459] leading-relaxed">
                      决定该资产在列表中显示的位置。填入整数，数值越大越靠前。不填默认为 0，排在最末尾。
                    </p>
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-[#9CA3AF] font-medium flex items-center gap-1.5">
                    中文说明 <Badge className="text-[9px] bg-white/[0.04] text-[#6B6459] border-white/[0.06] px-1 h-4">可选</Badge>
                  </Label>
                  <Input
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="如：天乙贵人查法——以年干或日干查四地支"
                    className="bg-[#0F1520] border-white/[0.10] text-[#EDE8DF] placeholder:text-[#4A4540] text-sm focus:border-[#B8964A]/60"
                  />
                  <p className="text-[11px] text-[#6B6459] leading-relaxed">
                    用 1-2 句简短的中文描述这个资产是做什么的。大模型在检索到此资产时会一并读取这段说明作为辅助上下文，帮助它更准确地理解该规则的用途。建议花 10 秒填一下，让知识库更易维护。
                  </p>
                </div>

                {/* Value (JSON) */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-[#9CA3AF] font-medium flex items-center gap-1.5">
                    资产值（Value） <span className="text-[#C08040] text-[11px] font-medium">*必填</span>
                    <Badge className="text-[9px] bg-[#C08040]/10 text-[#C08040] border-[#C08040]/20 px-1 h-4">JSON</Badge>
                  </Label>
                  <textarea
                    value={form.value}
                    onChange={e => setForm(f => ({ ...f, value: e.target.value }))}
                    placeholder={`{"dayGan": "甲", "checkBranchs": ["丑","未"], "level": "吉", "star": 5, "desc": "天乙贵人..."}`}
                    rows={5}
                    className="w-full px-3 py-2.5 bg-black/30 border border-white/[0.10] rounded-lg text-[#D8D2C8] placeholder:text-[#4A4540] text-sm font-mono resize-none focus:outline-none focus:border-[#B8964A]/60 focus:ring-1 focus:ring-[#B8964A]/30 leading-relaxed"
                  />
                  <p className="text-[11px] text-[#6B6459] leading-relaxed">
                    必须是合法的 JSON 格式（注意双引号、逗号、花括号一个都不能错）。引擎与大模型将解析此 JSON 获取具体规则。可自由定义字段，常见示例：dayGan（日干查法）、checkBranchs（查哪些地支）、level（吉凶等级，填"吉""凶""中"之一）、star（星级评分填 1-5）、desc（规则详细说明）。
                  </p>
                </div>
              </CardContent>

              {/* 操作按钮 */}
              <CardFooter className="flex justify-end gap-3 pt-0 border-t border-white/[0.04]">
                <button onClick={() => setFormOpen(false)} className="px-4 py-2 text-sm text-[#A09888] hover:text-[#EDE8DF] hover:bg-white/[0.04] rounded-lg transition-colors">
                  取消
                </button>
                <button onClick={handleSave} disabled={saving}
                  className="px-5 py-2 text-sm font-medium text-white bg-[#B8964A] hover:bg-[#C8A85A] rounded-lg transition-colors disabled:opacity-50 shadow-[0_0_12px_rgba(184,150,74,0.12)]">
                  {saving ? '保存中...' : editingId !== null ? '更新资产' : '创建资产'}
                </button>
              </CardFooter>
            </Card>
          )}

          {/* ── 加载中 ── */}
          {loading ? (
            <Card className="bg-[#1A1F2E] border-white/[0.06] shadow-sm">
              <CardContent className="flex items-center justify-center py-12 gap-2">
                <RefreshCw size={16} className="animate-spin text-[#B8964A]" />
                <span className="text-sm text-[#9CA3AF] italic">正在加载知识资产...</span>
              </CardContent>
            </Card>
          ) : filtered.length === 0 ? (
            <Card className="bg-[#1A1F2E] border-white/[0.06] shadow-sm">
              <CardContent className="p-8 flex flex-col items-center gap-3">
                <div className="size-12 flex items-center justify-center rounded-full bg-white/[0.04] border border-white/[0.06]">
                  <Library size={20} className="text-[#4A4540]" />
                </div>
                <p className="text-[#9CA3AF] text-sm">此分类暂无知识资产</p>
                <p className="text-[#6B6459] text-[12px] italic">点击右上角「新增资产」为 {catInfo.label} 添加第一条规则</p>
                {!formOpen && (
                  <button onClick={openCreate} className="mt-1 px-4 py-2 text-sm font-medium text-white bg-[#B8964A] hover:bg-[#C8A85A] rounded-lg transition-colors shadow-[0_0_12px_rgba(184,150,74,0.12)]">
                    新增第一条资产
                  </button>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-[#1A1F2E] border-white/[0.06] shadow-sm overflow-hidden">
              <CardContent className="p-0">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/[0.04] bg-white/[0.02]">
                    <th className="text-left px-4 py-2.5 text-[11px] text-[#9CA3AF] uppercase tracking-wider font-medium w-8">#</th>
                    <th className="text-left px-4 py-2.5 text-[11px] text-[#9CA3AF] uppercase tracking-wider font-medium">资产名</th>
                    <th className="text-left px-4 py-2.5 text-[11px] text-[#9CA3AF] uppercase tracking-wider font-medium">说明</th>
                    <th className="text-left px-4 py-2.5 text-[11px] text-[#9CA3AF] uppercase tracking-wider font-medium w-28">Value (预览)</th>
                    <th className="text-center px-4 py-2.5 text-[11px] text-[#9CA3AF] uppercase tracking-wider font-medium w-14">版本</th>
                    <th className="text-center px-4 py-2.5 text-[11px] text-[#9CA3AF] uppercase tracking-wider font-medium w-16">状态</th>
                    <th className="text-right px-4 py-2.5 text-[11px] text-[#9CA3AF] uppercase tracking-wider font-medium w-20">操作</th>
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
                      <tr key={a.id} className={`border-b border-white/[0.04] hover:bg-white/[0.03] transition-colors ${a.isActive === 0 ? 'opacity-40' : ''}`}>
                        <td className="px-4 py-3 text-xs text-[#4A4540] font-mono">{i + 1}</td>
                        <td className="px-4 py-2.5">
                          {(() => {
                            const cn = getChineseName(a.key)
                            return cn ? (
                              <div className="flex flex-col gap-0.5">
                                <span className="text-sm text-[#EDE8DF] font-medium leading-tight">{cn}</span>
                                <code className="text-[11px] text-[#6B6459] font-mono leading-tight">{a.key}</code>
                              </div>
                            ) : (
                              <code className="text-[12px] text-[#C08040] bg-[#C08040]/8 px-1.5 py-0.5 rounded font-mono">{a.key}</code>
                            )
                          })()}
                        </td>
                        <td className="px-4 py-3 text-xs text-[#9CA3AF] max-w-48 truncate">{a.description || '-'}</td>
                        <td className="px-4 py-3">
                          <code className="text-xs text-[#D8D2C8] bg-black/25 px-2 py-1 rounded font-mono truncate block max-w-28 leading-relaxed" title={a.value}>{preview || '…'}</code>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-[11px] text-[#4A4540] font-mono">v{a.version}</span>
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
                              className="p-1.5 rounded text-[#4A4540] hover:text-[#C08040] hover:bg-white/[0.06] transition-colors">
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

      {/* ═══════════════════════════════════════ */}
      {/* JSON 导入弹窗 — 代码编辑器风格 */}
      {/* ═══════════════════════════════════════ */}
      {importOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* 遮罩 */}
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => setImportOpen(false)}
          />

          {/* 弹窗 Card 容器 — 暗黑底 */}
          <Card className="relative w-full max-w-2xl mx-4 bg-[#1A1F2E] border-white/[0.06] shadow-2xl shadow-black/40">
            <CardHeader className="flex-row items-start justify-between space-y-0 pb-2 border-b border-white/[0.04]">
              <div>
                <CardTitle className="text-base font-semibold text-[#EDE8DF] flex items-center gap-2">
                  <FileJson size={18} className="text-[#B8964A]" />
                  导入知识资产
                </CardTitle>
                <CardDescription className="text-sm text-[#9CA3AF] mt-0.5">
                  从 JSON 文件批量导入命理规则字典 — 支持 UTF-8 编码的标准 JSON 格式
                </CardDescription>
              </div>
              <button
                onClick={() => setImportOpen(false)}
                className="p-1.5 rounded-md text-[#6B6459] hover:text-[#EDE8DF] hover:bg-white/[0.06] transition-colors"
              >
                <X size={18} />
              </button>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* 导入模式 */}
              <div className="space-y-1.5">
                <Label className="text-xs text-[#9CA3AF] font-medium">导入模式 — 处理重复资产的策略</Label>
                <div className="flex gap-2">
                  {([
                    { value: 'upsert' as const, label: '智能合并', desc: '同 Key 存在则更新内容，不存在则新增' },
                    { value: 'overwrite' as const, label: '完全覆盖', desc: '同 Key 资产将被整体替换（保留 ID）' },
                    { value: 'skip' as const, label: '仅新增', desc: '同 Key 资产直接跳过，只导入全新条目' },
                  ]).map(m => (
                    <button
                      key={m.value}
                      onClick={() => { setImportMode(m.value); setImportResult(null) }}
                      className={`flex-1 p-2.5 rounded-lg border text-left transition-all ${
                        importMode === m.value
                          ? 'border-[#B8964A]/50 bg-[#B8964A]/6'
                          : 'border-white/[0.06] bg-[#0F1520] hover:border-white/[0.10]'
                      }`}
                    >
                      <div className="text-[12px] font-medium text-[#EDE8DF]">{m.label}</div>
                      <div className="text-[10px] text-[#6B6459] mt-0.5 leading-relaxed">{m.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* 文件选择 */}
              <div className="space-y-1.5">
                <Label className="text-xs text-[#9CA3AF] font-medium">选择 JSON 文件</Label>
                <div className="relative">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    onChange={handleFileSelect}
                    className="w-full text-sm text-[#9CA3AF] file:mr-4 file:py-2.5 file:px-5 file:rounded-lg file:text-sm file:font-medium file:bg-[#B8964A] file:text-white file:border-0 hover:file:bg-[#C8A85A] transition-colors file:cursor-pointer"
                  />
                </div>
                <p className="text-[11px] text-[#6B6459] leading-relaxed">
                  选择本地 .json 文件，系统将自动校验格式。文件必须是合法的 JSON（UTF-8 编码），需包含 "assets" 数组字段。单次最多导入 500 条资产，超出请分批操作。
                </p>
              </div>

              {/* 预览 — 代码编辑器风格 */}
              {importPreview && (
                <div className="bg-black/40 border border-white/[0.10] rounded-lg overflow-hidden">
                  {/* 标题栏 — 模拟 IDE tab */}
                  <div className="flex items-center justify-between px-4 py-2 bg-black/30 border-b border-white/[0.06]">
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1.5">
                        <span className="size-2 rounded-full bg-[#FF5F57]" />
                        <span className="size-2 rounded-full bg-[#FFBD2E]" />
                        <span className="size-2 rounded-full bg-[#27C93F]" />
                      </div>
                      <span className="text-[11px] text-[#6B6459] font-mono tracking-tight">
                        {importFile?.name || 'knowledge-dict.json'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[#5B8C5A]">
                      <CheckCircle2 size={11} />
                      <span className="text-[11px] font-medium">JSON 校验通过</span>
                    </div>
                  </div>
                  {/* JSON 代码预览 */}
                  <div className="p-4 max-h-48 overflow-y-auto font-mono text-sm leading-relaxed">
                    <div className="text-[#6B6459] mb-2">
                      <span className="text-[#C08040]">"assets"</span>
                      <span className="text-[#9CA3AF]">: [</span>
                      <span className="text-[#5B8C5A]"> // {importPreview.total} 条资产</span>
                    </div>
                    <div className="text-[#9CA3AF] ml-4">
                      {importPreview.categories.map(c => `${CAT_LABELS[c] || c}`).join(', ')}
                    </div>
                    <div className="text-[#9CA3AF] mt-1">]</div>
                    <div className="mt-3 pt-2 border-t border-white/[0.08]">
                      <div className="flex gap-4 text-xs">
                        <span className="text-[#6B6459]">总数：<span className="text-[#EDE8DF] font-semibold">{importPreview.total}</span> 条</span>
                        <span className="text-[#6B6459]">分类：<span className="text-[#EDE8DF]">{importPreview.categories.length} 个</span></span>
                        <span className="text-[#6B6459]">模式：<span className="text-[#C08040] font-medium">{importMode === 'upsert' ? '智能合并' : importMode === 'overwrite' ? '完全覆盖' : '仅新增'}</span></span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 错误 */}
              {importError && (
                <div className="flex items-center gap-2 px-3 py-2.5 bg-[#C04030]/10 border border-[#C04030]/20 rounded-lg text-sm text-[#D06050]">
                  <AlertTriangle size={14} className="shrink-0" />
                  <span>{importError}</span>
                </div>
              )}

              {/* 导入结果 */}
              {importResult && (
                <div className="bg-[#5B8C5A]/10 border border-[#5B8C5A]/20 rounded-lg p-3.5 space-y-2">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 size={12} className="text-[#5B8C5A]" />
                    <span className="text-[12px] font-medium text-[#5B8C5A]">导入完成</span>
                  </div>
                  <div className="flex gap-4 text-xs">
                    <span className="text-[#EDE8DF]">新增 <span className="font-mono font-semibold text-[#5B8C5A]">{importResult.created}</span> 条</span>
                    <span className="text-[#EDE8DF]">更新 <span className="font-mono font-semibold text-[#C08040]">{importResult.updated}</span> 条</span>
                    <span className="text-[#EDE8DF]">跳过 <span className="font-mono font-semibold text-[#6B6459]">{importResult.skipped}</span> 条</span>
                  </div>
                </div>
              )}
            </CardContent>

            <CardFooter className="flex justify-end gap-3 border-t border-white/[0.04]">
              <button
                onClick={() => setImportOpen(false)}
                className="px-4 py-2 text-sm text-[#A09888] hover:text-[#EDE8DF] hover:bg-white/[0.04] rounded-lg transition-colors"
              >
                {importResult ? '关闭' : '取消'}
              </button>
              {!importResult && (
                <button
                  onClick={handleImport}
                  disabled={!importFile || importing}
                  className={`px-5 py-2 text-sm font-medium rounded-lg transition-colors ${
                    importFile
                      ? 'bg-[#B8964A] hover:bg-[#C8A85A] text-white shadow-[0_0_12px_rgba(184,150,74,0.12)]'
                      : 'bg-white/[0.04] text-[#4A4540] cursor-not-allowed'
                  }`}
                >
                  {importing ? (
                    <span className="flex items-center gap-1.5">
                      <RefreshCw size={11} className="animate-spin" />
                      导入中...
                    </span>
                  ) : (
                    `导入 ${importPreview?.total ?? 0} 条资产`
                  )}
                </button>
              )}
            </CardFooter>
          </Card>
        </div>
      )}
    </div>
  )
}
