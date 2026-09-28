import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  appType: 'mpa',
  plugins: [
    tailwindcss(),
    react(),
    {
      name: 'spa-fallback',
      configureServer(server) {
        server.middlewares.use((req, _res, next) => {
          const url = req.url ?? ''
          if (req.method !== 'GET') return next()
          // WebSocket（HMR）不拦截
          if (req.headers.upgrade) return next()

          const path = url.split('?')[0]

          // 管理后台：/admin/* 非静态资源 → admin/index.html
          if (path === '/admin' || path.startsWith('/admin/')) {
            if (path.includes('.') || path.startsWith('/admin/api')) return next()
            req.url = '/admin/index.html'
            return next()
          }

          // API 走代理；Vite 内部路径（/@vite、/@react-refresh、/__*）不拦截
          if (path.startsWith('/api') || path.startsWith('/@') || path.startsWith('/__')) return next()
          // 带扩展名的静态资源直接放行
          if (path.includes('.')) return next()

          // C 端 SPA 兜底：appType: 'mpa' 时 Vite 不做客户端路由兜底（默认只认 /），
          // 直接访问 /my 会 404。这里把无后缀路径交回 index.html。
          req.url = '/index.html'
          next()
        })
      },
    },
  ],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    minify: 'esbuild',
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        admin: path.resolve(__dirname, 'admin/index.html'),
      },
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
