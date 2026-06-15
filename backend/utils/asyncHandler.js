const { sendServerError } = require('./httpResponse')

/**
 * 异步路由包装器：统一 try/catch + 500 错误响应，消除每个路由重复的样板代码
 *
 * 行为与既有路由保持一致：捕获异常后 console.error(`${errorMessage}:`, error)
 * 并返回 res.status(500).json({ message: errorMessage })。
 * 若响应头已发送（如 SSE 场景），则交给 Express 默认错误处理。
 *
 * @param {Function} handler - async (req, res, next) => {}
 * @param {string} [errorMessage='服务器内部错误'] - 出错时的日志与响应文案
 */
const asyncHandler = (handler, errorMessage = '服务器内部错误') => {
  return async (req, res, next) => {
    try {
      await handler(req, res, next)
    } catch (error) {
      if (res.headersSent) {
        return next(error)
      }
      sendServerError(res, error, errorMessage)
    }
  }
}

module.exports = { asyncHandler }
