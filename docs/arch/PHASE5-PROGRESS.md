# Phase 5 · 商业化闭环 — 骨架实施记录

> **状态**：P5-1 ~ P5-6 已实施并**上线**（`http://216.167.120.225:3001`，2026-09-28）｜P5-5 / P5-6 有外部依赖待补
> **上游**：`../adr/README.md`（决策索引）｜`ARCHITECTURE-REVIEW.md` §7-§9
> **纪律**：不改变既有接口契约（全部为**新增**端点 / 可选字段），可在线上平滑上线。

---

## 一览

| 序 | 项目 | ADR | 状态 | 主要落点 |
|:--:|---|:--:|:--:|---|
| P5-1 | 备份脚本 + 恢复演练 | 008 | ✅ | `scripts/backup-db.py`（已完成于上一轮） |
| P5-2 | 可观测性基线 | 007 | ✅ | `lib/metrics.ts`、`lib/trace.ts`、`lib/health.ts` |
| P5-3 | 计算权威收敛 | 005 | ✅ | `lib/chart-hash.ts`、`lib/chart-source.ts`、`modules-public/chart/` |
| P5-4 | 额度幂等台账 | 004 | ✅ | `db/repositories/quota.ts`、`api/chat.ts` |
| P5-5 | 支付回调幂等 | 009 | 🔶 框架就绪 | `services/order-settlement.ts`、`modules-public/payment/` |
| P5-6 | PII 合规底座 | 006 | 🔶 后端就绪 | `db/repositories/consent.ts`、`modules-public/user/`（consent/export/delete） |

---

## 新增 HTTP 接口

| 方法 | 路径 | 说明 | 认证 |
|---|---|---|---|
| GET | `/api/health` | 进程级健康（保持轻量） | 无 |
| GET | `/api/health/deep` | **依赖级**：DB 可读 + LLM 可达，聚合 `ok/degraded/down` | 无 |
| GET | `/api/metrics` | Prometheus 文本指标 | 无 |
| POST | `/api/v1/app/chart` | **服务端权威排盘** → `sessionId` + `chartHash` | 可选 |
| POST | `/api/v1/app/payment/notify/:channel` | 支付回调（HMAC 验签 + 幂等结算） | 签名 |
| GET | `/api/v1/app/payment/channels` | 已启用支付渠道 | 无 |
| POST | `/api/v1/app/user/consent` | 告知同意留痕 | 是 |
| GET | `/api/v1/app/user/consent` | 同意记录查询 | 是 |
| GET | `/api/v1/app/user/data/export` | 数据导出（机读 JSON） | 是 |
| DELETE | `/api/v1/app/user/data` | 数据删除（软删 + 硬删 PII） | 是 + 密码 |

## 既有接口的**向后兼容**扩展

| 接口 | 新增可选字段 | 新增响应头 |
|---|---|---|
| `POST /api/chat`、`POST /api/chat/route`、`POST /api/report` | `sessionId`、`birth` | `X-Chart-Verified`、`X-Chart-Source` |

> 不传新字段时行为与改造前**完全一致**（`chart_verify_mode=off` 下仅记 warning）。

---

## 新增数据表 / 列

| 对象 | 变更 | 用途 |
|---|---|---|
| `sessions.chart_hash` / `engine_version` / `user_id` | 新增列 | 权威锚点 + PII 归属 |
| `users.deleted_at` | 新增列 | 软删除 |
| `quota_ledger` | **新表** | 额度追加式台账（幂等消费） |
| `consent_records` | **新表** | 告知同意留痕 |

迁移全部为 `CREATE TABLE IF NOT EXISTS` / `ALTER ... ADD COLUMN`（幂等、可重复执行）。

---

## 新增配置项

| key | 默认 | 说明 |
|---|---|---|
| `chart_verify_mode` | `off` | `off` / `warn` / `enforce` |
| `quota_enforce_chat` | 生产 `true`，其他 `false` | AI 对话扣减额度 |
| `payment_notify_secret` | 空 → 回调关闭 | 回调签名密钥（默认安全） |
| `consent_privacy_version` / `consent_agreement_version` | `v1.0` | 协议版本号 |

