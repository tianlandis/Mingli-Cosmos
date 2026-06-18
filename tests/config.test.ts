// ============================================================
// Phase 4B — 双轨配置路由测试
// 文件：tests/config.test.ts
// ============================================================

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { initDb, closeDb, setConfig } from '@/server/db'

beforeAll(() => {
  process.env.DB_PATH = ':memory:'
  initDb()
})

afterAll(() => { closeDb() })

describe('双轨配置路由', () => {
  it('.env 回退：数据库无配置时读环境变量', async () => {
    // Import after setting up env
    const { getAppConfig } = await import('@/server/config')
    const config = getAppConfig()
    expect(config.source).toBe('env')
    expect(config.provider).toBeDefined()
    expect(config.temperature).toBeGreaterThan(0)
  })

  it('DB 优先：写入数据库后读取', async () => {
    setConfig('default_llm_provider', 'siliconflow', '默认厂商')
    setConfig('default_llm_model', 'deepseek-ai/DeepSeek-V3', '默认模型')
    setConfig('default_temperature', '0.8', '温度')

    // reload to bypass cache
    const { reloadConfig } = await import('@/server/config')
    const config = reloadConfig()
    expect(config.source).toBe('db')
    expect(config.provider).toBe('siliconflow')
    expect(config.model).toBe('deepseek-ai/DeepSeek-V3')
    expect(config.temperature).toBe(0.8)
  })

  it('缓存：60s 内返回相同对象', async () => {
    const { getAppConfig, reloadConfig } = await import('@/server/config')
    const c1 = getAppConfig()
    const c2 = getAppConfig()
    expect(c1).toBe(c2) // 相同引用 = 缓存在生效

    reloadConfig()
    const c3 = getAppConfig()
    expect(c3.provider).toBe('siliconflow')
  })

  it('isUsingDbConfig 判断正确', async () => {
    const { isUsingDbConfig } = await import('@/server/config')
    expect(isUsingDbConfig()).toBe(true)
  })

  it('getAllDbConfigs 返回所有配置', async () => {
    const { getAllDbConfigs } = await import('@/server/config')
    const configs = getAllDbConfigs()
    expect(configs.length).toBeGreaterThanOrEqual(3)
  })
})
