import { useState, useCallback } from 'react'
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
  }, [])

  const apiHeaders = useCallback(() => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${auth.token}`,
  }), [auth.token])

  return { ...auth, login, logout, apiHeaders }
}
