# seeds/platform — 平台配置快照（预留）

> 数据域：**平台配置（可迁移）** → 落表 `plans` / `prompt_templates`

## 用途

存放**平台本体配置**的可迁移快照，让"后台调好的配置"也能进版本库、跨环境一键还原。

| 文件 | 内容 | 落表 |
|:--|:--|:--|
| `plans.json` | 订阅套餐定义 | `plans` |
| `prompts.json` | 默认提示词模板 | `prompt_templates` |

## 当前状态

⧗ **尚未启用**。现有配置由 `seed.ts`（代码内种子）+ 后台管理页维护，已能重建。

## 何时启用

当出现以下需求时，按 `seeds/knowledge/README.md` 的同一格式（`{ category, items[] }`）
导出配置并纳入 `npm run db:seed`：

- 需要把后台手工调好的提示词/套餐**固化为版本**；
- 需要在新环境（测试/预发/生产）**一键还原**配置；
- 需要**配置变更可 review**（走 PR 而非后台点击）。

> 实现方式：扩展 `scripts/seed-import.mts`，增加 platform 域的分发分支即可（约 20 行）。
