import { describe, expect, it } from 'vitest'
import {
  buildCombinedOutlineText,
  buildDiagramSource,
  computeDiagramViewport,
  parseOutlineText,
  toMermaidMindmap
} from './outlineDiagram'

describe('outlineDiagram', () => {
  it('parses markdown headers and nested lists', () => {
    const tree = parseOutlineText(`# 第一幕
- 开端
  - 主角出场
# 第二幕
- 高潮`)

    expect(tree).toHaveLength(2)
    expect(tree[0].label).toBe('第一幕')
    expect(tree[0].children[0].label).toBe('开端')
    expect(tree[0].children[0].children[0].label).toBe('主角出场')
  })

  it('builds combined outline from overall and chapter outlines', () => {
    const text = buildCombinedOutlineText('主线：复仇', [
      { title: '第一章', outline: '- 相遇\n- 冲突' }
    ])

    expect(text).toContain('# 整体大纲')
    expect(text).toContain('## 第一章')
  })

  it('generates mermaid mindmap source', () => {
    const source = buildDiagramSource('mindmap', '测试小说', '# 卷一\n- 事件A')
    expect(source).toContain('mindmap')
    expect(source).toContain('测试小说')
    expect(source).toContain('卷一')
  })

  it('handles empty outline gracefully', () => {
    const source = toMermaidMindmap('空大纲', [])
    expect(source).toContain('mindmap')
    expect(source).toContain('空大纲')
  })

  it('computes centered viewport fit', () => {
    const result = computeDiagramViewport(800, 400, 1000, 500)
    expect(result.scale).toBeLessThan(1)
    expect(result.pan.x).toBeGreaterThan(0)
    expect(result.pan.y).toBeGreaterThan(0)
  })
})
