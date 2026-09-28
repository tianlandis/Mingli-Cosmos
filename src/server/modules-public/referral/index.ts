// ============================================================
// [ADR-013] 推介奖励 — C 端公开路由
// 文件：src/server/modules-public/referral/index.ts
// 挂载：/api/v1/app/referral（目录约定自动扫描，见 core/router.ts）
//
//   GET  /me   我的邀请码 + 推介战绩（需登录）
//   POST /bind 补绑邀请码（需登录；仅限尚未绑定者）
//
// 绑定关系、达标、奖励发放的幂等语义见 repositories/referrals.ts。
// ============================================================

import { Hono } from 'hono'
import { z } from 'zod'
import { userAuthMiddleware, type UserEnv } from '../../core/middleware/user-auth'
import {
  encodeReferralCode,
  getReferralStats,
  getReferralRewardQuota,
  bindReferralByCode,
} from '../../db'

export const route = new Hono<UserEnv>()

const bindSchema = z.object({
  code: z.string().min(1, '请输入邀请码').max(32, '邀请码过长'),
})

// ═══════════════════════════════════════
// GET /me — 我的邀请码与战绩
// ═══════════════════════════════════════

route.get('/me', userAuthMiddleware, (c) => {
  const current = c.get('currentUser')!
  const stats = getReferralStats(current.userId)
  return c.json({
    success: true,
    data: {
      code: encodeReferralCode(current.userId),
      rewardQuota: getReferralRewardQuota(),
      ...stats,
    },
  })
})

// ═══════════════════════════════════════
// POST /bind — 补绑邀请码
// ═══════════════════════════════════════

route.post('/bind', userAuthMiddleware, async (c) => {
  let body: unknown
  try { body = await c.req.json() } catch {
    return c.json({ success: false, error: { code: 'BAD_REQUEST', message: '请求体格式错误' } }, 400)
  }
  const parsed = bindSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message || '参数错误' },
    }, 400)
  }

  const current = c.get('currentUser')!
  const res = bindReferralByCode(current.userId, parsed.data.code)
  if (!res.ok) {
    const messages: Record<string, string> = {
      INVALID_CODE: '邀请码无效',
      SELF_REFERRAL: '不能绑定自己的邀请码',
      REFERRER_NOT_FOUND: '邀请人不存在',
      ALREADY_BOUND: '你已绑定过邀请码',
    }
    const status = res.reason === 'ALREADY_BOUND' ? 409 : 400
    return c.json({
      success: false,
      error: { code: res.reason || 'BIND_FAILED', message: messages[res.reason || ''] || '绑定失败' },
    }, status)
  }

  return c.json({ success: true, data: { bound: true } }, 201)
})

export default route
