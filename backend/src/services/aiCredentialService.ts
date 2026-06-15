import { AiCredential } from '../models'
import { DEFAULT_AI_MODEL, DEFAULT_AI_PLATFORM } from '../constants/aiDefaults'
import { decryptSecret, encryptSecret } from '../utils/cryptoSecret'
import type { AiPlatform } from '../../../shared/types'

export interface UserAiConfig {
  platform: AiPlatform
  model: string
  apiKey: string
  customBaseURL?: string
  hasUserApiKey: boolean
}

export interface AiConfigStatus {
  platform: AiPlatform
  model: string
  hasApiKey: boolean
  source: 'user' | 'env' | 'none'
  maskedApiKey?: string
  customBaseURL?: string
}

export interface ConfiguredPlatform {
  platform: AiPlatform
  model: string
  maskedApiKey: string
  customBaseURL?: string
}

export interface AiConfigSummary {
  activePlatform: AiPlatform
  activeModel: string
  usingDefault: boolean
  hint: string | null
  configuredPlatforms: ConfiguredPlatform[]
}

const SUPPORTED_PLATFORMS: AiPlatform[] = ['aliyun', 'zhipu', 'deepseek', 'openai', 'custom']

const ENV_KEY_BY_PLATFORM: Partial<Record<AiPlatform, string>> = {
  aliyun: 'DASHSCOPE_API_KEY',
  zhipu: 'GLM_AI_KEY',
  deepseek: 'DEEPSEEK_API_KEY',
  openai: 'OPENAI_API_KEY'
}

const DEFAULT_MODEL_BY_PLATFORM: Record<AiPlatform, string> = {
  aliyun: 'qwen3.5-plus',
  zhipu: DEFAULT_AI_MODEL,
  deepseek: 'deepseek-chat',
  openai: 'gpt-4.1-mini',
  custom: DEFAULT_AI_MODEL
}

const normalizePlatform = (platform?: string): AiPlatform => {
  const normalized = (platform || DEFAULT_AI_PLATFORM).toLowerCase() as AiPlatform
  return SUPPORTED_PLATFORMS.includes(normalized) ? normalized : DEFAULT_AI_PLATFORM
}

const getEnvApiKey = (platform: AiPlatform): string => {
  const envKey = ENV_KEY_BY_PLATFORM[platform]
  return envKey ? (process.env[envKey] || '') : ''
}

const getDefaultModel = (platform: AiPlatform): string => DEFAULT_MODEL_BY_PLATFORM[platform] || DEFAULT_AI_MODEL

const maskApiKey = (apiKey: string): string => {
  if (apiKey.length <= 8) {
    return '****'
  }
  return `${apiKey.slice(0, 4)}****${apiKey.slice(-4)}`
}

export const getActiveAiConfigSummary = async (userId: number): Promise<AiConfigSummary> => {
  const credentials = await AiCredential.findAll({
    where: { userId },
    order: [['updatedAt', 'DESC']]
  })

  if (credentials.length === 0) {
    return {
      activePlatform: DEFAULT_AI_PLATFORM,
      activeModel: DEFAULT_AI_MODEL,
      usingDefault: true,
      hint: '未配置个人密钥，默认使用智谱 AI。请选择服务商并保存密钥后再切换。',
      configuredPlatforms: []
    }
  }

  const configuredPlatforms: ConfiguredPlatform[] = credentials.map((credential) => ({
    platform: credential.platform,
    model: credential.model || getDefaultModel(credential.platform),
    maskedApiKey: maskApiKey(decryptSecret(credential.encryptedApiKey)),
    customBaseURL: credential.customBaseURL || undefined
  }))

  const active = configuredPlatforms[0]!

  return {
    activePlatform: active.platform,
    activeModel: active.model,
    usingDefault: false,
    hint: null,
    configuredPlatforms
  }
}

export const getAiConfigStatus = async (userId: number, platform?: string): Promise<AiConfigStatus> => {
  const normalizedPlatform = normalizePlatform(platform)
  const credential = await AiCredential.findOne({ where: { userId, platform: normalizedPlatform } })
  if (credential) {
    const apiKey = decryptSecret(credential.encryptedApiKey)
    return {
      platform: normalizedPlatform,
      model: credential.model || getDefaultModel(normalizedPlatform),
      hasApiKey: true,
      source: 'user',
      maskedApiKey: maskApiKey(apiKey),
      customBaseURL: credential.customBaseURL || undefined
    }
  }

  const envApiKey = getEnvApiKey(normalizedPlatform)
  return {
    platform: normalizedPlatform,
    model: getDefaultModel(normalizedPlatform),
    hasApiKey: Boolean(envApiKey),
    source: envApiKey ? 'env' : 'none',
    maskedApiKey: envApiKey ? maskApiKey(envApiKey) : undefined
  }
}

export const saveUserAiConfig = async (
  userId: number,
  platform: string,
  apiKey: string,
  model?: string,
  customBaseURL?: string
): Promise<AiConfigStatus> => {
  const normalizedPlatform = normalizePlatform(platform)
  const normalizedApiKey = apiKey.trim()
  const normalizedModel = model?.trim() || getDefaultModel(normalizedPlatform)
  const normalizedBaseURL = customBaseURL?.trim() || null
  const existingCredential = await AiCredential.findOne({ where: { userId, platform: normalizedPlatform } })

  if (!normalizedApiKey && !existingCredential) {
    throw new Error('AI 密钥不能为空')
  }

  if (normalizedPlatform === 'custom' && !normalizedBaseURL) {
    throw new Error('自定义服务商必须填写 API 地址')
  }

  await AiCredential.upsert({
    userId,
    platform: normalizedPlatform,
    encryptedApiKey: normalizedApiKey
      ? encryptSecret(normalizedApiKey)
      : existingCredential!.encryptedApiKey,
    model: normalizedModel,
    customBaseURL: normalizedPlatform === 'custom' ? normalizedBaseURL : null
  })

  const displayApiKey = normalizedApiKey || decryptSecret(existingCredential!.encryptedApiKey)
  return {
    platform: normalizedPlatform,
    model: normalizedModel,
    hasApiKey: true,
    source: 'user',
    maskedApiKey: maskApiKey(displayApiKey),
    customBaseURL: normalizedPlatform === 'custom' ? normalizedBaseURL || undefined : undefined
  }
}

export const getUserAiConfig = async (userId?: number, platform?: string, model?: string): Promise<UserAiConfig> => {
  const normalizedPlatform = normalizePlatform(platform)

  if (userId) {
    const credential = await AiCredential.findOne({ where: { userId, platform: normalizedPlatform } })
    if (credential) {
      return {
        platform: normalizedPlatform,
        model: model?.trim() || credential.model || getDefaultModel(normalizedPlatform),
        apiKey: decryptSecret(credential.encryptedApiKey),
        customBaseURL: credential.customBaseURL || undefined,
        hasUserApiKey: true
      }
    }

    const userCredentialCount = await AiCredential.count({ where: { userId } })
    if (userCredentialCount === 0) {
      return {
        platform: DEFAULT_AI_PLATFORM,
        model: model?.trim() || DEFAULT_AI_MODEL,
        apiKey: getEnvApiKey(DEFAULT_AI_PLATFORM),
        hasUserApiKey: false
      }
    }
  }

  return {
    platform: normalizedPlatform,
    model: model?.trim() || getDefaultModel(normalizedPlatform),
    apiKey: getEnvApiKey(normalizedPlatform),
    hasUserApiKey: false
  }
}
