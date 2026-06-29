export interface OutlineNode {
  label: string
  children: OutlineNode[]
}

export type DiagramType = 'mindmap' | 'flowchart'

export const DIAGRAM_DEFAULT_SCALE: Record<DiagramType, number> = {
  mindmap: 1,
  flowchart: 1
}

export const DIAGRAM_MIN_SCALE = 0.4
export const DIAGRAM_MAX_SCALE = 6
export const DIAGRAM_SCALE_STEP = 0.2
export const DIAGRAM_FIT_PADDING = 32

export const computeDiagramViewport = (
  viewportWidth: number,
  viewportHeight: number,
  contentWidth: number,
  contentHeight: number
): { scale: number; pan: { x: number; y: number } } => {
  if (!viewportWidth || !viewportHeight || !contentWidth || !contentHeight) {
    return { scale: 1, pan: { x: 0, y: 0 } }
  }

  const availableWidth = viewportWidth - DIAGRAM_FIT_PADDING * 2
  const availableHeight = viewportHeight - DIAGRAM_FIT_PADDING * 2
  const fitScale = Math.min(
    availableWidth / contentWidth,
    availableHeight / contentHeight
  )
  const scale = Math.min(Math.max(fitScale, DIAGRAM_MIN_SCALE), 1)
  const scaledWidth = contentWidth * scale
  const scaledHeight = contentHeight * scale

  return {
    scale,
    pan: {
      x: (viewportWidth - scaledWidth) / 2,
      y: (viewportHeight - scaledHeight) / 2
    }
  }
}

export const getMermaidConfig = (diagramType: DiagramType) => ({
  startOnLoad: false,
  theme: 'dark' as const,
  securityLevel: 'loose' as const,
  themeVariables: {
    fontSize: diagramType === 'flowchart' ? '16px' : '15px',
    fontFamily: 'system-ui, -apple-system, "Segoe UI", "Microsoft YaHei", sans-serif',
    lineHeight: '1.45',
    nodeTextColor: '#e2e8f0',
    primaryTextColor: '#e2e8f0'
  },
  flowchart: {
    htmlLabels: true,
    nodeSpacing: 48,
    rankSpacing: 56,
    padding: 18,
    useMaxWidth: false,
    wrappingWidth: 200,
    curve: 'basis' as const
  },
  mindmap: {
    padding: 18,
    maxNodeWidth: 240
  }
})

