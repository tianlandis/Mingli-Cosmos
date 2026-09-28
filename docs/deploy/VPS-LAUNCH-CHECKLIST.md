# 🚀 VPS 上线验收清单（D-4 ~ D-6）

> **状态**：代码与编排均已就绪，等待 VPS 与域名。
> **最近更新**：2026-09-28 ｜ 适用版本 v4.1.0+（含 Phase 4b 运营中台）
> **本文目标**：拿到 VPS + 域名后，按本文顺序执行即可完成上线，无需再查代码。

---

## 〇、上线前必读：本次已修复的两个致命隐患

| # | 隐患 | 后果 | 修复 |
|:--:|------|------|------|
| 1 | `Dockerfile` 基础镜像为 `node:22-alpine` | 项目锁定 **Node 26**（`engines>=26`、`.nvmrc=26`），better-sqlite3 按 **ABI 147** 编译，Node 22 启动即崩 | 构建/运行阶段均改为 `node:26-alpine` |
| 2 | `docker-compose.yml` 未挂载数据卷 | SQLite 库在容器内，**容器重建后 users / orders / subscriptions / analytics_events 全部丢失** | 新增 `- ./data:/app/data` 与 `- ./logs:/app/logs` |

> 数据目录已写入 `.gitignore`（`data/`、`*.db*`），宿主机备份时请用 `sqlite3 .backup` 或直接打包 `data/` 目录。

---

## 〇·五、1Panel 环境专用路线（服务器已装 1Panel 时走这条）

> 实测环境：`1Panel` 面板（含 OpenResty）已占用 **80 端口**，`443` 默认未放行，
> 应用容器只映射 `3001`。因此**不要用 `certbot --nginx`**（会改写面板托管的配置），
> 改为「面板建反代站点 + 面板一键签 SSL」。

### 步骤

1. **放行端口**：云服务器安全组 / 系统防火墙开放 `80`、`443`（面板端口 `28322` 与 SSH 已开）。
   > 1Panel：面板设置 → 安全 → 防火墙；云厂商控制台还需同步开安全组。
2. **装 Docker**：1Panel → 应用商店 → 搜索 `Docker` / `Docker Compose` → 安装。
3. **部署应用**（面板 → 终端，或 SSH 执行）：
   ```bash
   curl -fsSL https://raw.githubusercontent.com/tianlandis/Mingli-Cosmos/master/scripts/deploy-vps.sh -o /tmp/deploy.sh
   bash /tmp/deploy.sh          # 默认装到 /opt/mingli
   vi /opt/mingli/.env          # 必须填 LLM_API_KEY
   cd /opt/mingli && docker compose up -d
   ```
4. **建反代站点**：1Panel → 网站 → 创建网站 → 类型选「**反向代理**」
   - 主域名：你的域名（无域名可先填服务器 IP）
   - 代理地址：`http://127.0.0.1:3001`
5. **确认 SSE 参数**（站点 → 反向代理 → 配置文件）：
   ```nginx
   proxy_buffering off;                # 关闭缓冲，否则 AI 回答会「整段一次性出现」
   proxy_cache off;
   proxy_read_timeout 300s;            # 长连接 5 分钟
   proxy_http_version 1.1;
   proxy_set_header Host $host;
   proxy_set_header X-Real-IP $remote_addr;
   proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;   # 登录限流按 IP，必须透传
   proxy_set_header X-Forwarded-Proto $scheme;
   ```
6. **签 SSL**：站点 → SSL → Let's Encrypt → 申请（面板自动续期）。
7. **验收**：`BASE=https://你的域名 node scripts/smoke-e2e.mjs`（期望 26/26）。

### 与命令行路线（certbot）的区别

| 项 | 1Panel 路线 | 命令行 certbot 路线 |
|---:|---|---|
| 80 端口归属 | 面板 OpenResty | 面板 OpenResty（同样被占用） |
| SSL 签发 | 面板一键 + 自动续期 | `certbot --nginx` 可能改写面板配置 ⚠️ |
| 配置维护 | 面板 UI，可视化 | 手写 nginx.conf |

---

## 一、D-4 域名绑定 + SSL

```bash
# 1. 域名 A 记录指向 VPS 公网 IP
#    example.com      →  <VPS_IP>
#    www.example.com  →  <VPS_IP>

# 2. 安装 certbot 并签发证书（Nginx 插件模式）
sudo apt update && sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d example.com -d www.example.com

# 3. 证书自动续期（certbot 默认已注册 systemd timer，可手动验证）
sudo certbot renew --dry-run
```

Nginx 侧确认（`nginx.conf` 已内置 SSE 优化，无需改动）：

- `proxy_buffering off` — SSE 流式不缓冲
- `proxy_read_timeout 300s` — 长连接不中断
- `location /` 已覆盖 `/api/v1/app/*` 新增路由，无需新增 location

---

## 二、D-5 部署验证

