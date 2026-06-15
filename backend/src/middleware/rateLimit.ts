import type { Request } from 'express'
import rateLimit from 'express-rate-limit'

const isProduction = process.env.NODE_ENV === 'production'

const AUTH_EXEMPT_PATHS = [
  '/api/csrf-token',
  '/api/health',
  '/api/user/login',
  '/api/user/register'
]

const isAuthExemptPath = (req: Request): boolean => {
  const path = (req.originalUrl || req.url || '').split('?')[0]
  return AUTH_EXEMPT_PATHS.some((item) => path === item || path.startsWith(`${item}/`))
}

export const globalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProduction ? 400 : 150,
  message: { message: '请求过于频繁，请稍后再试' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'OPTIONS' || isAuthExemptPath(req)
})

export const loginRegisterLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProduction ? 30 : 50,
  message: { message: '登录尝试次数过多，请稍后再试' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'OPTIONS',
  skipSuccessfulRequests: true
})
