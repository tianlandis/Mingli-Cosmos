# 数字命理推演引擎 · 版本记录

---

## v4.0.0 — 生产就绪 MVP (2026-06-18)

> **主题**：容器化 + 品牌升级 + 未来架构规划
>
> Tag: `v4.0.0` | Commit: `78ebcd2` | GitHub: [tianlandis/bazipaipan](https://github.com/tianlandis/bazipaipan)

---

### 🏗️ 架构升级：Vite + Hono 生产同构

- Hono 后端服务框架 (port 3001)，同时承载 API 与前端静态文件
- Vite 生产打包：dist/ 输出 SPA，Hono SPA fallback 路由
- 环境判定：`--prod` CLI flag 或 `NODE_ENV=production`
- 一键启动：`npm run start` → vite build + tsx --prod 自托管

### 🎨 UI 重构：大运竖轴 + 专题 Tab

- LuckTimeline.tsx：竖向时间轴，年龄/干支/quality 徽章，当前大运高亮
- TopicTabs.tsx：6 个专题 Tab（性格/事业/财运/婚姻/健康/子女）
- ChatPanel.tsx：A 模式对话 Copilot，SSE 流式渐入渲染
- ReportView.tsx：命书全量展示

### 🤖 算力增强：AI 全链路流水线

- LLM Provider 抽象层：统一 4 种后端（DeepSeek/OpenAI/Claude/Ollama）
- SOP 三阶段流水线：性格格局 → 运势趋势 → 报告装配
- System Prompt 构建器 + Guardrail 护栏 + SSE 流式响应
- AI SDK v6 SSE 兼容性修复（手动构建 text/event-stream）

### 🧪 测试稳固：186 项零失败

- vitest 3.2.4，7/7 文件全覆盖（calculator/patternRules/celebrity/e2e/guardrail/prompts/workflows）
- tsc --noEmit + vite build 回归通过

### 🐳 容器化：Docker + Nginx 部署方案

- `Dockerfile` 多阶段构建（build → 极简生产镜像，alpine 基镜像）
- `docker-compose.yml` 端口映射 3001:3001 + .env volumes 动态挂载 + restart: always
- `nginx.conf` SSE 流式代理专项优化（proxy_buffering off + chunked_transfer_encoding on）

### 📋 品牌升级 & 路线图

- 项目更名为"数字命理推演引擎"
- README 重写：古籍真传校准 + LLM 语义增强混合机制
- 双轨演进路线 v4.0.0+（功能轨 6 阶段 + 设计轨 3 优先级 S0/S1/S2）
- 未来架构规划：Phase 4a 管理后台 + 数据库 + 动态配置双轨路由

---

## v3.0 — 内核稳定版 (2026-06-17)

> **主题**：算法稳定 + 测试体系 + CI/CD + Bug 修复 + UI 规划
>
> Tag: `v3.0` | Commit: `06eae84` | GitHub: [tianlandis/bazipaipan](https://github.com/tianlandis/bazipaipan)

---

### 🔴 关键 Bug 修复

**`wuxing.ts` — `getShiShenName()` 参数颠倒**
- `getWuXingRelation(target, dayMaster)` → `getWuXingRelation(dayMaster, target)`
- 此前以 target 为"我"计算十神关系，导致全引擎十神判断颠倒
- **影响范围**：4 个调用点（patternRules.ts × 1, luckAnalysis.ts × 3）
- **严重程度**：P0 — 格局判断、大运流年解读均受影响

### ✅ 测试体系（从零搭建）

| 文件 | 用例数 | 覆盖范围 |
|------|:--:|------|
| `tests/calculator.test.ts` | 21 | 藏干表、五行常量、六合/三会/三合/六冲表 |
| `tests/patternRules.test.ts` | 18 | 格局判断、透干/分金、组合判定、破格风险 |

- 框架：`vitest`
- 运行：`npm test` — **39/39 全部通过**

### 🛠 工程化

| 项目 | 说明 |
|------|------|
| `vitest.config.ts` | vitest 配置 |
| `.prettierrc` | 格式化规则（无分号、单引号、尾逗号） |
| `.github/workflows/ci.yml` | CI 流程：lint → typecheck → test → build |
| `package.json` | 新增 `typecheck` + `test` scripts |

### 📚 文档

- **清理 5 个文件**：移除过时的 `yongShen.ts` 引用（V2.1 废弃用神忌神体系）
  - `ARCHITECTURE.md` — 流水线、组件表、文件表、输出 json 示例
  - `contracts/engine-api.md` — 文件引用表
  - `rules/04-qiangruo-yongshen.md` — 代码引用
- **新增**：`docs/design/UI_DESIGN_RECOMMENDATIONS.md` — 基于 frontend-design 方法论的全面 UI 评审

### 🧪 算法已验证

- 透干/分金/比劫逻辑对齐 Python MCP（v2.1 完成）
- `HIDDEN_STEMS` 数据对齐 3 个 MD 规则文件（v2.1 完成）
- `npm run build` ✓ | `npx tsc --noEmit` 零错误

---

### 版本统计数据

```
文件变更:  12 files, +1741 -30
测试覆盖:  39 tests (2 files)
新增文件:  7 (.github/ci.yml, .prettierrc, vitest.config.ts,
               tests/calculator.test.ts, tests/patternRules.test.ts,
               docs/design/UI_DESIGN_RECOMMENDATIONS.md, docs/CHANGELOG.md)
依赖变更:  3 新增 (vitest, @testing-library/react, jsdom)
```

---

## v2.1 — 核心算法对齐 (2026-06-17)

> Tag: `v2.1` | 主题：核心算法对齐 Python MCP + 架构文档完善

- 透干阶段：`resolveTouGan()` 新增比劫跳过逻辑
- 分金逆排：`resolveFenJin()` 重写反向迭代
- 亥月特规：分金去戊
- 比劫不成格：简化逻辑对齐 MCP
- 藏干修正：丑月顺序改为 癸→辛→己
- 残留代码清理：3 个未使用删除表
- 文档架构：`docs/arch/ALGORITHM-AUTHORITY.md` + 拆分策略

## v1.1 — 规则引擎增强

- 格局判断支持：内格/外格 + 四正月/透干/分金备选路径
- 神煞分析、五行平衡、十神配置
- 经典引证系统（《渊海子平》《三命通会》）

## v1.0 — 初始版本

- 四柱八字排盘
- 大运流年计算
- 基础批注输出
