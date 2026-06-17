# 八字排盘 · 版本记录

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
