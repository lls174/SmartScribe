import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { UIThemeKey } from '@/themes/uiThemes'
import { getUITheme } from '@/themes/uiThemes'

const STORAGE_KEY = 'uiTheme'

type ThemeContextValue = {
  themeKey: UIThemeKey
  setThemeKey: (key: UIThemeKey) => void
  antdTheme: ReturnType<typeof getUITheme>['antdTheme']
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function readInitialTheme(): UIThemeKey {
  const raw = localStorage.getItem(STORAGE_KEY)
  const key: UIThemeKey =
    raw === 'cyber-dark' || raw === 'warm-light' || raw === 'ink-dark' ? raw : 'cyber-dark'

  // 尽量避免首次渲染的“闪一下默认主题”
  document.documentElement.dataset.theme = key
  return key
}

export const ThemeProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [themeKey, setThemeKeyState] = useState<UIThemeKey>(() => readInitialTheme())

  const setThemeKey = (key: UIThemeKey) => {
    setThemeKeyState(key)
    localStorage.setItem(STORAGE_KEY, key)
  }

  useEffect(() => {
    document.documentElement.dataset.theme = themeKey
  }, [themeKey])

  const antdTheme = useMemo(() => getUITheme(themeKey).antdTheme, [themeKey])

  const value = useMemo(
    () => ({ themeKey, setThemeKey, antdTheme }),
    [themeKey, antdTheme]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}

