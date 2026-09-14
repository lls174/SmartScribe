import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { AI_ENABLE_DEEP_THINKING_KEY, readStoredAiConfig } from '@/data/aiModelCatalog'
import { aiConfigService } from '@services/aiConfigService'

export interface AIConfig {
  platform: string
  model: string
  enableDeepThinking: boolean
}

interface AIConfigContextType {
  config: AIConfig
  updateConfig: (partial: Partial<AIConfig>) => void
  getFullConfig: () => AIConfig
}

const defaultConfig: AIConfig = readStoredAiConfig()

const AIConfigContext = createContext<AIConfigContextType>({
  config: defaultConfig,
  updateConfig: () => {},
  getFullConfig: () => defaultConfig
})

export const AIConfigProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [config, setConfig] = useState<AIConfig>(defaultConfig)

  const updateConfig = useCallback((partial: Partial<AIConfig>) => {
    setConfig(prev => {
      const newConfig = { ...prev, ...partial }
      if (partial.platform) {
        localStorage.setItem('aiPlatform', partial.platform)
      }
      if (partial.model) {
        localStorage.setItem('aiModel', partial.model)
      }
      if (typeof partial.enableDeepThinking === 'boolean') {
        localStorage.setItem(AI_ENABLE_DEEP_THINKING_KEY, partial.enableDeepThinking ? 'true' : 'false')
      }
      return newConfig
    })
  }, [])

  const getFullConfig = useCallback(() => config, [config])

  /** 登录后拉取站点默认；未自备密钥时覆盖本地缓存，无需进入设置页。 */
  useEffect(() => {
    const syncSiteDefaults = async () => {
      if (!localStorage.getItem('token')) return
      try {
        const summary = await aiConfigService.getSummary()
        if (summary.useOwnAiKey) return
        const platform = summary.defaultPlatform?.trim()
        const model = summary.defaultModel?.trim()
        if (!platform || !model) return
        setConfig((prev) => {
          if (prev.platform === platform && prev.model === model) return prev
          localStorage.setItem('aiPlatform', platform)
          localStorage.setItem('aiModel', model)
          return { ...prev, platform, model }
        })
      } catch {
        // 未登录或接口失败时沿用本地缓存，不影响现有生成流程
      }
    }

    const onAuthChange = () => {
      void syncSiteDefaults()
    }

    void syncSiteDefaults()
    window.addEventListener('auth-change', onAuthChange)
    return () => {
      window.removeEventListener('auth-change', onAuthChange)
    }
  }, [])

  return (
    <AIConfigContext.Provider value={{ config, updateConfig, getFullConfig }}>
      {children}
    </AIConfigContext.Provider>
  )
}

export const useAIConfig = () => {
  const context = useContext(AIConfigContext)
  if (!context) {
    throw new Error('useAIConfig 必须在 AIConfigProvider 内使用')
  }
  return context
}
