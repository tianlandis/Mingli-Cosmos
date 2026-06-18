#!/usr/bin/env bash
# ============================================================
# 数字命理推演引擎 — VPS 一键部署 (Production)
# ============================================================
# 使用：
#   1. SSH 到 VPS
#   2. git clone https://github.com/tianlandis/Mingli-Cosmos.git
#   3. cd Mingli-Cosmos && bash deploy/deploy.sh
# ============================================================
set -e

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$SCRIPT_DIR"

echo ""
echo "============================================"
echo "  数字命理推演引擎 — 生产部署"
echo "============================================"
echo ""

# ── 依赖检查 ──
log "Docker: $(docker --version 2>&1)"
log "Compose: $(docker compose version 2>&1)"

# ── .env 处理 ──
if [ ! -f ".env" ]; then
  if [ -f ".env.example" ]; then
    cp .env.example .env
    warn "已从 .env.example 复制模板 → .env"
    warn "============================================"
    warn "  ⚠️  请先编辑 .env 填入 API Key 后再继续！"
    warn "  nano .env"
    warn "============================================"
    exit 1
  else
    err ".env 和 .env.example 都不存在"
  fi
fi

# ── 停止旧容器 ──
log "清理旧容器..."
docker compose down 2>/dev/null || true

# ── 构建 + 启动 ──
log "构建镜像 + 启动（首次约 2-3 分钟）..."
docker compose up -d --build

# ── 等待就绪 ──
log "等待服务就绪..."
for i in $(seq 1 15); do
  if curl -sf http://localhost:3001/api/health > /dev/null 2>&1; then
    log "服务已就绪！"
    break
  fi
  [ $i -eq 15 ] && warn "超时，检查: docker compose logs"
  sleep 2
done

# ── 结果 ──
PUBLIC_IP=$(curl -sf ifconfig.me 2>/dev/null || echo "YOUR_IP")
echo ""
echo "============================================"
echo "  ✅ 部署完成"
echo "============================================"
echo ""
echo "  站点:    http://${PUBLIC_IP}:3001"
echo "  健康检查: http://${PUBLIC_IP}:3001/api/health"
echo ""
echo "  管理命令:"
echo "    docker compose logs -f      实时日志"
echo "    docker compose restart      重启"
echo "    docker compose down         停止"
echo ""
