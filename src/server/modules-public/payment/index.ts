// ============================================================
// Phase 5 P5-5 — 支付回调端（ADR-009 回调幂等）
// 文件：src/server/modules-public/payment/index.ts
// 挂载：/api/v1/app/payment
//
//   POST /notify/:channel   第三方支付异步通知（签名校验 + 幂等结算）
//   GET  /channels          当前已启用的支付渠道（供前端选择）
//
// 安全设计：
//   1. **默认关闭**：未配置 `payment_notify_secret` 时一律 503，
//      绝不暴露一个「无签名即可发货」的公开端点；
//   2. 签名口径：`hex(hmac_sha256(rawBody, secret))`，头 `x-pay-signature`；
//   3. 结算走 `settleOrderPaid`（唯一幂等入口），重复通知不重复发货；
//   4. 回调响应语义遵循第三方惯例：成功返回 200，签名失败 401。
// ============================================================

import { Hono } from 'hono'
import { z } from 'zod'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { getConfig } from '../../db'
import { settleOrderPaid } from '../../services/order-settlement'

export const route = new Hono()

const notifySchema = z.object({
  orderNo: z.string().min(1).max(64),
  tradeNo: z.string().max(64).optional(),
  amountCents: z.number().int().min(0).optional(),
  status: z.string().max(20).optional(),
})

/** 回调签名密钥：DB 配置优先 → 环境变量兜底 */
function getNotifySecret(): string | null {
  try {
    const fromDb = getConfig('payment_notify_secret')?.value
    if (fromDb && fromDb.trim()) return fromDb.trim()
  } catch {
    // DB 未就绪 → 落到 env
  }
  const fromEnv = process.env.PAYMENT_NOTIFY_SECRET
  return fromEnv && fromEnv.trim() ? fromEnv.trim() : null
}

function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  try {
    return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'))
  } catch {
    return false
  }
}

/** 当前启用的支付渠道（真实渠道接入后由配置驱动） */
function enabledChannels(): string[] {
  const channels: string[] = []
  if (getNotifySecret()) channels.push('wechat', 'alipay')
  return channels
}

route.get('/channels', (c) => {
  return c.json({
    success: true,
    data: {
      channels: enabledChannels(),
      // 真实渠道需：备案域名 + HTTPS + 商户资质（外部依赖）
      mockEnabled: true,
    },
  })
})

route.post('/notify/:channel', async (c) => {
  const channel = c.req.param('channel')

  const secret = getNotifySecret()
  if (!secret) {
    return c.json({
      success: false,
      error: { code: 'PAYMENT_CHANNEL_DISABLED', message: '支付回调未启用（未配置签名密钥）' },
    }, 503)
  }

  const rawBody = await c.req.text()
  const signature = c.req.header('x-pay-signature') || ''
  if (!signature) {
    return c.json({
      success: false,
      error: { code: 'SIGNATURE_MISSING', message: '缺少签名' },
    }, 401)
  }

  const expected = createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex')
  if (!safeEqualHex(signature, expected)) {
    return c.json({
      success: false,
      error: { code: 'SIGNATURE_INVALID', message: '签名校验失败' },
    }, 401)
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(rawBody)
  } catch {
    return c.json({
      success: false,
      error: { code: 'BAD_REQUEST', message: '回调体不是合法 JSON' },
    }, 400)
  }

  const result = notifySchema.safeParse(parsed)
  if (!result.success) {
    return c.json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: result.error.issues[0]?.message || '参数错误' },
    }, 400)
  }

  const payload = result.data
  // 第三方显式声明失败（如交易关闭）→ 不结算
  if (payload.status && !['success', 'paid', 'TRADE_SUCCESS', 'SUCCESS'].includes(payload.status)) {
    return c.json({ success: true, data: { orderNo: payload.orderNo, settled: false, reason: payload.status } })
  }

  const outcome = settleOrderPaid({
    orderNo: payload.orderNo,
    tradeNo: payload.tradeNo ?? `${channel.toUpperCase()}-${Date.now()}`,
    channel,
    amountCents: payload.amountCents,
  })

  if (!outcome.ok) {
    const httpStatus = outcome.code === 'NOT_FOUND' ? 404
      : outcome.code === 'AMOUNT_MISMATCH' ? 400
        : 409
    return c.json({
      success: false,
      error: { code: outcome.code, message: outcome.message },
    }, httpStatus)
  }

  return c.json({
    success: true,
    data: {
      orderNo: outcome.order.orderNo,
      status: outcome.order.status,
      alreadySettled: outcome.alreadySettled,
      subscription: outcome.subscription,
    },
  })
})

export default route
