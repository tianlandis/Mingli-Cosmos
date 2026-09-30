// ============================================================
// 后台：账户与安全（修改管理员密码 + 活跃会话管理）
// 文件：admin/modules/account/AccountPage.tsx
//
// 解决：后端早已提供「改密码 / 会话列表 / 强制下线」三个接口
//   （见 src/server/modules/auth/index.ts），但后台没有任何 UI 入口 ——
//   管理员只能用命令行改密码，也看不到「谁正在登录后台」。
//   本页把这两块补齐（与「会员等级」同类问题：有接口、缺前端）。
//
// 接口：
//   PUT  /api/v1/admin/auth/password          { oldPassword, newPassword }
//   GET  /api/v1/admin/auth/sessions
//   POST /api/v1/admin/auth/sessions/revoke   { sessionId }
// 请求统一走 admin/lib/api.ts（带全局 401 拦截）。
// ============================================================

import { useState, useEffect, useCallback } from 'react'
import {
  KeyRound,
  Loader2,
  Save,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  ShieldOff,
  MonitorSmartphone,
  Eye,
  EyeOff,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table'
import { api } from '../../lib/api'
import { cn } from '@/lib/utils'

interface AdminSession {
  id: number
  tokenJti: string
  username: string
  ip: string | null
  userAgent: string | null
  isActive: number
  expiresAt: string
  createdAt: string
  logoutAt: string | null
}

/** 把 UA 压成一句人话，太长就截断（表格空间有限） */
function shortenUA(ua: string | null): string {
  if (!ua) return '未知设备'
  const browser =
    /Edg\//.test(ua) ? 'Edge'
    : /Chrome\//.test(ua) ? 'Chrome'
    : /Firefox\//.test(ua) ? 'Firefox'
    : /Safari\//.test(ua) ? 'Safari'
    : '浏览器'
  const os =
    /Windows/.test(ua) ? 'Windows'
    : /Mac OS/.test(ua) ? 'macOS'
    : /Android/.test(ua) ? 'Android'
    : /iPhone|iPad/.test(ua) ? 'iOS'
    : /Linux/.test(ua) ? 'Linux'
    : ''
  const head = os ? `${browser} · ${os}` : browser
  return ua.length > 60 ? `${head}…` : head
}

export default function AccountPage({ onLogout }: { onLogout: () => void }) {
  // ── 表单状态 ──
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [saving, setSaving] = useState(false)
  const [pwdError, setPwdError] = useState('')
  const [pwdStatus, setPwdStatus] = useState('')

  // ── 会话状态 ──
  const [sessions, setSessions] = useState<AdminSession[]>([])
  const [loadingSessions, setLoadingSessions] = useState(true)
  const [revoking, setRevoking] = useState<number | null>(null)
  const [sessError, setSessError] = useState('')

  const loadSessions = useCallback(async () => {
    setLoadingSessions(true)
    setSessError('')
    const res = await api.get<AdminSession[]>('/api/v1/admin/auth/sessions')
    if (!res.success || !res.data) {
      setSessError(res.error?.message ?? '加载会话失败')
      setSessions([])
    } else {
      setSessions(res.data)
    }
    setLoadingSessions(false)
  }, [])

  useEffect(() => { loadSessions() }, [loadSessions])

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPwdError('')
    setPwdStatus('')

    if (newPassword.length < 6) {
      setPwdError('新密码至少 6 位')
      return
    }
    if (newPassword !== confirmPassword) {
      setPwdError('两次输入的新密码不一致')
      return
    }
    if (newPassword === oldPassword) {
      setPwdError('新密码不能与旧密码相同')
      return
    }

    setSaving(true)
    const res = await api.put<{ message: string }>('/api/v1/admin/auth/password', {
      oldPassword,
      newPassword,
    })
    setSaving(false)

    if (!res.success) {
      setPwdError(res.error?.message ?? '修改失败')
      return
    }

    setOldPassword(''); setNewPassword(''); setConfirmPassword('')
    setPwdStatus('密码已修改，所有设备已强制下线。即将返回登录页…')
    // 后端会吊销所有会话（含当前），需重新登录
    setTimeout(() => onLogout(), 2200)
  }

  const handleRevoke = async (s: AdminSession) => {
    setRevoking(s.id)
    setSessError('')
    const res = await api.post<{ message: string; isSelfRevoke?: boolean }>(
      '/api/v1/admin/auth/sessions/revoke',
      { sessionId: s.id },
    )
    setRevoking(null)
    if (!res.success) {
      setSessError(res.error?.message ?? '强制下线失败')
      return
    }
    if (res.data?.isSelfRevoke) {
      // 把自己踢了 → 直接回登录页
      onLogout()
      return
    }
    await loadSessions()
  }

  return (
    <div className="space-y-5 max-w-4xl">
      {/* ═══ 修改管理员密码 ═══ */}
      <Card className="bg-[#1A1F2E] border-white/[0.06]">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="size-7 flex items-center justify-center rounded-lg bg-[#B8964A]/8 border border-[#B8964A]/15 shrink-0">
              <KeyRound size={12} className="text-[#B8964A]" />
            </div>
            <div>
              <CardTitle className="text-sm text-[#EDE8DF] tracking-[0.04em]">修改管理员密码</CardTitle>
              <CardDescription className="text-[11px] text-[#6B6459] mt-0.5">
                修改成功后，所有已登录设备将被强制下线，需用新密码重新登录
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pb-4">
          <form onSubmit={handleChangePassword} className="space-y-3 max-w-md">
            <div className="space-y-1.5">
              <Label className="text-[12px] text-[#A09888]">当前密码</Label>
              <Input
                type={showPwd ? 'text' : 'password'}
                autoComplete="current-password"
                value={oldPassword}
                onChange={e => { setOldPassword(e.target.value); setPwdError('') }}
                className="bg-[#0A1118] border-white/[0.08] text-[#EDE8DF]"
                placeholder="输入当前密码"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[12px] text-[#A09888]">新密码</Label>
              <Input
                type={showPwd ? 'text' : 'password'}
                autoComplete="new-password"
                value={newPassword}
                onChange={e => { setNewPassword(e.target.value); setPwdError('') }}
                className="bg-[#0A1118] border-white/[0.08] text-[#EDE8DF]"
                placeholder="至少 6 位"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[12px] text-[#A09888]">确认新密码</Label>
              <Input
                type={showPwd ? 'text' : 'password'}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={e => { setConfirmPassword(e.target.value); setPwdError('') }}
                className="bg-[#0A1118] border-white/[0.08] text-[#EDE8DF]"
                placeholder="再次输入新密码"
              />
            </div>

            <label className="flex items-center gap-2 text-[12px] text-[#6B6459] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showPwd}
                onChange={e => setShowPwd(e.target.checked)}
                className="accent-[#B8964A]"
              />
              {showPwd ? <Eye size={12} /> : <EyeOff size={12} />}
              显示密码
            </label>

            {pwdError && (
              <div className="flex items-start gap-2 px-3 py-2 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                <span>{pwdError}</span>
              </div>
            )}
            {pwdStatus && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">
                <CheckCircle2 size={14} className="shrink-0" />
                <span>{pwdStatus}</span>
              </div>
            )}

            <Button
              type="submit"
              disabled={saving || !oldPassword || !newPassword || !confirmPassword}
              className={cn(
                'px-4 py-2 text-sm font-medium rounded-lg border transition-colors',
                (!saving && oldPassword && newPassword && confirmPassword)
                  ? 'bg-[#C04030] hover:bg-[#A03024] text-[#EDE8DF] border-transparent'
                  : 'bg-transparent text-[#4A4540] border-white/[0.06] cursor-not-allowed',
              )}
            >
              {saving
                ? <Loader2 size={13} className="mr-1.5 animate-spin" />
                : <Save size={13} className="mr-1.5" />}
              修改密码
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* ═══ 活跃会话 ═══ */}
      <Card className="bg-[#1A1F2E] border-white/[0.06]">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="size-7 flex items-center justify-center rounded-lg bg-[#4D6BFE]/8 border border-[#4D6BFE]/15 shrink-0">
                <MonitorSmartphone size={12} className="text-[#7B90FF]" />
              </div>
              <div>
                <CardTitle className="text-sm text-[#EDE8DF] tracking-[0.04em]">活跃会话</CardTitle>
                <CardDescription className="text-[11px] text-[#6B6459] mt-0.5">
                  正在登录后台的设备；可疑会话可一键强制下线
                </CardDescription>
              </div>
            </div>
            <Button
              onClick={loadSessions}
              disabled={loadingSessions}
              className="px-3 py-1.5 text-xs rounded-lg border border-white/[0.08] bg-transparent text-[#A09888] hover:text-[#D8D2C8] hover:bg-white/[0.04]"
            >
              <RefreshCw size={12} className={cn('mr-1.5', loadingSessions && 'animate-spin')} />
              刷新
            </Button>
          </div>
        </CardHeader>

        <CardContent className="pb-4">
          {sessError && (
            <div className="flex items-start gap-2 px-3 py-2 mb-3 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <span>{sessError}</span>
            </div>
          )}

          {loadingSessions ? (
            <div className="flex items-center justify-center gap-2 py-8 text-[#6B6459] text-sm">
              <Loader2 size={14} className="animate-spin" />
              正在读取会话…
            </div>
          ) : sessions.length === 0 ? (
            <div className="py-8 text-center text-[#6B6459] text-sm">暂无活跃会话</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/[0.06] hover:bg-transparent">
                    <TableHead className="text-[#6B6459] text-xs">用户</TableHead>
                    <TableHead className="text-[#6B6459] text-xs">IP</TableHead>
                    <TableHead className="text-[#6B6459] text-xs">设备</TableHead>
                    <TableHead className="text-[#6B6459] text-xs">登录时间</TableHead>
                    <TableHead className="text-[#6B6459] text-xs">到期</TableHead>
                    <TableHead className="text-[#6B6459] text-xs text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessions.map(s => (
                    <TableRow key={s.id} className="border-white/[0.04]">
                      <TableCell className="text-[#D8D2C8] text-[13px]">{s.username}</TableCell>
                      <TableCell className="text-[#A09888] text-[12px] font-mono">{s.ip ?? '—'}</TableCell>
                      <TableCell className="text-[#A09888] text-[12px]">{shortenUA(s.userAgent)}</TableCell>
                      <TableCell className="text-[#6B6459] text-[12px] font-mono">{s.createdAt ?? '—'}</TableCell>
                      <TableCell className="text-[#6B6459] text-[12px] font-mono">{s.expiresAt ?? '—'}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          onClick={() => handleRevoke(s)}
                          disabled={revoking === s.id}
                          className="px-2.5 py-1 text-xs rounded-md border border-red-500/20 bg-red-500/5 text-red-400 hover:bg-red-500/12 transition-colors"
                        >
                          {revoking === s.id
                            ? <Loader2 size={11} className="mr-1 animate-spin" />
                            : <ShieldOff size={11} className="mr-1" />}
                          强制下线
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <p className="text-[11px] text-[#4A4540] mt-3 leading-relaxed">
            提示：管理员会话有效期 24 小时。修改密码会自动吊销全部会话；此处仅针对单条会话操作。
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