```bash
# 1. 拉取代码
git clone https://github.com/tianlandis/Mingli-Cosmos.git && cd Mingli-Cosmos

# 2. 准备 .env（必须修改的项）
#    ADMIN_PASSWORD    管理员初始密码
#    ADMIN_JWT_SECRET  后台会话密钥
#    USER_JWT_SECRET   C 端用户令牌密钥（新增，务必自定义）
#    LLM_*             模型供应商配置
cp .env.example .env   # 若无 example，按 README 的环境变量表手写

# 3. 构建并启动
docker compose up -d --build

# 4. 观察启动日志（确认表创建 + 种子写入）
docker compose logs -f --tail=100
# 期望看到：
#   [DB] initialized: data/mingli.db
#   [Knowledge] Registry booted: 35 assets loaded
#   [Router] modules 已注册模块: audit, auth, config, dashboard, knowledge, llm, prompts, users, orders, analytics
#   [Router] modules-public 已注册模块: billing, track, user
#   [Server] Hono listening on http://localhost:3001
```

---

## 三、D-6 公网验收清单

### 3.1 基础健康

```bash
curl -s https://example.com/api/health | jq
# 期望：status=ok，含 uptime_seconds / memory_mb / node_version
```

### 3.2 前端与后台

| 入口 | 期望 |
|------|------|
| `https://example.com/` | C 端排盘页，右上角出现「登录 / 注册」 |
| `https://example.com/admin` | 管理后台登录页 |
| 后台 → 仪表盘 | 出现「运营概览」区块（用户/活跃/排盘/对话/收入/订阅） |
| 后台 → C端用户 | 列表可加载（空态提示「暂无匹配的用户」） |
| 后台 → 订单管理 → 套餐 | 默认 3 个套餐（体验包 / 月度 / 年度） |

### 3.3 C 端账号链路（新增 API）

```bash
API=https://example.com/api/v1/app

# 注册
curl -s -X POST $API/user/register -H 'Content-Type: application/json' \
  -d '{"username":"smoke1","password":"secret123"}' | jq

# 登录 → 取 token
TOKEN=$(curl -s -X POST $API/user/login -H 'Content-Type: application/json' \
  -d '{"account":"smoke1","password":"secret123"}' | jq -r .data.token)

# 查看额度与订阅
curl -s $API/user/me -H "Authorization: Bearer $TOKEN" | jq

# 套餐列表 → 下单 → 模拟支付
curl -s $API/billing/plans | jq
curl -s -X POST $API/billing/orders -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"planId":2}' | jq
curl -s -X POST $API/billing/orders/1/pay -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{}' | jq
# 期望：status=paid，subscription 生效，quotaRemaining 增加

# 埋点
curl -s -X POST $API/track -H 'Content-Type: application/json' \
  -d '{"event":"paipan","payload":{"source":"smoke"}}' | jq
# 期望 201；非白名单事件返回 400 UNSUPPORTED_EVENT
```

### 3.4 一键端到端冒烟（替代 3.3 的手工 curl）

仓库内置 26 项断言的冒烟脚本，可直接对公网域名跑：

```bash
BASE=https://example.com node scripts/smoke-e2e.mjs
# 或用管理员凭据（脚本默认 admin / mingli2026，生产请显式传入）
BASE=https://example.com ADMIN_PASSWORD=<你的密码> node scripts/smoke-e2e.mjs
```

覆盖：健康检查 → 注册 → 重名/错密码拦截 → 登录 → me/quota → 套餐 → 下单 → 模拟支付
→ 我的订单/订阅 → 埋点（含白名单拒绝）→ 后台登录 → 用户/订单/看板 → 未授权拦截。

> 期望输出 `通过 26 项 / 失败 0 项`。
> 注：脚本会写入真实数据（用户 `smoke*`、一笔测试订单），验收后可在后台删除。

### 3.5 SSE 流式（公网最关键的一项）

浏览器打开排盘 → 点击「向墨白提问命理问题」→ 发送消息：

- [ ] 首个 token 在 3 秒内出现（Nginx 未缓冲）
- [ ] 流式输出无卡顿、无整段一次性返回
- [ ] 中途不出现 504 / 连接重置

### 3.6 数据持久化验证（本次修复项）

```bash
docker compose restart
docker compose exec bazipaipan-prod sh -c 'ls -l /app/data'
# 用户与订单仍在 → 后台「C端用户」列表可见 smoke1
```

---

## 四、上线后建议立即执行的配置

| 配置项 | 位置 | 建议值 | 说明 |
|--------|------|--------|------|
| `quota_enforce_chat` | 后台 → 系统配置 | 先 `false`，运营稳定后开 | 开启后登录用户每次 AI 对话扣 1 次额度，不足返回 402 |
| 管理员密码 | 后台登录后可改 | 强密码 | 首次登录后立即修改，改密会强制所有后台会话下线 |
| `USER_JWT_SECRET` | `.env` | 随机长字符串 | C 端令牌密钥，泄露可伪造用户身份 |

---

## 五、回滚预案

```bash
# 保留数据回滚到上一个镜像
docker compose down          # ./data 卷在宿主机，不会丢
git checkout <上一个 commit>
docker compose up -d --build
```

> ⚠️ 数据库只做增量建表（`CREATE TABLE IF NOT EXISTS` + 安全 ALTER），
> **无删列/改列迁移**，因此向下回滚代码不会破坏数据结构。
