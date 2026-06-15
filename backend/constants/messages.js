/**
 * 统一的提示文案常量
 * 集中管理 404 / 通用操作 / 鉴权相关文案，避免散落各处导致不一致
 */
const NOT_FOUND = {
  NOVEL: '小说不存在',
  CHAPTER: '章节不存在',
  USER: '用户不存在',
  CREATIVE: '创意不存在',
  CHARACTER_CARD: '人物卡不存在',
  VERSION: '版本不存在'
}

const COMMON = {
  DELETED: '删除成功',
  RESTORED: '恢复成功',
  PERMANENT_DELETED: '永久删除成功',
  NO_UPDATE_FIELDS: '缺少要更新的字段'
}

const AUTH = {
  BANNED: '账号已被封禁，请联系管理员'
}

module.exports = { NOT_FOUND, COMMON, AUTH }
