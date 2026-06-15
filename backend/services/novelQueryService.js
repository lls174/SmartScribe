const { Novel, Chapter } = require('../models')

/**
 * 查询属于指定用户的小说（默认排除已软删除）
 * @param {number|string} novelId
 * @param {number} userId
 * @param {Object} [options]
 * @param {boolean} [options.includeDeleted=false] - 是否包含已软删除的小说
 * @returns {Promise<Object|null>}
 */
const findOwnedNovel = async (novelId, userId, { includeDeleted = false } = {}) => {
  const where = { id: parseInt(novelId, 10), userId }
  if (!includeDeleted) {
    where.isDeleted = false
  }
  return Novel.findOne({ where })
}

/**
 * 查询属于指定用户的章节（通过关联 Novel 校验归属）
 * 注意：不默认过滤 isDeleted，以兼容回收站恢复/永久删除等场景。
 * @param {number|string} chapterId
 * @param {number} userId
 * @returns {Promise<Object|null>}
 */
const findOwnedChapter = async (chapterId, userId) => {
  return Chapter.findOne({
    include: [{ model: Novel, where: { userId } }],
    where: { id: parseInt(chapterId, 10) }
  })
}

module.exports = { findOwnedNovel, findOwnedChapter }
