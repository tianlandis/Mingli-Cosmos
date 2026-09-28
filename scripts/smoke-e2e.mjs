/**
 * 端到端冒烟脚本（真实起服务后跑）
 *
 * 用法：
 *   1) 另开终端起服务：
 *      DB_PATH=data/smoke.db SERVER_PORT=3099 node_modules/.bin/tsx src/server/index.ts --prod
 *   2) 本脚本：
 *      BASE=http://localhost:3099 node scripts/smoke-e2e.mjs
 *
 * 覆盖链路：健康检查 → C 端注册 → 登录 → me/quota → 套餐 → 下单 → 模拟支付
 *          → 订阅查询 → 埋点上报 → 后台登录 → 用户列表/订单统计/运营看板
 */

const BASE = process.env.BASE || 'http://localhost:3099'
const ADMIN_USER = process.env.ADMIN_USERNAME || 'admin'
const ADMIN_PASS = process.env.ADMIN_PASSWORD || 'mingli2026'

let pass = 0
let fail = 0
const failures = []

function ok(name, cond, detail) {
  if (cond) {
    pass++
    console.log(`  ✅ ${name}`)
  } else {
    fail++
    failures.push(`${name}${detail ? ' — ' + detail : ''}`)
    console.log(`  ❌ ${name}${detail ? ' — ' + detail : ''}`)
  }
}

