/**
 * 数据库错误判断工具
 */

/**
 * 判断错误是否为「数据表不存在」（用于尚未初始化的可选表的优雅降级）
 * @param {Error} error
 * @returns {boolean}
 */
const isMissingTableError = (error) => {
  const code = error?.original?.code || error?.parent?.code
  const message = String(error?.original?.sqlMessage || error?.message || '')
  return (
    code === 'ER_NO_SUCH_TABLE' ||
    message.includes("doesn't exist") ||
    message.includes('no such table')
  )
}

module.exports = { isMissingTableError }
