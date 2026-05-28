const rateLimit = require('express-rate-limit')

const isProduction = process.env.NODE_ENV === 'production'

// 仅限制登录/注册，避免误伤 /info 等已认证接口
const loginRegisterLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProduction ? 20 : 50,
  message: { message: '登录尝试次数过多，请稍后再试' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'OPTIONS',
  // 成功登录/注册不计入次数，只累计失败尝试
  skipSuccessfulRequests: true,
})

module.exports = {
  loginRegisterLimiter,
}
