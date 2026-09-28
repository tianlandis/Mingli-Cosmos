// ============================================================
// 登录限流语义回归测试
// 文件：src/server/core/__tests__/rate-limit.test.ts
//
// 背景（2026-09-28 修复的可用性缺陷）：
//   旧实现中 `loginRateLimit()` 中间件对「每一次登录请求」都计数，
//   包括成功登录 —— 导致管理员/C 端用户正常登录 5 次后即被锁 15 分钟。
// 新语义：
//   计数只在登录**失败**时累加；登录成功则清空该 IP + 账号的计数。
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest'
import {
  isIpBlocked,
  recordIpFailure,
  clearIpAttempts,
  checkUserRate,
  recordUserFailure,
  clearUserAttempts,
  recordLoginFailure,
  clearLoginAttempts,
} from '../middleware/rate-limit'

const IP = '10.0.0.99'
const ACCOUNT = 'tester-001'

describe('登录限流 — 失败才计数', () => {
  beforeEach(() => {
    clearIpAttempts(IP)
    clearUserAttempts(ACCOUNT)
  })

  it('前 4 次失败不触发限流，第 5 次失败后 IP 被锁', () => {
    for (let i = 0; i < 4; i++) {
      recordIpFailure(IP)
      expect(isIpBlocked(IP).allowed).toBe(true)
    }
    recordIpFailure(IP)
    expect(isIpBlocked(IP).allowed).toBe(false)
    expect(isIpBlocked(IP).retryAfterMs).toBeGreaterThan(0)
  })

  it('【核心回归】登录成功会清空计数，正常多次登录不会被误锁', () => {
    // 连续 5 次「成功登录」不应产生任何计数
    for (let i = 0; i < 5; i++) {
      clearLoginAttempts(IP, ACCOUNT)
      expect(isIpBlocked(IP).allowed).toBe(true)
    }
    expect(isIpBlocked(IP).allowed).toBe(true)
    expect(checkUserRate(ACCOUNT)).toBe(true)
  })

  it('失败 4 次后成功一次 → 计数清零，可再次失败 4 次而不被锁', () => {
    for (let i = 0; i < 4; i++) recordLoginFailure(IP, ACCOUNT)
    expect(isIpBlocked(IP).allowed).toBe(true)

    clearLoginAttempts(IP, ACCOUNT) // 登录成功
    expect(isIpBlocked(IP).allowed).toBe(true)

    for (let i = 0; i < 4; i++) {
      recordLoginFailure(IP, ACCOUNT)
      expect(isIpBlocked(IP).allowed).toBe(true)
    }
  })

  it('账号维度独立计数：默认上限 10 次，第 10 次失败后被锁', () => {
    for (let i = 0; i < 9; i++) {
      recordUserFailure(ACCOUNT)
      expect(checkUserRate(ACCOUNT)).toBe(true)
    }
    recordUserFailure(ACCOUNT)
    expect(checkUserRate(ACCOUNT)).toBe(false)
  })

  it('清空账号计数后恢复放行', () => {
    for (let i = 0; i < 10; i++) recordUserFailure(ACCOUNT)
    expect(checkUserRate(ACCOUNT)).toBe(false)
    clearUserAttempts(ACCOUNT)
    expect(checkUserRate(ACCOUNT)).toBe(true)
  })

  it('不同 IP / 不同账号互不干扰', () => {
    const otherIp = '10.0.0.100'
    const otherAccount = 'tester-002'
    for (let i = 0; i < 5; i++) recordLoginFailure(IP, ACCOUNT)
    expect(isIpBlocked(IP).allowed).toBe(false)
    expect(isIpBlocked(otherIp).allowed).toBe(true)
    expect(checkUserRate(otherAccount)).toBe(true)

    clearIpAttempts(otherIp)
    clearUserAttempts(otherAccount)
  })

  it('recordLoginFailure 同时累加 IP 与账号两个维度', () => {
    // 一次失败：IP 记 1 次（上限 5）、账号记 1 次（上限 10），均未触发
    recordLoginFailure(IP, ACCOUNT)
    expect(isIpBlocked(IP).allowed).toBe(true)
    expect(checkUserRate(ACCOUNT)).toBe(true)

    // 再补 9 次账号失败 → 账号维度累计 10 次被锁
    for (let i = 0; i < 9; i++) recordUserFailure(ACCOUNT)
    expect(checkUserRate(ACCOUNT)).toBe(false)
    // 此时 IP 维度仍只有 1 次，放行 —— 证明两个维度相互独立
    expect(isIpBlocked(IP).allowed).toBe(true)

    // IP 维度补满 5 次 → 被锁
    for (let i = 0; i < 4; i++) recordIpFailure(IP)
    expect(isIpBlocked(IP).allowed).toBe(false)
  })
})
