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
      name: 'admin-spa-fallback',
      configureServer(server) {
        server.middlewares.use((req, _res, next) => {
          const url = req.url ?? ''
          // SPA fallback: 所有 /admin/* 非静态资源路径 → admin/index.html
          if (
            url.startsWith('/admin') &&
            !url.includes('.') &&           // 排除静态资源 (.js/.css/.svg...)
            !url.startsWith('/admin/api')    // 排除 API 代理
          ) {
            req.url = '/admin/index.html'
          }
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
