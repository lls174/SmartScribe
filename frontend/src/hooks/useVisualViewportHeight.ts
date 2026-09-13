import { useEffect } from 'react'

/**
 * 把页面高度同步到 visualViewport，避免手机键盘弹起后仍按 100vh 留下空白带。
 */
export function useVisualViewportHeight(enabled: boolean) {
  useEffect(() => {
    if (!enabled) {
      return undefined
    }

    const root = document.documentElement
    const viewport = window.visualViewport
    const mobileQuery = window.matchMedia('(max-width: 768px)')

    /** 用可见视口高度更新 CSS 变量，并抵消 iOS 上推后的半屏空隙 */
    const sync = () => {
      if (!mobileQuery.matches) {
        root.classList.remove('vv-lock')
        root.style.removeProperty('--app-vv-height')
        return
      }

      root.classList.add('vv-lock')
      const height = Math.round(viewport?.height ?? window.innerHeight)
      root.style.setProperty('--app-vv-height', `${height}px`)
      if (viewport && viewport.offsetTop !== 0) {
        window.scrollTo(0, 0)
      }
    }

    sync()
    mobileQuery.addEventListener('change', sync)
    viewport?.addEventListener('resize', sync)
    viewport?.addEventListener('scroll', sync)
    window.addEventListener('orientationchange', sync)

    return () => {
      root.classList.remove('vv-lock')
      root.style.removeProperty('--app-vv-height')
      mobileQuery.removeEventListener('change', sync)
      viewport?.removeEventListener('resize', sync)
      viewport?.removeEventListener('scroll', sync)
      window.removeEventListener('orientationchange', sync)
    }
  }, [enabled])
}

/**
 * 键盘动画结束后，把当前输入框滚进可见区域。
 */
export function scrollFocusedInputIntoView(event: { target: EventTarget | null }) {
  const target = event.target
  if (!(target instanceof HTMLElement)) {
    return
  }
  window.setTimeout(() => {
    target.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, 50)
}
