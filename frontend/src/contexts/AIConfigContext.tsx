import React, { createContext, useContext, useState, useCallback } from 'react'

export interface AIConfig {
  platform: string
  model: string
  apiKey: string
  customBaseURL: string
}

interface AIConfigContextType {
  config: AIConfig
  updateConfig: (partial: Partial<AIConfig>) => void
  getFullConfig: () => AIConfig
}

const defaultConfig: AIConfig = {
  platform: localStorage.getItem('aiPlatform') || 'aliyun',
  model: localStorage.getItem('aiModel') || 'qwen3.5-plus',
  apiKey: '',
  customBaseURL: ''
}

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
