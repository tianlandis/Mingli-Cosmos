import { useState, useCallback, useEffect } from 'react'
import { getToken, setToken, clearToken, api } from '../lib/api'

interface AuthState {
  token: string | null
  isAuthenticated: boolean
}

export function useAuth() {
  const [auth, setAuth] = useState<AuthState>(() => {
    const token = getToken()
    return { token, isAuthenticated: !!token }
  })
  // 启动时 token 验证中：有 token 但尚未确认有效性
  const [verifying, setVerifying] = useState(() => !!getToken())

  // ── 启动时验证 token 有效性 ──
  useEffect(() => {
    const token = getToken()
    if (!token) {
      setVerifying(false)
      return
    }

    let cancelled = false
    api.get<{ username: string; authenticated: boolean }>('/api/v1/admin/auth/verify')
      .then(res => {
        if (cancelled) return
        if (!res.success) {
          // token 无效，清除并跳登录
          clearToken()
          setAuth({ token: null, isAuthenticated: false })
        }
        // token 有效，保持已认证状态
      })
      .catch(() => {
        if (cancelled) return
        // 网络错误：不清除 token，让 401 拦截器处理
      })
      .finally(() => {
        if (!cancelled) setVerifying(false)
      })

    return () => { cancelled = true }
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    const res = await api.post<{ token: string }>('/api/v1/admin/auth/login', { username, password })
    if (!res.success) {
      throw new Error(res.error?.message || '登录失败')
    }
    if (res.data?.token) {
      setToken(res.data.token)
      setAuth({ token: res.data.token, isAuthenticated: true })
    } else {
      throw new Error('登录响应缺少令牌')
    }
  }, [])

  const logout = useCallback(() => {
    clearToken()
    setAuth({ token: null, isAuthenticated: false })
    setVerifying(false)
  }, [])

  const apiHeaders = useCallback(() => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${auth.token}`,
  }), [auth.token])

  return { ...auth, verifying, login, logout, apiHeaders }
}
