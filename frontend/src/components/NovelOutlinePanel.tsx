import React, { useEffect, useState } from 'react'
import { Button, Col, Input, List, Modal, Row, Space, message } from 'antd'
import { ApartmentOutlined, ThunderboltOutlined } from '@ant-design/icons'
import type { Chapter, NovelSetting } from '@app-types/index'
import { aiService } from '@services/aiService'
import { novelService } from '@services/novelService'
import { useAIConfig } from '@contexts/AIConfigContext'
import { getAiStreamPhaseLabel } from '@utils/aiStream'
import type { AiStreamPhase } from '@app-types/index'
import OutlineDiagramModal from '@components/OutlineDiagramModal'

const OUTLINE_PLACEHOLDER = `# 第一幕：开端
- 主角出场
- 触发事件

# 第二幕：发展
- 冲突升级
- 关键转折

# 第三幕：高潮与结局
- 最终对决
- 结局收束`

const CHAPTER_OUTLINE_PLACEHOLDER = `- 本章目标
- 关键事件
- 伏笔/悬念`

interface NovelOutlinePanelProps {
  novelId: number
  novelName?: string
  chapters: Chapter[]
  novelSetting: NovelSetting | null
  defaultNovelType?: string
  onSettingUpdated: (setting: NovelSetting) => void
  onChaptersUpdated: () => void
}

