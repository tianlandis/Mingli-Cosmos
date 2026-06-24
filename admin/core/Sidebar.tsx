// ============================================================
// Phase 4 — 侧边栏组件 v2（可折叠 · 用户信息 · 快捷键 · shadcn 集成）
// 文件：admin/core/Sidebar.tsx
// ============================================================

import { NavLink } from 'react-router-dom'
import { menuGroups } from './menu.config'
import { cn } from '@/lib/utils'
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import {
  ChevronRight,
  LogOut,
  ChevronLeft,
  ChevronsLeftRight,
  User,
} from 'lucide-react'

interface SidebarProps {
  onLogout: () => void
  collapsed: boolean
  onToggleCollapse: () => void
}

const activeClass = [
  'bg-[#C04030]/15 text-[#E8A090]',
  'border border-[#C04030]/25',
  'shadow-[0_0_12px_rgba(192,64,48,0.1)]',
]

const normalClass = [
  'text-[#A09888]',
  'hover:bg-white/[0.04] hover:text-[#D8D2C8]',
]

const disabledClass = [
  'text-[#4A4540] cursor-not-allowed',
  'opacity-40',
]

export default function Sidebar({ onLogout, collapsed, onToggleCollapse }: SidebarProps) {
  return (
    <aside
      className={cn(
        'h-screen flex flex-col shrink-0 select-none',
        'bg-[#1A2332] text-[#D8D2C8]',
        'border-r border-white/[0.06]',
        'transition-all duration-300 ease-in-out',
        collapsed ? 'w-[68px]' : 'w-60',
      )}
    >
      {/* ═══ Logo / 品牌区 ═══ */}
      <div className={cn(
        'px-4 py-4 border-b border-white/[0.06]',
        collapsed ? 'flex justify-center' : '',
      )}>
        {collapsed ? (
          <div
            className={cn(
              'size-9 flex items-center justify-center',
              'border-2 border-[#C04030] rounded-sm',
              'font-serif font-bold text-[#C04030] text-sm',
              '-rotate-3 shadow-[0_0_12px_rgba(192,64,48,0.15)]',
            )}
          >
            墨
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div
                className={cn(
                  'size-8 flex items-center justify-center',
                  'border-2 border-[#C04030] rounded-sm',
                  'font-serif font-bold text-[#C04030] text-sm',
                  '-rotate-3 shadow-[0_0_12px_rgba(192,64,48,0.15)]',
                )}
              >
                墨
              </div>
              <div>
                <h1 className="text-lg font-semibold text-[#EDE8DF] tracking-[0.06em]">
                  墨白
                </h1>
                <p className="text-[12px] text-[#7B7366] mt-0.5 tracking-[0.04em]">
                  管理后台 · v4.0
                </p>
              </div>
            </div>
            {/* 折叠按钮 */}
            <button
              onClick={onToggleCollapse}
              className={cn(
                'size-7 flex items-center justify-center rounded-md',
                'text-[#6B6459] hover:text-[#D8D2C8] hover:bg-white/[0.06]',
                'transition-all duration-200',
              )}
              title="折叠侧边栏"
            >
              <ChevronLeft size={14} />
            </button>
          </div>
        )}
      </div>

      {/* ═══ 导航区 ═══ */}
      <nav className={cn(
        'flex-1 overflow-y-auto py-3 space-y-4',
        collapsed ? 'px-1.5' : 'px-2',
      )}>
        {menuGroups.map((group) => (
          <div key={group.label} className="flex flex-col">
            {/* 分组标头 — 折叠时隐藏 */}
            {!collapsed && (
              <p className="px-3 mb-1.5 text-xs font-medium text-[#6B6459] uppercase tracking-[0.1em]">
                {group.label}
              </p>
            )}

            {/* 导航项 */}
            <div className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const isDisabled = item.disabled ?? false
                const Icon = item.icon

                // 折叠态：仅图标 + Tooltip
                if (collapsed) {
                  if (isDisabled) {
                    return (
                      <div key={item.key} className="flex justify-center">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span>
                              <button
                                disabled
                                className={cn(
                                  'size-10 flex items-center justify-center rounded-lg',
                                  'text-base transition-all duration-150',
                                  disabledClass,
                                )}
                              >
                                <Icon className="size-4" />
                              </button>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent
                            side="right"
                            className={cn(
                              'bg-[#222839] text-[#D8D2C8]',
                              'border border-white/[0.08]',
                              'shadow-xl shadow-black/40 rounded-lg',
                              'text-xs',
                            )}
                          >
                            {item.label} — {item.disabledHint}
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    )
                  }
                  return (
                    <div key={item.key} className="flex justify-center">
                      <NavLink
                        to={`/${item.key}`}
                        end
                        className={({ isActive }) =>
                          cn(
                            'size-10 flex items-center justify-center rounded-lg',
                            'transition-all duration-150',
                            isActive ? activeClass : normalClass,
                          )
                        }
                      >
                        {({ isActive }) => (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="relative">
                                <Icon className="size-4" />
                                {item.badge && (
                                  <span className="absolute -top-1 -right-1 size-2 rounded-full bg-[#C04030]" />
                                )}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent
                              side="right"
                              className={cn(
                                'bg-[#222839] text-[#D8D2C8]',
                                'border border-white/[0.08]',
                                'shadow-xl shadow-black/40 rounded-lg',
                                'text-xs',
                              )}
                            >
                              <span>{item.label}</span>
                              {item.badge && (
                                <span className="ml-1.5 px-1 py-0.5 rounded text-[10px] font-medium bg-[#C04030]/15 text-[#C06050] border border-[#C04030]/20">
                                  {item.badge}
                                </span>
                              )}
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </NavLink>
                    </div>
                  )
                }

                // 展开态：完整导航
                // 禁用项
                if (isDisabled) {
                  const link = (
                    <button
                      disabled
                      className={cn(
                        'flex items-center gap-2.5 px-3 py-2 rounded-lg w-full',
                        'text-base transition-all duration-150 text-left outline-none',
                        disabledClass,
                      )}
                    >
                      <Icon className="size-4 shrink-0" />
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.badge && (
                        <span className="px-1.5 py-0.5 rounded text-sm font-medium bg-[#C04030]/15 text-[#C06050] border border-[#C04030]/20">
                          {item.badge}
                        </span>
                      )}
                    </button>
                  )
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

                // 正常项
                return (
                  <div key={item.key}>
                    <NavLink
                      to={`/${item.key}`}
                      end
                      className={({ isActive }) =>
                        cn(
                          'flex items-center gap-2.5 px-3 py-2 rounded-lg w-full',
                          'text-base transition-all duration-150 text-left outline-none',
                          isActive ? activeClass : normalClass,
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <Icon className="size-4 shrink-0" />
                          <span className="flex-1 truncate">{item.label}</span>
                          {item.badge && (
                            <span className="px-1.5 py-0.5 rounded text-sm font-medium bg-[#C04030]/15 text-[#C06050] border border-[#C04030]/20">
                              {item.badge}
                            </span>
                          )}
                          {isActive && (
                            <ChevronRight className="size-3 shrink-0 text-[#C04030]" />
                          )}
                        </>
                      )}
                    </NavLink>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* ═══ 底部区域 ═══ */}
      <div className={cn(
        'border-t border-white/[0.06]',
        collapsed ? 'px-2 py-3' : 'px-4 py-3.5',
      )}>
        {collapsed ? (
          /* 折叠态：展开按钮 + 退出 */
          <div className="flex flex-col items-center gap-3">
            <button
              onClick={onToggleCollapse}
              className={cn(
                'size-8 flex items-center justify-center rounded-md',
                'text-[#6B6459] hover:text-[#D8D2C8] hover:bg-white/[0.06]',
                'transition-all duration-200',
              )}
              title="展开侧边栏"
            >
              <ChevronsLeftRight size={14} />
            </button>
            <Separator className="bg-white/[0.06]" />
            <button
              onClick={onLogout}
              className={cn(
                'size-8 flex items-center justify-center rounded-md',
                'text-[#6B6459] hover:text-[#D06050] hover:bg-red-500/10',
                'transition-colors duration-150',
              )}
              title="退出登录"
            >
              <LogOut size={14} />
            </button>
          </div>
        ) : (
          /* 展开态：用户信息 + 退出 */
          <div className="space-y-3">
            {/* 用户信息区域 */}
            <div className="flex items-center gap-2.5 px-1">
              <Avatar className="size-8 bg-white/[0.06] border border-white/[0.08]">
                <AvatarFallback className="bg-[#C04030]/15 text-[#E8A090] text-xs font-medium">
                  <User size={14} />
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-[#D8D2C8] font-medium truncate">管理员</p>
                <p className="text-[11px] text-[#6B6459] truncate">admin@local</p>
              </div>
            </div>

            <Separator className="bg-white/[0.06]" />

            {/* 操作区 */}
            <div className="flex items-center gap-1">
              <button
                onClick={onToggleCollapse}
                className={cn(
                  'flex-1 flex items-center gap-1.5 px-2 py-1.5 rounded-md',
                  'text-xs text-[#6B6459] hover:text-[#D8D2C8] hover:bg-white/[0.04]',
                  'transition-colors duration-150',
                )}
                title="折叠侧边栏 (Ctrl+\)"
              >
                <ChevronsLeftRight size={12} />
                折叠
              </button>
              <button
                onClick={onLogout}
                className={cn(
                  'flex-1 flex items-center gap-1.5 px-2 py-1.5 rounded-md',
                  'text-xs text-[#6B6459] hover:text-[#D06050] hover:bg-red-500/10',
                  'transition-colors duration-150',
                )}
              >
                <LogOut size={12} />
                退出
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}
