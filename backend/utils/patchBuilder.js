/**
 * 部分更新 patch 构建工具
 * 从请求体中挑选允许更新的字段，仅保留显式传入（!== undefined）的字段
 *
 * @param {Object} body - 请求体
 * @param {string[]} allowedFields - 允许更新的字段名列表
 * @returns {Object} 仅包含传入字段的 patch 对象
 */
const buildPatch = (body, allowedFields) => {
  return allowedFields.reduce((patch, field) => {
    if (body && typeof body[field] !== 'undefined') {
      patch[field] = body[field]
    }
    return patch
  }, {})
}

module.exports = { buildPatch }
