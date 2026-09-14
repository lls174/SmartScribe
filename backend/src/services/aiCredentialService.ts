import { AiCredential, AppSetting, User } from '../models'
import { DEFAULT_AI_MODEL, DEFAULT_AI_PLATFORM } from '../constants/aiDefaults'
import { decryptSecret, encryptSecret } from '../utils/cryptoSecret'
import type { AiPlatform } from '../../../shared/types'

export interface UserAiConfig {
  platform: AiPlatform
  model: string
  apiKey: string
  customBaseURL?: string
  hasUserApiKey: boolean
  /** 已开自备密钥但尚未保存 Key，调用方应提示用户填写，不能回落平台默认。 */
  missingOwnKey?: boolean
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
  useOwnAiKey: boolean
  defaultPlatform: AiPlatform
  defaultModel: string
  hint: string | null
  configuredPlatforms: ConfiguredPlatform[]
}

const SITE_DEFAULT_PLATFORM_KEY = 'ai.defaultPlatform'
const SITE_DEFAULT_MODEL_KEY = 'ai.defaultModel'

const SUPPORTED_PLATFORMS: AiPlatform[] = ['aliyun', 'zhipu', 'deepseek', 'openai', 'custom']

const ENV_KEY_BY_PLATFORM: Partial<Record<AiPlatform, string>> = {
  aliyun: 'DASHSCOPE_API_KEY',
  zhipu: 'GLM_AI_KEY',
  deepseek: 'DEEPSEEK_API_KEY',
  openai: 'OPENAI_API_KEY'
}

