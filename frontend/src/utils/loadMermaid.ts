export interface MermaidAPI {
  initialize: (config: Record<string, unknown>) => void
  render: (id: string, text: string) => Promise<{ svg: string }>
}

declare global {
  interface Window {
    mermaid?: MermaidAPI
  }
}

const MERMAID_SCRIPT_ID = 'smart-scribe-mermaid'
const MERMAID_SCRIPT_URL = `${import.meta.env.BASE_URL}vendor/mermaid.min.js`

let loadingPromise: Promise<MermaidAPI> | null = null

export const loadMermaid = (): Promise<MermaidAPI> => {
  if (window.mermaid) {
    return Promise.resolve(window.mermaid)
  }

  if (loadingPromise) {
    return loadingPromise
  }

  loadingPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById(MERMAID_SCRIPT_ID) as HTMLScriptElement | null
    if (existing) {
      existing.addEventListener('load', () => {
        if (window.mermaid) resolve(window.mermaid)
        else reject(new Error('Mermaid 加载失败'))
      }, { once: true })
      existing.addEventListener('error', () => reject(new Error('Mermaid 脚本加载失败')), { once: true })
      return
    }

    const script = document.createElement('script')
    script.id = MERMAID_SCRIPT_ID
    script.src = MERMAID_SCRIPT_URL
    script.async = true
    script.onload = () => {
      if (window.mermaid) {
        resolve(window.mermaid)
        return
      }
      reject(new Error('Mermaid 加载失败'))
    }
    script.onerror = () => reject(new Error('Mermaid 脚本加载失败'))
    document.head.appendChild(script)
  })

  return loadingPromise
}
