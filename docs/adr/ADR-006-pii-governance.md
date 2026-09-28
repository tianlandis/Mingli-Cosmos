# ADR-006: 个人信息（生辰）数据治理与删除权

- **状态**: `Accepted` 🔶（2026-09-28 后端底座实施，Phase 5 P5-6；前端同意入口与文案上线后转 ✅）
- **日期**: 2026-09-28
- **决策者**: 田哥
- **类别**: 🔧 完善（合规）
- **关联**: `../arch/ARCHITECTURE-REVIEW.md` §5、`../plan/05-risk-compliance.md`

---

## 背景（Context）

八字产品必然采集**生辰（出生年月日时）+ 性别 + 出生地**，属《个人信息保护法》下的
**敏感个人信息**。当前系统存了这些数据（`sessions` 存整份 chart + annotation），但：

- ❌ 无隐私政策页；
- ❌ 无用户协议；
- ❌ 无数据导出 / 删除接口；
- ❌ 无同意记录。

这是**上量前的硬性合规缺口**。

## 驱动因素（Decision Drivers）

- 面向境内用户的合规硬要求（告知同意、最小必要、可删除 / 可导出）。
- 用户信任是命理类产品的核心资产。
- PII 与备份 / 日志 / 分析数据存在**多处扩散**，治理需覆盖全链路。

## 决策（Decision）

1. **告知同意**：注册 / 首次排盘前展示隐私政策 + 用户协议，记录同意（时间 + 版本号）。
2. **最小必要**：只采集计算必需字段；`analytics_events` **不落原始生辰**。
3. **可导出 / 可删除**：提供 `GET /user/data/export`（机读格式）与 `DELETE /user/data`
   （软删 + 到期硬删），删除请求落审计。
4. **加密与脱敏**：备份文件加密（ADR-008）；日志**禁止**打印原始生辰。
5. **保留期限**：明确各类数据保留期，到期自动清理（与 ADR-008 的 TTL 联动）。

## 后果（Consequences）

**正向 (+)**
- 合规风险消除；用户信任提升；满足"可删除权"。

**负向 (−)**
- 改造注册 / 排盘入口与数据层，工作量中等。

**中性 / 风险**
- 删除权与"审计留存"冲突 → 审计**只留操作元数据**，不留原始 PII。

## 复审触发条件

- 上线境外市场 → 需对齐 GDPR / 当地法；
- 数据出域 / 使用第三方 LLM 处理 PII → 需评估跨境与委托处理合规。

## 实施记录（2026-09-28 · P5-6 后端底座）

| 决策项 | 落点 |
|---|---|
| 告知同意 | 新表 `consent_records`；`POST /api/v1/app/user/consent`（时间 + 版本 + 来源 IP/UA），`GET` 可查 |
| 版本管理 | `app_configs.consent_privacy_version` / `consent_agreement_version` |
| 可导出 | `GET /api/v1/app/user/data/export`（用户 / 同意 / 订阅 / 订单 / 额度台账 / 排盘 / 埋点） |
| 可删除 | `DELETE /api/v1/app/user/data`（二次确认 `confirm:'DELETE'` + 密码校验） |
| 删除语义 | 软删用户（`users.status='deleted'` + `deletedAt` + 清空手机/邮箱/昵称）→ **硬删**排盘快照（含生辰）→ 埋点匿名化（保统计）→ 全部会话失效 |
| 审计 | `audit_logs` 记 `resource='user_data'`，**只留操作元数据，不留原始 PII** |
| 埋点不落生辰 | `analytics_events.payload` 从未包含生辰；删除时进一步抹除 `userId/ip/ua` |

**未完成（前端/文案侧）**：隐私政策页、用户协议页、注册/排盘入口的同意勾选（需产品与法务文案）。

测试：`src/server/modules/__tests__/pii-compliance.test.ts`

## 关联

ADR-008（备份加密）｜ADR-007（日志脱敏）｜REVIEW §5
