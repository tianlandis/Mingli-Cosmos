# 💻 技术栈锁定（Tech Stack · Locked）

> **版本**: v2.0 | **用途**: 避免因版本不兼容引入新依赖导致问题

---

## 固定技术栈（不可随意更改）

| 层级 | 技术 | 版本 |
|------|------|:---:|
| **前端框架** | React | 19.x |
| **编程语言** | TypeScript | 6.x |
| **构建工具** | Vite | 8.x |
| **样式方案** | Tailwind CSS | v4 (via @tailwindcss/vite plugin) |
| **农历计算** | `lunar-typescript` (6tail) | latest |
| **测试** | Playwright (E2E) | latest |
| **代码规范** | ESLint | 10.x |
| **包管理** | npm | — |

---

## 设计风格（不可随意更改）

**新中式深色主题**：

| 色值 | 用途 |
|------|------|
| `#1a1410` | 深棕黑底（主背景） |
| `#c41e3a` | 朱红（强调色/主色调） |
| `#d4a853` | 鎏金（装饰/高亮） |
| `#e7d7c0` | 暖米色（正文/卡片） |

---

## 限制规则

- ❌ **不允许引入新的UI框架**（如 Ant Design, MUI）
- ❌ **不允许替换 Tailwind CSS** 为其他样式方案
- ❌ **不允许替换 lunar-typescript** 为其他农历库
- ⚠️ **新增 npm 包需评估必要性**，避免依赖膨胀
- ✅ **纯 TypeScript 工具函数**可以自由添加在 `engine/` 中

---

## 环境要求

- Node.js ≥ 18
- npm ≥ 9
- 现代浏览器（Chrome/Safari/Firefox/Edge 最新版）
