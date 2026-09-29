// ============================================================
// 管理后台：计费设置（免费模式 + 各功能额度成本）
// 文件：src/server/modules/billing/index.ts
// 路由：/api/v1/admin/billing
//   GET  /  读取免费开关 + 配置成本 + 生效成本
//   PUT  /  保存免费开关 / 各功能成本（写 app_configs，热生效）
//
// 配置真值统一由 src/server/lib/billing.ts 解释，本模块只负责读写，
// 不在别处再写一份成本默认值，避免前后端/多处漂移。
// ============================================================

import { Hono } from 'hono'
import { z } from 'zod'
import { authMiddleware } from '../../core/middleware/auth'
import { logAudit, type AdminEnv } from '../../core/middleware/audit'
import { setConfig } from '../../db'
import { reloadConfig } from '../../config'
import {
  BILLABLE_FEATURES,
  BILLING_LABELS,
  QUOTA_DEFAULTS,
  getBillingSnapshot,
} from '../../lib/billing'

export const route = new Hono<AdminEnv>()
route.use('*', authMiddleware)

// ═══════════════════════════════════════
// Zod 校验
// ═══════════════════════════════════════

const costField = z.number().int().min(0).max(100000)

const putBillingSchema = z.object({
  /** 全站免费（测试期）：开启后所有功能不扣额度 */
  freeMode: z.boolean().optional(),
  /** 各功能额度成本；只写提供的字段 */
  costs: z.object({
    chart: costField.optional(),
    report: costField.optional(),
    synastry: costField.optional(),
    chat: costField.optional(),
  }).partial().optional(),
})

// ═══════════════════════════════════════
// GET / — 读取计费设置
// ═══════════════════════════════════════

route.get('/', (c) => {
  const snap = getBillingSnapshot()
  return c.json({
    success: true,
    data: {
      ...snap,
      /** UI 元数据：功能清单 + 中文名 + 内置默认值 */
      features: BILLABLE_FEATURES,
      labels: BILLING_LABELS,
      defaults: QUOTA_DEFAULTS,
    },
  })
})

// ═══════════════════════════════════════
// PUT / — 保存计费设置
// ═══════════════════════════════════════

route.put('/', async (c) => {
  let body: unknown
  try { body = await c.req.json() } catch {
    return c.json({ success: false, error: { code: 'BAD_REQUEST', message: '请求体格式错误' } }, 400)
  }

  const parsed = putBillingSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message || '参数错误' },
    }, 400)
  }

  const { freeMode, costs } = parsed.data

  if (freeMode !== undefined) {
    setConfig(
      'free_mode',
      freeMode ? '1' : '0',
      '全站免费模式',
      '开启后所有功能不扣额度（测试期用）',
      'boolean',
      'general',
    )
  }

  if (costs) {
    for (const f of BILLABLE_FEATURES) {
      const v = costs[f]
      if (v !== undefined) {
        setConfig(
          `${f}_quota_cost`,
          String(v),
          `${BILLING_LABELS[f]}额度成本`,
          `${BILLING_LABELS[f]}每次消耗的额度次数；0 表示免费`,
          'number',
          'general',
        )
      }
    }
  }

  // 配置即时生效（清理内存缓存）
  reloadConfig()

  logAudit(c, {
    action: 'update',
    resource: 'config',
    detail: `计费设置: freeMode=${freeMode ?? '(不变)'} costs=${JSON.stringify(costs ?? {})}`,
  })

  return c.json({ success: true, data: getBillingSnapshot() })
})

export default route
