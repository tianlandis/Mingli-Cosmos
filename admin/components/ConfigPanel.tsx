import { useState, useEffect, useCallback } from 'react'
import { Settings, RotateCcw, Plus, Trash2, Database, FileWarning, HelpCircle } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'

const CONFIG_DESCRIPTIONS: Record<string, string> = {
  'default_llm_provider': '当前全局激活的 AI 大模型后端标识（数据存储于 SQLite app_configs 表）。所有未指定 Provider 的 AI 调用均使用此项',
  'admin_password_hash': '管理员登录凭证的加密哈希值（切勿手动修改）。由系统在修改密码时自动重新计算',
  'jwt_secret': 'JWT（JSON Web Token）签名密钥。修改后所有已登录会话立即失效，需重新登录',
  'session_max_age_hours': '管理员登录会话有效期，单位小时。超时后自动退出，需重新认证',
  'module_settings': '功能模块总开关配置，JSON 格式。控制各业务模块（排盘/性格/事业/婚姻）的启用状态',
  'system_name': '系统全局显示名称，影响页面标题、邮件签名等处展示的系统名称',
  'guard_enabled': 'L3 防幻觉护栏全局开关。关闭后 Prompt 模板中的护栏规则将不生效',
  'rate_limit_ip_max': '同一 IP 地址在时间窗口内的最大登录尝试次数，防暴力破解',
  'rate_limit_ip_window_sec': 'IP 限流时间窗口（秒），超过此窗口后计数清零',
}

function getConfigDescription(key: string): string | null {
  return CONFIG_DESCRIPTIONS[key] ?? null
}

interface ConfigRow {
  id: number
  key: string
  value: string
  displayName: string | null
  description: string | null
}

