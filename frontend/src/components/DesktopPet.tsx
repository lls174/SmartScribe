import { useEffect, useRef, useState } from 'react'
import '@styles/DesktopPet.css'
import { Live2DCubismModel } from 'live2d-renderer'

const LS_KEY_ENABLED = 'desktopPetEnabled'
const MOTION_PRIORITY_NORMAL = 2

type MotionRequest = {
  group: string
  index: number
}

function isEnabledByDefault() {
  const raw = localStorage.getItem(LS_KEY_ENABLED)
  if (raw === null) return true
  return raw === 'true'
}

export default function DesktopPet() {
  const [enabled, setEnabled] = useState<boolean>(isEnabledByDefault())
  const [hidden, setHidden] = useState(false)
  const [showClose, setShowClose] = useState(false)

  const stageRef = useRef<HTMLDivElement | null>(null)
  const modelRef = useRef<Live2DCubismModel | null>(null)
  const pendingPlayRef = useRef<MotionRequest | null>(null)
  const goodbyeTimerRef = useRef<number | null>(null)
  const motionTokenRef = useRef(0)
  const renderFrameRef = useRef<number | null>(null)

  const stopRenderLoop = () => {
    if (renderFrameRef.current !== null) {
      window.cancelAnimationFrame(renderFrameRef.current)
      renderFrameRef.current = null
    }
  }

  const startRenderLoop = (model: Live2DCubismModel) => {
    stopRenderLoop()
    const tick = () => {
      try {
        if (modelRef.current === model && model.loaded) {
          model.update()
          renderFrameRef.current = window.requestAnimationFrame(tick)
        }
      } catch {
        stopRenderLoop()
      }
    }
    renderFrameRef.current = window.requestAnimationFrame(tick)
  }

  const playMotion = (model: Live2DCubismModel | null, group: string, index = 0, priority = MOTION_PRIORITY_NORMAL) => {
    if (!model?.loaded) return false
    const token = motionTokenRef.current + 1
    motionTokenRef.current = token
    const restoreMovement = () => {
      if (motionTokenRef.current === token) model.enableMovement = true
    }

    model.enableMovement = false
    try {
      model.setDragging(0, 0)
    } catch {
      // ignore
    }

    window.setTimeout(restoreMovement, group === 'Bye' ? 3200 : 2600)
    try {
      model.startMotion(group, index, priority, undefined, restoreMovement).catch(() => {
        try {
          model.startRandomMotion(group, priority, undefined, restoreMovement).catch(restoreMovement)
        } catch {
          restoreMovement()
        }
      })
      return true
    } catch {
      // Some groups may not exist on custom models; fall back to random group playback.
    }

    try {
      model.startRandomMotion(group, priority, undefined, restoreMovement).catch(restoreMovement)
      return true
    } catch {
      restoreMovement()
      return false
    }
  }

  useEffect(() => {
    const onCfg = (e: Event) => {
      const detail = (e as CustomEvent<any>).detail || {}
      if (typeof detail.enabled === 'boolean') setEnabled(detail.enabled)

      const pm = detail.playMotion
      if (pm && typeof pm.group === 'string') {
        const req = { group: pm.group, index: Number(pm.index ?? 0) || 0 }
        pendingPlayRef.current = req
        playMotion(modelRef.current, req.group, req.index, MOTION_PRIORITY_NORMAL)
      }
    }

    window.addEventListener('desktopPetConfigChanged', onCfg as any)
    return () => window.removeEventListener('desktopPetConfigChanged', onCfg as any)
  }, [])

  useEffect(() => {
    const sync = (e: StorageEvent) => {
      if (e.key === LS_KEY_ENABLED && e.newValue != null) setEnabled(e.newValue === 'true')
    }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [])

  useEffect(() => {
    localStorage.setItem(LS_KEY_ENABLED, String(enabled))
  }, [enabled])

  useEffect(() => {
    if (enabled) {
      setHidden(false)
      setShowClose(false)
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled || hidden) {
      stopRenderLoop()
      try {
        modelRef.current?.destroy(false)
      } catch {
        // ignore
      }
      modelRef.current = null
      if (stageRef.current) stageRef.current.innerHTML = ''
      return
    }

    const mount = stageRef.current
    if (!mount) return

    const width = 260
    const height = 560
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const modelUrl = '/hiyori_pro_zh/runtime/hiyori_pro_t11.model3.json?v=renderer-webgl-1'
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    canvas.style.display = 'block'
    canvas.style.cursor = 'pointer'

    mount.innerHTML = ''
    mount.appendChild(canvas)

    let disposed = false

    const onContextMenu = (ev: MouseEvent) => {
      try {
        ev.preventDefault()
        ev.stopPropagation()
      } catch {
        // ignore
      }
      setShowClose(true)
    }

    mount.addEventListener('contextmenu', onContextMenu, true)
    canvas.addEventListener('contextmenu', onContextMenu, true)

    const model = new Live2DCubismModel(canvas, {
      cubismCorePath: '/live2dcubismcore.min.js',
      checkMocConsistency: false,
      autoAnimate: false,
      autoInteraction: true,
      tapInteraction: false,
      randomMotion: false,
      keepAspect: false,
      zoomEnabled: false,
      enablePan: false,
      doubleClickReset: false,
      scale: 1,
      enablePhysics: true,
      enablePose: true,
      enableBreath: true,
      enableEyeblink: true,
      enableMotion: true,
      enableMovement: true,
    })
    modelRef.current = model

    model
      .load(modelUrl)
      .then(() => {
        if (disposed) return
        try {
          canvas.width = Math.round(width * dpr)
          canvas.height = Math.round(height * dpr)
          model.x = canvas.width / 2
          model.centerModel()
        } catch {
          // ignore
        }
        startRenderLoop(model)

        const req = pendingPlayRef.current
        if (req?.group) playMotion(model, req.group, req.index, MOTION_PRIORITY_NORMAL)
      })
      .catch((err) => {
        console.error('Live2D 加载失败:', err)
      })

    return () => {
      disposed = true
      stopRenderLoop()
      if (goodbyeTimerRef.current) {
        window.clearTimeout(goodbyeTimerRef.current)
        goodbyeTimerRef.current = null
      }
      try {
        mount.removeEventListener('contextmenu', onContextMenu, true)
        canvas.removeEventListener('contextmenu', onContextMenu, true)
      } catch {
        // ignore
      }
      try {
        model.destroy(false)
      } catch {
        // ignore
      }
      if (modelRef.current === model) modelRef.current = null
      mount.innerHTML = ''
    }
  }, [enabled, hidden])

  if (!enabled || hidden) return null

  const onPetContextMenu = (e: React.MouseEvent) => {
    try {
      e.preventDefault()
      e.stopPropagation()
    } catch {
      // ignore
    }
    setShowClose(true)
  }

  const onCloseClick = (e: React.MouseEvent) => {
    try {
      e.preventDefault()
      e.stopPropagation()
    } catch {
      // ignore
    }

    setShowClose(false)
    if (goodbyeTimerRef.current) window.clearTimeout(goodbyeTimerRef.current)
    goodbyeTimerRef.current = null
    setHidden(true)
  }

  return (
    <div className="desktop-pet" aria-label="桌宠（Live2D，固定右下角）" onContextMenu={onPetContextMenu}>
      <div className="desktop-pet__frame">
        {showClose && (
          <button type="button" className="desktop-pet__close" onClick={onCloseClick}>
            关闭
          </button>
        )}
        <div ref={stageRef} className="desktop-pet__live2d" />
      </div>
    </div>
  )
}
