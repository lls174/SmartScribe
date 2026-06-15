export const getJwtSecret = (): string => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET 未配置')
  }

  return process.env.JWT_SECRET
}
