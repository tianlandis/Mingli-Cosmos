// ============================================================
// 计费策略测试 —— 免费模式 + 成本读取 + cost=0 免费台账
// 文件：src/server/lib/__tests__/billing.test.ts
// ============================================================

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import {
  initDb,
  closeDb,
  createUser,
  setConfig,
  deleteConfig,
  getUserById,
  reserveQuota,
  getLedgerByKey,
  sumLedgerDelta,
} from '@/server/db'
import {
  isBillingFree,
  readQuotaCost,
  readConfiguredCost,
  readNewUserQuota,
  getBillingSnapshot,
  QUOTA_DEFAULTS,
  BILLABLE_FEATURES,
  NEW_USER_QUOTA_DEFAULT,
} from '@/server/lib/billing'

function cleanup() {
  deleteConfig('free_mode')
  deleteConfig('new_user_quota')
  for (const f of BILLABLE_FEATURES) deleteConfig(`${f}_quota_cost`)
}

beforeAll(() => {
  process.env.DB_PATH = ':memory:'
  initDb()
})

afterEach(cleanup)

afterAll(() => {
  cleanup()
  closeDb()
  delete process.env.DB_PATH
})

// ═══════════════════════════════════════
// A. 默认与配置
// ═══════════════════════════════════════

describe('billing — 成本读取', () => {
  it('未配置时回落内置默认（排盘免费，其余 1）', () => {
    expect(readQuotaCost('chart')).toBe(0)
    expect(readQuotaCost('report')).toBe(1)
    expect(readQuotaCost('synastry')).toBe(1)
    expect(readQuotaCost('chat')).toBe(1)
  })

  it('后台配置后按配置生效', () => {
    setConfig('report_quota_cost', '3')
    expect(readQuotaCost('report')).toBe(3)
    expect(readConfiguredCost('report')).toBe(3)
  })

  it('非法配置（非数字 / 负数）回落默认', () => {
    setConfig('report_quota_cost', 'abc')
    expect(readQuotaCost('report')).toBe(QUOTA_DEFAULTS.report)
    setConfig('synastry_quota_cost', '-5')
    expect(readQuotaCost('synastry')).toBe(QUOTA_DEFAULTS.synastry)
  })
})

// ═══════════════════════════════════════
// A2. 新用户初始额度（可配）
// ═══════════════════════════════════════

describe('billing — 新用户初始额度', () => {
  it('未配置时回落内置默认 5', () => {
    expect(NEW_USER_QUOTA_DEFAULT).toBe(5)
    expect(readNewUserQuota()).toBe(5)
  })

  it('后台配置后按配置生效', () => {
    setConfig('new_user_quota', '10')
    expect(readNewUserQuota()).toBe(10)
  })

  it('配置为 0 表示新用户默认无额度', () => {
    setConfig('new_user_quota', '0')
    expect(readNewUserQuota()).toBe(0)
  })

  it('非法配置（非数字 / 负数 / 空）回落默认', () => {
    setConfig('new_user_quota', 'abc')
    expect(readNewUserQuota()).toBe(NEW_USER_QUOTA_DEFAULT)
    setConfig('new_user_quota', '-3')
    expect(readNewUserQuota()).toBe(NEW_USER_QUOTA_DEFAULT)
    setConfig('new_user_quota', '')
    expect(readNewUserQuota()).toBe(NEW_USER_QUOTA_DEFAULT)
  })

  it('snapshot 携带 newUserQuota', () => {
    setConfig('new_user_quota', '7')
    expect(getBillingSnapshot().newUserQuota).toBe(7)
  })

  it('注册路径：取配置值作为 quotaTotal', () => {
    setConfig('new_user_quota', '8')
    const u = createUser({ username: 'newbie-q', passwordHash: 'x', quotaTotal: readNewUserQuota() })
    expect(getUserById(u.id)!.quotaTotal).toBe(8)
  })
})

// ═══════════════════════════════════════
// B. 全站免费模式
// ═══════════════════════════════════════

