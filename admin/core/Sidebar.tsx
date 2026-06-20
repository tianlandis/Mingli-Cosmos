// ============================================================
// Phase 4 — 侧边栏组件（玄青 · 朱砂 · 新中式暗色质感）
// 文件：admin/core/Sidebar.tsx
// ============================================================

import { menuGroups, type PageKey } from './menu.config'
import { cn } from '@/lib/utils'
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip'
import { ChevronRight, LogOut } from 'lucide-react'

export interface SidebarProps {
  activePage: PageKey
  onNavigate: (page: PageKey) => void
  onLogout: () => void
}

export default function Sidebar({ activePage, onNavigate, onLogout }: SidebarProps) {
  return (
    <aside
      className={cn(
        'w-60 h-screen flex flex-col shrink-0 select-none',
        'bg-[#1A2332] text-[#D8D2C8]',
        'border-r border-white/[0.06]',
      )}
    >
      {/* ═══ Logo / 品牌区 ═══ */}
      <div className="px-5 py-5 border-b border-white/[0.06]">
        <div className="flex items-center gap-2.5">
          {/* 朱砂印章 */}
          <div
            className={cn(
              'size-8 flex items-center justify-center',
              'border-2 border-[#C04030] rounded-sm',
              'font-serif font-bold text-[#C04030] text-xs',
              '-rotate-3 shadow-[0_0_12px_rgba(192,64,48,0.15)]',
            )}
          >
            墨
          </div>
          <div>
            <h1 className="text-base font-semibold text-[#EDE8DF] tracking-[0.06em]">
              墨白
            </h1>
            <p className="text-[10px] text-[#7B7366] mt-0.5 tracking-[0.04em]">
              管理后台 · v4.0
            </p>
          </div>
        </div>
      </div>

      {/* ═══ 导航区 ═══ */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
        {menuGroups.map((group) => (
          <div key={group.label} className="flex flex-col">
            {/* 分组标头 */}
            <p className="px-3 mb-1.5 text-[10px] font-medium text-[#6B6459] uppercase tracking-[0.1em]">
              {group.label}
            </p>

            {/* 导航项 — 使用 flex flex-col 替代 ul/li */}
            <div className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const isActive = activePage === item.key
                const isDisabled = item.disabled ?? false

                const link = (
                  <button
                    key={item.key}
                    onClick={() => {
                      if (!isDisabled) onNavigate(item.key)
                    }}
                    disabled={isDisabled}
                    className={cn(
                      'flex items-center gap-2.5 px-3 py-2 rounded-lg w-full',
                      'text-sm transition-all duration-150',
                      'text-left outline-none',
                      // 激活态 - 朱砂色背景
                      isActive && [
                        'bg-[#C04030]/15 text-[#E8A090]',
                        'border border-[#C04030]/25',
                        'shadow-[0_0_12px_rgba(192,64,48,0.1)]',
                      ],
                      // 禁用态 - 低对比度
                      isDisabled && [
                        'text-[#4A4540] cursor-not-allowed',
                        'opacity-40',
                      ],
                      // 常态 hover
                      !isActive && !isDisabled && [
                        'text-[#A09888]',
                        'hover:bg-white/[0.04] hover:text-[#D8D2C8]',
                      ],
                    )}
                  >
                    <item.icon className="size-4 shrink-0" />
                    <span className="flex-1 truncate">{item.label}</span>

                    {/* Badge */}
                    {item.badge && (
                      <span
                        className={cn(
                          'px-1.5 py-0.5 rounded text-[9px] font-medium',
                          'bg-[#C04030]/15 text-[#C06050] border border-[#C04030]/20',
                        )}
                      >
                        {item.badge}
                      </span>
                    )}

                    {/* 激活箭头 */}
                    {isActive && (
                      <ChevronRight className="size-3 shrink-0 text-[#C04030]" />
                    )}
                  </button>
                )

                // 禁用项用 Tooltip 包裹
                if (isDisabled) {
                  return (
                    <div key={item.key}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="block">{link}</span>
                        </TooltipTrigger>
                        <TooltipContent
                          side="right"
                          className={cn(
                            'bg-[#222839] text-[#D8D2C8]',
                            'border border-white/[0.08]',
                            'shadow-xl shadow-black/40 rounded-lg',
                          )}
                        >
                          {item.disabledHint}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  )
                }

                return <div key={item.key}>{link}</div>
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* ═══ 底部：用户区 ═══ */}
      <div className="px-4 py-3.5 border-t border-white/[0.06]">
        <button
          onClick={onLogout}
          className={cn(
            'w-full text-left text-xs text-[#6B6459]',
            'hover:text-[#D06050] transition-colors duration-150',
            'flex items-center gap-2',
          )}
        >
          <LogOut className="size-3" />
          退出登录
        </button>
      </div>
    </aside>
  )
}
