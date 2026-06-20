# ============================================================
# 数字命理推演引擎 — Docker 多阶段构建
# 目标：极致轻量生产镜像（仅保留 dist/ + 运行时依赖）
# ============================================================

# ═══ Stage 1: 构建阶段 ═══
FROM node:22-alpine AS builder

WORKDIR /app

# 安装构建依赖（利用 Docker 层缓存）
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# 复制源码并构建
COPY tsconfig.json tsconfig.app.json tsconfig.node.json vite.config.ts index.html ./
COPY src/ ./src/
COPY admin/ ./admin/
COPY public/ ./public/
RUN npm run build

# ═══ Stage 2: 生产运行阶段 ═══
FROM node:22-alpine AS runner

WORKDIR /app

# 安装生产依赖 + better-sqlite3 原生编译工具链
COPY package.json package-lock.json ./
RUN apk add --no-cache python3 make g++ && \
    npm ci --omit=dev && \
    npm rebuild better-sqlite3 && \
    apk del python3 make g++

# 从构建阶段复制产物
COPY --from=builder /app/dist ./dist

# 复制服务端运行时源码（不含 client/ 前端源码）
COPY tsconfig.json tsconfig.app.json tsconfig.node.json ./
COPY src/server/ ./src/server/
COPY src/engine/ ./src/engine/

# 容器内暴露 3001 端口
EXPOSE 3001

# 环境变量自动加载（由 docker-compose volumes 注入 .env）
ENV NODE_ENV=production

# 健康检查：每 30s 探测 /api/health
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "const http=require('http');http.get('http://localhost:3001/api/health',r=>{process.exit(r.statusCode===200?0:1)})"

# 启动命令：直接运行 Hono 生产服务器
CMD ["npx", "tsx", "src/server/index.ts", "--prod"]
