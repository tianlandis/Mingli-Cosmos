// ============================================================
// 账户与数据 · 合规中心（路由 `/my/data`）
// 文件：src/pages/DataPage.tsx
//
// 落地 [P5-6 / ADR-006] PII 合规底座的**前端入口**（后端接口早已存在）：
//   - GET    /api/v1/app/user/consent       同意记录
//   - POST   /api/v1/app/user/consent       告知同意留痕
//   - GET    /api/v1/app/user/data/export   数据导出（机读 JSON）
//   - DELETE /api/v1/app/user/data          注销账号（软删 + 硬删 PII + 审计）
//
// 未登录时展示登录引导，复用外壳层的登录弹窗（useShell().openAuth）。
// 说明：隐私政策 / 用户协议**正文**为测试版占位文案，正式文本待法务确认后替换，
//       不阻塞本页的「同意留痕 / 导出 / 注销」流程闭环。
// ============================================================

import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle, ArrowLeft, Check, ChevronDown, Download, FileText,
  Loader2, LogIn, ShieldCheck, Trash2, X,
} from 'lucide-react'
import { userApi } from '../lib/user-api'
import { useShell } from '../lib/shell'

type ConsentType = 'privacy_policy' | 'user_agreement'

interface ConsentRecord {
  id: number
  type: string
  version: string
  agreed: boolean
  createdAt: string
}

const CONSENT_LABEL: Record<ConsentType, string> = {
  privacy_policy: '隐私政策',
  user_agreement: '用户协议',
}

const CONSENT_ORDER: ConsentType[] = ['privacy_policy', 'user_agreement']

/** 正文（测试版占位，正式文本待法务确认后替换） */
const CONSENT_BODY: Record<ConsentType, string[]> = {
  privacy_policy: [
    '一、我们收集哪些信息',
    '为完成八字排盘与命理推演，我们会收集你主动填写的出生信息（出生日期、时辰、性别）以及账号信息（账号、昵称、可选手机号/邮箱）。',
    '二、我们如何使用信息',
    '出生信息仅用于生成你的命盘与推送相关推演结果；我们不会将其用于本产品之外的其他用途，也不会向第三方出售。',
    '三、AI 服务的说明',
    '排盘与批注由本地规则引擎计算，AI 仅用于将结论组织为自然语言表达，不参与命理计算，也不会凭空断言。',
    '四、你的权利',
    '你可以随时在本页导出你的全部数据，或注销账号并删除个人信息。删除后不可恢复。',
    '（测试版本 · 正式文本待更新）',
  ],
  user_agreement: [
    '一、服务内容',
    '本产品提供八字排盘、命理批注与 AI 对话解读等数字命理推演服务。内容仅供参考与自我认知，不构成任何决策建议。',
    '二、使用规范',
    '请勿利用本服务从事违法、侵权或骚扰他人的行为；账号及密码由你自行保管。',
    '三、免责声明',
    '命理推演结果不构成医疗、法律、投资等专业意见，请勿据此做出重大决策。',
    '四、协议变更',
    '我们可能不时更新本协议，更新后会在本页展示并以弹窗方式重新征求你的同意。',
    '（测试版本 · 正式文本待更新）',
  ],
}