const DEFAULT_MODEL_BY_PLATFORM: Record<AiPlatform, string> = {
  aliyun: 'qwen3.5-plus',
  zhipu: 'glm-5-turbo',
  deepseek: DEFAULT_AI_MODEL,
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

/** 读取站点默认平台与模型，未配置时回落到代码常量。 */
export const getSiteAiDefaults = async (): Promise<{ platform: AiPlatform; model: string }> => {
  const rows = await AppSetting.findAll({
    where: { key: [SITE_DEFAULT_PLATFORM_KEY, SITE_DEFAULT_MODEL_KEY] }
  })
  const map = Object.fromEntries(rows.map((row) => [row.key, row.value]))
  const platform = normalizePlatform(map[SITE_DEFAULT_PLATFORM_KEY] || DEFAULT_AI_PLATFORM)
  const model = map[SITE_DEFAULT_MODEL_KEY]?.trim() || getDefaultModel(platform)
  return { platform, model }
}

/** 管理员保存站点默认平台与模型。 */
export const setSiteAiDefaults = async (platform: string, model: string): Promise<{ platform: AiPlatform; model: string }> => {
  const normalizedPlatform = normalizePlatform(platform)
  if (normalizedPlatform === 'custom') {
    throw new Error('站点默认不能使用自定义服务商')
  }
  const normalizedModel = model.trim()
  if (!normalizedModel) {
    throw new Error('默认模型不能为空')
  }
  await AppSetting.upsert({ key: SITE_DEFAULT_PLATFORM_KEY, value: normalizedPlatform })
  await AppSetting.upsert({ key: SITE_DEFAULT_MODEL_KEY, value: normalizedModel })
  return { platform: normalizedPlatform, model: normalizedModel }
}

/** 把数据库里的 0/1/true 统一成布尔值。 */
const coerceFlag = (value: unknown): boolean => value === true || value === 1 || value === '1'

/** 读取用户是否改用自己的密钥。 */
export const getUserUseOwnAiKey = async (userId: number): Promise<boolean> => {
  const user = await User.findByPk(userId, { attributes: ['useOwnAiKey'] })
  return coerceFlag(user?.getDataValue('useOwnAiKey'))
}

/** 更新用户是否使用自备密钥。 */
export const setUserUseOwnAiKey = async (userId: number, useOwnAiKey: boolean): Promise<void> => {
  await User.update({ useOwnAiKey }, { where: { id: userId } })
}

const maskApiKey = (apiKey: string): string => {
  if (apiKey.length <= 8) {
    return '****'
  }
  return `${apiKey.slice(0, 4)}****${apiKey.slice(-4)}`
}

export const getActiveAiConfigSummary = async (userId: number): Promise<AiConfigSummary> => {
  const [defaults, useOwnAiKey, credentials] = await Promise.all([
    getSiteAiDefaults(),
    getUserUseOwnAiKey(userId),
    AiCredential.findAll({
      where: { userId },
      order: [['updatedAt', 'DESC']]
    })
  ])

  const configuredPlatforms: ConfiguredPlatform[] = credentials.map((credential) => ({
    platform: credential.platform,
    model: credential.model || getDefaultModel(credential.platform),
    maskedApiKey: maskApiKey(decryptSecret(credential.encryptedApiKey)),
    customBaseURL: credential.customBaseURL || undefined
  }))

  if (!useOwnAiKey) {
    return {
      activePlatform: defaults.platform,
      activeModel: defaults.model,
      usingDefault: true,
      useOwnAiKey: false,
      defaultPlatform: defaults.platform,
      defaultModel: defaults.model,
      hint: '当前使用平台默认密钥。开启「使用自己的密钥」后可选择服务商并填写密钥。',
      configuredPlatforms
    }
  }

  if (configuredPlatforms.length === 0) {
    return {
      activePlatform: defaults.platform,
      activeModel: defaults.model,
      usingDefault: true,
      useOwnAiKey: true,
      defaultPlatform: defaults.platform,
      defaultModel: defaults.model,
      hint: '已开启自备密钥，请选择服务商并保存密钥后再生成。',
      configuredPlatforms: []
    }
  }

  const active = configuredPlatforms[0]!
  return {
    activePlatform: active.platform,
    activeModel: active.model,
    usingDefault: false,
    useOwnAiKey: true,
    defaultPlatform: defaults.platform,
    defaultModel: defaults.model,
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

/** 解密一条已保存的用户密钥。 */
const readUserCredential = (credential: AiCredential, model?: string): UserAiConfig => {
  let apiKey = ''
  try {
    apiKey = decryptSecret(credential.encryptedApiKey)
  } catch {
    throw new Error('已保存的 AI 密钥无法解密，请在设置页重新保存密钥（或检查 AI_KEY_ENCRYPTION_SECRET 是否与保存时一致）')
  }
  return {
    platform: credential.platform,
    model: model?.trim() || credential.model || getDefaultModel(credential.platform),
    apiKey,
    customBaseURL: credential.customBaseURL || undefined,
    hasUserApiKey: true
  }
}

/** 优先取指定平台的用户密钥，没有则取最近保存的一条。 */
const findUserCredential = async (userId: number, platform?: AiPlatform): Promise<AiCredential | null> => {
  if (platform) {
    const matched = await AiCredential.findOne({ where: { userId, platform } })
    if (matched) return matched
  }
  return AiCredential.findOne({
    where: { userId },
    order: [['updatedAt', 'DESC']]
  })
}

export const getUserAiConfig = async (userId?: number, platform?: string, model?: string): Promise<UserAiConfig> => {
  const defaults = await getSiteAiDefaults()

  if (userId) {
    const useOwnAiKey = await getUserUseOwnAiKey(userId)
    if (!useOwnAiKey) {
      return {
        platform: defaults.platform,
        model: defaults.model,
        apiKey: getEnvApiKey(defaults.platform),
        hasUserApiKey: false
      }
    }

    const requestedPlatform = platform ? normalizePlatform(platform) : undefined
    const credential = await findUserCredential(userId, requestedPlatform)
    if (credential) {
      return readUserCredential(credential, requestedPlatform && credential.platform === requestedPlatform ? model : undefined)
    }
    return {
      platform: requestedPlatform || defaults.platform,
      model: model?.trim() || defaults.model,
      apiKey: '',
      hasUserApiKey: false,
      missingOwnKey: true
    }
  }

  const normalizedPlatform = normalizePlatform(platform || defaults.platform)
  return {
    platform: normalizedPlatform,
    model: model?.trim() || getDefaultModel(normalizedPlatform),
    apiKey: getEnvApiKey(normalizedPlatform),
    hasUserApiKey: false
  }
}
