# LLM 路由：模型分级 + 降级 + thinking 适配

> 状态：已实现（2026-09-29）｜ 涉及文件：`src/server/lib/llm.ts`、`src/server/config/index.ts`、`src/server/db/migrate.ts`
> 用途：回答「哪次调用用哪个模型」「模型挂了怎么办」「思考型模型为什么输出为空」

---

## 一、为什么要分级

项目里 LLM 的用途差异极大，一刀切配一个模型必然两头不讨好：

| 场景 | 调用点 | 特征 | 需要什么 |
|---|---|---|---|
| AI 对话 | `api/chat.ts`（对话 + Multi-Agent） | 流式、要低延迟、多轮 | **快**，质量过得去就行 |
| 意图路由 | `agents/router-agent.ts` | 只输出几十 token 的 JSON | **最快最便宜**，杀鸡焉用牛刀 |
| 命书 Step1 性格 | `workflows/step-personality.ts` | 非流式、要准确、结构化 JSON | **准**，慢点无所谓 |
| 命书 Step2 运势 | `workflows/step-luck.ts` | 同上 | **准** |

一个模型同时满足「快」和「准」只能靠加钱。分级的本质是**按场景付不同的钱**：

- 对话走本地小模型 → 零边际成本、无网络往返
- 命书走云端强模型 → 质量优先，且命书本就按次计费（5 点券），成本可覆盖

---

## 二、分级模型

### 两个角色

| role | 用途 | 推荐配置 |
|---|---|---|
| `fast` | AI 对话、意图路由 | 本地 ollama `qwen2.5:7b`（实测 67~72 字/s）、或云端低价模型 |
| `deep` | 命书 Step1 / Step2 | 云端强模型（DeepSeek-V3 / Qwen3.5-122B） |
| `NULL` | 不参与分级 | 仅作为全局默认候选 |

### 解析顺序

```
loadConfig(role)
  └─ api_keys 表
       1. role 匹配 AND isActive=1        ← role 专属
       2. isDefault=1 AND isActive=1      ← 全局默认
       3. isDefault=1（放宽 Active）      ← 防止误下线导致无可用配置
  └─ 都没有 → app_configs → .env（旧链路，无分级概念）
```

**关键设计：不配置 = 完全兼容旧行为。** 后台不给任何供应商设 role 时，
`role` 查询必然 miss，自动走全局默认 —— 这条路径与改造前逐字等价，
因此本次改动不引入任何破坏性变更。

---

## 三、降级：本地模型挂了怎么办

`fast` 常配本地模型（ollama / LM Studio）。本机一关机、模型被卸载、
或 LM Studio 与 ollama 抢显存导致服务不可用，端点就立刻不可达。

### 候选链

```ts
resolveRoutes(role) → [role 专属, 全局默认]   // 同端点同模型时自动去重为 1 条
```

### 两段式降级

| 场景 | 机制 | 时机 |
|---|---|---|
| **流式**（对话） | `pickAvailableRoute()` —— 开始前并发探测 `GET <baseUrl>/models`（2.5s 超时），取第一个可达的 | 生成前 |
| **非流式**（命书） | 候选链 `for` 循环 —— 首选整个 `withRetry` 失败后换下一个候选重跑 | 生成失败后 |

流式不能「失败了再换」——流一旦开始就无法回退，所以必须在**开始前**筛。
命书是异步的、允许整体重试，所以放在**失败后**换，省掉每次的探测开销。

### 失败暴露原则

所有候选都不可达时**返回首选**，让原始错误原样抛出（连接 refused / 401 / 超时），
而不是包装成一句"降级失败"。排障时第一手错误最有价值。

---

## 四、thinking 模型适配

DeepSeek-R1 / QwQ 这类思考型模型把正文写在 `reasoning_content` 里，
`content` 是空字符串 —— AI SDK 只读 `content`，结果就是**生成成功但输出为空**。

**解法**：给 provider 注入自定义 `fetch`，把非流式 JSON 响应里的
`reasoning_content` 回填到 `content`。

```ts
isThinkingModel('deepseek-r1:7b')  // true
isThinkingModel('qwen2.5:7b')      // false
```

**只处理非流式**。流式（SSE）需要逐 chunk 解析且各家长格式不一，风险高于收益；
**流式场景请直接用非思考型模型**（实测 ollama `qwen2.5:7b` 速度最快且天然不串台）。

---

## 五、配置方法

### 后台 UI

`LLM 配置 → 新增/编辑供应商 → 模型用途（分级）` 下拉：

- 不参与分级（默认）
- `fast · 低延迟`
- `deep · 高质量`

列表卡片上会显示 `FAST` / `DEEP` 徽章。

### API

```bash
# 创建 fast 供应商
POST /api/v1/admin/llm
{
  "provider": "local",
  "label": "本机 ollama qwen2.5:7b",
  "apiKey": "ollama",
  "baseUrl": "http://127.0.0.1:11434/v1",
  "model": "qwen2.5:7b",
  "role": "fast"          # ← 新增字段
}

# 取消分级
PUT /api/v1/admin/llm/:id   { "role": null }
```

⚠️ **zod 铁律**：`role` 必须在 `providerBodySchema` 里显式声明，否则会被静默剥离。
同一 role 只允许一个供应商，设置新值时会自动顶掉旧的。

---

## 六、与护栏的分工

四道防线各管一层，互不替代：

| 层 | 机制 | 管什么 |
|---|---|---|
| L1 | `stopSequences: SELF_TALK_STOP` | 解码层切断：不让模型编下一轮对话 |
| L1.5 | `findSelfTalkIndex()` 结果级截断 | 换写法绕过 stop 时的兜底 |
| **L1.6（本文件）** | 分级 + 降级 | 用哪个模型、模型挂了怎么办 |
| L3 | `lib/guardrail.ts validateResponse()` | 生成**结束后**的内容合规检查（只 warn 不拦截） |

---

## 七、实测数据（2026-09-29）

| 项目 | 结果 |
|---|---|
| 分级生效 | fast → 本机 ollama `qwen2.5:7b`；deep → 独立配置 |
| 对话质量 | 54 字符，口语化 + 免责声明，**无串台** |
| 对话耗时 | 首次 46s（ollama 冷加载）→ 热态 1~4s |
| 回归测试 | vitest **533/533**（新增 `llm-routing.test.ts` 28 项） |

---

## 八、已知约束

1. **冷加载是真瓶颈**：ollama 首次加载 30~70s。建议固定用一个模型常驻，
   不要让 LM Studio 与 ollama 同时占用显存。
2. **容器访问宿主机**：填 `host.docker.internal:11434` 或宿主机内网 IP（如 `192.168.2.197:11434`），
   **不能填 `127.0.0.1`**（那是容器自己）。ollama 默认只监听回环，需设 `OLLAMA_HOST=0.0.0.0` 后重启。
3. **配置缓存 60s**：后台改完配置最多 60s 生效。
