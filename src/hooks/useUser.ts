// ============================================================
// Phase 4b M-6 — C 端登录状态 Hook
// 文件：src/hooks/useUser.ts
// 职责：登录 / 注册 / 登出 / 额度与订阅状态
// ============================================================

import { useCallback, useEffect, useState } from 'react'
import { userApi, getUserToken, setUserToken, clearUserToken } from '../lib/user-api'

export interface CurrentUser {
  id: number
  username: string
  nickname: string | null
  status: string
  vipLevel: string
  vipExpiresAt: string | null
  quotaTotal: number
  quotaUsed: number
  quotaRemaining: number
  createdAt: string
}

export interface UserSubscription {
  vipLevel: string
  startsAt: string
  endsAt: string
  status: string
}

export function useUser() {
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [subscription, setSubscription] = useState<UserSubscription | null>(null)
  const [verifying, setVerifying] = useState(true)

  /** 拉取当前登录态（有 token 时查 /me，否则查 /status） */
  const refresh = useCallback(async () => {
    const token = getUserToken()
    if (!token) {
      setUser(null)
      setSubscription(null)
      setVerifying(false)
      return
    }

    const res = await userApi.get<{ user: CurrentUser; quotaRemaining: number; subscription: UserSubscription | null }>(
      '/api/v1/app/user/me',
    )
    if (res.success && res.data?.user) {
      setUser({ ...res.data.user, quotaRemaining: res.data.quotaRemaining })
      setSubscription(res.data.subscription ?? null)
    } else {
      // token 失效或账号不可用
      setUser(null)
      setSubscription(null)
      clearUserToken()
    }
    setVerifying(false)
  }, [])

  // 挂载时校验登录态：refresh 内部按 token 有无落状态，属「订阅外部系统」的正当用法
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { refresh() }, [refresh])

  const login = useCallback(async (account: string, password: string) => {
    const res = await userApi.post<{ token: string; user: CurrentUser }>(
      '/api/v1/app/user/login',
      { account, password },
    )
    if (!res.success || !res.data?.token) {
      throw new Error(res.error?.message || '登录失败')
    }
    setUserToken(res.data.token)
    await refresh()
    return res.data.user
  }, [refresh])

  const register = useCallback(async (input: {
    username: string
    password: string
    nickname?: string
    phone?: string
    email?: string
    /** [ADR-013] 推介邀请码（选填） */
    referralCode?: string
  }) => {
    const res = await userApi.post<{ token: string; user: CurrentUser }>(
      '/api/v1/app/user/register',
      input,
    )
    if (!res.success || !res.data?.token) {
      throw new Error(res.error?.message || '注册失败')
    }
    setUserToken(res.data.token)
    await refresh()
    return res.data.user
  }, [refresh])

  const logout = useCallback(async () => {
    await userApi.post('/api/v1/app/user/logout')
    clearUserToken()
    setUser(null)
    setSubscription(null)
  }, [])

  return {
    user,
    subscription,
    verifying,
    isLogin: !!user,
    quotaRemaining: user?.quotaRemaining ?? 0,
    refresh,
    login,
    register,
    logout,
  }
}
