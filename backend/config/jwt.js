/**
 * JWT 配置工具
 * 统一获取 JWT 密钥，避免在多个文件中重复定义
 */
const getJwtSecret = () => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET 未配置')
  }

  return process.env.JWT_SECRET
}

module.exports = { getJwtSecret }