export default function ConfigPanel({ apiHeaders }: { apiHeaders: () => Record<string, string> }) {
  const [configs, setConfigs] = useState<ConfigRow[]>([])
  const [usingDb, setUsingDb] = useState(false)
  const [newKey, setNewKey] = useState('')
  const [newValue, setNewValue] = useState('')
  const [status, setStatus] = useState('')

  const load = useCallback(async () => {
    const res = await fetch('/api/v1/admin/config', { headers: apiHeaders() })
    const data = await res.json()
    setConfigs(data.data?.configs || [])
    setUsingDb(data.data?.usingDb || false)
  }, [apiHeaders])

  useEffect(() => { load() }, [load])

  const handleAdd = async () => {
    if (!newKey || !newValue) return
    await fetch('/api/v1/admin/config', {
      method: 'POST',
      headers: apiHeaders(),
      body: JSON.stringify({ key: newKey, value: newValue, displayName: newKey }),
    })
    setNewKey('')
    setNewValue('')
    setStatus('已保存')
    load()
    setTimeout(() => setStatus(''), 2000)
  }

  const handleReload = async () => {
    const res = await fetch('/api/v1/admin/config/reload', { method: 'POST', headers: apiHeaders() })
    const data = await res.json()
    setStatus(`配置已刷新，来源: ${data.data?.source || data.source || 'unknown'}`)
    load()
  }

  const handleDelete = async (key: string) => {
    await fetch(`/api/v1/admin/config/${key}`, { method: 'DELETE', headers: apiHeaders() })
    load()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-[#EDE8DF] flex items-center gap-2 tracking-[0.04em]">
            <Settings size={18} className="text-[#B8964A]" />
            系统配置
          </h2>
          <p className="text-sm text-[#6B6459] mt-0.5">运行时参数与功能开关管理</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={cn(
            'inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[12px] font-medium border',
            usingDb
              ? 'bg-[#5B8C5A]/10 text-[#5B8C5A] border-[#5B8C5A]/20'
              : 'bg-[#C08040]/10 text-[#C08040] border-[#C08040]/20',
          )}>
            {usingDb ? <Database className="size-3" /> : <FileWarning className="size-3" />}
            {usingDb ? 'DB 模式' : '.env 回退'}
          </span>
          <button
            onClick={handleReload}
            className="flex items-center gap-1 px-3 py-1.5 text-sm text-[#B8964A] hover:text-[#D8C08A] bg-[#B8964A]/8 hover:bg-[#B8964A]/12 border border-[#B8964A]/15 rounded-md transition-colors"
          >
            <RotateCcw size={12} />
            刷新缓存
          </button>
        </div>
      </div>

      {/* Status toast */}
      {status && (
        <div className="px-3 py-2 rounded-md bg-[#5B8C5A]/10 border border-[#5B8C5A]/20 text-[#5B8C5A] text-sm flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-[#5B8C5A]" />
          {status}
        </div>
      )}

      {/* Add form */}
      <Card className="bg-[#1A1F2E] border-white/[0.06] max-w-3xl">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="size-7 flex items-center justify-center rounded-lg bg-[#B8964A]/8 border border-[#B8964A]/15 shrink-0">
              <Plus size={12} className="text-[#B8964A]" />
            </div>
            <div>
              <CardTitle className="text-sm text-[#EDE8DF] tracking-[0.04em]">新增配置项</CardTitle>
              <CardDescription className="text-[11px] text-[#6B6459] mt-0.5">
                添加键值对到 app_configs 表，保存后需刷新缓存方可生效
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pb-4">
          <div className="flex gap-3">
            <div className="flex-1 space-y-1.5">
              <Label className="text-[12px] text-[#6B6459] font-medium">配置键 (Key)</Label>
              <input
                value={newKey}
                onChange={e => setNewKey(e.target.value)}
                placeholder="如：module_settings"
                className="w-full px-3.5 py-2 bg-[#1A2332] border border-white/[0.08] rounded-lg text-base text-[#EDE8DF] placeholder:text-[#4A4540] font-mono focus:outline-none focus:border-[#B8964A]/60 focus:ring-1 focus:ring-[#B8964A]/20 transition-colors"
              />
              <p className="text-[11px] text-[#6B6459] italic">系统内部标识键名，需全局唯一，推荐 snake_case 命名，如 system_name、guard_enabled</p>
            </div>
            <div className="flex-1 space-y-1.5">
              <Label className="text-[12px] text-[#6B6459] font-medium">配置值 (Value)</Label>
              <input
                value={newValue}
                onChange={e => setNewValue(e.target.value)}
                placeholder="配置值..."
                className="w-full px-3.5 py-2 bg-[#1A2332] border border-white/[0.08] rounded-lg text-base text-[#EDE8DF] placeholder:text-[#4A4540] font-mono focus:outline-none focus:border-[#B8964A]/60 focus:ring-1 focus:ring-[#B8964A]/20 transition-colors"
              />
              <p className="text-[11px] text-[#6B6459] italic">配置的具体内容。JSON 格式需语法有效、结构完整；纯文本可直接填写数字或字符串</p>
            </div>
            <button
              onClick={handleAdd}
              className="px-5 py-2 bg-[#C04030] hover:bg-[#A03024] text-[#EDE8DF] text-base font-medium rounded-lg transition-colors duration-150 shrink-0 self-end"
            >
              保存
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Config table */}
      <Card className="bg-[#1A1F2E] border-white/[0.06] overflow-hidden">
        <CardContent className="p-0">
        <table className="w-full text-base">
          <thead>
            <tr className="border-b border-white/[0.06] bg-[#1A2332]/60">
              <th className="text-left px-5 py-3 text-[12px] font-medium text-[#6B6459] uppercase tracking-[0.08em] w-[200px]">键</th>
              <th className="text-left px-5 py-3 text-[12px] font-medium text-[#6B6459] uppercase tracking-[0.08em] w-[280px]">值</th>
              <th className="text-left px-5 py-3 text-[12px] font-medium text-[#6B6459] uppercase tracking-[0.08em]">作用与存储说明</th>
              <th className="text-right px-5 py-3 text-[12px] font-medium text-[#6B6459] uppercase tracking-[0.08em] w-20">操作</th>
            </tr>
          </thead>
          <tbody>
            {configs.map(c => {
              const desc = getConfigDescription(c.key)
              return (
                <tr key={c.id} className="border-b border-white/[0.03] last:border-0 hover:bg-white/[0.02] transition-colors">
                  <td className="px-5 py-3 font-mono text-sm text-[#A09888]">{c.key}</td>
                  <td className="px-5 py-3 font-mono text-sm text-[#EDE8DF] max-w-[280px] truncate" title={c.value}>{c.value}</td>
                  <td className="px-5 py-3">
                    {desc ? (
                      <p className="text-[12px] text-[#6B6459] leading-relaxed">{desc}</p>
                    ) : (
                      <span className="text-[12px] text-[#4A4540] italic">自定义配置，暂无说明</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => handleDelete(c.key)}
                      className="inline-flex items-center gap-1 px-2 py-1 text-[12px] text-[#D06050] hover:text-[#FF7070] hover:bg-[#C04030]/10 rounded transition-colors"
                    >
                      <Trash2 size={11} />
                      删除
                    </button>
                  </td>
                </tr>
              )
            })}
            {configs.length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-12 text-center text-[#4A4540] text-sm">
                  暂无配置项，使用上方表单添加
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </CardContent>
      </Card>
    </div>
  )
}

function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ')
}
