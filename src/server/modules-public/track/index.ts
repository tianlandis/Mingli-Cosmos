// ============================================================
// Phase 4b M-8 — 运营埋点 API（公开路由，可选登录）
// 文件：src/server/modules-public/track/index.ts
// 路由：POST /api/v1/app/track
// ============================================================

import { Hono } from 'hono'
import { z } from 'zod'
import { optionalUserAuth, type UserEnv } from '../../core/middleware/user-auth'
import { TRACKABLE_EVENTS, trackEvent, isTrackableEvent } from '../../db'

export const route = new Hono<UserEnv>()

const trackSchema = z.object({
  event: z.string().min(1).max(32),
  sessionId: z.string().max(64).optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
})

route.post('/', optionalUserAuth, async (c) => {
  let body: unknown
  try { body = await c.req.json() } catch {
    return c.json({ success: false, error: { code: 'BAD_REQUEST', message: '请求体格式错误' } }, 400)
  }

  const parsed = trackSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message || '参数错误' },
    }, 400)
  }

  const { event, sessionId, payload } = parsed.data

  // 白名单校验：拒绝任意事件名污染看板
  if (!isTrackableEvent(event)) {
    return c.json({
      success: false,
      error: {
        code: 'UNSUPPORTED_EVENT',
        message: `不支持的事件类型，可选：${TRACKABLE_EVENTS.join(', ')}`,
      },
    }, 400)
  }

  const current = c.get('currentUser')
  const row = trackEvent({
    event,
    userId: current?.userId ?? null,
    sessionId: sessionId ?? null,
    payload: (payload ?? {}) as Record<string, unknown>,
    ip: c.req.header('x-forwarded-for')?.split(',')[0].trim()
      || c.req.header('x-real-ip')
      || null,
    userAgent: c.req.header('user-agent') ?? null,
  })

  return c.json({ success: true, data: { id: row.id, event: row.event } }, 201)
})

export default route
