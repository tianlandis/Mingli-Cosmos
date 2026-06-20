// ============================================================
// Phase 4 — 模块路由自动扫描加载器
// 文件：src/server/core/router.ts
// 职责：扫描 modules/ 目录，自动注册各模块的路由
// ============================================================

import { Hono } from 'hono'
import { readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

interface ModuleDefinition {
  prefix: string        // e.g. 'auth', 'dashboard', 'llm'
  router: Hono          // Hono sub-router instance
}

/**
 * 自动扫描 modules/ 目录，动态加载并注册所有业务模块
 *
 * 约定：
 *   1. modules/<name>/index.ts 必须 export default 一个 Hono 实例
 *   2. 模块名 = 目录名 → 路由前缀 /<name>
 *   3. 若模块导出 meta: { prefix: 'custom' } 可覆盖前缀
 *
 * 用法：
 *   const adminRouter = createAdminRouter()
 *   app.route('/api/v1/admin', adminRouter)
 */
export async function createAdminRouter(): Promise<Hono> {
  const adminRouter = new Hono()
  const modulesDir = join(__dirname, '..', 'modules')
  const registered: string[] = []

  let entries: string[] = []
  try {
    entries = readdirSync(modulesDir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name)
  } catch {
    console.warn('[Router] modules/ 目录不存在，跳过模块加载')
    return adminRouter
  }

  for (const moduleName of entries) {
    const indexPath = join(modulesDir, moduleName, 'index.ts')
    try {
      const mod = await import(pathToFileURL(indexPath).href)

      // 取出 router（支持 default export 或 named export 'route'）
      const subRouter: Hono | undefined = mod.default || mod.route

      if (!subRouter || !(subRouter instanceof Hono)) {
        console.warn(`[Router] ⚠ 模块 "${moduleName}" 未导出 Hono 实例，跳过`)
        continue
      }

      // 路由前缀
      const prefix = mod.meta?.prefix || moduleName
      adminRouter.route(`/${prefix}`, subRouter)
      registered.push(moduleName)
    } catch (e: any) {
      console.warn(`[Router] ⚠ 加载模块 "${moduleName}" 失败:`, e.message)
    }
  }

  console.log(`[Router] 已注册模块 (${registered.length}): ${registered.join(', ')}`)
  return adminRouter
}
