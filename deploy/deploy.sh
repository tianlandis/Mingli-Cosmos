#!/usr/bin/env bash
# ============================================================
# 数字命理推演引擎 — VPS 一键部署脚本
# 用法：chmod +x deploy.sh && ./deploy.sh
# ============================================================
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; exit 1; }

echo "============================================"
echo "  数字命理推演引擎 — VPS 部署"
echo "============================================"
echo ""

# ── 取得公网 IP ──
PUBLIC_IP=$(curl -sf ifconfig.me 2>/dev/null || echo "YOUR_IP")

# ── 1. 检查依赖 ──
log "检查 Docker..."
docker --version || err "Docker 未安装"
docker compose version || err "Docker Compose 未安装"

# ── 2. 克隆仓库 ──
REPO_DIR="$HOME/mingli-cosmos"
if [ -d "$REPO_DIR" ]; then
  log "仓库已存在，执行 git pull..."
  cd "$REPO_DIR"
  git pull origin master
else
  log "克隆仓库..."
  git clone https://github.com/tianlandis/Mingli-Cosmos.git "$REPO_DIR"
  cd "$REPO_DIR"
fi

# ── 3. 配置 .env ──
if [ ! -f ".env" ]; then
  warn ".env 不存在，创建默认配置..."
  cat > .env << ENVEOF
# LLM Provider: deepseek | claude | openai | local
LLM_PROVIDER=local
LLM_API_KEY=ollama
LLM_BASE_URL=http://localhost:11434/v1
LLM_MODEL=qwen2.5:7b
SERVER_PORT=3001
LOG_ENABLED=true
LOG_LEVEL=info
ENVEOF
  warn "请编辑 .env 填入正确的 LLM 配置: nano .env"
else
  log ".env 已存在，跳过"
fi

# ── 4. 停止旧容器 ──
log "停止旧容器..."
docker compose down 2>/dev/null || true

# ── 5. 构建并启动 ──
log "构建镜像并启动容器（首次构建约 2-3 分钟）..."
docker compose up -d --build

# ── 6. 等待健康检查 ──
log "等待服务就绪..."
for i in $(seq 1 15); do
  if curl -sf http://localhost:3001/api/health > /dev/null 2>&1; then
    log "服务已就绪！"
    break
  fi
  if [ $i -eq 15 ]; then
    warn "服务启动超时，查看日志: docker compose logs"
  fi
  sleep 2
done

# ── 7. 验证 ──
echo ""
echo "============================================"
echo "  健康检查"
echo "============================================"
curl -s http://localhost:3001/api/health 2>/dev/null | python3 -m json.tool 2>/dev/null || \
  curl -s http://localhost:3001/api/health

echo ""
echo "============================================"
echo "  ✅ 部署完成！"
echo "============================================"
echo ""
echo "  公网访问: http://${PUBLIC_IP}:3001"
echo "  健康检查: http://${PUBLIC_IP}:3001/api/health"
echo ""
echo "  常用命令:"
echo "    docker compose logs -f          查看日志"
echo "    docker compose restart          重启服务"
echo "    docker compose down             停止服务"
echo "    docker compose up -d --build    重建并启动"
echo ""
