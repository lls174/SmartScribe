const { validationResult } = require('express-validator')

/**
 * express-validator 校验结果中间件
 * 统一返回首个校验错误，行为与既有路由一致：400 + { message }
 */
const validateRequest = (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: errors.array()[0].msg })
  }
  next()
}

module.exports = { validateRequest }
