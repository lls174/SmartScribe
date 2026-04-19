const express = require('express')
const cors = require('cors')
const dotenv = require('dotenv')
const helmet = require('helmet')
const rateLimit = require('express-rate-limit')
const csurf = require('csurf')
const cookieParser = require('cookie-parser')
const { connectDatabase, getDatabaseStatus } = require('./config/db')

// 加载环境变量
dotenv.config()



const app = express()
const PORT = process.env.PORT || 3001
const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3002',
  'http://localhost:3003',
  'http://localhost:3004'
]

const parseAllowedOrigins = () => {
  const configuredOrigins = process.env.CORS_ORIGINS
    ?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)

  return configuredOrigins?.length ? configuredOrigins : DEFAULT_ALLOWED_ORIGINS
}

const allowedOrigins = parseAllowedOrigins()
const trustProxy = process.env.TRUST_PROXY

if (trustProxy && trustProxy !== 'false') {
  app.set('trust proxy', trustProxy === 'true' ? 1 : trustProxy)
} else if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1)
}

const ensureRequiredEnv = () => {
  const requiredEnvVars = ['JWT_SECRET']
  const missingEnvVars = requiredEnvVars.filter((key) => !process.env[key])

  if (missingEnvVars.length > 0) {
    throw new Error(`缺少必要环境变量: ${missingEnvVars.join(', ')}`)
  }

  if (process.env.NODE_ENV === 'production' && !process.env.CORS_ORIGINS) {
    console.warn('未配置 CORS_ORIGINS，将仅允许默认本地开发来源访问')
  }
}

// Helmet 中间件 - 提供 XSS 防护和其他安全 HTTP 头
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false,
}))

// CORS 配置
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true)
      return
    }

    callback(null, false)
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
  credentials: true
}))

// cookie 解析中间件
app.use(cookieParser())

// 请求体解析中间件
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// API 访问频率限制
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 分钟
  max: 100, // 每个 IP 在 15 分钟内最多 100 个请求
  message: { message: '请求过于频繁，请稍后再试' },
  standardHeaders: true,
  legacyHeaders: false,
})

// 对 AI 接口进行更严格的频率限制
const aiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 分钟
  max: 10, // 每个 IP 在 1 分钟内最多 10 个请求
  message: { message: 'AI 接口请求过于频繁，请稍后再试' },
  standardHeaders: true,
  legacyHeaders: false,
})

// 登录注册接口频率限制
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 分钟
  max: 5, // 每个 IP 在 15 分钟内最多 5 个登录/注册请求
  message: { message: '登录尝试次数过多，请稍后再试' },
  standardHeaders: true,
  legacyHeaders: false,
})

// 应用全局频率限制
app.use('/api/', limiter)

// CSRF 防护中间件
const csrfProtection = process.env.NODE_ENV === 'test'
  ? (req, res, next) => next()
  : csurf({
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  }
})

// 路由 - 先导入路由触发数据库同步
const userRoutes = require('./routes/user')
const novelRoutes = require('./routes/novel')
const aiRoutes = require('./routes/ai')
const feedbackRoutes = require('./routes/feedback')
const creativeRoutes = require('./routes/creative')

// 应用 CSRF 保护到所有需要保护的路由
app.use('/api/user', csrfProtection)
app.use('/api/novel', csrfProtection)
app.use('/api/ai', csrfProtection)
app.use('/api/feedback', csrfProtection)
app.use('/api/creative', csrfProtection)

// 应用路由和特定的频率限制
app.use('/api/user', authLimiter, userRoutes)
app.use('/api/novel', novelRoutes)
app.use('/api/ai', aiLimiter, aiRoutes)
app.use('/api/feedback', feedbackRoutes)
app.use('/api/creative', creativeRoutes)

// 获取 CSRF Token 的接口（不需要 CSRF 保护）
app.get('/api/csrf-token', csrfProtection, (req, res) => {
  res.json({ csrfToken: req.csrfToken() })
})

// 健康检查
app.get('/api/health', async (req, res) => {
  const databaseConnected = await connectDatabase({ logSuccess: false, logFailure: false })
  const databaseStatus = getDatabaseStatus()

  res.status(databaseConnected ? 200 : 503).json({
    status: databaseConnected ? 'ok' : 'degraded',
    database: databaseStatus,
    uptime: process.uptime()
  })
})

// 全局错误处理中间件
app.use((err, req, res, next) => {
  if (err.code === 'EBADCSRFTOKEN') {
    return res.status(403).json({ message: 'CSRF 验证失败' })
  }
  console.error(err.stack)
  res.status(500).json({ message: '服务器内部错误' })
})

// 启动服务器
const startServer = async () => {
  ensureRequiredEnv()

  const databaseConnected = await connectDatabase()
  if (!databaseConnected) {
    throw new Error('数据库连接失败，服务未启动')
  }

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
  })
}

if (require.main === module) {
  startServer().catch((error) => {
    console.error('服务启动失败:', error)
    process.exit(1)
  })
}

module.exports = app
module.exports.startServer = startServer
module.exports.ensureRequiredEnv = ensureRequiredEnv