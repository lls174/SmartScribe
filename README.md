# SmartScribe - AI 驱动的未来创作引擎

一款轻量化 AI 网文创作工具

## 📁 项目结构

## 🛠️ 技术栈

### 前端

| 技术                    | 用途            |
| --------------------- | ------------- |
| React 18 + TypeScript | 核心框架          |
| Vite                  | 构建工具          |
| Ant Design 5.x        | UI 组件库（科幻风覆盖） |
| Draft.js              | 富文本编辑器        |
| React Router v6       | 前端路由          |
| Axios                 | HTTP 客户端      |

### 后端

| 技术                    | 用途        |
| --------------------- | --------- |
| Node.js + Express     | 服务端框架     |
| MySQL + Sequelize ORM | 数据库       |
| JWT + bcryptjs        | 身份认证与密码加密 |
| csurf + helmet        | 安全防护      |
| express-rate-limit    | 频率限制      |

## 🚀 快速开始

### 1. 安装依赖

```bash
# 安装前端依赖
cd frontend
npm install

# 安装后端依赖
cd ../backend
npm install
```

### 2. 配置环境变量

#### 方式一：Windows 系统环境变量（推荐）

在 Windows 系统设置中添加以下环境变量：

| 变量名                 | 说明              | 是否必填      |
| ------------------- | --------------- | --------- |
| `DASHSCOPE_API_KEY` | 阿里云百炼 API 密钥    | 否（可在前端填写） |
| `GLM_AI_KEY`        | 智谱 AI API 密钥    | 否（可在前端填写） |
| `DEEPSEEK_API_KEY`  | DeepSeek API 密钥 | 否（可在前端填写） |
| `OPENAI_API_KEY`    | OpenAI API 密钥   | 否（可在前端填写） |
| `JWT_SECRET`        | JWT 签名密钥        | **是**     |

> **安全提示**：`JWT_SECRET` 必须配置，其他 AI 密钥可选。用户也可在前端「AI 设置」页面自行输入 API 密钥（仅存于内存）。

#### 方式二：后端 .env 文件

创建 `backend/.env` 文件：

```env
PORT=3001
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=你的数据库密码
DB_NAME=smart_scribe
JWT_SECRET=你的JWT密钥
NODE_ENV=development

# 以下为可选的服务端默认 AI 密钥（用户未填写时使用）
DASHSCOPE_API_KEY=
GLM_AI_KEY=
DEEPSEEK_API_KEY=
OPENAI_API_KEY=
```

### 3. 配置数据库

确保 MySQL 服务已启动并创建了数据库 `smart_scribe`。

### 4. 初始化数据库表

```bash
cd backend
npm run db:init
```

> 此命令会自动创建所有必要的数据表（users, novels, chapters, feedbacks, creatives）。如需更新表结构，请手动删除对应表后重新运行。

### 5. 启动服务

```bash
# 启动后端服务（终端 1）
cd backend
npm run dev

# 启动前端服务（终端 2）
cd frontend
npm run dev
```

### 6. 访问应用

打开浏览器访问：**<http://localhost:3002>**

| 地址                      | 说明     |
| ----------------------- | ------ |
| <http://localhost:3002> | 前端首页   |
| <http://localhost:3001> | 后端 API |

## 📖 功能指南

### AI 平台配置

进入「**AI 设置**」页面，选择 AI 平台和模型：

| 平台       | 可用模型                              | 默认 API 地址 |
| -------- | --------------------------------- | --------- |
| 阿里云百炼    | qwen-turbo / plus / max / long    | 内置        |
| 智谱 AI    | glm-4-flash / 4 / 4-plus / 4-long | 内置        |
| DeepSeek | deepseek-chat / reasoner          | 内置        |
| OpenAI   | gpt-4o-mini / 4o / 4-turbo        | 内置        |
| 自定义      | 用户输入模型名称                          | 用户填写      |

### 使用流程

1. **注册/登录** → 创建账号
2. **AI 设置** → 选择平台、模型，输入 API 密钥（可选）
3. **新建小说** → 输入基本信息
4. **章节生成** → 选择题材、风格等参数，AI 流式生成内容
5. **续写/润色** → 对已有章节进行续写或润色处理
6. **创意生成** → 获取流行趋势、热门题材、创意元素灵感
7. **保存创意** → 将生成的创意内容保存到创意管理

### 流式响应体验

所有 AI 生成操作均采用 **Server-Sent Events (SSE)** 流式传输：

- 后端实时推送 AI 返回的文本块
- 前端以**打字机效果**逐字显示
- 闪烁光标提示正在生成
- 无需等待全部完成即可看到内容

## 🔧 端口说明

| 端口   | 用途        | 冲突时处理         |
| ---- | --------- | ------------- |
| 3001 | 后端 API 服务 | 请询问用户是否修改     |
| 3002 | 前端开发服务器   | Vite 自动寻找可用端口 |

## 📄 许可证

MIT License
