import { useState, useCallback } from 'react'

interface AuthState {
  token: string | null
  isAuthenticated: boolean
}

const TOKEN_KEY = 'admin_token'

function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function useAuth() {
  const [auth, setAuth] = useState<AuthState>(() => {
    const token = getStoredToken()
    return { token, isAuthenticated: !!token }
  })

  const login = useCallback(async (username: string, password: string) => {
    const res = await fetch('/api/v1/admin/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.message || err.error?.message || '登录失败')
    }
    const data = await res.json()
    localStorage.setItem(TOKEN_KEY, data.data.token)
    setAuth({ token: data.data.token, isAuthenticated: true })
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    setAuth({ token: null, isAuthenticated: false })
  }, [])

  const apiHeaders = useCallback(() => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${auth.token}`,
  }), [auth.token])

  return { ...auth, login, logout, apiHeaders }
}
