# SmartScribe 云端部署文档（Vercel + Render）

本文档描述将 **前端部署到 Vercel**、**后端 API 部署到 Render** 的方式。数据库仍使用 **MySQL**（与现有 Sequelize 配置一致），需单独准备可公网或内网连通的 MySQL 实例。

> 说明：若你习惯写成「前端 Vercel、后端 Render」，与本文一致即可；两者为不同域名，需配置跨域与前端 API 地址。

## 架构一览

| 组件 | 平台 | 说明 |
|------|------|------|
| 前端静态站点 | [Vercel](https://vercel.com) | Vite 构建后的 SPA |
| 后端 HTTP API | [Render](https://render.com) | Node.js Web Service，`npm start` |
| 数据库 | 自建或云厂商 | **MySQL**，供 Render 上的后端连接 |

浏览器从 `https://你的项目.vercel.app` 访问前端，请求发往 `https://你的服务.onrender.com/api/...`（通过环境变量 `VITE_API_BASE_URL` 配置）。

## 1. 准备 MySQL

后端依赖 `mysql2`，环境变量与 [`backend/.env.example`](backend/.env.example) 一致。任选其一：

- Render 上若提供 **MySQL** 托管或插件，按其面板填写 `DB_HOST`、`DB_PORT`、`DB_USER`、`DB_PASSWORD`、`DB_NAME`
- 或使用 **PlanetScale / Railway / Aiven** 等提供的 MySQL，把外网可连的主机与账号填入 Render 环境变量

在 MySQL 中建好库后，在本地或 CI 对目标库执行一次（或仅在首次上线执行）：

```bash
cd backend
# 配置好 DB_* 与 JWT_SECRET 后
npm run db:init
```

如果你是从旧版本升级到包含 RBAC、AI 请求日志/用量统计的新版本，请额外执行一次：

```bash
cd backend
npm run db:migrate:rbac-usage
```

## 2. 部署后端（Render Web Service）

1. 在 Render 控制台 **New → Web Service**，连接你的 Git 仓库。
2. **Root Directory** 填：`backend`
3. **Runtime**：Node
4. **Build Command**：`npm install`（或 `npm ci`，若已提交 `package-lock.json`）
5. **Start Command**：`npm start`（即 `node app.js`）
6. **Instance type**：按流量选择；免费实例冷启动较慢，属正常现象。

### 环境变量（Render → Environment）

在 Render 服务里至少配置：

| 变量名 | 说明 |
|--------|------|
| `NODE_ENV` | `production` |
| `PORT` | 一般由 Render 注入，可不手写；若未注入可保留默认逻辑 |
| `JWT_SECRET` | 必填，随机长字符串 |
| `DB_HOST` / `DB_PORT` / `DB_USER` / `DB_PASSWORD` / `DB_NAME` | MySQL 连接 |
| `CORS_ORIGINS` | **必填**。你的 Vercel 预览与生产域名，英文逗号分隔，例如：`https://smart-scribe.vercel.app,https://www.example.com` |
| `TRUST_PROXY` | 建议 `true`（Render 在反向代理后） |
| `ADMIN_BOOTSTRAP_KEY` | 建议配置，用于初始化首个 admin |
| `DASHSCOPE_API_KEY` 等 | 可选，服务端默认 AI 密钥 |

部署完成后记下后端公网地址，例如：`https://smartscribe-api.onrender.com`。健康检查：`https://smartscribe-api.onrender.com/api/health`。

## 3. 部署前端（Vercel）

1. 在 Vercel **Import Project**，选择同一仓库。
2. **Root Directory** 填：`frontend`
3. **Framework Preset**：Vite（一般会自动识别）
4. **Build Command**：`npm run build`
5. **Output Directory**：`dist`
6. **Install Command**：默认 `npm install` 即可（需执行 `postinstall` 复制 Live2D 资源时勿跳过安装）

### 环境变量（Vercel → Settings → Environment Variables）

| 变量名 | 值示例 | 说明 |
|--------|--------|------|
| `VITE_APP_BASE_URL` | `/` | 站点挂在根路径时保持 `/` |
| `VITE_API_BASE_URL` | `https://smartscribe-api.onrender.com/api` | **不要**末尾多余斜杠；与 Render 上实际域名一致 |

保存后重新触发一次 **Deploy**，以便构建期注入 `VITE_*`。

### SPA 路由（刷新不 404）

若 Vercel 对深层路由返回 404，在 `frontend` 目录下增加 `vercel.json`：

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

提交后由 Vercel 自动读取；也可在 Vercel 项目 **Rewrites** 里等价配置。

## 4. 联调检查清单

1. 浏览器打开 Vercel 地址，开发者工具 **Network** 中 API 请求应指向 `https://…onrender.com/api/...`。
2. 先访问任意会调接口的页面，确认能请求 `/api/csrf-token`（状态 200），再测登录、注册。
3. 若出现 **CORS** 错误：检查 Render 上 `CORS_ORIGINS` 是否包含当前浏览器地址栏的 **完整 origin**（含 `https://`，无路径）。
4. 若 **401 / CSRF** 异常：确认前端 `withCredentials` 仍为 true，且 API 与 Cookie 域名一致为 Render；不要混用 http/https。
5. **AI 流式**：长连接可能被网关超时中断，若不稳定可适当调高 Render 侧超时或拆短流式链路（属运维调优）。

## 4.1 初始化管理员（admin）

在 Render 的环境变量配置好 `ADMIN_BOOTSTRAP_KEY` 后，执行一次初始化请求（只用于创建/提升首个管理员账号）：

```bash
curl -X POST "https://smartscribe-api.onrender.com/api/admin/bootstrap" \
  -H "Content-Type: application/json" \
  -H "x-admin-bootstrap-key: <你的ADMIN_BOOTSTRAP_KEY>" \
  -d '{"username":"admin","password":"admin123456"}'
```

## 5. 与「自建服务器」文档的关系

- 单机 **Nginx + PM2 + MySQL** 的步骤见 [`部署文档.md`](部署文档.md)。
- 本文 **Vercel + Render** 与之并列，按你的托管选择其一即可。
