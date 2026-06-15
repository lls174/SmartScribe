import api from './api'
import { DEFAULT_AI_PLATFORM } from '@/data/aiModelCatalog'

export interface AiConfigStatus {
  platform: string
  model: string
  hasApiKey: boolean
  source: 'user' | 'env' | 'none'
  maskedApiKey?: string
  customBaseURL?: string
}

export interface ConfiguredPlatform {
  platform: string
  model: string
  maskedApiKey: string
  customBaseURL?: string
}

export interface AiConfigSummary {
  activePlatform: string
  activeModel: string
  usingDefault: boolean
  hint: string | null
  configuredPlatforms: ConfiguredPlatform[]
  platformStatus?: AiConfigStatus
}

export const aiConfigService = {
  getSummary: async (): Promise<AiConfigSummary> => {
    const response = await api.get('/ai/config')
    return response.data
  },

  getPlatformConfig: async (platform = DEFAULT_AI_PLATFORM): Promise<AiConfigSummary> => {
    const response = await api.get('/ai/config', { params: { platform } })
    return response.data
  },

  saveConfig: async (data: { platform: string; apiKey: string; model: string; customBaseURL?: string }): Promise<AiConfigStatus> => {
    const response = await api.post('/ai/config', data)
    return response.data
  }
}