export const enhanceMermaidSvg = (svg: SVGSVGElement, diagramType: DiagramType) => {
  const fontSize = diagramType === 'flowchart' ? 16 : 15

  svg.removeAttribute('max-width')
  svg.style.maxWidth = 'none'
  svg.style.width = 'auto'
  svg.style.height = 'auto'

  const styleEl = svg.querySelector('style')
  if (styleEl?.textContent) {
    styleEl.textContent = styleEl.textContent
      .replace(/max-width:\s*[^;{}]+;?/gi, '')
      .replace(/#mermaid-[^ \t{]+/g, `#${svg.id || 'mermaid-svg'}`)
  }

  svg.querySelectorAll('text, tspan').forEach((element) => {
    element.setAttribute('font-size', String(fontSize))
  })

  svg.querySelectorAll('foreignObject div, foreignObject span, foreignObject p, .nodeLabel').forEach((element) => {
    if (element instanceof HTMLElement) {
      element.style.fontSize = `${fontSize}px`
      element.style.lineHeight = '1.5'
    }
  })

  const viewBox = svg.viewBox.baseVal
  if (viewBox.width > 0 && viewBox.height > 0) {
    svg.setAttribute('width', String(Math.ceil(viewBox.width)))
    svg.setAttribute('height', String(Math.ceil(viewBox.height)))
  }
}

const sanitizeMindmapLabel = (label: string): string => {
  return label
    .replace(/[()[\]{}]/g, ' ')
    .replace(/"/g, "'")
    .trim()
    .slice(0, 80) || '节点'
}

const sanitizeFlowLabel = (label: string): string => {
  return label.replace(/"/g, "'").trim().slice(0, 80) || '节点'
}

export const parseOutlineText = (text: string): OutlineNode[] => {
  const lines = text.split('\n')
  const roots: OutlineNode[] = []
  const stack: Array<{ level: number; node: OutlineNode }> = []
  let lastListIndent = -1

  for (const rawLine of lines) {
    const line = rawLine.replace(/\t/g, '  ')
    const trimmed = line.trim()
    if (!trimmed) continue

    let level = 1
    let label = trimmed

    const headerMatch = trimmed.match(/^(#{1,6})\s+(.+)$/)
    const listMatch = line.match(/^(\s*)([-*+]|\d+[.)])\s+(.+)$/)

    if (headerMatch) {
      level = headerMatch[1].length
      label = headerMatch[2].trim()
      lastListIndent = -1
    } else if (listMatch) {
      const indent = listMatch[1].length
      label = listMatch[3].trim()

      if (stack.length === 0) {
        level = 1
      } else if (lastListIndent < 0 || indent > lastListIndent) {
        level = stack[stack.length - 1].level + 1
      } else if (indent === lastListIndent) {
        stack.pop()
        level = stack.length > 0 ? stack[stack.length - 1].level + 1 : 1
      } else {
        while (stack.length > 0 && stack[stack.length - 1].level > 1) {
          stack.pop()
        }
        level = stack.length > 0 ? stack[stack.length - 1].level + 1 : 1
      }

      lastListIndent = indent
    } else {
      level = stack.length > 0 ? stack[stack.length - 1].level + 1 : 1
      lastListIndent = -1
    }

    const node: OutlineNode = { label, children: [] }

    while (stack.length > 0 && stack[stack.length - 1].level >= level) {
      stack.pop()
    }

    if (stack.length === 0) {
      roots.push(node)
    } else {
      stack[stack.length - 1].node.children.push(node)
    }

    stack.push({ level, node })
  }

  return roots
}

const appendMindmapNodes = (nodes: OutlineNode[], lines: string[], depth: number) => {
  for (const node of nodes) {
    lines.push(`${'  '.repeat(depth)}${sanitizeMindmapLabel(node.label)}`)
    if (node.children.length > 0) {
      appendMindmapNodes(node.children, lines, depth + 1)
    }
  }
}

export const toMermaidMindmap = (rootLabel: string, nodes: OutlineNode[]): string => {
  const lines = ['mindmap', `  root((${sanitizeMindmapLabel(rootLabel)}))`]
  appendMindmapNodes(nodes, lines, 2)
  return lines.join('\n')
}

let flowIdCounter = 0

const resetFlowIdCounter = () => {
  flowIdCounter = 0
}

const appendFlowchartNodes = (
  nodes: OutlineNode[],
  lines: string[],
  parentId?: string
): void => {
  for (const node of nodes) {
    const id = `n${flowIdCounter++}`
    lines.push(`  ${id}["${sanitizeFlowLabel(node.label)}"]`)
    if (parentId) {
      lines.push(`  ${parentId} --> ${id}`)
    }
    if (node.children.length > 0) {
      appendFlowchartNodes(node.children, lines, id)
    }
  }
}

export const toMermaidFlowchart = (rootLabel: string, nodes: OutlineNode[]): string => {
  resetFlowIdCounter()
  const lines = ['flowchart TD']
  const rootId = `n${flowIdCounter++}`
  lines.push(`  ${rootId}["${sanitizeFlowLabel(rootLabel)}"]`)
  appendFlowchartNodes(nodes, lines, rootId)
  return lines.join('\n')
}

export const buildCombinedOutlineText = (
  overallOutline: string,
  chapters: Array<{ title?: string | null; outline?: string | null }>
): string => {
  const sections: string[] = []

  if (overallOutline.trim()) {
    sections.push(`# 整体大纲\n${overallOutline.trim()}`)
  }

  const chapterSections = chapters
    .map((chapter, index) => {
      if (!chapter.outline?.trim()) return ''
      const title = chapter.title?.trim() || `第${index + 1}章`
      return `## ${title}\n${chapter.outline.trim()}`
    })
    .filter(Boolean)

  if (chapterSections.length > 0) {
    sections.push(`# 章节大纲\n${chapterSections.join('\n\n')}`)
  }

  return sections.join('\n\n')
}

export const buildDiagramSource = (
  type: DiagramType,
  rootLabel: string,
  outlineText: string
): string => {
  const nodes = parseOutlineText(outlineText)
  if (nodes.length === 0) {
    return type === 'mindmap'
      ? `mindmap\n  root((${sanitizeMindmapLabel(rootLabel)}))`
      : `flowchart TD\n  root["${sanitizeFlowLabel(rootLabel)}"]`
  }

  return type === 'mindmap'
    ? toMermaidMindmap(rootLabel, nodes)
    : toMermaidFlowchart(rootLabel, nodes)
}

export const outlineToJsonTree = (outlineText: string): OutlineNode[] => {
  return parseOutlineText(outlineText)
}

export const downloadTextFile = (filename: string, content: string) => {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
