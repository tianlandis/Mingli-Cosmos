// ============================================================
// 管理员密码初始化 — 安全回归测试
// 文件：src/server/modules/__tests__/admin-password.test.ts
//
// 生产事故背景（2026-09-28 首次上线时实测发现）：
//   auth 模块原先在**模块顶层**读取 `process.env.ADMIN_PASSWORD` 作为默认密码。
//   由于该模块的求值时机可能早于 dotenv 注入，部署方在 .env 里设置的
//   ADMIN_PASSWORD 被静默忽略 —— 数据库里被写死为内置默认密码 `mingli2026`，
//   且密码来源优先级是「DB > env」，导致此后改 .env 也永远不生效，
//   后台长期处于**公开弱口令**状态。
//
// 本次修复：
//   1. 所有环境变量改为惰性读取（调用时才读 process.env）
//   2. 新增 `ensureAdminPasswordInitialized()`，在 initDb() 之后由启动流程显式调用
//
// 本文件刻意在**模块加载之后**才设置 process.env.ADMIN_PASSWORD ——
// 旧实现在该场景下必然失败，因此可有效防止缺陷回归。
// ============================================================

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import {
  route as authRoute,
  ensureAdminPasswordInitialized,
  FALLBACK_ADMIN_PASSWORD,
} from '@/server/modules/auth'
import { initDb, closeDb, getDb, schema } from '@/server/db'

const CONFIGURED_PASSWORD = 'ProdPass_2026!'
const ADMIN_USERNAME = 'admin'

interface LoginBody {
  success: boolean
  data?: { token?: string }
  error?: { code?: string; message?: string }
}

let app: Hono
let ipSeq = 0

/** 每个请求换一个来源 IP，避免登录限流（失败才计数）干扰用例 */
function jsonHeaders(): Record<string, string> {
  ipSeq++
  return {
    'Content-Type': 'application/json',
    'x-forwarded-for': `10.20.0.${ipSeq}`,
  }
}

async function login(password: string, username = ADMIN_USERNAME) {
  const res = await app.request('/login', {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({ username, password }),
  })
  return { status: res.status, body: (await res.json()) as LoginBody }
}

function readPasswordHash(): string | undefined {
  return getDb()
    .select({ value: schema.appConfigs.value })
    .from(schema.appConfigs)
    .where(eq(schema.appConfigs.key, 'admin_password_hash'))
    .get()?.value
}

function writePasswordHash(hash: string): void {
  getDb().insert(schema.appConfigs).values({
    key: 'admin_password_hash',
    value: hash,
    displayName: '管理员密码哈希',
    description: 'BCrypt hash of the admin password',
    valueType: 'string',
    category: 'security',
  }).onConflictDoUpdate({
    target: schema.appConfigs.key,
    set: { value: hash },
  }).run()
}

beforeAll(() => {
  process.env.DB_PATH = ':memory:'
  initDb()

  // ⚠️ 关键：在 auth 模块**已被加载**之后才注入环境变量。
  // 惰性读取的修复使这里仍能生效；旧的模块顶层常量写法在此必然失效。
  process.env.ADMIN_PASSWORD = CONFIGURED_PASSWORD

  app = new Hono()
  app.route('/', authRoute)
})

afterAll(() => {
  closeDb()
})

describe('管理员密码 — 环境变量优先级与启动自检', () => {
  it('启动自检应把 ADMIN_PASSWORD 的哈希写入数据库（而非内置默认值）', () => {
    getDb().delete(schema.appConfigs).run()

    ensureAdminPasswordInitialized()

    const hash = readPasswordHash()
    expect(hash).toBeTruthy()
    expect(bcrypt.compareSync(CONFIGURED_PASSWORD, hash!)).toBe(true)
    expect(bcrypt.compareSync(FALLBACK_ADMIN_PASSWORD, hash!)).toBe(false)
  })

  it('用 .env 配置的 ADMIN_PASSWORD 可以登录后台', async () => {
    const r = await login(CONFIGURED_PASSWORD)
    expect(r.status).toBe(200)
    expect(r.body.data?.token).toBeTruthy()
  })

  it('【安全回归】内置默认密码 mingli2026 必须登录失败', async () => {
    const r = await login(FALLBACK_ADMIN_PASSWORD)
    expect(r.status).toBe(401)
    expect(r.body.error?.code).toBe('UNAUTHORIZED')
  })

  it('用户名错误同样拒绝', async () => {
    const r = await login(CONFIGURED_PASSWORD, 'root')
    expect(r.status).toBe(401)
  })

  it('DB 中已有密码记录时，自检不覆盖（保留后台修改结果）', () => {
    const manualHash = bcrypt.hashSync('ManuallyChanged#1', 10)
    writePasswordHash(manualHash)

    ensureAdminPasswordInitialized()

    expect(readPasswordHash()).toBe(manualHash)
  })
})
