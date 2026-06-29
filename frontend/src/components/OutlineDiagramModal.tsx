import React, { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Modal, Tabs, Button, Space, message, Typography, Spin } from 'antd'
import { ZoomInOutlined, ZoomOutOutlined, ExpandOutlined, FullscreenOutlined, FullscreenExitOutlined } from '@ant-design/icons'
import {
  buildCombinedOutlineText,
  buildDiagramSource,
  computeDiagramViewport,
  DIAGRAM_MAX_SCALE,
  DIAGRAM_MIN_SCALE,
  DIAGRAM_SCALE_STEP,
  downloadTextFile,
  enhanceMermaidSvg,
  getMermaidConfig,
  outlineToJsonTree,
  type DiagramType
} from '@/utils/outlineDiagram'

const { Paragraph } = Typography

const getFullscreenElement = () =>
  document.fullscreenElement
  || (document as Document & { webkitFullscreenElement?: Element | null }).webkitFullscreenElement
  || null

const requestElementFullscreen = async (element: HTMLElement) => {
  if (element.requestFullscreen) {
    await element.requestFullscreen()
    return
  }
  const webkitElement = element as HTMLElement & { webkitRequestFullscreen?: () => void }
  webkitElement.webkitRequestFullscreen?.()
}

const exitElementFullscreen = async () => {
  if (document.exitFullscreen) {
    await document.exitFullscreen()
    return
  }
  const webkitDocument = document as Document & { webkitExitFullscreen?: () => void }
  webkitDocument.webkitExitFullscreen?.()
}

interface OutlineDiagramModalProps {
  open: boolean
  onClose: () => void
  rootLabel: string
  overallOutline: string
  chapters: Array<{ title?: string | null; outline?: string | null }>
}

