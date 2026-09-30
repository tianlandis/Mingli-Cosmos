// ============================================================
// Service Worker — C 端「app shell」离线缓存
// 文件：public/sw.js（构建后原样拷贝到 dist/sw.js，由服务端以 /sw.js 提供）
//
// 目标：manifest 已上线，「加到主屏」可用；本文件补齐离线能力 ——
//       离线/弱网时仍能打开应用外壳（导航请求回退到缓存的 index.html）。
//
// 策略总览：
//   · 预缓存 app shell：/ 、/index.html 、/manifest.webmanifest 、/favicon.svg
//   · 导航请求（打开页面）→ 网络优先，失败回退缓存外壳（离线可启动）
//   · 同源静态资源（/assets/* 等 hash 文件）→ 缓存优先
//   · 跨域 Google Fonts → 缓存优先（离线字体不丢）
//   · 一律不拦截：/api/*（数据要实时）、/admin*（后台敏感，且是独立入口）、/sw.js 自身
//
// 说明：缓存名带版本；activate 时清理旧版本缓存。只要本文件内容变化，
//       浏览器即安装新版 SW 并清旧缓存。
// ============================================================

const VERSION = 'v1'
const SHELL_CACHE = `mingli-shell-${VERSION}`
const FONT_CACHE = `mingli-font-${VERSION}`

// 预缓存清单：仅放「固定路径」资源；带 hash 的 /assets/* 走运行时缓存
const SHELL_ASSETS = ['/', '/index.html', '/manifest.webmanifest', '/favicon.svg']

// 同源、且适合「缓存优先」的静态资源判定
function isStaticAsset(pathname) {
  return (
    pathname.startsWith('/assets/') ||
    pathname === '/favicon.svg' ||
    pathname === '/icons.svg' ||
    pathname === '/manifest.webmanifest'
  )
}

// ── install：预缓存外壳 ──
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE)
      await precacheShell(cache)
      // 新 SW 立即进入等待激活（配合下方 clients.claim 及时更新）
      await self.skipWaiting()
    })(),
  )
})

// 预缓存 app shell。
// 关键：构建产物文件名带 hash（/assets/index-XXXX.js），构建期才知道，无法写死在清单里。
// 因此 install 时先取 index.html，解析其引用的 JS/CSS 入口一并预缓存 ——
// 这样「首次访问安装 SW」之后即可离线打开，无需用户刷新第二次。
async function precacheShell(cache) {
  const addSafe = (url) =>
    cache.add(new Request(url, { cache: 'reload' })).catch(() => {})

  // 1) 固定清单
  await Promise.all(SHELL_ASSETS.map(addSafe))

  // 2) 取 index.html 并存入缓存，再解析其引用
  let html = ''
  try {
    const res = await fetch(new Request('/index.html', { cache: 'reload' }))
    html = await res.clone().text()
    await cache.put('/index.html', res.clone())
    await cache.put('/', res)
  } catch {
    return
  }

  const refs = new Set()
  for (const m of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    const u = m[1]
    if (u.startsWith('/assets/') || u.startsWith('https://fonts.googleapis.com/')) {
      refs.add(u)
    }
  }
  await Promise.all([...refs].map(addSafe))

  // 3) 再解析已缓存 CSS 内的 url(...)（字体/图片等），补一层
  for (const u of refs) {
    if (!u.endsWith('.css')) continue
    const hit = await cache.match(u)
    if (!hit) continue
    let css = ''
    try {
      css = await hit.clone().text()
    } catch {
      continue
    }
    const inner = new Set()
    for (const m of css.matchAll(/url\((\/assets\/[^)"']+)\)/g)) inner.add(m[1])
    await Promise.all([...inner].map(addSafe))
  }
}

// ── activate：清理旧版本缓存 + 立即接管页面 ──
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(
        keys
          .filter(
            (k) =>
              (k.startsWith('mingli-shell-') || k.startsWith('mingli-font-')) &&
              k !== SHELL_CACHE &&
              k !== FONT_CACHE,
          )
          .map((k) => caches.delete(k)),
      )
      await self.clients.claim()
    })(),
  )
})

// ── fetch：按类型分流 ──
self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return

  let url
  try {
    url = new URL(req.url)
  } catch {
    return
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return

  const sameOrigin = url.origin === self.location.origin

  // 不拦截：API / 后台 / SW 自身
  if (
    sameOrigin &&
    (url.pathname.startsWith('/api/') ||
      url.pathname === '/admin' ||
      url.pathname.startsWith('/admin/') ||
      url.pathname === '/sw.js')
  ) {
    return
  }

  // 跨域：仅处理 Google Fonts（离线字体）
  if (!sameOrigin) {
    if (
      url.hostname === 'fonts.googleapis.com' ||
      url.hostname === 'fonts.gstatic.com'
    ) {
      event.respondWith(cacheFirst(req, FONT_CACHE))
    }
    return
  }

  // 导航请求（打开页面）→ 网络优先，离线回退外壳
  if (req.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(req))
    return
  }

  // 同源静态资源 → 缓存优先
  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirst(req, SHELL_CACHE))
  }
})

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName)
  const hit = await cache.match(req)
  if (hit) return hit
  try {
    const res = await fetch(req)
    // 仅缓存成功响应 / 跨域不透明响应
    if (res && (res.ok || res.type === 'opaque')) {
      cache.put(req, res.clone()).catch(() => {})
    }
    return res
  } catch (err) {
    const fallback = await cache.match(req)
    if (fallback) return fallback
    throw err
  }
}

async function networkFirstNavigation(req) {
  const cache = await caches.open(SHELL_CACHE)
  try {
    const res = await fetch(req)
    // 顺带刷新外壳副本（下次离线用最新的 index.html）
    cache.put('/index.html', res.clone()).catch(() => {})
    return res
  } catch (err) {
    const shell =
      (await cache.match('/index.html')) || (await cache.match('/'))
    if (shell) return shell
    throw err
  }
}
