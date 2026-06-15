/**
 * 统一 HTTP 响应工具
 */

/**
 * 返回指定状态码的错误响应
 * @param {Object} res - Express 响应对象
 * @param {number} statusCode - HTTP 状态码
 * @param {string} message - 提示信息
 */
const sendError = (res, statusCode, message) => {
  return res.status(statusCode).json({ message })
}

/**
 * 记录并返回 500 服务器错误（保持与既有路由一致的日志 + 响应格式）
 * @param {Object} res - Express 响应对象
 * @param {Error} error - 错误对象
 * @param {string} message - 用于日志与响应的提示信息
 */
const sendServerError = (res, error, message) => {
  console.error(`${message}:`, error)
  return res.status(500).json({ message })
}

module.exports = { sendError, sendServerError }
