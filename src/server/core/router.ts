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

/**
 * 自动扫描指定模块目录，动态加载并注册所有业务模块
 *
 * 约定：
 *   1. <dir>/<name>/index.ts 必须 export default 一个 Hono 实例
 *   2. 模块名 = 目录名 → 路由前缀 /<name>
 *   3. 若模块导出 meta: { prefix: 'custom' } 可覆盖前缀
 */
export async function createModuleRouter(dirName: string): Promise<Hono> {
  const router = new Hono()
  const modulesDir = join(__dirname, '..', dirName)
  const registered: string[] = []

  let entries: string[] = []
  try {
    entries = readdirSync(modulesDir, { withFileTypes: true })
      .filter(d => d.isDirectory() && !d.name.startsWith('__'))  // 跳过 __tests__ 等辅助目录
      .map(d => d.name)
  } catch {
    console.warn(`[Router] ${dirName}/ 目录不存在，跳过模块加载`)
    return router
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
      router.route(`/${prefix}`, subRouter)
      registered.push(moduleName)
    } catch (e: any) {
      console.warn(`[Router] ⚠ 加载模块 "${moduleName}" 失败:`, e.message)
    }
  }

  console.log(`[Router] ${dirName} 已注册模块 (${registered.length}): ${registered.join(', ')}`)
  return router
}

/**
 * 管理后台路由（modules/ → /api/v1/admin/*）
 *
 * 用法：
 *   const adminRouter = await createAdminRouter()
 *   app.route('/api/v1/admin', adminRouter)
 */
export async function createAdminRouter(): Promise<Hono> {
  return createModuleRouter('modules')
}

/**
 * C 端公开路由（modules-public/ → /api/v1/app/*）
 * 与后台模块分开存放，避免后台鉴权中间件误伤 C 端接口
 */
export async function createPublicRouter(): Promise<Hono> {
  return createModuleRouter('modules-public')
}
