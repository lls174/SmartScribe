import React, { createContext, useContext, useState, useCallback } from 'react'
import { AI_ENABLE_DEEP_THINKING_KEY, readStoredAiConfig } from '@/data/aiModelCatalog'

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
