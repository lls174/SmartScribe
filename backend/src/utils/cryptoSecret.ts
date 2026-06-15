import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12

const getSecretMaterial = (): string => {
  const secret = process.env.AI_KEY_ENCRYPTION_SECRET || process.env.JWT_SECRET
  if (!secret) {
    throw new Error('缺少 AI_KEY_ENCRYPTION_SECRET 或 JWT_SECRET，无法加密 AI 密钥')
  }
  return secret
}

const getKey = (): Buffer => crypto.createHash('sha256').update(getSecretMaterial()).digest()

export const encryptSecret = (plainText: string): string => {
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv)
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()

  return [iv, authTag, encrypted].map((part) => part.toString('base64')).join(':')
}

export const decryptSecret = (payload: string): string => {
  const [ivRaw, authTagRaw, encryptedRaw] = payload.split(':')
  if (!ivRaw || !authTagRaw || !encryptedRaw) {
    throw new Error('AI 密钥密文格式不正确')
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivRaw, 'base64'))
  decipher.setAuthTag(Buffer.from(authTagRaw, 'base64'))
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedRaw, 'base64')),
    decipher.final()
  ])

  return decrypted.toString('utf8')
}