const OutlineDiagramModal: React.FC<OutlineDiagramModalProps> = ({
  open,
  onClose,
  rootLabel,
  overallOutline,
  chapters
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const fullscreenRootRef = useRef<HTMLDivElement>(null)
  const renderId = useId().replace(/:/g, '')
  const dragStateRef = useRef({
    active: false,
    startX: 0,
    startY: 0,
    panX: 0,
    panY: 0
  })

  const [diagramType, setDiagramType] = useState<DiagramType>('mindmap')
  const [renderError, setRenderError] = useState<string | null>(null)
  const [rendering, setRendering] = useState(false)
  const [modalReady, setModalReady] = useState(false)
  const [scale, setScale] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)

  const combinedText = buildCombinedOutlineText(overallOutline, chapters)
  const diagramSource = buildDiagramSource(diagramType, rootLabel, combinedText)

  const clampScale = (value: number) => Math.min(DIAGRAM_MAX_SCALE, Math.max(DIAGRAM_MIN_SCALE, value))

  const fitDiagramToViewport = useCallback(() => {
    const viewport = viewportRef.current
    const svg = containerRef.current?.querySelector('svg')
    if (!viewport || !svg) {
      setScale(1)
      setPan({ x: 0, y: 0 })
      return
    }

    const contentWidth = svg.getBoundingClientRect().width || Number(svg.getAttribute('width')) || 0
    const contentHeight = svg.getBoundingClientRect().height || Number(svg.getAttribute('height')) || 0
    const { scale: nextScale, pan: nextPan } = computeDiagramViewport(
      viewport.clientWidth,
      viewport.clientHeight,
      contentWidth,
      contentHeight
    )
    setScale(nextScale)
    setPan(nextPan)
  }, [])

  const resetViewport = useCallback(() => {
    fitDiagramToViewport()
  }, [fitDiagramToViewport])

  const handleZoomIn = () => setScale((prev) => clampScale(prev + DIAGRAM_SCALE_STEP))
  const handleZoomOut = () => setScale((prev) => clampScale(prev - DIAGRAM_SCALE_STEP))
  const handleZoomReset = () => resetViewport()

  const handleModalOpenChange = (visible: boolean) => {
    setModalReady(visible)
    if (visible) {
      resetViewport()
      setRenderError(null)
    }
  }

  const handleDiagramTypeChange = (type: DiagramType) => {
    setDiagramType(type)
    setPan({ x: 0, y: 0 })
    setScale(1)
  }

  useEffect(() => {
    if (!open || !modalReady) return

    let cancelled = false

    const waitForContainer = async (): Promise<HTMLDivElement | null> => {
      for (let i = 0; i < 10; i += 1) {
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
        if (containerRef.current) return containerRef.current
      }
      return containerRef.current
    }

    const renderDiagram = async () => {
      setRendering(true)
      setRenderError(null)

      try {
        const container = await waitForContainer()
        if (cancelled || !container) return

        const mermaid = (await import('mermaid')).default
        mermaid.initialize(getMermaidConfig(diagramType))

        container.innerHTML = ''
        const renderKey = `outline-diagram-${renderId}-${diagramType}-${Date.now()}`
        const { svg } = await mermaid.render(renderKey, diagramSource)

        if (cancelled || !containerRef.current) return

        containerRef.current.innerHTML = svg
        const svgElement = containerRef.current.querySelector('svg')
        if (svgElement) {
          enhanceMermaidSvg(svgElement, diagramType)
        }

        if (!cancelled) {
          requestAnimationFrame(() => {
            if (!cancelled) fitDiagramToViewport()
          })
        }
      } catch (error) {
        if (!cancelled) {
          console.error('导图渲染失败:', error)
          setRenderError('导图渲染失败，请检查大纲格式或尝试切换图表类型')
        }
      } finally {
        if (!cancelled) {
          setRendering(false)
        }
      }
    }

    void renderDiagram()

    return () => {
      cancelled = true
    }
  }, [open, modalReady, diagramSource, renderId, diagramType, fitDiagramToViewport])

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport || !open || !modalReady || renderError) return

    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      event.stopPropagation()
      const delta = event.deltaY > 0 ? -DIAGRAM_SCALE_STEP : DIAGRAM_SCALE_STEP
      setScale((prev) => clampScale(prev + delta))
    }

    viewport.addEventListener('wheel', onWheel, { passive: false })

    return () => {
      viewport.removeEventListener('wheel', onWheel)
    }
  }, [open, modalReady, renderError])

  useEffect(() => {
    if (!dragging) return

    const onMouseMove = (event: MouseEvent) => {
      if (!dragStateRef.current.active) return
      const dx = event.clientX - dragStateRef.current.startX
      const dy = event.clientY - dragStateRef.current.startY
      setPan({
        x: dragStateRef.current.panX + dx,
        y: dragStateRef.current.panY + dy
      })
    }

    const stopDrag = () => {
      dragStateRef.current.active = false
      setDragging(false)
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', stopDrag)

    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', stopDrag)
    }
  }, [dragging])

  const handleMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0 || rendering) return
    event.preventDefault()
    dragStateRef.current = {
      active: true,
      startX: event.clientX,
      startY: event.clientY,
      panX: pan.x,
      panY: pan.y
    }
    setDragging(true)
  }

  const handleToggleFullscreen = async () => {
    const root = fullscreenRootRef.current
    if (!root) return

    try {
      if (getFullscreenElement() === root) {
        await exitElementFullscreen()
      } else {
        await requestElementFullscreen(root)
      }
    } catch (error) {
      console.error('切换全屏失败:', error)
      message.error('全屏切换失败')
    }
  }

  useEffect(() => {
    const handleFullscreenChange = () => {
      const active = getFullscreenElement() === fullscreenRootRef.current
      setIsFullscreen(active)
      requestAnimationFrame(() => {
        fitDiagramToViewport()
      })
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange)

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange)
    }
  }, [fitDiagramToViewport])

  useEffect(() => {
    if (!open && getFullscreenElement() === fullscreenRootRef.current) {
      void exitElementFullscreen()
    }
  }, [open])

  const renderDiagramControls = (compact = false) => (
    <Space wrap size={compact ? 'small' : 'middle'}>
      <Button
        type={diagramType === 'mindmap' ? 'primary' : 'default'}
        size={compact ? 'small' : 'middle'}
        onClick={() => handleDiagramTypeChange('mindmap')}
      >
        思维导图
      </Button>
      <Button
        type={diagramType === 'flowchart' ? 'primary' : 'default'}
        size={compact ? 'small' : 'middle'}
        onClick={() => handleDiagramTypeChange('flowchart')}
      >
        流程图
      </Button>
      <Button size={compact ? 'small' : 'middle'} icon={<ZoomOutOutlined />} onClick={handleZoomOut} disabled={scale <= DIAGRAM_MIN_SCALE}>
        缩小
      </Button>
      <Button size={compact ? 'small' : 'middle'} icon={<ZoomInOutlined />} onClick={handleZoomIn} disabled={scale >= DIAGRAM_MAX_SCALE}>
        放大
      </Button>
      <Button size={compact ? 'small' : 'middle'} icon={<ExpandOutlined />} onClick={handleZoomReset}>
        重置
      </Button>
      <span className="novel-outline-zoom-label">{Math.round(scale * 100)}%</span>
      <Button
        size={compact ? 'small' : 'middle'}
        icon={isFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
        onClick={() => void handleToggleFullscreen()}
      >
        {isFullscreen ? '退出全屏' : '全屏'}
      </Button>
    </Space>
  )

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(diagramSource)
      message.success('Mermaid 源码已复制')
    } catch {
      message.error('复制失败')
    }
  }

  const handleDownloadMermaid = () => {
    downloadTextFile(`${rootLabel}-outline.mmd`, diagramSource)
    message.success('已下载 Mermaid 文件')
  }

  const handleDownloadJson = () => {
    const tree = outlineToJsonTree(combinedText)
    downloadTextFile(`${rootLabel}-outline.json`, JSON.stringify(tree, null, 2))
    message.success('已下载 JSON 树形结构')
  }

  return (
    <Modal
      title="大纲可视化"
      open={open}
      onCancel={onClose}
      width={960}
      footer={null}
      destroyOnClose
      afterOpenChange={handleModalOpenChange}
    >
      <Space wrap style={{ marginBottom: 16 }}>
        {renderDiagramControls()}
        <Button onClick={handleCopy}>复制 Mermaid</Button>
        <Button onClick={handleDownloadMermaid}>下载 .mmd</Button>
        <Button onClick={handleDownloadJson}>下载 JSON</Button>
      </Space>

      <Paragraph type="secondary" style={{ marginBottom: 12 }}>
        支持 Markdown 标题（# ##）和列表（- 项）层级。在导图区域内滚轮缩放、按住拖拽平移，点击全屏可沉浸查看，按 Esc 退出全屏。
      </Paragraph>

      {renderError ? (
        <div className="novel-outline-diagram-error">{renderError}</div>
      ) : (
        <div
          ref={fullscreenRootRef}
          className={`novel-outline-diagram-fullscreen-root${isFullscreen ? ' is-fullscreen' : ''}`}
        >
          {isFullscreen && (
            <div
              className="novel-outline-diagram-fullscreen-toolbar"
              onMouseDown={(event) => event.stopPropagation()}
            >
              {renderDiagramControls(true)}
            </div>
          )}
          <div
            ref={viewportRef}
            className={`novel-outline-diagram-viewport novel-outline-diagram-viewport--${diagramType}${dragging ? ' is-dragging' : ''}`}
            onMouseDown={handleMouseDown}
          >
            <Spin spinning={rendering} tip="正在渲染导图...">
              <div
                ref={canvasRef}
                className="novel-outline-diagram-canvas"
                style={{
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`
                }}
              >
                <div ref={containerRef} className="novel-outline-diagram" />
              </div>
            </Spin>
          </div>
        </div>
      )}

      <Tabs
        style={{ marginTop: 16 }}
        items={[
          {
            key: 'source',
            label: 'Mermaid 源码',
            children: (
              <pre className="novel-outline-diagram-source">{diagramSource}</pre>
            )
          },
          {
            key: 'outline',
            label: '合并大纲文本',
            children: (
              <pre className="novel-outline-diagram-source">{combinedText || '暂无大纲内容'}</pre>
            )
          }
        ]}
      />
    </Modal>
  )
}

export default OutlineDiagramModal
