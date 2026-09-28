// ============================================================
// Phase 4b M-6 — C 端登录 / 注册弹窗
// 文件：src/components/AuthDialog.tsx
// ============================================================

import { useState } from 'react'
import { X, Loader2, UserPlus, LogIn } from 'lucide-react'

interface AuthDialogProps {
  open: boolean
  mode: 'login' | 'register'
  onClose: () => void
  onModeChange: (mode: 'login' | 'register') => void
  onLogin: (account: string, password: string) => Promise<unknown>
  onRegister: (input: {
    username: string
    password: string
    nickname?: string
    phone?: string
    email?: string
    /** [ADR-013] 推介邀请码（选填） */
    referralCode?: string
  }) => Promise<unknown>
}

export default function AuthDialog({
  open, mode, onClose, onModeChange, onLogin, onRegister,
}: AuthDialogProps) {
  const [account, setAccount] = useState('')
  const [username, setUsername] = useState('')
  const [nickname, setNickname] = useState('')
  const [phone, setPhone] = useState('')
  const [referralCode, setReferralCode] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (!open) return null

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      if (mode === 'login') {
        await onLogin(account.trim(), password)
      } else {
        await onRegister({
          username: username.trim(),
          password,
          nickname: nickname.trim() || undefined,
          phone: phone.trim() || undefined,
          referralCode: referralCode.trim() || undefined,
        })
      }
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* 遮罩 */}
      <div
        className="absolute inset-0 bg-fg-primary/40 backdrop-blur-[2px]"
        onClick={onClose}
      />

      <div className="relative w-full max-w-sm bg-[#FDFBF7] border border-line-strong rounded-sm shadow-[0_12px_40px_rgba(28,25,20,0.18)]">
        {/* 头部 */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#E8E2D8]">
          <div className="flex items-center gap-2">
            {mode === 'login'
              ? <LogIn size={15} className="text-brand" />
              : <UserPlus size={15} className="text-brand" />}
            <span className="text-sm font-bold tracking-[0.08em] text-fg-primary">
              {mode === 'login' ? '登录' : '注册账号'}
            </span>
          </div>
          <button onClick={onClose} className="text-fg-tertiary hover:text-fg-primary transition-colors">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={submit} className="px-5 py-4 space-y-3">
          {mode === 'login' ? (
            <Field label="账号 / 手机号 / 邮箱">
              <input
                value={account}
                onChange={e => setAccount(e.target.value)}
                required
                autoComplete="username"
                placeholder="请输入登录账号"
                className={inputCls}
              />
            </Field>
          ) : (
            <>
              <Field label="账号（3-32 位字母数字下划线）">
                <input
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  required
                  autoComplete="username"
                  placeholder="如 mingli_2026"
                  className={inputCls}
                />
              </Field>
              <Field label="昵称（选填）">
                <input
                  value={nickname}
                  onChange={e => setNickname(e.target.value)}
                  placeholder="展示用昵称"
                  className={inputCls}
                />
              </Field>
              <Field label="手机号（选填）">
                <input
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="可用于登录"
                  className={inputCls}
                />
              </Field>
              <Field label="邀请码（选填）">
                <input
                  value={referralCode}
                  onChange={e => setReferralCode(e.target.value)}
                  placeholder="有好友邀请可填"
                  className={inputCls}
                />
              </Field>
            </>
          )}

          {/* 密码长度下限只属于「注册」规则；登录仅校验非空，
              否则任何早于当前密码策略的账号都无法在 UI 中登录 */}
          <Field label={mode === 'register' ? '密码（至少 6 位）' : '密码'}>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={mode === 'register' ? 6 : undefined}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              placeholder="••••••"
              className={inputCls}
            />
          </Field>

          {error && (
            <p className="text-xs text-brand-strong bg-[#F5EDEB] border border-[#D4A8A4] rounded-sm px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full py-2.5 rounded-sm bg-brand hover:bg-brand-strong disabled:opacity-60 text-white text-sm font-bold tracking-[0.08em] transition-colors flex items-center justify-center gap-2"
          >
            {busy && <Loader2 size={14} className="animate-spin" />}
            {mode === 'login' ? '登录' : '注册并登录'}
          </button>

          <p className="text-center text-xs text-[#8A8172]">
            {mode === 'login' ? '还没有账号？' : '已有账号？'}
            <button
              type="button"
              onClick={() => { setError(null); onModeChange(mode === 'login' ? 'register' : 'login') }}
              className="ml-1 text-brand hover:underline font-medium"
            >
              {mode === 'login' ? '立即注册' : '去登录'}
            </button>
          </p>
        </form>
      </div>
    </div>
  )
}

const inputCls =
  'w-full px-3 py-2 rounded-sm border border-line-strong bg-white text-sm text-fg-primary ' +
  'placeholder:text-fg-tertiary focus:outline-none focus:border-brand transition-colors'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] text-fg-secondary mb-1 tracking-wide">{label}</label>
      {children}
    </div>
  )
}