环境变量：`CHART_VERIFY_MODE`、`PAYMENT_NOTIFY_SECRET`、`HEALTH_LLM_PROBE`。

---

## 部署后自测发现的缺陷与修复（2026-09-28）

**现象**：`quota_enforce_chat=true` 且上游 LLM 不可用时，用户「没拿到任何回复却被扣额度」。

**根因**：AI SDK v6 中上游失败（402 余额不足 / 429 限流 / 5xx）**不是同步抛错**，
而是以 `{type:'error'}` chunk 的形式流入 `result.fullStream`。旧实现把该 chunk
落到 `default:` 分支当「未知 chunk」静默吞掉，随后仍执行 `commitQuota` —— 计费成立但零产出。

**修复**（`api/chat.ts`）：

1. 新增 `case 'error'`：把流内错误记入 `streamError`（构造期同步错误另用 try/catch 兜住）。
2. 流结束后按「成功才计费」判定：`streamError || !fullText` → `refundQuota` + SSE 回传
   `{type:'error', code:'LLM_STREAM_FAILED'}`，**不 commit**。
3. 保留原有 `catch(err)` 兜底退款（与上述路径共用幂等键，不会重复退）。

**验证**：

- 新增回归测试 `modules/__tests__/chat-billing-safety.test.ts`（mock `streamText`）：
  error chunk → `refunded` 且 `quotaUsed` 不变；零输出 → `refunded`；正常产出 → `committed` +1。
- 真实端到端（门禁开 + 真实上游 402）：SSE 回传 `LLM_STREAM_FAILED`，额度 `5/5` 未动，
  台账 `status='refunded'`。
- 冒烟新增「失败不计费：额度未被消耗」断言（26 → 40 项）。

> 结论：**失败不计费**语义成立，`quota_enforce_chat=true` 的「先验证再开启」前置条件已满足，
> 故生产保持 `true`（P5-4 转正）。真正待办是**真实 LLM Key**（当前 provider=local，
> 深度健康检查中 `llm=skipped`），非计费问题。

---

## 验收基线（本地 · 修复后）

| 项 | 结果 |
|---|---|
| `npm run typecheck`（tsc -b --noEmit） | 零错误 |
| `npx vitest run` | **393 / 393**（22 文件；P5 新增 73 项） |
| `npm run build` | 通过 |
| `npm run smoke`（真实服务） | **40 / 40**（P5 新增 14 项） |
| 生产实测（216.167.120.225:3001） | 深度健康 ok ｜ 冒烟 **40 / 40** |

新增测试文件：
`core/__tests__/observability.test.ts`、
`modules/__tests__/computation-authority.test.ts`、
`modules/__tests__/quota-ledger.test.ts`、
`modules/__tests__/payment-callback.test.ts`、
`modules/__tests__/pii-compliance.test.ts`、
`modules/__tests__/chat-billing-safety.test.ts`

---

## 上线注意（灰度顺序）

1. **备份**：先跑一次 `scripts/backup-db.py`（ADR-008），再升级。
2. **迁移**：容器重启即自动执行（幂等）；建议升级后 `curl /api/health/deep` 验证 DB 探测。
3. **P5-4 灰度**：生产 `quota_enforce_chat` 现为 `true`（转正）——「失败不计费」已由回归测试 +
   真实端到端验证（见上「部署后自测发现的缺陷与修复」）。上线后观察 `quota_ledger`
   增长与 402 比例即可；如遇异常，后台一键改回 `false` 即恢复放行。
4. **P5-3 灰度**：`chart_verify_mode` 建议 `off → warn → enforce` 三步走，
   观察日志中的 `CHART_MISMATCH_WARN` 比例；前端切换到 `/api/v1/app/chart` 后再上 `enforce`。
5. **P5-5**：`payment_notify_secret` 保持空（回调关闭）直到真实渠道接入并完成证书/域名准备。

## 剩余（需外部输入，非代码问题）

- **P5-5 真实支付**：备案域名 + HTTPS + 商户资质 → 微信/支付宝 SDK、证书管理、对账报表。
- **P5-6 前端与文案**：隐私政策页、用户协议页、注册/排盘入口的同意勾选。
- **P1 待办**：LLM 网关（ADR-003）、数据保留 TTL、版本化迁移链、api_keys 加密存储。
