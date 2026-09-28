# ADR-007: 可观测性基线 —— SLO / 指标 / 追踪

- **状态**: `Accepted` ✅（2026-09-28 实施，Phase 5 P5-2；指标后端/告警待接入）
- **日期**: 2026-09-28
- **决策者**: 田哥
- **类别**: 🔧 完善（可运维性）
- **关联**: `../arch/ARCHITECTURE-REVIEW.md` §4.4、`src/server/core/app.ts`（`/api/health`）

---

## 背景（Context）

当前健康检查 `/api/health` **不探测 DB / LLM 上游**；指标停留在日志级；
无 SLO、无请求追踪。问题只能"等用户报障再查"。管理端与 C 端延迟也未分开观测，
而"admin 是否拖慢 C 端"（§R-3）恰是判断**是否需要拆服务**（ADR-001）的关键信号，
目前**没有数据支撑**。

## 驱动因素（Decision Drivers）

- 可运维性 = 出问题时能**快速定位**，而非盲查。
- 拆分决策（ADR-001）需要**数据**（分维度延迟）。
- LLM 成本治理（ADR-003）需要**计量指标**。

## 决策（Decision）

建立**最小可运维基线**：

1. **健康检查分级**：
   - `/api/health`（进程级，保持轻量）；
   - `/api/health/deep`（探测 DB 可读 + LLM 可达，带超时）。
2. **三类指标**：
   - 请求维度：延迟 / 错误率 / 吞吐，**按 `admin` 与 `app` 分维度**；
   - LLM 维度：调用成本、缓存命中率、供应商失败率（配合 ADR-003）；
   - 业务维度：注册、付费、额度消耗。
3. **追踪**：为每次 AI 会话贯穿 `traceId`（chat → tools → LLM → 落库）。
4. **SLO 草案**：如 `/api/chat` P95 < 8s、错误率 < 1%、健康检查可用性 99.9%。

> 落地可按"**先结构化日志，再上指标后端**"两步走，避免一次性引入重型设施。

## 后果（Consequences）

**正向 (+)**
- 可定位、可告警、可度量；为拆分决策提供数据。

**负向 (−)**
- 需引入指标 / 日志后端或轻量替代（Prometheus + Grafana，或先落结构化日志）。

**中性 / 风险**
- 告警噪音 → 先只对 **SLO 关键项**告警，逐步调参。

## 复审触发条件

- 引入多实例 / 拆分服务 → 需分布式追踪；
- SLO 长期不达标 → 触发容量 / 架构重评。

## 实施记录（2026-09-28 · P5-2）

| 决策项 | 落点 |
|---|---|
| 健康检查分级 | `GET /api/health`（进程级，保持轻量）+ `GET /api/health/deep`（DB 可读 + LLM 可达，带超时，聚合 `ok/degraded/down`） |
| 请求维度指标 | `mingli_http_requests_total`、`mingli_http_request_duration_ms{scope}` —— **admin / app 分母口径分离** |
| 指标出口 | `GET /api/metrics`（Prometheus 文本 exposition，零依赖） |
| 追踪 | 全局中间件贯穿 `X-Trace-Id`（上游透传校验，非法头部拒绝） |
| SLO 草案 | `/api/chat` P95 < 8s（直方图分桶已含 8000ms 边界）、错误率 < 1%、健康检查可用性 99.9% |
| 实现位置 | `src/server/lib/metrics.ts`、`src/server/lib/trace.ts`、`src/server/lib/health.ts`、`src/server/core/app.ts` |

**取舍**：不引入 prom-client / OTel —— 单实例（ADR-001）下跨进程聚合无意义；
标签维度由**代码写死枚举**，不接受任意用户输入（防基数爆炸）。
将来接指标后端时**只需替换 `metrics.ts`**，调用方不变。

**待补**：LLM 维度成本/缓存命中指标（依赖 ADR-003 网关）、告警规则、日志聚合后端。

测试：`src/server/core/__tests__/observability.test.ts`

## 关联

ADR-001（拆分触发信号）｜ADR-003（LLM 指标）｜ADR-006（日志脱敏）｜REVIEW §4.4
