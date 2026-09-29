# 测试期模式切换：额度统一 1 + LLM 全本地 Ollama

> 日期：2026-09-29 ｜ 环境：内网 `192.168.2.10:3001` ｜ 提交：`6af7d64` → `f873358` → `3eb1bbb`

---

## 一、额度统一为 1

### 背景
原「额度倒挂」：新用户初始 `quota_total=5`，命书扣 5、合盘扣 20 → 新用户第一次点合盘必 402。
田哥决定：**测试阶段所有消耗统一改成 1**。

### 代码改动
| 位置 | 原值 | 现值 | 说明 |
|:--|:--:|:--:|:--|
| `src/server/api/chat.ts` | 1（硬编码） | 1 | 不变 |
| `src/server/api/report.ts` | `DEFAULT_COST=5` | **1** | 仍可被后台 `report_quota_cost` 覆盖 |
| `src/server/modules-public/synastry/index.ts` | `DEFAULT_COST=20`（**硬编码，不可配**） | **1** | 新增 `readCost()`，读后台 `synastry_quota_cost` |
| `src/lib/credits.ts`（前端展示） | report 5 / synastry 20 | **1 / 1** | 与真实扣费对齐，避免 UI 撒谎 |

### 运行时配置（内网 DB `app_configs`，热生效，重建不丢）
```
report_quota_cost   = 1
synastry_quota_cost = 1
```
后台可视化改：系统配置页即可；或 `POST /api/v1/admin/config {key,value,displayName,valueType:'number'}`。

---

## 二、LLM 全部切到本机 Ollama

### 端点现状（内网 `api_keys` 表）
| # | role | 状态 | 端点 | 说明 |
|:-:|:--|:--:|:--|:--|
| 1 | — | ⛔ 已停用 | `172.17.0.1:9090` simple-one-api | 上游无健康 provider（`no healthy provider ... glm-4.5-flash`），此前是全局默认 |
| 4 | fast | ✅ **全局默认** | `http://192.168.2.197:11434/v1` qwen2.5:7b | 对话 / 路由 / Multi-Agent |
| 5 | deep | ✅ | `http://192.168.2.197:11434/v1` qwen2.5:7b | 命书 Step1/Step2 |

### `.env` 同步（`/opt/mingli/.env`，兜底路径，避免 DB 异常时回落坏网关）
```
LLM_PROVIDER=local
LLM_API_KEY=ollama
LLM_BASE_URL=http://192.168.2.197:11434/v1
LLM_MODEL=qwen2.5:7b
LLM_TIMEOUT_MS=180000
```

> ⚠️ `.env` 是**挂载文件**（`./.env:/app/.env:ro`）由应用自行读取，**不是容器环境变量** —— `docker exec env | grep LLM_` 查不到属正常。

---

## 三、顺手修复：LLM 单步超时可配

本地 7B 跑命书（多步、长输出）超过原定 30s 硬超时 → 命书 500（`LLM_TIMEOUT`），且失败会**白重试一次**（30s×2=60s）。

- `src/server/lib/llm.ts`：超时改读 `LLM_TIMEOUT_MS`（默认仍 30s，**不改变原行为**）
- 命中 `LLM_TIMEOUT` **不再重试**（模型慢，重试只会再等一整个窗口）

---

## 四、后台 20 处裸 fetch 收口

admin 有 20 处直接 `fetch()` + 手工拼 `Authorization`，绕过 `admin/lib/api.ts` 的统一封装
→ token 过期**不触发 401 拦截**、不自动清 token 跳登录。

已全部改为 `api.get/post/put/delete`，并移除贯穿组件的 `apiHeaders` prop 链
（`useAuth` 不再导出）。涉及：`AuditLog`、`ConfigPanel`、`DashboardPage`、`LLMPage`、
`ProviderForm`、`SkillsPanel`、`ToolCallingPanel`、`App.tsx`、`hooks/useAuth.ts`。

---

## 五、实测结果（内网）

| 项目 | 结果 |
|:--|:--|
| C 端注册 → 排盘 → 命书 | **200 / 114.3s / 扣 1 额度**（此前 500，超时所致） |
| 双人合盘 | **200 / 扣 1 额度**（此前硬编码 20 → 新用户必 402） |
| 失败不计费 | ✅ 命书 500 那次额度 5→5，未扣 |
| 后台页面 | `/admin`、`/admin/llm`、`/admin/config`、`/admin/dashboard`、`/admin/audit` 全部 200 且 `admin-root=true` |
| 静态资源 | `/assets/admin-*.js` 200 |
| smoke | **42/42** |
| typecheck / vitest / build | 0 错 / **533/533** / ✓ |

---

## 六、遗留 / 待办

1. **命书 114s 偏慢**（本地 7B × 多步）。若嫌慢可：本机设 `OLLAMA_KEEP_ALIVE=-1` 让模型常驻（免冷加载 30~70s），或给 deep 换更强/更快的云端模型。
2. **新用户初始额度仍 5**（schema 硬编码），测试期消耗 1 → 够测 5 次；要更大需 migration 或后台逐个加。**建议做成可配（`new_user_quota`），待拍板。**
3. **#1 GLM 网关**待修（修 simple-one-api 渠道后，后台点一下「命书」按钮即可切回）。
4. 生产 VPS 后台密码是否同步改 `wwww0000`（公网弱口令有风险，未擅动）。
