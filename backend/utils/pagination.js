/**
 * 分页参数解析工具
 * 统一 page/limit/offset 的解析与边界处理
 *
 * @param {Object} req - Express 请求对象
 * @param {Object} [options]
 * @param {number} [options.defaultLimit=10] - 默认每页条数
 * @param {number} [options.maxLimit=100] - 每页条数上限
 * @returns {{ page: number, limit: number, offset: number }}
 */
const parsePagination = (req, { defaultLimit = 10, maxLimit = 100 } = {}) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1)
  const rawLimit = parseInt(req.query.limit, 10) || defaultLimit
  const limit = Math.min(Math.max(rawLimit, 1), maxLimit)
  return { page, limit, offset: (page - 1) * limit }
}

module.exports = { parsePagination }
