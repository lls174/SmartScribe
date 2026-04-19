const jwt = require('jsonwebtoken')

const getJwtSecret = () => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET 未配置')
  }

  return process.env.JWT_SECRET
}

/**
 * 验证JWT token的中间件
 * @param {Object} req - 请求对象
 * @param {Object} res - 响应对象
 * @param {Function} next - 下一个中间件函数
 * @returns {void}
 */
const verifyToken = (req, res, next) => {
  // 支持从 Authorization header 或 query 参数获取 token
  const token = req.headers.authorization?.split(' ')[1] || req.query.token
  
  if (!token) {
    return res.status(401).json({ message: '未授权' })
  }

  try {
    // 测试环境下，使用测试token
    if (process.env.NODE_ENV === 'test' && token === 'test-token') {
      req.userId = 1
      return next()
    }
    
    // 实际环境下，验证JWT token
    const decoded = jwt.verify(token, getJwtSecret())
    req.userId = decoded.userId
    next()
  } catch (error) {
    console.error('Token验证失败:', error)
    return res.status(401).json({ message: '无效的token' })
  }
}

module.exports = { verifyToken }
