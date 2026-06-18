import { useState } from 'react'

export default function Login({ onLogin }: { onLogin: (u: string, p: string) => Promise<void> }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await onLogin(username, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0A1118] p-4">
      {/* Decorative gradient orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#C04030]/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-[#B8964A]/5 rounded-full blur-3xl pointer-events-none" />

      <div className="relative animate-ink-spread">
        {/* 朱砂印章 */}
        <div className="flex justify-center mb-8">
          <div className="size-14 flex items-center justify-center border-3 border-[#C04030] rounded-sm font-serif font-bold text-[#C04030] text-lg -rotate-3 shadow-[0_0_20px_rgba(192,64,48,0.15)]">
            墨
          </div>
        </div>

        {/* Card */}
        <div className="bg-[#1A1F2E] border border-white/[0.06] rounded-xl shadow-2xl shadow-black/50 w-96 max-w-full p-8">
          <h1 className="text-xl font-semibold text-center mb-1 text-[#EDE8DF] tracking-[0.06em]">
            墨白
          </h1>
          <p className="text-xs text-center text-[#6B6459] mb-8 tracking-[0.05em]">
            管理后台 · v4.0
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Username */}
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-[#A09888] tracking-[0.04em]">
                用户名
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-2.5 bg-[#1A2332] border border-white/[0.08] rounded-lg text-sm text-[#EDE8DF] placeholder:text-[#4A4540] focus:outline-none focus:border-[#B8964A]/60 focus:ring-1 focus:ring-[#B8964A]/20 transition-colors"
                placeholder="admin"
                autoFocus
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-[#A09888] tracking-[0.04em]">
                密码
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 bg-[#1A2332] border border-white/[0.08] rounded-lg text-sm text-[#EDE8DF] placeholder:text-[#4A4540] focus:outline-none focus:border-[#B8964A]/60 focus:ring-1 focus:ring-[#B8964A]/20 transition-colors"
                placeholder="••••••••"
              />
            </div>

            {/* Error */}
            {error && (
              <div className="px-3 py-2 rounded-md bg-[#C04030]/10 border border-[#C04030]/20">
                <p className="text-[#D06050] text-xs text-center">{error}</p>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-[#C04030] hover:bg-[#A03024] disabled:opacity-50 disabled:cursor-not-allowed text-[#EDE8DF] text-sm font-medium rounded-lg transition-colors duration-200 tracking-[0.04em]"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin size-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  登录中...
                </span>
              ) : '登录'}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-[10px] text-[#4A4540] mt-6 tracking-[0.05em]">
          墨白命理堂 · 玄青朱砂 · 新中式现代工具
        </p>
      </div>
    </div>
  )
}
