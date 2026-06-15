import express, { type ErrorRequestHandler, type RequestHandler } from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import csurf from 'csurf'
import cookieParser from 'cookie-parser'
import { connectDatabase, getDatabaseStatus } from './config/db'
import { globalApiLimiter } from './middleware/rateLimit'
import userRoutes from './routes/user'
import novelRoutes from './routes/novel'
import aiRoutes from './routes/ai'
import feedbackRoutes from './routes/feedback'
import creativeRoutes from './routes/creative'
import adminRoutes from './routes/admin'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001
const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3002',
  'http://localhost:3003',
  'http://localhost:3004'
]

const parseAllowedOrigins = (): string[] => {
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

export const ensureRequiredEnv = (): void => {
  const requiredEnvVars = ['JWT_SECRET']
  const missingEnvVars = requiredEnvVars.filter((key) => !process.env[key])
  if (missingEnvVars.length > 0) {
    throw new Error(`缺少必要环境变量: ${missingEnvVars.join(', ')}`)
  }
  if (process.env.NODE_ENV === 'production' && !process.env.CORS_ORIGINS) {
    console.warn('未配置 CORS_ORIGINS，将仅允许默认本地开发来源访问')
  }
}

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:']
    }
  },
  crossOriginEmbedderPolicy: false
}))

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

app.use(cookieParser())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { message: 'AI 接口请求过于频繁，请稍后再试' },
  standardHeaders: true,
  legacyHeaders: false
})

app.use('/api/', globalApiLimiter)

const csrfProtection: RequestHandler = process.env.NODE_ENV === 'test'
  ? (_req, _res, next) => next()
  : csurf({
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    }
  })

app.use('/api/user', csrfProtection)
app.use('/api/novel', csrfProtection)
app.use('/api/ai', csrfProtection)
app.use('/api/feedback', csrfProtection)
app.use('/api/creative', csrfProtection)
app.use('/api/admin', csrfProtection)

app.use('/api/user', userRoutes)
app.use('/api/novel', novelRoutes)
app.use('/api/ai', aiLimiter, aiRoutes)
app.use('/api/feedback', feedbackRoutes)
app.use('/api/creative', creativeRoutes)
app.use('/api/admin', adminRoutes)

app.get('/api/csrf-token', csrfProtection, (req, res) => {
  res.json({ csrfToken: req.csrfToken?.() || '' })
})

app.get('/api/health', async (_req, res) => {
  const databaseConnected = await connectDatabase({ logSuccess: false, logFailure: false })
  const databaseStatus = getDatabaseStatus()
  res.status(databaseConnected ? 200 : 503).json({
    status: databaseConnected ? 'ok' : 'degraded',
    database: databaseStatus,
    uptime: process.uptime()
  })
})

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err?.code === 'EBADCSRFTOKEN') {
    return res.status(403).json({ message: 'CSRF 验证失败' })
  }
  console.error(err?.stack || err)
  res.status(500).json({ message: '服务器内部错误' })
}

app.use(errorHandler)

export const startServer = async (): Promise<void> => {
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

export default app
