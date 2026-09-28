# 🚀 VPS 部署记录 — 216.167.120.225

> **部署日期**：2026-09-28 ｜ **代码版本**：`cda11ab`（master）
> **部署方式**：Docker Compose（应用容器直连公网 3001，反向代理由 1Panel 侧自行配置）

---

## 一、服务器档案

| 项 | 值 |
|---|---|
| 公网 IP | `216.167.120.225` |
| 系统 | Ubuntu 24.04（内核 6.8.0-139） |
| 规格 | 2 vCPU / 961 MiB RAM / 29 GB 磁盘（剩 ~20 GB）/ **swap 4 GB**（1Panel 自带） |
| 面板 | 1Panel（端口 `28322`，入口 `/www`） |
| 运行时 | Docker 29.8.1 + Docker Compose v5.5.1 |
| 部署目录 | `/opt/mingli`（git clone，master） |
| 容器 | `bazipaipan-prod`（镜像 `mingli-bazipaipan`，`node:26-alpine`，healthy） |
| 端口 | 容器 `3001` → 宿主 `0.0.0.0:3001`（公网可直连） |
| 数据 | `/opt/mingli/data/mingli.db`（挂载持久化）+ `/opt/mingli/logs` |
| 配置 | `/opt/mingli/.env`（管理员密码与 JWT 密钥均为随机生成，**不入库**） |

> ⚠️ 2 核 961 MiB 内存下构建**必须依赖 swap**（本机已有 4 GB，实测构建通过）；若换机器请先确认内存或 swap。

---

## 二、部署步骤（可复现）

```bash
# 1. 拉代码
git clone https://github.com/tianlandis/Mingli-Cosmos.git /opt/mingli && cd /opt/mingli

# 2. 生成 .env（随机密钥；ADMIN_PASSWORD / *_JWT_SECRET 必须自定义）
cp .env.example .env && vi .env

# 3. 构建并启动
docker compose up -d --build

# 4. 验证
curl -s http://127.0.0.1:3001/api/health
```

也可用仓库内脚本一键完成：`bash scripts/deploy-vps.sh`。

---

## 三、验收结果（2026-09-28）

| 验收项 | 结果 |
|---|---|
| `GET /api/health`（公网） | ✅ 200，`node_version: v26.10.0`，`env: production` |
| 前端首页 `http://216.167.120.225:3001/` | ✅ 200（SPA 壳） |
| 管理后台 `/admin` | ✅ 200 |
| 端到端冒烟 `BASE=http://216.167.120.225:3001 node scripts/smoke-e2e.mjs` | ✅ **26 / 26 通过** |
| 后台管理员密码 | ✅ 使用 `.env` 中随机密码登录成功；`mingli2026` 已被拒绝（401） |
| 数据持久化 | ✅ `./data`、`./logs` 已挂载 |

---

## 四、本次上线期间发现并修复的 3 个生产级缺陷

| # | 缺陷 | 影响 | 状态 |
|:--:|---|---|:--:|
| 1 | 登录限流对**成功登录**也计数（IP 5 次/15 分钟） | 管理员正常登录 5 次即被锁 15 分钟；反代未透传 XFF 时全站共享一个桶 | ✅ 已修（`d9bfe31`） |
| 2 | `.env` 的 `ADMIN_PASSWORD` 被静默忽略 | **后台长期可用内置弱口令 `mingli2026` 登录**（公网） | ✅ 已修（`cda11ab`），生产已验证 |
| 3 | Docker 基础镜像 Node 22 / 未挂数据卷 | 容器启动即崩 / 容器重建丢用户与订单 | ✅ 已修（`50c8ab0`） |

---

## 五、待办

| # | 事项 | 归属 |
|:--:|---|---|
| 1 | **LLM Key 余额不足**：SiliconFlow 返回 `code 30001 account balance is insufficient`，AI 对话不可用 → 需更换 Key 或充值 | 田哥提供 Key，我改 `.env` 并重启 |
| 2 | 反向代理：`80/443 → 127.0.0.1:3001`（服务器当前 **80/443 均未监听**），建议同时签 HTTPS | 田哥 |
| 3 | 云安全组放行 `80` / `443`（`3001` 已放通，公网验证可达） | 田哥 |
| 4 | 上线后建议：更换 1Panel API Key、SSH 改密码 | 田哥 |
| 5 | 首轮验收产生的测试数据（`smoke*` 用户、测试订单）可在后台清理 | 我 / 田哥 |

---

## 六、已知环境问题（非本项目缺陷）

- **1Panel 开放 API 无法从外部调用**：任何请求（含 API / swagger）都被面板的「安全登录」保护层
  拦截，返回 1441 字节的 `Access Temporarily Unavailable` 页面（页面提示 `1pctl user-info`）。
  排查结论：与 API 签名无关（签名算法为 `md5('1panel' + apiKey + 时间戳)`，已按文档实现）。
  影响：无 —— 本次部署改走 SSH，面板 API 未参与。
- 本机（开发机）出口 IP 与服务器 IP 相同（透明代理），排查外部访问问题时需注意。

---

## 七、常用运维命令

```bash
cd /opt/mingli
docker compose ps                      # 查看状态
docker compose logs -f --tail=100      # 实时日志
docker compose restart                 # 重启（.env 改动生效即可用此命令）
docker compose up -d --build           # 代码更新后重建
git pull && docker compose up -d --build   # 拉取新版本并重建

# 备份数据库（SQLite **在线备份 API**，勿直接 cp —— WAL 模式下浅拷贝可能损坏）
python3 /opt/mingli/scripts/backup-db.py            # 手动备份一次（默认 DB/目录/保留份数）
python3 /opt/mingli/scripts/backup-db.py --gzip     # 压缩备份
python3 /opt/mingli/scripts/backup-db.py --restore /opt/mingli/backups/mingli-YYYYmmdd-HHMMSS.db \
        --to /opt/mingli/data/mingli.db --force     # 恢复（先 docker compose stop）
crontab -l | grep backup-db                          # 查看每日备份任务（03:17，保留 14 份）
ls -lh /opt/mingli/backups/                          # 查看备份
```