describe('billing — 免费模式', () => {
  it('开启后所有功能生效成本为 0，但配置值保留', () => {
    setConfig('report_quota_cost', '3')
    setConfig('free_mode', '1')
    expect(isBillingFree()).toBe(true)
    expect(readQuotaCost('report')).toBe(0)
    expect(readQuotaCost('chart')).toBe(0)
    expect(readQuotaCost('synastry')).toBe(0)
    expect(readQuotaCost('chat')).toBe(0)
    // 配置值不受免费模式影响（关闭后可恢复）
    expect(readConfiguredCost('report')).toBe(3)
  })

  it('关闭（0 / false / 缺省）后按配置生效', () => {
    setConfig('report_quota_cost', '3')
    setConfig('free_mode', '0')
    expect(isBillingFree()).toBe(false)
    expect(readQuotaCost('report')).toBe(3)

    setConfig('free_mode', 'false')
    expect(isBillingFree()).toBe(false)

    deleteConfig('free_mode')
    expect(isBillingFree()).toBe(false)
  })

  it('snapshot 同时给出配置值与生效值', () => {
    setConfig('report_quota_cost', '2')
    setConfig('free_mode', '1')
    const s = getBillingSnapshot()
    expect(s.freeMode).toBe(true)
    expect(s.costs.report).toBe(2)
    expect(s.effectiveCosts.report).toBe(0)
  })
})

// ═══════════════════════════════════════
// C. cost=0 免费台账（reserveQuota 放开零成本）
// ═══════════════════════════════════════

describe('billing — cost=0 免费台账', () => {
  it('cost=0：不改变余额，仍写 0 台账且幂等', () => {
    const u = createUser({ username: 'free-user', passwordHash: 'x', quotaTotal: 0 })

    const r1 = reserveQuota({ userId: u.id, idempotencyKey: 'free-1', cost: 0, reason: 'report' })
    expect(r1.ok).toBe(true)
    expect(r1.reused).toBe(false)
    expect(r1.balanceAfter).toBe(0)
    expect(getUserById(u.id)!.quotaUsed).toBe(0)      // 未扣

    const led = getLedgerByKey('free-1')
    expect(led?.delta).toBe(0)
    expect(led?.status).toBe('pending')

    // 幂等：同 key 复用首次结果
    const r2 = reserveQuota({ userId: u.id, idempotencyKey: 'free-1', cost: 0 })
    expect(r2.reused).toBe(true)
    expect(r2.balanceAfter).toBe(0)

    expect(sumLedgerDelta(u.id)).toBe(0)
  })

  it('cost=0 时余额不参与判断（超额账号也能用免费功能）', () => {
    const u = createUser({ username: 'over-user', passwordHash: 'x', quotaTotal: 0 })

    // quotaTotal=0 → cost=1 必然不足，证明该账号确实"超额"
    const deny = reserveQuota({ userId: u.id, idempotencyKey: 'over-0', cost: 1 })
    expect(deny.ok).toBe(false)
    expect(deny.reason).toBe('QUOTA_EXHAUSTED')

    // cost=0 → 放行，且余额不变
    const free = reserveQuota({ userId: u.id, idempotencyKey: 'over-1', cost: 0, reason: 'chart' })
    expect(free.ok).toBe(true)
    expect(getUserById(u.id)!.quotaUsed).toBe(0)
  })

  it('绑定免费模式：免费下报告成本为 0 → 预留不扣', () => {
    const u = createUser({ username: 'free-mode-user', passwordHash: 'x', quotaTotal: 1 })
    setConfig('report_quota_cost', '5')
    setConfig('free_mode', '1')

    const cost = readQuotaCost('report')
    expect(cost).toBe(0)
    const r = reserveQuota({ userId: u.id, idempotencyKey: 'fm-1', cost, reason: 'report' })
    expect(r.ok).toBe(true)
    expect(getUserById(u.id)!.quotaUsed).toBe(0)      // 1 额度没动
  })
})
