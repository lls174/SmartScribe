import { useState, useCallback } from 'react'

/**
 * 弹窗开关状态 hook，统一 visible 状态与 show/hide/toggle 操作。
 *
 * @param initialOpen 初始是否打开，默认 false
 */
export function useModal(initialOpen = false) {
  const [open, setOpen] = useState(initialOpen)

  const show = useCallback(() => setOpen(true), [])
  const hide = useCallback(() => setOpen(false), [])
  const toggle = useCallback(() => setOpen((prev) => !prev), [])

  return { open, setOpen, show, hide, toggle }
}
