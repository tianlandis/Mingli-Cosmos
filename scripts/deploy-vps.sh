#!/usr/bin/env bash
# ============================================================
# Mingli-Cosmos — VPS 一键部署脚本（在服务器上执行）
#
# 用法（root 身份）：
#   curl -fsSL https://raw.githubusercontent.com/tianlandis/Mingli-Cosmos/master/scripts/deploy-vps.sh -o deploy.sh
#   bash deploy.sh
#
# 或已 clone 仓库后：
#   bash scripts/deploy-vps.sh
#
# 可选环境变量：
#   APP_DIR=/opt/mingli       部署目录（默认 /opt/mingli）
#   BRANCH=master             分支（默认 master）
#   SKIP_BUILD=1              跳过重新构建（仅重启）
#   HOST_DATA_DIR=/opt/mingli-data   数据目录（默认 ${APP_DIR}-data，**仓库之外**）
#   HOST_LOG_DIR=/opt/mingli-logs    日志目录（默认 ${APP_DIR}-logs，**仓库之外**）
# ============================================================

set -euo pipefail

APP_DIR="${APP_DIR:-/opt/mingli}"
BRANCH="${BRANCH:-master}"
REPO="https://github.com/tianlandis/Mingli-Cosmos.git"
# ⚠️ 数据/日志默认放在仓库【之外】，避免 git pull / git reset 覆盖运行中的数据库
HOST_DATA_DIR="${HOST_DATA_DIR:-${APP_DIR}-data}"
HOST_LOG_DIR="${HOST_LOG_DIR:-${APP_DIR}-logs}"

log()  { echo -e "\033[32m[deploy]\033[0m $*"; }
warn() { echo -e "\033[33m[warn]\033[0m $*"; }
die()  { echo -e "\033[31m[error]\033[0m $*"; exit 1; }

# ── 1. 环境检查 ──────────────────────────────
log "检查运行环境..."
command -v docker >/dev/null 2>&1 || die "未安装 Docker。1Panel → 应用商店 → 安装 Docker / Docker Compose"
docker compose version >/dev/null 2>&1 || docker-compose version >/dev/null 2>&1 \
  || die "未安装 Docker Compose"

FREE_MB=$(free -m | awk '/^Mem:/{print $2}')
log "内存: ${FREE_MB} MB"
[ "${FREE_MB:-0}" -lt 1500 ] && warn "内存低于 1.5GB，vite build 可能失败；建议加 swap 或升配"

# ── 2. 获取代码 ──────────────────────────────
if [ -d "$APP_DIR/.git" ]; then
  log "更新代码（$APP_DIR）..."
  cd "$APP_DIR"
  git fetch --all --prune
  git checkout "$BRANCH"
  git pull --ff-only origin "$BRANCH" || warn "拉取失败，使用本地现有代码继续"
else
  log "克隆代码到 $APP_DIR ..."
  git clone -b "$BRANCH" "$REPO" "$APP_DIR"
  cd "$APP_DIR"
fi

# ── 2.5 守卫：仓库内不得跟踪任何运行期数据文件 ──────────
# 历史上 data/mingli.db 被误提交，git pull/reset 会用它覆盖线上库 → 真实数据丢失
if git ls-files -- data logs 2>/dev/null | grep -q .; then
  die "检测到仓库跟踪了 data/ 或 logs/ 下的文件（$(git ls-files -- data logs | head -3 | tr '\n' ' ')），
      git 操作会覆盖运行中的数据库。请先执行：git rm -r --cached data logs && git commit"
fi

# ── 3. 准备数据/日志目录（仓库之外）─────────────
mkdir -p "$HOST_DATA_DIR" "$HOST_LOG_DIR"
log "数据目录: $HOST_DATA_DIR ｜ 日志目录: $HOST_LOG_DIR"
if [ -f "$APP_DIR/data/mingli.db" ] && [ ! -f "$HOST_DATA_DIR/mingli.db" ]; then
  warn "仓库内发现旧库 $APP_DIR/data/mingli.db，迁移到 $HOST_DATA_DIR/mingli.db"
  cp -p "$APP_DIR/data/mingli.db" "$HOST_DATA_DIR/mingli.db"
fi

# ── 3. 准备 .env ─────────────────────────────
if [ ! -f "$APP_DIR/.env" ]; then
  log "生成 .env（随机安全密钥）..."
  rand() { head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n'; }
  cat > "$APP_DIR/.env" <<EOF
# ── LLM ──────────────────────────────
LLM_PROVIDER=siliconflow
LLM_API_KEY=REPLACE_ME
LLM_BASE_URL=https://api.siliconflow.cn/v1
LLM_MODEL=Qwen/Qwen3.5-122B-A10B

# ── 服务 ──────────────────────────────
SERVER_PORT=3001
DB_PATH=data/mingli.db

# ── 数据/日志目录（仓库之外，避免 git 覆盖线上数据库）──
HOST_DATA_DIR=$HOST_DATA_DIR
HOST_LOG_DIR=$HOST_LOG_DIR

# ── 安全 ──────────────────────────────
ADMIN_PASSWORD=$(head -c 12 /dev/urandom | base64 | tr -d '/+=' | head -c 14)
ADMIN_JWT_SECRET=$(rand)
USER_JWT_SECRET=$(rand)

# ── 日志 ──────────────────────────────
LOG_ENABLED=true
LOG_LEVEL=info
EOF
  warn "已生成 .env，请务必编辑填入 LLM_API_KEY：vi $APP_DIR/.env"
else
  log ".env 已存在，保留现有配置"
fi

# ── 4. 构建并启动 ────────────────────────────
cd "$APP_DIR"
mkdir -p "$HOST_DATA_DIR" "$HOST_LOG_DIR"

if [ "${SKIP_BUILD:-0}" != "1" ]; then
  log "构建镜像（首次约 3-8 分钟）..."
  docker compose build --no-cache 2>&1 | tail -20
fi

log "启动容器..."
docker compose up -d

# ── 5. 健康检查 ──────────────────────────────
log "等待服务就绪..."
for i in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:3001/api/health >/dev/null 2>&1; then
    log "✅ 服务已就绪（第 ${i} 次探测）"
    curl -s http://127.0.0.1:3001/api/health | head -5
    echo
    break
  fi
  [ "$i" -eq 30 ] && { warn "健康检查超时，查看日志：docker compose logs --tail=100"; }
  sleep 3
done

log "容器状态："
docker compose ps

cat <<'NEXT'

────────────────────────────────────────
 下一步（在 1Panel 面板操作）：
  1. 网站 → 创建「反向代理」站点：
       域名：你的域名（或先用服务器 IP）
       代理地址：http://127.0.0.1:3001
  2. 站点设置 → 反向代理 → 配置文件，确认 SSE 三件套存在：
       proxy_buffering off;
       proxy_cache off;
       proxy_read_timeout 300s;
  3. 站点设置 → SSL → Let's Encrypt 签发（需 80 端口可访问 + 域名已解析）
  4. 验收：
       BASE=https://你的域名 node scripts/smoke-e2e.mjs
────────────────────────────────────────
NEXT