const NovelOutlinePanel: React.FC<NovelOutlinePanelProps> = ({
  novelId,
  novelName,
  chapters,
  novelSetting,
  defaultNovelType = '玄幻',
  onSettingUpdated,
  onChaptersUpdated
}) => {
  const { config } = useAIConfig()
  const [overallOutline, setOverallOutline] = useState('')
  const [chapterOutlines, setChapterOutlines] = useState<Record<number, string>>({})
  const [savingOverall, setSavingOverall] = useState(false)
  const [savingChapterId, setSavingChapterId] = useState<number | null>(null)
  const [diagramOpen, setDiagramOpen] = useState(false)
  const [aiModalOpen, setAiModalOpen] = useState(false)
  const [aiNovelType, setAiNovelType] = useState(defaultNovelType)
  const [aiCorePlot, setAiCorePlot] = useState('')
  const [aiLength, setAiLength] = useState('中篇（30-50章）')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiStreamPhase, setAiStreamPhase] = useState<AiStreamPhase>('waiting')
  const [aiGeneratedText, setAiGeneratedText] = useState('')

  useEffect(() => {
    setOverallOutline(novelSetting?.overallOutline || '')
  }, [novelSetting?.overallOutline])

  useEffect(() => {
    const next: Record<number, string> = {}
    chapters.forEach((chapter) => {
      next[chapter.id] = chapter.outline || ''
    })
    setChapterOutlines(next)
  }, [chapters])

  const handleSaveOverallOutline = async () => {
    try {
      setSavingOverall(true)
      const setting = await novelService.updateNovelSetting(novelId, { overallOutline })
      onSettingUpdated(setting)
      message.success('整体大纲已保存')
    } catch (error) {
      console.error('保存整体大纲失败:', error)
      message.error('保存整体大纲失败')
    } finally {
      setSavingOverall(false)
    }
  }

  const handleSaveChapterOutline = async (chapterId: number) => {
    try {
      setSavingChapterId(chapterId)
      await novelService.updateChapterOutline(chapterId, chapterOutlines[chapterId] || '')
      message.success('章节大纲已保存')
      onChaptersUpdated()
    } catch (error) {
      console.error('保存章节大纲失败:', error)
      message.error('保存章节大纲失败')
    } finally {
      setSavingChapterId(null)
    }
  }

  const handleAiGenerateOutline = async () => {
    if (!aiCorePlot.trim()) {
      message.warning('请输入核心剧情')
      return
    }

    try {
      setAiLoading(true)
      setAiGeneratedText('')
      setAiStreamPhase('waiting')
      const result = await aiService.generateOutline(
        aiNovelType,
        aiCorePlot,
        aiLength,
        (chunk) => setAiGeneratedText((prev) => prev + chunk),
        (phase) => setAiStreamPhase(phase),
        undefined,
        config
      )
      setOverallOutline(result)
      message.success('AI 大纲已生成，请确认后保存')
      setAiModalOpen(false)
    } catch (error) {
      console.error('AI 生成大纲失败:', error)
      message.error(error instanceof Error ? error.message : 'AI 生成大纲失败')
    } finally {
      setAiLoading(false)
    }
  }

  const hasOutlineContent = Boolean(
    overallOutline.trim() ||
    chapters.some((chapter) => chapterOutlines[chapter.id]?.trim())
  )

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <Row justify="space-between" align="middle" gutter={[12, 12]}>
        <Col>
          <span className="novel-memory-hint">
            维护整体大纲与各章大纲，生成/续写时会自动注入。支持转为思维导图或流程图。
          </span>
        </Col>
        <Col>
          <Space wrap>
            <Button
              icon={<ApartmentOutlined />}
              disabled={!hasOutlineContent}
              onClick={() => setDiagramOpen(true)}
            >
              转为导图
            </Button>
            <Button icon={<ThunderboltOutlined />} onClick={() => setAiModalOpen(true)}>
              AI 生成整体大纲
            </Button>
          </Space>
        </Col>
      </Row>

      <div className="novel-outline-section">
        <div className="novel-outline-section-title">整体大纲</div>
        <Input.TextArea
          rows={10}
          value={overallOutline}
          onChange={(e) => setOverallOutline(e.target.value)}
          placeholder={OUTLINE_PLACEHOLDER}
          className="novel-outline-textarea"
        />
        <Row justify="end" style={{ marginTop: 12 }}>
          <Button type="primary" loading={savingOverall} onClick={handleSaveOverallOutline}>
            保存整体大纲
          </Button>
        </Row>
      </div>

      <div className="novel-outline-section">
        <div className="novel-outline-section-title">章节大纲</div>
        {chapters.length === 0 ? (
          <div className="novel-outline-empty">暂无章节，请先新建或生成章节后再填写章节大纲。</div>
        ) : (
          <List
            dataSource={chapters}
            renderItem={(chapter, index) => (
              <List.Item className="novel-outline-chapter-item">
                <Space direction="vertical" style={{ width: '100%' }} size="small">
                  <div className="novel-outline-chapter-title">
                    第{index + 1}章 · {chapter.title || '未命名章节'}
                  </div>
                  <Input.TextArea
                    rows={4}
                    value={chapterOutlines[chapter.id] ?? ''}
                    onChange={(e) => setChapterOutlines((prev) => ({
                      ...prev,
                      [chapter.id]: e.target.value
                    }))}
                    placeholder={CHAPTER_OUTLINE_PLACEHOLDER}
                    className="novel-outline-textarea"
                  />
                  <Row justify="end">
                    <Button
                      size="small"
                      type="primary"
                      loading={savingChapterId === chapter.id}
                      onClick={() => handleSaveChapterOutline(chapter.id)}
                    >
                      保存本章大纲
                    </Button>
                  </Row>
                </Space>
              </List.Item>
            )}
          />
        )}
      </div>

      <OutlineDiagramModal
        open={diagramOpen}
        onClose={() => setDiagramOpen(false)}
        rootLabel={novelName || '小说大纲'}
        overallOutline={overallOutline}
        chapters={chapters.map((chapter) => ({
          title: chapter.title,
          outline: chapterOutlines[chapter.id] ?? chapter.outline
        }))}
      />

      <Modal
        title="AI 生成整体大纲"
        open={aiModalOpen}
        onCancel={() => !aiLoading && setAiModalOpen(false)}
        onOk={handleAiGenerateOutline}
        okText={aiLoading ? getAiStreamPhaseLabel(aiStreamPhase) : '生成'}
        confirmLoading={aiLoading}
        width={640}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <div>
            <div style={{ marginBottom: 8 }}>小说类型</div>
            <Input value={aiNovelType} onChange={(e) => setAiNovelType(e.target.value)} placeholder="玄幻 / 都市 / 科幻..." />
          </div>
          <div>
            <div style={{ marginBottom: 8 }}>核心剧情</div>
            <Input.TextArea
              rows={4}
              value={aiCorePlot}
              onChange={(e) => setAiCorePlot(e.target.value)}
              placeholder="描述主线冲突、主角目标、核心卖点..."
            />
          </div>
          <div>
            <div style={{ marginBottom: 8 }}>大纲篇幅</div>
            <Input value={aiLength} onChange={(e) => setAiLength(e.target.value)} placeholder="短篇 / 中篇 / 长篇" />
          </div>
          {aiLoading && (
            <div className="novel-outline-ai-preview">
              {aiGeneratedText || getAiStreamPhaseLabel(aiStreamPhase)}
            </div>
          )}
        </Space>
      </Modal>
    </Space>
  )
}

export default NovelOutlinePanel
