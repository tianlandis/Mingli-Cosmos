import type { ReactNode } from 'react'

type Page = 'config' | 'prompts' | 'audit'

const NAV: { key: Page; label: string; icon: string }[] = [
  { key: 'config', label: '系统配置', icon: '⚙️' },
  { key: 'prompts', label: 'Prompt 模板', icon: '📝' },
  { key: 'audit', label: '操作日志', icon: '📋' },
]

export default function Layout({
  page, onNavigate, onLogout, children,
}: {
  page: Page
  onNavigate: (p: Page) => void
  onLogout: () => void
  children: ReactNode
}) {
  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-56 bg-slate-800 text-white flex flex-col">
        <div className="p-4 border-b border-slate-700">
          <h1 className="text-lg font-bold">墨白 管理后台</h1>
          <p className="text-xs text-slate-400 mt-1">v4.0.0+ Phase 4</p>
        </div>
        <nav className="flex-1 py-2">
          {NAV.map((item) => (
            <button
              key={item.key}
              onClick={() => onNavigate(item.key)}
              className={`w-full text-left px-4 py-2.5 flex items-center gap-2 transition-colors ${
                page === item.key
                  ? 'bg-amber-600 text-white'
                  : 'text-slate-300 hover:bg-slate-700 hover:text-white'
              }`}
            >
              <span>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-700">
          <button
            onClick={onLogout}
            className="w-full text-left text-slate-400 hover:text-white transition-colors text-sm"
          >
            ← 退出登录
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-6 overflow-auto">
        {children}
      </main>
    </div>
  )
}
