import { useEffect, useRef, useState } from 'react'
import '@styles/DesktopPet.css'
import { Application, DisplayObject, Ticker, UPDATE_PRIORITY } from 'pixi.js'
import { Live2DModel } from 'pixi-live2d-display/cubism4'

const LS_KEY_ENABLED = 'desktopPetEnabled'
const LS_KEY_POS = 'desktopPetPosition'

// 兼容兜底：某些 Pixi 事件系统会调用 currentTarget.isInteractive()
// 如果 Live2D 对象链上缺少该方法会直接抛错，导致点击/动作逻辑被打断。
// 这里补一个最保守的实现，避免运行时崩溃。
try {
  const proto: any = (DisplayObject as any)?.prototype
  if (proto && typeof proto.isInteractive !== 'function') {
    proto.isInteractive = function isInteractive() {
      return false
    }
  }
} catch {
  // ignore
}

// 更强兜底：有些事件系统的 currentTarget 不是 DisplayObject（例如纯对象/代理对象）
// 但仍会调用 currentTarget.isInteractive()；这里给所有对象补一个“非枚举”方法避免崩溃。
try {
  const p: any = Object.prototype as any
  if (typeof p.isInteractive !== 'function') {
    Object.defineProperty(Object.prototype, 'isInteractive', {
      value: function isInteractive() {
        return false
      },
      configurable: true,
      writable: true,
      enumerable: false,
    })
  }
} catch {
  // ignore
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function getDefaultPos() {
  const w = window.innerWidth
  const h = window.innerHeight
  return { x: Math.max(16, w - 420), y: Math.max(120, h - 560) }
}

function readSavedPos(): { x: number; y: number } | null {
  try {
    const raw = localStorage.getItem(LS_KEY_POS)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (typeof parsed?.x !== 'number' || typeof parsed?.y !== 'number') return null
    return { x: parsed.x, y: parsed.y }
  } catch {
    return null
  }
}

function savePos(pos: { x: number; y: number }) {
  localStorage.setItem(LS_KEY_POS, JSON.stringify(pos))
}

function isEnabledByDefault() {
  const raw = localStorage.getItem(LS_KEY_ENABLED)
  if (raw === null) return true
  return raw === 'true'
}

export default function DesktopPet() {
  const [enabled, setEnabled] = useState<boolean>(isEnabledByDefault())

  const petRef = useRef<HTMLDivElement | null>(null)
  const stageRef = useRef<HTMLDivElement | null>(null)

  const appRef = useRef<Application | null>(null)
  const modelRef = useRef<any>(null)
  const motionGroupsRef = useRef<string[]>([])
  const motionIdxRef = useRef(0)
  const mountClickRef = useRef<(() => void) | null>(null)
  const motionPlanRef = useRef<Array<{ group: string; index: number }>>([])
  const lookTargetRef = useRef({ x: 0, y: 0 })
  const lookCurrentRef = useRef({ x: 0, y: 0 })
  const lookJitterRef = useRef({ x: 0, y: 0, t: 0 })

  useEffect(() => {
    // 同页即时同步（Setting 页修改 localStorage 不会触发 storage 事件）
    const onCfg = (e: Event) => {
      const detail = (e as CustomEvent<any>).detail || {}
      if (typeof detail.enabled === 'boolean') setEnabled(detail.enabled)
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

  // 固定右下角：不再保存/拖拽位置（如需拖拽可再加开关）

  useEffect(() => {
    if (!enabled) {
      // 关闭时销毁 pixi
      try {
        appRef.current?.destroy(true)
      } catch {
        // ignore
      }
      appRef.current = null
      modelRef.current = null
      if (stageRef.current) stageRef.current.innerHTML = ''
      return
    }

    const mount = stageRef.current
    if (!mount) return

    const width = 420
    const height = 560
    const modelUrl = '/hiyori_pro_zh/runtime/hiyori_pro_t11.model3.json'

    const app = new Application({
      width,
      height,
      antialias: true,
      backgroundAlpha: 0,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
    } as any)
    appRef.current = app
    let disposed = false

    ;(async () => {
      if (disposed) return
      mount.innerHTML = ''
      mount.appendChild(app.view as any)

      // 关键：必须注册 PIXI.Ticker（类，带 shared），不能传 app.ticker（实例）
      try {
        Live2DModel.registerTicker(Ticker as any)
      } catch (e) {
        console.warn('[pet] Live2D registerTicker failed', e)
      }

      const model = await Live2DModel.from(modelUrl, { autoInteract: false })
      if (disposed) return
      modelRef.current = model

      // 启用模型点击：点击切换动作（桌宠固定右下角，不需要上下晃动）
      try {
        ;(app.stage as any).interactive = true
        ;(app.stage as any).interactiveChildren = true
        ;(model as any).interactive = true
        ;(model as any).interactiveChildren = false
        ;(model as any).buttonMode = true
      } catch {
        // ignore
      }

      // 让模型更自然：底部对齐、自动适配高度、轻微漂浮
      model.anchor?.set?.(0.5, 1)

      app.stage.addChild(model as any)

      // 按实际 bounds 自适应缩放与定位，尽量保证“完整显示”
      const getBoundsSafe = () => {
        try {
          const b = (model as any).getBounds?.()
          if (b && Number.isFinite(b.width) && Number.isFinite(b.height)) return b
        } catch {
          // ignore
        }
        return {
          x: 0,
          y: 0,
          width: Math.max(1, (model as any).width ?? 1),
          height: Math.max(1, (model as any).height ?? 1),
        }
      }

      const fitAndPlace = () => {
        const pad = 10

        // 1) 归一 & 先放到底部居中（保证“完整拟合”基准稳定）
        model.scale.set(1)
        model.x = width / 2
        model.y = height - pad

        // 2) 计算拟合缩放（按 bounds）
        const b1 = getBoundsSafe()
        const bw = Math.max(1, b1.width)
        const bh = Math.max(1, b1.height)
        const targetW = width - pad * 2
        const targetH = height - pad * 2
        const s = Math.max(0.12, Math.min(3.0, Math.min(targetW / bw, targetH / bh)))
        model.scale.set(s)

        // 3) 重新拿 bounds 并做“画布内不裁切”的修正
        const b2 = getBoundsSafe()
        const left = b2.x
        const right = b2.x + b2.width
        const top = b2.y
        const bottom = b2.y + b2.height

        let dx = 0
        let dy = 0
        if (left < pad) dx += pad - left
        if (right > width - pad) dx -= right - (width - pad)
        if (top < pad) dy += pad - top
        if (bottom > height - pad) dy -= bottom - (height - pad)

        model.x += dx
        model.y += dy

        // 4) 在不出界前提下，稍微向右下偏一点（更像右下角桌宠）
        const b3 = getBoundsSafe()
        const r2 = b3.x + b3.width
        const btm2 = b3.y + b3.height
        const extraRight = Math.min(60, (width - pad) - r2)
        const extraDown = Math.min(18, (height - pad) - btm2)
        model.x += Math.max(0, extraRight)
        model.y += Math.max(0, extraDown)
      }

      // 多次 fit：避免首帧 bounds 不稳定导致仍裁切
      requestAnimationFrame(fitAndPlace)
      window.setTimeout(fitAndPlace, 100)
      window.setTimeout(fitAndPlace, 500)

      // Live2D 动作：优先随机播放 Idle/默认组
      const getMotionGroups = () => {
        const im = (model as any).internalModel
        const settings = im?.settings || im?._settings || null
        const motions = settings?.motions || settings?.Motions || null
        const keys = motions ? Object.keys(motions) : []
        // 常见：Idle / idle / TapBody / TouchBody 等
        const preferred = ['Idle', 'idle', 'TapBody', 'TouchBody', 'Tap', 'Start']
        const picked = preferred.find((k) => keys.includes(k))
        if (picked) return [picked, ...keys.filter((k) => k !== picked)]
        return keys
      }

      const startRandomMotion = (group: string) => {
        const im = (model as any).internalModel
        // 1) motionManager.startRandomMotion(group)
        const mm =
          im?.motionManager ||
          im?.motionManager?.motionManager ||
          im?.motionManager?._motionManager ||
          null
        if (typeof mm?.startRandomMotion === 'function') {
          try {
            mm.startRandomMotion(group, 0)
            return true
          } catch {
            // ignore
          }
        }

        // 1.5) motionManager.startMotion(group, index)
        if (typeof mm?.startMotion === 'function') {
          try {
            mm.startMotion(group, 0, 0)
            return true
          } catch {
            // ignore
          }
        }

        // 2) internalModel.startRandomMotion(group)
        if (typeof im?.startRandomMotion === 'function') {
          try {
            im.startRandomMotion(group, 0)
            return true
          } catch {
            // ignore
          }
        }

        // 2.5) internalModel.startMotion(group, index)
        if (typeof im?.startMotion === 'function') {
          try {
            im.startMotion(group, 0, 0)
            return true
          } catch {
            // ignore
          }
        }

        // 3) model.motion(group)
        if (typeof (model as any).motion === 'function') {
          try {
            ;(model as any).motion(group, 0)
            return true
          } catch {
            // ignore
          }
        }

        return false
      }

      // 点击切动作：使用 DOM click（不依赖 Pixi 事件系统，避免 currentTarget.isInteractive 报错）
      const groups = getMotionGroups()
      motionGroupsRef.current = groups.length ? groups : ['Idle']
      motionIdxRef.current = 0

      // 构建“可播放列表”：把每个组里的 motion 索引展开，确保点击一定切到不同动作
      try {
        const im = (model as any).internalModel
        const settings = im?.settings || im?._settings || null
        const motions = settings?.motions || settings?.Motions || null
        const plan: Array<{ group: string; index: number }> = []
        for (const g of motionGroupsRef.current) {
          const arr = Array.isArray(motions?.[g]) ? motions[g] : null
          const n = arr?.length ? Number(arr.length) : 1
          for (let i = 0; i < Math.max(1, n); i += 1) plan.push({ group: g, index: i })
        }
        motionPlanRef.current = plan.length ? plan : [{ group: 'Idle', index: 0 }]
      } catch {
        motionPlanRef.current = [{ group: 'Idle', index: 0 }]
      }

      const playPlanAt = (i: number) => {
        const plan = motionPlanRef.current
        if (!plan.length) return false
        const item = plan[i % plan.length]
        const im = (model as any).internalModel
        const mm =
          im?.motionManager ||
          im?.motionManager?.motionManager ||
          im?.motionManager?._motionManager ||
          null
        // 优先精确播放“某组第 N 个 motion”
        if (typeof mm?.startMotion === 'function') {
          try {
            mm.startMotion(item.group, item.index, 0)
            return true
          } catch {
            // ignore
          }
        }
        if (typeof im?.startMotion === 'function') {
          try {
            im.startMotion(item.group, item.index, 0)
            return true
          } catch {
            // ignore
          }
        }
        // 回退：随机播放该组
        return startRandomMotion(item.group)
      }

      // 初始先播放一次（默认 Idle 的第一个）
      window.setTimeout(() => playPlanAt(0), 150)

      const onMountClick = () => {
        const plan = motionPlanRef.current
        if (!plan.length) return
        motionIdxRef.current = (motionIdxRef.current + 1) % plan.length
        playPlanAt(motionIdxRef.current)
      }
      mountClickRef.current = onMountClick
      mount.addEventListener('click', onMountClick)

      // 眼睛跟随鼠标：监听鼠标位置，写入 Live2D 参数（眼球/头部）
      const onMouseMove = (ev: MouseEvent) => {
        const rect = (app.view as any as HTMLCanvasElement).getBoundingClientRect()
        const nx = ((ev.clientX - rect.left) / rect.width) * 2 - 1 // [-1, 1]
        const ny = ((ev.clientY - rect.top) / rect.height) * 2 - 1 // [-1, 1]
        // 反转 Y，让“上移鼠标→向上看”更自然
        lookTargetRef.current.x = Math.max(-1, Math.min(1, nx))
        lookTargetRef.current.y = Math.max(-1, Math.min(1, -ny))
      }
      window.addEventListener('mousemove', onMouseMove, { passive: true })

      const coreModel = (model as any).internalModel?.coreModel
      const applyLook = (deltaMS: number) => {
        if (!coreModel) return
        const setParam: ((id: string, v: number) => void) | null =
          typeof coreModel.setParameterValueById === 'function' ? coreModel.setParameterValueById.bind(coreModel) : null
        const getParam: ((id: string) => number) | null =
          typeof coreModel.getParameterValueById === 'function' ? coreModel.getParameterValueById.bind(coreModel) : null
        const addParam: ((id: string, v: number, w?: number) => void) | null =
          typeof coreModel.addParameterValueById === 'function' ? coreModel.addParameterValueById.bind(coreModel) : null
        if (!setParam && !addParam) return

        // 更灵动：加入轻微“扫视”抖动（不依赖鼠标也会有一点点眼神流动）
        const j = lookJitterRef.current
        j.t += deltaMS
        if (j.t > 650 + Math.random() * 550) {
          j.t = 0
          // 幅度稍大一些，让“眼神更活”
          j.x = (Math.random() * 2 - 1) * 0.22
          j.y = (Math.random() * 2 - 1) * 0.16
        }
        // jitter 逐渐衰减
        j.x *= 0.972
        j.y *= 0.972

        // 平滑跟随（阻尼更强，减少“死板追踪”）
        // 响应更快一些（更显眼）
        const lerp = 1 - Math.pow(0.00008, Math.min(1, deltaMS / 16.67))
        lookCurrentRef.current.x += (lookTargetRef.current.x - lookCurrentRef.current.x) * lerp
        lookCurrentRef.current.y += (lookTargetRef.current.y - lookCurrentRef.current.y) * lerp

        const x = Math.max(-1, Math.min(1, lookCurrentRef.current.x + j.x))
        const y = Math.max(-1, Math.min(1, lookCurrentRef.current.y + j.y))

        // 目标：motion 正常播放，同时叠加鼠标跟随
        // 做法：在“动作更新后的当前值”基础上，加一个偏移再写回（本帧最后执行）
        const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
        const setAdd = (id: string, delta: number, lo: number, hi: number) => {
          if (setParam) {
            const base = getParam ? getParam(id) : 0
            setParam(id, clamp(base + delta, lo, hi))
            return
          }
          // 回退：叠加式
          addParam?.(id, delta, 1.0)
        }

        // 眼球：更明显（仍限制在 [-1, 1]）
        setAdd('ParamEyeBallX', x * 2.0, -1, 1)
        setAdd('ParamEyeBallY', y * 2.0, -1, 1)

        // 头部：在 motion 基础上加偏移（角度范围经验值）
        setAdd('ParamAngleX', x * 38, -30, 30)
        setAdd('ParamAngleY', y * 28, -30, 30)
        setAdd('ParamAngleZ', x * -12, -30, 30)

        // 回退：叠加式
        if (addParam) {
          try {
            addParam('ParamEyeBallX', x * 1.25, 1.0)
            addParam('ParamEyeBallY', y * 1.25, 1.0)
          } catch {
            // ignore
          }
          try {
            addParam('ParamAngleX', x * 22, 0.55)
            addParam('ParamAngleY', y * 16, 0.55)
            addParam('ParamAngleZ', x * -6, 0.25)
          } catch {
            // ignore
          }
        }
      }

      // 用 shared ticker，并设为更低优先级，确保在 Live2D 自身更新之后再应用视线（减少“被动画干扰”）
      const onSharedTick = () => {
        applyLook((Ticker.shared as any).deltaMS ?? 16.67)
      }
      Ticker.shared.add(onSharedTick, undefined, UPDATE_PRIORITY.UTILITY - 100)

      // 鼠标提示可点击
      try {
        ;(app.view as any).style.cursor = 'pointer'
      } catch {
        // ignore
      }

      ;(model as any).__petOnMouseMove = onMouseMove
      ;(model as any).__petOnSharedTick = onSharedTick
    })().catch((err) => {
      console.error('Live2D 加载失败:', err)
    })

    return () => {
      disposed = true
      try {
        app.destroy(true)
      } catch {
        // ignore
      }
      try {
        const onMountClick = mountClickRef.current
        if (onMountClick) mount.removeEventListener('click', onMountClick)
      } catch {
        // ignore
      }
      try {
        const m: any = modelRef.current
        const mm = m?.__petOnMouseMove
        if (mm) window.removeEventListener('mousemove', mm)
        const st = m?.__petOnSharedTick
        if (st) Ticker.shared.remove(st)
      } catch {
        // ignore
      }
      appRef.current = null
      modelRef.current = null
      mountClickRef.current = null
      mount.innerHTML = ''
    }
  }, [enabled])

  if (!enabled) return null

  return (
    <div
      ref={petRef}
      className="desktop-pet"
      aria-label="桌宠（Live2D，固定右下角）"
      onClick={() => mountClickRef.current?.()}
    >
      <div className="desktop-pet__frame">
        <div ref={stageRef} className="desktop-pet__live2d" />
      </div>
    </div>
  )
}
