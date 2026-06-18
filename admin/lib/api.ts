// ============================================================
// Phase 5 — 统一 API 客户端（JWT 自动注入 + 全局 401 拦截）
// 文件：admin/lib/api.ts
// 职责：所有 /api/v1/admin/* 请求的统一出口
// ============================================================

const TOKEN_KEY = 'admin_token'

// ── 401 全局回调（由 App.tsx 注册） ──
let onUnauthorized: (() => void) | null = null

export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler
}

// ── Token 管理 ──
export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
}

// ── 响应类型 ──
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: { code: string; message: string }
  message?: string
}

// ── 核心 fetch 封装 ──
export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<ApiResponse<T>> {
  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  // 合并用户自定义 headers（不覆盖 Content-Type 和 Authorization）
  if (options.headers) {
    const userHeaders = options.headers as Record<string, string>
    Object.assign(headers, userHeaders)
  }

  let res: Response
  try {
    res = await fetch(path, { ...options, headers })
  } catch {
    return {
      success: false,
      error: { code: 'NETWORK_ERROR', message: '网络连接失败，请检查服务是否启动' },
    }
  }

  // ═══ 全局 401 拦截 ═══
  if (res.status === 401) {
    clearToken()
    if (onUnauthorized) onUnauthorized()
    try {
      const body = await res.json()
      return {
        success: false,
        error: body?.error || { code: 'UNAUTHORIZED', message: '认证已过期，请重新登录' },
      }
    } catch {
      return {
        success: false,
        error: { code: 'UNAUTHORIZED', message: '认证已过期，请重新登录' },
      }
    }
  }

  // ═══ 解析 JSON ═══
  try {
    const data = await res.json()
    return data
  } catch {
    // 非 JSON 响应（如 204 No Content）
    if (res.ok) {
      return { success: true, data: undefined as unknown as T }
    }
    return {
      success: false,
      error: { code: 'PARSE_ERROR', message: `服务返回异常 (${res.status})` },
    }
  }
}

// ── 便捷方法 ──
export const api = {
  get: <T = unknown>(path: string) =>
    apiFetch<T>(path),

  post: <T = unknown>(path: string, body?: unknown) =>
    apiFetch<T>(path, {
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),

  put: <T = unknown>(path: string, body?: unknown) =>
    apiFetch<T>(path, {
      method: 'PUT',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),

  patch: <T = unknown>(path: string, body?: unknown) =>
    apiFetch<T>(path, {
      method: 'PATCH',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),

  delete: <T = unknown>(path: string) =>
    apiFetch<T>(path, { method: 'DELETE' }),
}

export default api
