# 2026-09-29 — 本机 Ollama 打通 + fast 上内网 + 后台口令固定

对象：内网 `192.168.2.10:3001`（容器 `bazipaipan-prod`）｜本机 Ollama `192.168.2.197:11434`

---

## 1. 连通性：三层全通 ✅

| 链路 | 结果 |
|:--|:--|
| 本机 → `192.168.2.197:11434/v1/models` | HTTP 200（此前 000，`OLLAMA_HOST=0.0.0.0` 已生效） |
| 内网机 → 本机 | HTTP 200 / 6ms |
| **容器内** → 本机 | HTTP 200 / 120ms |

> 容器内无 curl（精简镜像），探测用 `docker exec -w /app bazipaipan-prod node -e "fetch(...)"`。

## 2. fast 供应商上线（api_keys #4）✅

```
provider=local  label=Ollama-Qwen2.5-7B(本机fast)
baseUrl=http://192.168.2.197:11434/v1   model=qwen2.5:7b
role=fast  isActive=1  apiKey=ollama（占位）
```
后台 ping：**11ms ok / 27ms ok**。

**硬证据（确认请求真的走 fast）**：把 #4 的 baseUrl 改成不可达的 `:11435` → 对话立刻 0 输出；改回 `:11434` 后恢复。若未走 fast，改动不会影响结果。

## 3. 对话实测（/api/chat，流式 SSE）✅

| 指标 | 值 |
|:--|:--|
| 首字延迟 | 7.8s（冷）/ 4.1s（热） |
| 输出 | 76 字 / 61 字 |
| 串台 | 无（自带「墨白」人设 + 免责声明，刹车间断干净） |

> 流式字段是 `{type:'text-delta', textDelta}`，不是 `delta/text`。
> `/api/chat` 必须带 `sessionId` 或 `chart+annotation`；`birth` 重算分支（文档 B 模式）代码里未实现。

## 4. 🚨 发现：#1 GLM 网关不可用

降级打到 #1 时报错：

```
no healthy provider is available for model glm-4.5-flash
```

- 网关进程活着：`*:9090 simple-one-api (pid 400381)`，无 key 访问返回 401（鉴权正常）
- 是**上游渠道无健康 provider**，不是本项目代码问题
- **影响：deep 角色（命书 Step1 性格 / Step2 运势）当前无可用端点 → 命书会失败**

## 5. 后台口令固定为 `wwww0000` ✅

优先级：`app_configs.admin_password_hash` **>** `env ADMIN_PASSWORD` **>** 内置 `mingli2026`。
**只改 .env 不生效**，正确姿势两步：

1. 后台 `PUT /api/v1/admin/auth/password` `{oldPassword,newPassword}`（**PUT，POST 会 404**）→ 写 DB
2. 同步改 `/opt/mingli/.env`（已备份 `.env.bak-<ts>`）+ 重启容器

验证：旧密码 `922159e4eb63309f` → 401；新密码 → 200 且可访问后台；重启后仍生效。
登录体：`{username:'admin', password}`（只传 password 会 VALIDATION_ERROR）。

---

## 待拍板

1. **生产 VPS `216.167.120.225` 是否同步改 `wwww0000`** —— 公网暴露弱口令有风险，未擅自改动。
2. **deep 端点怎么修** —— 修 simple-one-api 的 GLM 渠道 / 用本机 Ollama（如 `qwen3:latest`）临时顶 / 换云端供应商。
