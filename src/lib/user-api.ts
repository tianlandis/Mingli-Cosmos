// ============================================================
// Phase 4b M-6 — C 端 API 客户端
// 文件：src/lib/user-api.ts
// 职责：token 存取 + /api/v1/app/* 请求统一出口
// ============================================================

const TOKEN_KEY = 'ml_user_token'

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: { code: string; message: string }
  message?: string
}

// ── Token 管理 ──

export function getUserToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY) } catch { return null }
}

export function setUserToken(token: string) {
  try { localStorage.setItem(TOKEN_KEY, token) } catch { /* 隐私模式忽略 */ }
}

export function clearUserToken() {
  try { localStorage.removeItem(TOKEN_KEY) } catch { /* ignore */ }
}

// ── 请求封装 ──

export async function userApiFetch<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<ApiResponse<T>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  }
  const token = getUserToken()
  if (token) headers.Authorization = `Bearer ${token}`

  try {
    const res = await fetch(path, { ...options, headers })

    // 令牌失效：清理本地状态，交给上层重新拉取登录态
    if (res.status === 401 && token) clearUserToken()

    const data = await res.json().catch(() => ({
      success: false,
      error: { code: 'PARSE_ERROR', message: `服务返回异常 (${res.status})` },
    }))
    return data as ApiResponse<T>
  } catch {
    return {
      success: false,
      error: { code: 'NETWORK_ERROR', message: '网络连接失败，请稍后重试' },
    }
  }
}

export const userApi = {
  get: <T = unknown>(path: string) => userApiFetch<T>(path),
  post: <T = unknown>(path: string, body?: unknown) =>
    userApiFetch<T>(path, {
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  put: <T = unknown>(path: string, body?: unknown) =>
    userApiFetch<T>(path, {
      method: 'PUT',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
}

// ═══════════════════════════════════════
// 运营埋点（Phase 4b M-8）
// ═══════════════════════════════════════

const SESSION_KEY = 'ml_session_id'

/** 匿名会话 ID：首次访问生成，用于未登录用户的埋点归因 */
export function getSessionId(): string {
  try {
    let id = localStorage.getItem(SESSION_KEY)
    if (!id) {
      id = `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
      localStorage.setItem(SESSION_KEY, id)
    }
    return id
  } catch {
    return 'anonymous'
  }
}

/**
 * 上报埋点事件
 * 失败静默（埋点不应影响主流程），且使用 keepalive 保证页面跳转时也能送达
 */
export function track(
  event: string,
  payload?: Record<string, unknown>,
): void {
  try {
    fetch('/api/v1/app/track', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(getUserToken() ? { Authorization: `Bearer ${getUserToken()}` } : {}),
      },
      body: JSON.stringify({ event, payload, sessionId: getSessionId() }),
      keepalive: true,
    }).catch(() => { /* 埋点失败不影响业务 */ })
  } catch {
    /* ignore */
  }
}
