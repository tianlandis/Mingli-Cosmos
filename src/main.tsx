// ============================================================
// C 端入口 — 路由装配
// 文件：src/main.tsx
//
// 路由结构：
//   /         排盘页（首页）
//   /discover 发现 · 新增功能的布局入口
//   /my       我的 · 用户中心
//   其他      重定向回首页（避免深链 404 白屏）
//
// 说明：生产环境由 Hono 的 SPA 兜底返回 index.html；
//       开发环境由 vite.config.ts 的中间件兜底（appType: 'mpa' 默认不做兜底）。
// ============================================================

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import PaipanPage from './pages/PaipanPage.tsx'
import DiscoverPage from './pages/DiscoverPage.tsx'
import MyPage from './pages/MyPage.tsx'

const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <PaipanPage /> },
      { path: 'discover', element: <DiscoverPage /> },
      { path: 'my', element: <MyPage /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