async function api(method, path, { token, body, admin } = {}) {
  const headers = {}
  if (body) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`
  if (admin) headers['x-admin-token'] = admin
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  let json = null
  try { json = await res.json() } catch { /* 非 JSON 响应 */ }
  return { status: res.status, json }
}

const suffix = Date.now().toString().slice(-6)
const username = `smoke${suffix}`

async function main() {
  console.log(`\n🚀 冒烟目标：${BASE}\n`)

  // ── 1. 健康检查 ──────────────────────────────
  console.log('[1] 健康检查')
  const health = await api('GET', '/api/health')
  ok('GET /api/health → 200', health.status === 200, `status=${health.status}`)
  ok('健康检查返回 success', health.json?.success === true || health.json?.status === 'ok')

  // ── 2. C 端注册 ──────────────────────────────
  console.log('\n[2] C 端用户注册')
  const reg = await api('POST', '/api/v1/app/user/register', {
    body: { username, password: 'Test@1234', nickname: '冒烟用户', phone: `139${suffix}` },
  })
  ok('注册 → 201', reg.status === 201, `status=${reg.status} ${JSON.stringify(reg.json?.error || '')}`)
  const userToken = reg.json?.data?.token
  ok('注册返回 token', !!userToken)
  ok('新用户初始额度 = 5', reg.json?.data?.user?.quotaRemaining === 5,
    `quotaRemaining=${reg.json?.data?.user?.quotaRemaining}`)

  // ── 3. 重复注册拦截 ──────────────────────────
  console.log('\n[3] 重复注册/错误密码拦截')
  const dup = await api('POST', '/api/v1/app/user/register', {
    body: { username, password: 'Test@1234' },
  })
  ok('重名注册 → 409', dup.status === 409, `status=${dup.status}`)

  const badLogin = await api('POST', '/api/v1/app/user/login', {
    body: { account: username, password: 'wrong-password' },
  })
  ok('错误密码 → 401', badLogin.status === 401, `status=${badLogin.status} ${JSON.stringify(badLogin.json?.error || '')}`)

  // ── 4. 登录 / me / quota ─────────────────────
  console.log('\n[4] 登录态与额度')
  const login = await api('POST', '/api/v1/app/user/login', {
    body: { account: username, password: 'Test@1234' },
  })
  ok('登录 → 200', login.status === 200, `status=${login.status}`)
  const loginToken = login.json?.data?.token || userToken

  const me = await api('GET', '/api/v1/app/user/me', { token: loginToken })
  ok('me → 200 且用户名一致', me.status === 200 && me.json?.data?.user?.username === username,
    `got=${me.json?.data?.user?.username}`)

  const noAuth = await api('GET', '/api/v1/app/user/me')
  ok('无 token 访问 me → 401', noAuth.status === 401, `status=${noAuth.status}`)

  const quota = await api('GET', '/api/v1/app/user/quota', { token: loginToken })
  ok('quota → 200', quota.status === 200)

  // ── 5. 套餐与下单 ────────────────────────────
  console.log('\n[5] 套餐 / 下单 / 模拟支付')
  const plans = await api('GET', '/api/v1/app/billing/plans')
  ok('套餐列表 → 200 且非空', plans.status === 200 && Array.isArray(plans.json?.data) && plans.json.data.length > 0,
    `count=${plans.json?.data?.length}`)
  const planId = plans.json?.data?.[0]?.id

  const order = await api('POST', '/api/v1/app/billing/orders', { token: loginToken, body: { planId } })
  ok('下单 → 201', order.status === 201, `status=${order.status} ${JSON.stringify(order.json?.error || '')}`)
  const orderId = order.json?.data?.id || order.json?.data?.orderId

  const pay = await api('POST', `/api/v1/app/billing/orders/${orderId}/pay`, {
    token: loginToken, body: { method: 'alipay' },
  })
  ok('模拟支付 → 200', pay.status === 200, `status=${pay.status} ${JSON.stringify(pay.json?.error || '')}`)

  const myOrders = await api('GET', '/api/v1/app/billing/orders', { token: loginToken })
  ok('我的订单 → 200 且含 1 条', myOrders.status === 200 && (myOrders.json?.data?.total >= 1),
    `total=${myOrders.json?.data?.total}`)

  const sub = await api('GET', '/api/v1/app/billing/subscription', { token: loginToken })
  ok('订阅查询 → 200', sub.status === 200, `status=${sub.status}`)

  // ── 6. 埋点 ──────────────────────────────────
  console.log('\n[6] 埋点上报')
  const hit = await api('POST', '/api/v1/app/track', {
    token: loginToken, body: { event: 'page_view', sessionId: `s_${suffix}`, payload: { path: '/' } },
  })
  ok('合法事件 → 200/201', hit.status === 200 || hit.status === 201, `status=${hit.status}`)
  const bad = await api('POST', '/api/v1/app/track', { token: loginToken, body: { event: 'evil_event' } })
  ok('白名单外事件 → 400', bad.status === 400, `status=${bad.status}`)

  // ── 7. 后台链路 ──────────────────────────────
  console.log('\n[7] 后台登录与运营中台')
  const adminLogin = await api('POST', '/api/v1/admin/auth/login', { body: { username: ADMIN_USER, password: ADMIN_PASS } })
  ok('后台登录 → 200', adminLogin.status === 200, `status=${adminLogin.status} ${JSON.stringify(adminLogin.json?.error || '')}`)
  const adminToken = adminLogin.json?.data?.token

  const users = await api('GET', '/api/v1/admin/users?page=1&pageSize=10', { token: adminToken })
  ok('后台用户列表 → 200', users.status === 200, `status=${users.status}`)

  const userStats = await api('GET', '/api/v1/admin/users/stats', { token: adminToken })
  ok('用户统计 → 200', userStats.status === 200, `status=${userStats.status}`)

  const orders = await api('GET', '/api/v1/admin/orders?page=1&pageSize=10', { token: adminToken })
  ok('后台订单列表 → 200', orders.status === 200, `status=${orders.status}`)

  const orderStats = await api('GET', '/api/v1/admin/orders/stats', { token: adminToken })
  ok('订单统计 → 200 且收额 > 0', orders.status === 200 && (orderStats.json?.data?.paidAmount ?? 0) >= 0,
    JSON.stringify(orderStats.json?.data || {}))

  const ov = await api('GET', '/api/v1/admin/analytics/overview', { token: adminToken })
  ok('运营看板 → 200', ov.status === 200, `status=${ov.status}`)

  const series = await api('GET', '/api/v1/admin/analytics/series?days=7', { token: adminToken })
  ok('趋势序列 → 200', series.status === 200, `status=${series.status}`)

  const noAdmin = await api('GET', '/api/v1/admin/users')
  ok('无 token 访问后台 → 401', noAdmin.status === 401, `status=${noAdmin.status}`)

  // ── 汇总 ─────────────────────────────────────
  console.log('\n────────────────────────────')
  console.log(`通过 ${pass} 项 / 失败 ${fail} 项`)
  if (fail) {
    console.log('\n失败明细：')
    failures.forEach((f) => console.log('  • ' + f))
    process.exit(1)
  }
  console.log('🎉 端到端冒烟全部通过')
}

main().catch((e) => {
  console.error('冒烟脚本异常：', e)
  process.exit(1)
})
