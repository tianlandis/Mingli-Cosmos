// ============================================================
// [ADR-011] 后台体系（应用）管理路由
// 文件：src/server/modules/systems/index.ts
// 路由：/api/v1/admin/systems
//
// 解决：后台一直以来「没有可供管理员选定应用/体系的入口」——
//   引擎注册表早已注册 bazi / astro / mbti，C 端也有切换器，
//   唯独后台既无 API 也无 UI 能感知体系概念，管理员无法配置默认应用。
//   本模块把 registry 的权威清单 + module_settings 的选择结果暴露给后台。
//
// 只读清单 + 选择落库分离：体系本身的启停写在 module_settings（config 模块），
//   这里只负责「有哪些」与「当前选了什么」，避免两份真值。
// ============================================================

import { Hono } from 'hono'
import { z } from 'zod'
import { authMiddleware } from '../../core/middleware/auth'
import { logAudit, type AdminEnv } from '../../core/middleware/audit'
import { listConfigs, setConfig } from '../../db'
import { reloadConfig } from '../../config'
import { parseModuleSettings } from '../config/schema'
import { listSystemIds, getSystemEngine, isKnownSystem, DEFAULT_SYSTEM } from '../../systems/registry'
import { getSystemMeta } from '../../systems/meta'

export const route = new Hono<AdminEnv>()
route.use('*', authMiddleware)

/** 当前 module_settings 里的体系选择（DB 损坏时自动回落默认值） */
function currentSelection() {
  const row = (listConfigs() as Array<{ key: string; value: string }>).find(c => c.key === 'module_settings')
  const settings = parseModuleSettings(row?.value)
  // 防御：默认体系必须已注册且已启用，否则纠回 DEFAULT_SYSTEM
  const enabled = settings.systems.enabledSystems.filter(id => isKnownSystem(id))
  const fallbackEnabled = enabled.length > 0 ? enabled : [DEFAULT_SYSTEM]
  const defaultSystem = enabled.includes(settings.systems.defaultSystem)
    ? settings.systems.defaultSystem
    : fallbackEnabled[0] ?? DEFAULT_SYSTEM
  return { defaultSystem, enabledSystems: fallbackEnabled, settings }
}

const selectBodySchema = z.object({
  defaultSystem: z.string().min(1).optional(),
  enabledSystems: z.array(z.string().min(1)).optional(),
})

// ---- GET /systems — 体系清单 + 当前选择 ----
route.get('/', (c) => {
  const { defaultSystem, enabledSystems } = currentSelection()

  const systems = listSystemIds().map((id) => {
    const engine = getSystemEngine(id)
    return {
      id,
      ...getSystemMeta(id),
      version: engine?.version ?? 'unknown',
      registered: true,
      enabled: enabledSystems.includes(id),
      isDefault: id === defaultSystem,
    }
  })

  return c.json({
    success: true,
    data: {
      systems,
      defaultSystem,
      enabledSystems,
      /** 引擎注册但 meta 未登记的 id（提示补 meta，不阻断） */
      unlabeled: systems.filter(s => s.label === s.id).map(s => s.id),
    },
  })
})

// ---- PUT /systems — 保存体系选择（写回 module_settings） ----
route.put('/', async (c) => {
  let body: unknown
  try { body = await c.req.json() } catch {
    return c.json({ success: false, error: { code: 'BAD_REQUEST', message: '请求体格式错误' } }, 400)
  }

  const parsed = selectBodySchema.safeParse(body)
  if (!parsed.success) {
    return c.json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? '参数格式错误' },
    }, 400)
  }

  const { settings } = currentSelection()

  // ── 校验：体系必须已在 registry 注册，杜绝写进不存在的 id ──
  const nextEnabled = parsed.data.enabledSystems
    ? [...new Set(parsed.data.enabledSystems)]
    : settings.systems.enabledSystems
  const unknown = nextEnabled.filter(id => !isKnownSystem(id))
  if (unknown.length > 0) {
    return c.json({
      success: false,
      error: { code: 'UNKNOWN_SYSTEM', message: `未注册的体系：${unknown.join(', ')}` },
    }, 400)
  }

  // ── 校验：至少启用一个，否则 C 端无可用应用 ──
  if (nextEnabled.length === 0) {
    return c.json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: '至少需启用一个体系' },
    }, 400)
  }

  // ── 校验：默认体系必须已注册且已启用 ──
  const nextDefault = parsed.data.defaultSystem ?? settings.systems.defaultSystem
  if (!isKnownSystem(nextDefault)) {
    return c.json({
      success: false,
      error: { code: 'UNKNOWN_SYSTEM', message: `未注册的体系：${nextDefault}` },
    }, 400)
  }
  if (!nextEnabled.includes(nextDefault)) {
    return c.json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: `默认体系 ${nextDefault} 不在启用清单内，请先启用` },
    }, 400)
  }

  const merged = {
    ...settings,
    systems: { defaultSystem: nextDefault, enabledSystems: nextEnabled },
  }

  setConfig('module_settings', JSON.stringify(merged), '模块功能开关', '控制各业务模块的启用/禁用及参数限制', 'json', 'general')
  reloadConfig()
  logAudit(c, { action: 'update', resource: 'config', detail: `systems: default=${nextDefault} enabled=[${nextEnabled.join(',')}]` })

  return c.json({ success: true, data: { defaultSystem: nextDefault, enabledSystems: nextEnabled } })
})
