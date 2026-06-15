import rateLimit from 'express-rate-limit'

const isProduction = process.env.NODE_ENV === 'production'

export const loginRegisterLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProduction ? 20 : 50,
  message: { message: '登录尝试次数过多，请稍后再试' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'OPTIONS',
  skipSuccessfulRequests: true
})
