// ============================================================
// Phase 4C — 管理后台认证
// 文件：src/server/api/admin/auth.ts
// ============================================================

import { Hono } from 'hono'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'

const JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'mingli-admin-secret-change-me'
const TOKEN_EXPIRY = '24h'

interface LoginBody {
  username: string
  password: string
}

export const authRoute = new Hono()

// 管理员密码（首次运行时 hash，后续复用）
const ADMIN_PASSWORD_HASH = (() => {
  const pass = process.env.ADMIN_PASSWORD || 'mingli2026'
  return bcrypt.hashSync(pass, 10)
})()

authRoute.post('/auth/login', async (c) => {
  const body = await c.req.json() as LoginBody

  const adminUser = process.env.ADMIN_USERNAME || 'admin'

  if (body.username !== adminUser || !bcrypt.compareSync(body.password, ADMIN_PASSWORD_HASH)) {
    return c.json({ error: 'UNAUTHORIZED', message: '用户名或密码错误' }, 401)
  }

  const token = jwt.sign({ username: body.username, role: 'admin' }, JWT_SECRET, {
    expiresIn: TOKEN_EXPIRY,
  })

  return c.json({ token, expiresIn: TOKEN_EXPIRY })
})

/** JWT 验证中间件 */
export async function authMiddleware(c: any, next: () => Promise<void>) {
  const authHeader = c.req.header('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'UNAUTHORIZED', message: '缺少认证令牌' }, 401)
  }

  try {
    const token = authHeader.slice(7)
    const payload = jwt.verify(token, JWT_SECRET)
    c.set('adminUser', payload)
    await next()
  } catch {
    return c.json({ error: 'UNAUTHORIZED', message: '令牌无效或已过期' }, 401)
  }
}