interface ExportPayload {
  exportedAt: string
  notice: string
  [key: string]: unknown
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

export default function DataPage() {
  const navigate = useNavigate()
  const { user, verifying, openAuth, logout } = useShell()

  const [records, setRecords] = useState<ConsentRecord[]>([])
  const [loadingConsent, setLoadingConsent] = useState(false)
  const [expanded, setExpanded] = useState<ConsentType | null>(null)
  const [agreeing, setAgreeing] = useState<ConsentType | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deletePassword, setDeletePassword] = useState('')
  const [deleteText, setDeleteText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const loadConsent = useCallback(async () => {
    setLoadingConsent(true)
    const res = await userApi.get<{ types: string[]; records: ConsentRecord[] }>(
      '/api/v1/app/user/consent',
    )
    if (res.success && res.data) setRecords(res.data.records ?? [])
    setLoadingConsent(false)
  }, [])

  useEffect(() => {
    if (user) void loadConsent()
  }, [user, loadConsent])

  /** 某类型最新一条同意记录（用于展示状态） */
  const latestOf = (type: ConsentType): ConsentRecord | null => {
    const list = records.filter(r => r.type === type)
    if (list.length === 0) return null
    return list.reduce((a, b) => (a.id > b.id ? a : b))
  }

  async function agree(type: ConsentType) {
    setAgreeing(type)
    setNotice(null)
    const res = await userApi.post('/api/v1/app/user/consent', { type, agreed: true })
    setAgreeing(null)
    if (!res.success) {
      setNotice(res.error?.message ?? '操作失败，请稍后重试')
      return
    }
    setNotice(`已记录你对《${CONSENT_LABEL[type]}》的同意`)
    void loadConsent()
  }

  async function doExport() {
    setExporting(true)
    setExportError(null)
    const res = await userApi.get<ExportPayload>('/api/v1/app/user/data/export')
    setExporting(false)
    if (!res.success || !res.data) {
      setExportError(res.error?.message ?? '导出失败，请稍后重试')
      return
    }
    try {
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const stamp = new Date().toISOString().slice(0, 10)
      a.href = url
      a.download = `mingli-data-export-${stamp}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch {
      setExportError('生成导出文件失败，请稍后重试')
    }
  }

  async function doDelete() {
    setDeleting(true)
    setDeleteError(null)
    const res = await userApi.del<{ deleted: boolean; message: string }>(
      '/api/v1/app/user/data',
      { confirm: 'DELETE', password: deletePassword },
    )
    setDeleting(false)
    if (!res.success) {
      setDeleteError(res.error?.message ?? '注销失败，请稍后重试')
      return
    }
    setDeleteOpen(false)
    await logout()
    navigate('/')
  }

  // ── 未登录：引导 ──
  if (!verifying && !user) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 px-6 text-center">
        <ShieldCheck size={40} className="text-brand" aria-hidden="true" />
        <div>
          <p className="text-sm font-bold text-fg-primary tracking-wide mb-1">账户与数据</p>
          <p className="text-xs text-fg-secondary">登录后可查看隐私政策、导出你的数据或注销账号</p>
        </div>
        <button
          type="button"
          onClick={() => openAuth('login')}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-sm bg-brand hover:bg-brand-strong text-white text-sm font-bold tracking-[0.08em] transition-colors"
        >
          <LogIn size={14} aria-hidden="true" />
          去登录
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4 pb-4">
      {/* ── 头部 ── */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate('/my')}
          aria-label="返回"
          className="p-1.5 -ml-1.5 rounded-sm text-fg-secondary hover:text-fg-primary hover:bg-surface-muted transition-colors"
        >
          <ArrowLeft size={18} aria-hidden="true" />
        </button>
        <div>
          <h1 className="text-base font-bold text-fg-primary tracking-wide">账户与数据</h1>
          <p className="text-[11px] text-fg-tertiary">隐私政策 · 数据导出 · 注销账号</p>
        </div>
      </div>

      {notice && (
        <p className="text-xs text-semantic-positive bg-semantic-positive/10 border border-semantic-positive/30 rounded-sm px-3 py-2">
          {notice}
        </p>
      )}

      {/* ── 一、协议与同意 ── */}
      <section className="rounded-md border border-line-soft bg-white p-5">
        <div className="flex items-center gap-2 mb-3">
          <FileText size={15} className="text-brand" aria-hidden="true" />
          <span className="text-sm font-bold text-fg-primary tracking-wide">协议与同意</span>
          {loadingConsent && <Loader2 size={13} className="animate-spin text-fg-tertiary" aria-hidden="true" />}
        </div>

        <div className="space-y-3">
          {CONSENT_ORDER.map(type => {
            const rec = latestOf(type)
            const agreed = !!rec?.agreed
            const isOpen = expanded === type
            return (
              <div key={type} className="rounded-sm border border-line-soft">
                <div className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <button
                    type="button"
                    onClick={() => setExpanded(isOpen ? null : type)}
                    className="flex items-center gap-1.5 text-sm text-fg-primary hover:text-brand transition-colors"
                  >
                    <span>{CONSENT_LABEL[type]}</span>
                    <ChevronDown
                      size={14}
                      className={`text-fg-tertiary transition-transform ${isOpen ? 'rotate-180' : ''}`}
                      aria-hidden="true"
                    />
                  </button>
                  <span
                    className={`shrink-0 px-1.5 py-0.5 rounded-sm text-[10px] ${
                      agreed
                        ? 'text-semantic-positive bg-semantic-positive/10'
                        : 'text-fg-tertiary bg-surface-sunken'
                    }`}
                  >
                    {agreed ? `已同意 ${rec?.version ?? ''}` : '尚未同意'}
                  </span>
                </div>

                {isOpen && (
                  <div className="px-3 pb-3 border-t border-line-soft">
                    <div className="pt-3 space-y-2">
                      {CONSENT_BODY[type].map((line, i) => (
                        <p key={i} className="text-xs text-fg-secondary leading-relaxed">{line}</p>
                      ))}
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <span className="text-[11px] text-fg-tertiary tabular-nums">
                        {rec ? `上次同意：${fmtDateTime(rec.createdAt)}` : '尚未表示同意'}
                      </span>
                      <button
                        type="button"
                        onClick={() => void agree(type)}
                        disabled={agreeing === type}
                        className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm bg-brand hover:bg-brand-strong disabled:opacity-60 text-white text-xs font-medium transition-colors"
                      >
                        {agreeing === type
                          ? <Loader2 size={12} className="animate-spin" aria-hidden="true" />
                          : <Check size={12} aria-hidden="true" />}
                        {agreed ? '重新确认同意' : '我已阅读并同意'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {/* ── 二、数据导出 ── */}
      <section className="rounded-md border border-line-soft bg-white p-5">
        <div className="flex items-center gap-2 mb-2">
          <Download size={15} className="text-brand" aria-hidden="true" />
          <span className="text-sm font-bold text-fg-primary tracking-wide">导出我的数据</span>
        </div>
        <p className="text-xs text-fg-secondary leading-relaxed mb-3">
          将你的账户、生辰档案、历史命盘、订单、额度流水与同意记录导出为一份 JSON 文件。
          文件含个人信息（含生辰），请妥善保管。
        </p>
        {exportError && (
          <p className="text-xs text-brand-strong bg-[#F5EDEB] border border-[#D4A8A4] rounded-sm px-3 py-2 mb-3">
            {exportError}
          </p>
        )}
        <button
          type="button"
          onClick={() => void doExport()}
          disabled={exporting}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-sm border border-line-strong bg-white hover:bg-surface-muted disabled:opacity-60 text-sm text-fg-primary font-medium transition-colors"
        >
          {exporting
            ? <Loader2 size={14} className="animate-spin" aria-hidden="true" />
            : <Download size={14} aria-hidden="true" />}
          {exporting ? '正在导出…' : '下载数据文件'}
        </button>
      </section>

      {/* ── 三、注销账号（危险操作）── */}
      <section className="rounded-md border border-[#D4A8A4] bg-white p-5">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle size={15} className="text-brand-strong" aria-hidden="true" />
          <span className="text-sm font-bold text-brand-strong tracking-wide">注销账号</span>
        </div>
        <p className="text-xs text-fg-secondary leading-relaxed mb-3">
          注销后将<strong className="text-brand-strong">永久删除</strong>你的生辰档案与历史命盘，
          登录会话立即失效，<strong className="text-brand-strong">该操作不可恢复</strong>。
          埋点数据会被匿名化保留用于统计。
        </p>
        <button
          type="button"
          onClick={() => { setDeleteOpen(true); setDeleteError(null); setDeletePassword(''); setDeleteText('') }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-sm border border-[#D4A8A4] text-brand-strong hover:bg-[#F5EDEB] text-sm font-medium transition-colors"
        >
          <Trash2 size={14} aria-hidden="true" />
          注销账号
        </button>
      </section>

      {/* ── 注销二次确认弹窗 ── */}
      {deleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-fg-primary/40 backdrop-blur-[2px]"
            onClick={() => { if (!deleting) setDeleteOpen(false) }}
          />
          <div className="relative w-full max-w-md bg-[#FDFBF7] border border-line-strong rounded-sm shadow-[0_12px_40px_rgba(28,25,20,0.18)]">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#E8E2D8]">
              <div className="flex items-center gap-2">
                <AlertTriangle size={15} className="text-brand-strong" />
                <span className="text-sm font-bold tracking-[0.08em] text-brand-strong">确认注销账号</span>
              </div>
              <button
                type="button"
                onClick={() => { if (!deleting) setDeleteOpen(false) }}
                className="text-fg-tertiary hover:text-fg-primary transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="px-5 py-4 space-y-3">
              <p className="text-xs text-fg-secondary leading-relaxed">
                此操作将删除你的全部个人数据且<strong className="text-brand-strong">不可恢复</strong>。
                请输入登录密码，并输入 <span className="font-mono font-bold text-brand-strong">DELETE</span> 以确认。
              </p>

              <div>
                <label className="block text-[11px] text-fg-secondary mb-1 tracking-wide">登录密码</label>
                <input
                  type="password"
                  value={deletePassword}
                  onChange={e => setDeletePassword(e.target.value)}
                  autoComplete="current-password"
                  placeholder="••••••"
                  className={inputCls}
                />
              </div>

              <div>
                <label className="block text-[11px] text-fg-secondary mb-1 tracking-wide">
                  输入 DELETE 确认
                </label>
                <input
                  value={deleteText}
                  onChange={e => setDeleteText(e.target.value)}
                  placeholder="DELETE"
                  className={`${inputCls} font-mono`}
                />
              </div>

              {deleteError && (
                <p className="text-xs text-brand-strong bg-[#F5EDEB] border border-[#D4A8A4] rounded-sm px-3 py-2">
                  {deleteError}
                </p>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setDeleteOpen(false)}
                  disabled={deleting}
                  className="flex-1 py-2.5 rounded-sm border border-line-strong bg-white hover:bg-surface-muted disabled:opacity-60 text-sm text-fg-secondary font-medium transition-colors"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={() => void doDelete()}
                  disabled={deleting || deleteText !== 'DELETE' || deletePassword.length === 0}
                  className="flex-1 py-2.5 rounded-sm bg-brand-strong hover:opacity-90 disabled:opacity-50 text-white text-sm font-bold tracking-[0.08em] transition-colors flex items-center justify-center gap-2"
                >
                  {deleting && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
                  确认注销
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const inputCls =
  'w-full px-3 py-2 rounded-sm border border-line-strong bg-white text-sm text-fg-primary ' +
  'placeholder:text-fg-tertiary focus:outline-none focus:border-brand transition-colors'
