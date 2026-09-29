# 测试期全站免费 + 后台计费设置 + 用户会员等级（2026-09-29）

> commit `3500180` ｜ 部署内网 `192.168.2.10:3001`
> 基线：typecheck 0 错 ｜ vitest **542/542**（33 文件）｜ build ✓ ｜ 内网 smoke **42/42**

---

## 一、需求

田哥（测试阶段）：

1. **排盘、命书生成全部免费**，最好后台也能设置；
2. 后台**用户注册列表**里没有手动设置**会员等级**的入口；
3. **命书使用额度、排盘额度**都要能后台手动设置；
4. 测试阶段能用的功能先全上；
5. **以后公网 VPS 不再上线，直接在本地/内网测试**。

---

## 二、方案

### 核心：唯一计费入口 `src/server/lib/billing.ts`

把「每个功能扣多少额度」从 3 处各自实现（report / synastry / chat 各有一份 `readCost`）
收敛到一个模块，并叠加一个**全站免费开关**：

| 配置键（app_configs） | 含义 | 默认 |
|:--|:--|:--:|
| `free_mode` | 全站免费（测试期）——开启后所有成本视为 0 | 关 |
| `chart_quota_cost` | 排盘额度 | **0（免费）** |
| `report_quota_cost` | 命书额度 | 1 |
| `synastry_quota_cost` | 双人合盘额度 | 1 |
| `chat_quota_cost` | AI 对话额度 | 1 |

- `isBillingFree()` → 读 `free_mode`；
- `readQuotaCost(feature)` → **计费调用点唯一入口**，免费模式恒返回 0；
- `readConfiguredCost(feature)` → 返回配置值（不受免费模式影响，供后台编辑展示）；
- `getBillingSnapshot()` → 同时给出「配置值 `costs`」与「生效值 `effectiveCosts`」，后台如实展示。

### `reserveQuota` 放开 `cost = 0`

原来 `cost <= 0` 直接抛错。现在允许 `cost = 0`：

- 仍写一条 `delta = 0` 的台账 → **幂等语义完全不变**（同一 key 复用首次结果）；
- 不改变用户余额（`quotaUsed` 不动）；
- `cost = 0` 时**余额不参与判断**（超额账号也能用免费功能）。

这样计费调用点**完全不用改逻辑**——免费只是「成本读成 0」，`reserve/commit/refund` 三段照跑。

### 各计费点

| 端点 | 原 | 现 |
|:--|:--|:--|
| `POST /api/report`（命书） | 本地 `readCost()` 读 `report_quota_cost` | `readQuotaCost('report')` |
| `POST /api/v1/app/synastry` | 本地 `readCost()` 读 `synastry_quota_cost` | `readQuotaCost('synastry')` |
| `POST /api/chat`（对话） | 硬编码 `cost: 1` | `readQuotaCost('chat')` |
| `POST /api/v1/app/chart`（排盘） | **不扣费** | 新增可配额度，默认 0；仅登录用户且 cost>0 才扣，落库失败自动退款 |

### 后台接口

```
GET  /api/v1/admin/billing  → { freeMode, costs, effectiveCosts, features, labels, defaults }
PUT  /api/v1/admin/billing  → { freeMode?, costs? }  写 app_configs + 即时 reloadConfig + 审计
```

### 后台 UI

- **`admin/components/BillingPanel.tsx`**（挂在「系统配置」页）：
  全站免费模式总开关 + 排盘/命书/合盘/对话 四个额度输入，
  每行显示「配置值（可编辑）」与「当前生效值」，dirty 才亮保存按钮。
- **`admin/modules/users/UsersPage.tsx`**：操作列新增「设置会员等级」（皇冠图标）→
  弹窗选 `free / basic / pro` + 到期时间（留空=永久）。
  复用**早已存在**的 `PATCH /api/v1/admin/users/:id`（后端支持 `vipLevel` / `vipExpiresAt`，此前只是没有 UI 入口）。

---

## 三、内网实测（`BASE=http://192.168.2.10:3001`）

```
[1] BILLING GET  200  {"freeMode":false,"costs":{chart:0,report:1,synastry:1,chat:1},...}
[2] BILLING PUT  200  freeMode:true → effectiveCosts 全 0（复查已持久化）
[3] 注册(初始额度 5) → 排盘 200 扣 0 → 命书 200/79.8s 扣 0 → 合盘 200 扣 0
>>> 免费模式结论：总扣减 = 0 ✅ 全免费
[4] 用户列表命中 #15 → PATCH {vipLevel:'pro'} 200 → 复查 vipLevel = pro ✅
```

---

## 四、注意事项

1. **新用户初始额度仍是 schema 硬编码的 5**（`users.quota_total default 5`）——改默认值需要 migration；
   测试期免费模式下不影响使用，正式定价前再统一处理。
2. **免费模式下的成本配置会被保留**，关闭 `free_mode` 后立即按配置值计费——测试转正式只改一个开关。
3. **排盘扣费只对登录用户生效**；未登录（C 端首页匿名排盘）不扣费，这是刻意的（排盘是免费入口）。
4. 计费调用点已收敛，新增功能只要用 `readQuotaCost('<feature>')` 即自动受免费模式管控。
