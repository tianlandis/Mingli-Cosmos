# Phase 4 管理后台前端源码

> 此目录为 Phase 4 "动态配置与管理后台" 预留。
> 当前为架构规划阶段（2026-06-18），暂不实现。

## 规划文件结构

```
admin/
├── index.html              # 入口 HTML（独立 SPA）
├── main.tsx                # React 入口
├── App.tsx                 # 路由 + 布局
├── components/
│   ├── Layout.tsx          # 后台布局（侧边栏 + 顶栏）
│   ├── ApiKeyManager.tsx   # API Key 可视化管理面板
│   ├── PromptEditor.tsx    # Prompt 模板编辑器
│   ├── ConfigPanel.tsx     # 全局配置面板
│   ├── SessionList.tsx     # 会话列表
│   └── AuditLog.tsx        # 操作日志
├── hooks/
│   ├── useAuth.ts          # 登录态管理
│   └── useConfigApi.ts     # 配置 API 调用
└── styles/
    └── admin.css           # 后台专用样式
```

> 详细规划见 `docs/arch/ARCHITECTURE-FUTURE.md`
