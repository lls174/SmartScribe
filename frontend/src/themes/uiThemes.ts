import { theme } from 'antd'
import type { ThemeConfig } from 'antd'

export type UIThemeKey = 'cyber-dark' | 'warm-light' | 'ink-dark'

export type UIThemeDefinition = {
  key: UIThemeKey
  name: string
  description: string
  /** 给 html[data-theme] 用 */
  htmlDataTheme: UIThemeKey
  /** 给 antd ConfigProvider 用 */
  antdTheme: ThemeConfig
}

export const UI_THEMES: UIThemeDefinition[] = [
  {
    key: 'cyber-dark',
    name: '赛博霓虹（暗色）',
    description: '蓝紫霓虹 + 深空背景，当前默认风格',
    htmlDataTheme: 'cyber-dark',
    antdTheme: {
      algorithm: theme.darkAlgorithm,
      token: {
        colorPrimary: '#00d4ff',
        colorSuccess: '#10b981',
        colorWarning: '#f59e0b',
        colorError: '#ef4444',
        colorInfo: '#00d4ff',
        colorBgBase: '#0a0e27',
        colorBgContainer: 'rgba(10, 14, 39, 0.7)',
        colorBgElevated: 'rgba(15, 20, 45, 0.85)',
        colorBgLayout: '#050816',
        colorBorder: 'rgba(59, 130, 246, 0.35)',
        colorBorderSecondary: 'rgba(59, 130, 246, 0.2)',
        colorText: '#e0e7ff',
        colorTextSecondary: '#a5b4fc',
        colorTextTertiary: 'rgba(165, 180, 252, 0.5)',
        colorTextQuaternary: 'rgba(165, 180, 252, 0.3)',
        borderRadius: 8,
        fontFamily: "'Rajdhani', 'Segoe UI', 'Roboto', sans-serif",
        controlHeight: 44
      },
      components: {
        Input: {
          activeBorderColor: '#00d4ff',
          hoverBorderColor: 'rgba(0, 212, 255, 0.5)',
          activeShadow: '0 0 16px rgba(0, 212, 255, 0.3)',
          colorBgContainer: 'rgba(10, 14, 39, 0.7)',
          colorBorder: 'rgba(59, 130, 246, 0.35)',
          activeBg: 'rgba(10, 14, 39, 0.8)'
        },
        InputNumber: {
          colorBgContainer: 'rgba(10, 14, 39, 0.7)',
          colorBorder: 'rgba(59, 130, 246, 0.35)'
        },
        Card: {
          colorBgContainer: 'rgba(15, 20, 45, 0.85)',
          colorBorderSecondary: 'rgba(59, 130, 246, 0.3)'
        },
        Button: {
          primaryShadow: '0 4px 16px rgba(0, 212, 255, 0.35)'
        },
        Select: {
          colorBgContainer: 'rgba(10, 14, 39, 0.7)',
          colorBorder: 'rgba(59, 130, 246, 0.35)',
          optionActiveBg: 'rgba(0, 212, 255, 0.1)',
          optionSelectedBg: 'rgba(0, 212, 255, 0.15)'
        },
        Modal: {
          contentBg: 'rgba(15, 20, 45, 0.95)'
        },
        Table: {
          headerBg: 'rgba(20, 25, 55, 0.9)',
          rowHoverBg: 'rgba(0, 212, 255, 0.05)',
          borderColor: 'rgba(59, 130, 246, 0.2)'
        },
        Pagination: {
          itemBg: 'transparent',
          itemActiveBg: 'rgba(0, 212, 255, 0.2)'
        }
      }
    }
  },
  {
    key: 'warm-light',
    name: '暖阳纸感（浅色）',
    description: '米白纸感 + 橙金点缀，适合长时间阅读与编辑',
    htmlDataTheme: 'warm-light',
    antdTheme: {
      algorithm: theme.defaultAlgorithm,
      token: {
        colorPrimary: '#f97316',
        colorSuccess: '#16a34a',
        colorWarning: '#f59e0b',
        colorError: '#dc2626',
        colorInfo: '#f97316',
        colorBgBase: '#fbf7ef',
        colorBgLayout: '#f6efe2',
        colorBgContainer: 'rgba(255, 255, 255, 0.85)',
        colorBgElevated: 'rgba(255, 255, 255, 0.95)',
        colorBorder: 'rgba(156, 104, 44, 0.25)',
        colorBorderSecondary: 'rgba(156, 104, 44, 0.15)',
        colorText: '#1f2937',
        colorTextSecondary: '#4b5563',
        borderRadius: 10,
        fontFamily: "'Rajdhani', 'Segoe UI', 'Roboto', sans-serif",
        controlHeight: 44
      }
    }
  },
  {
    key: 'ink-dark',
    name: '墨绿夜读（暗色）',
    description: '墨绿 + 金色点缀，沉稳护眼，有明显区分度',
    htmlDataTheme: 'ink-dark',
    antdTheme: {
      algorithm: theme.darkAlgorithm,
      token: {
        colorPrimary: '#34d399',
        colorSuccess: '#22c55e',
        colorWarning: '#fbbf24',
        colorError: '#fb7185',
        colorInfo: '#34d399',
        colorBgBase: '#08120f',
        colorBgLayout: '#040a08',
        colorBgContainer: 'rgba(8, 18, 15, 0.72)',
        colorBgElevated: 'rgba(10, 26, 20, 0.88)',
        colorBorder: 'rgba(52, 211, 153, 0.22)',
        colorBorderSecondary: 'rgba(52, 211, 153, 0.14)',
        colorText: '#dcfce7',
        colorTextSecondary: 'rgba(220, 252, 231, 0.72)',
        borderRadius: 10,
        fontFamily: "'Rajdhani', 'Segoe UI', 'Roboto', sans-serif",
        controlHeight: 44
      }
    }
  }
]

export function getUITheme(key: UIThemeKey): UIThemeDefinition {
  const found = UI_THEMES.find((t) => t.key === key)
  return found ?? UI_THEMES[0]
}

