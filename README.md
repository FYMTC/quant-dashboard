# Quant Dashboard

独立于 Hermes 运行环境的前端看板项目（Next.js + TypeScript）。

## 设计边界（防污染）

- 只改动本目录，不写 Hermes 运行目录与配置。
- 当前为 `mock` 数据模式，不读取任何 Hermes 文件或进程状态。
- 预留只读 API 接入位，不包含交易、写库、写信号能力。

## 数据源模式

- `mock`（默认）：完全本地 mock 数据，不依赖 Hermes。
- `readonly_gateway`：仅通过独立只读网关拉取数据（HTTP API），不直接访问 Hermes 文件系统。

## 启动

```bash
cd /config/quant-dashboard
cp .env.local.example .env.local
npm run dev -- -p 3100
```

访问 [http://localhost:3100](http://localhost:3100)。

## 环境变量

参考 `.env.local.example`：

- `DASHBOARD_DATA_MODE=mock|readonly_gateway`
- `READONLY_API_BASE_URL`（只读网关地址，仅 readonly_gateway 模式需要）
- `READONLY_API_TOKEN`（只读网关 token，仅 readonly_gateway 模式需要）
- `NEXT_PUBLIC_DASHBOARD_REFRESH_MS`（前端刷新间隔，默认 30000ms）

## 现有页面与接口

- 首页：`src/app/page.tsx`
  - 系统状态卡片
  - 近期信号列表
  - 最近报告列表
- 健康检查：`GET /api/health`
- 看板数据：`GET /api/dashboard`

## 后续接入真实数据（仍保持隔离）

- 新建独立只读后端（建议不同容器/端口）。
- 只暴露聚合后的只读视图 API，不暴露 Hermes 内部文件路径。
- 在本项目中仅通过 `READONLY_API_BASE_URL` 访问该网关。

## 与独立网关联调

网关项目目录：`/config/quant-dashboard-gateway`

1. 启动网关：
   ```bash
   cd /config/quant-dashboard-gateway
   cp .env.example .env
   npm install
   npm run dev
   ```
   默认 `GATEWAY_SOURCE_MODE=mock`，后续可在网关侧切到 `upstream` 接真实只读数据。
2. 配置前端 `.env.local`：
   ```env
   DASHBOARD_DATA_MODE=readonly_gateway
   READONLY_API_BASE_URL=http://127.0.0.1:8787
   READONLY_API_TOKEN=change_me_readonly_token
   NEXT_PUBLIC_DASHBOARD_REFRESH_MS=30000
   ```
3. 启动看板并验证页面数据来自 `readonly_gateway` 模式。

## Docker 一键隔离运行

```bash
cd /config
docker compose -f quant-dashboard-stack.compose.yml up -d --build
```

- 前端看板：`http://127.0.0.1:3100`
- 只读网关：`http://127.0.0.1:8787/health`
