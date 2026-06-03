import React, { useState, useRef, useEffect } from 'react'
import { Button, Typography, Space, Row, Col, Form, Input, Modal, message, Select, Dropdown, Card, Tabs, List, Tag, Switch, InputNumber, Collapse } from 'antd'
import { DragOutlined, DownloadOutlined, HistoryOutlined, BranchesOutlined, MoreOutlined, ArrowLeftOutlined } from '@ant-design/icons'
import type { MenuProps } from 'antd'

const { Option } = Select
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { Editor, EditorState, RichUtils, convertFromRaw } from 'draft-js'
import 'draft-js/dist/Draft.css'
import { aiService } from '@services/aiService'
import type { NovelContext } from '@services/aiService'
import { novelService } from '@services/novelService'
import { PROMPT_TEMPLATES, PROMPT_TEMPLATES_UPDATED_AT, type PromptTemplate } from '@/data/promptTemplates'
import { useAuth } from '@hooks/useAuth'
import { useMediaQuery } from '@hooks/useMediaQuery'
import { useAIConfig } from '@contexts/AIConfigContext'
import Loading from '@components/Loading'
import type { CharacterCard, Chapter, NovelSetting } from '@app-types/index'
import '@styles/Novel.css'

const { Title } = Typography

const Novel: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const { config } = useAIConfig()
  const [editorState, setEditorState] = useState(() => EditorState.createEmpty())
  const [loading, setLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [actionType, setActionType] = useState<'generate' | 'continue' | 'polish'>('generate')
  const [customPrompt, setCustomPrompt] = useState('')
  const [chapterTitle, setChapterTitle] = useState('')
  const [genre, setGenre] = useState('玄幻')
  const [customGenre, setCustomGenre] = useState('')
  const [style, setStyle] = useState('正常')
  const [customStyle, setCustomStyle] = useState('')
  const [corePlot, setCorePlot] = useState('')
  const [characters, setCharacters] = useState('')
  const [other, setOther] = useState('')
  const [wordCount, setWordCount] = useState('2000')
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>()
  const [continueWordCount, setContinueWordCount] = useState('2000')
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [pageLoading, setPageLoading] = useState(true)
  const [generatedContent, setGeneratedContent] = useState('')
  const [editing, setEditing] = useState(false)
  const [currentChapter, setCurrentChapter] = useState<Chapter | null>(null)
  const [editingChapterId, setEditingChapterId] = useState<number | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [draggingChapterId, setDraggingChapterId] = useState<number | null>(null)
  const [characterCards, setCharacterCards] = useState<CharacterCard[]>([])
  const [novelSetting, setNovelSetting] = useState<NovelSetting | null>(null)
  const [characterModalVisible, setCharacterModalVisible] = useState(false)
  const [editingCharacter, setEditingCharacter] = useState<CharacterCard | null>(null)
  const [memoryLoading, setMemoryLoading] = useState(false)
  const [characterForm] = Form.useForm()
  const [settingForm] = Form.useForm()
  const editorRef = useRef<Editor>(null)
  const appliedTemplateRef = useRef<string | null>(null)
  const generatingRef = useRef<HTMLDivElement>(null)
  const chapterContentRef = useRef<HTMLDivElement>(null)
  const streamEndRef = useRef<HTMLDivElement>(null)
  const pendingScrollToChapterRef = useRef(false)
  const autoFollowRef = useRef(true)
  const lastScrollYRef = useRef(0)

  const scrollToElement = (element: HTMLElement | null, behavior: ScrollBehavior = 'smooth') => {
    if (!element) return

    requestAnimationFrame(() => {
      element.scrollIntoView({ behavior, block: 'start' })
    })
  }
  const isMobile = useMediaQuery('(max-width: 768px)')

  const buildNovelContext = (): NovelContext => {
    return {
      novelId: id ? Number(id) : undefined,
      novelMeta: {
        name: undefined,
        genre: genre === '自定义' ? customGenre : genre,
        style: style === '自定义' ? customStyle : style,
        totalChapters: chapters.length
      },
      chapters: chapters.map(c => ({
        id: c.id,
        title: c.title,
        content: c.content,
        plot: c.plot
      })),
      currentChapterId: currentChapter?.id
    }
  }

  useEffect(() => {
    if (authLoading) return
    if (!isAuthenticated) {
      navigate('/login')
      return
    }
    if (id) {
      fetchChapters()
      fetchNovelMemory()
    }
  }, [id, isAuthenticated, authLoading, navigate])

  useEffect(() => {
    const handleScroll = () => {
      const currentY = window.scrollY
      if (currentY < lastScrollYRef.current - 4) {
        // 用户向上滚动，停止自动跟随
        autoFollowRef.current = false
      } else {
        // 滚回接近底部时恢复自动跟随
        const distanceToBottom =
          document.documentElement.scrollHeight - window.innerHeight - currentY
        if (distanceToBottom < 160) {
          autoFollowRef.current = true
        }
      }
      lastScrollYRef.current = currentY
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    if (loading) {
      autoFollowRef.current = true
      lastScrollYRef.current = window.scrollY
      requestAnimationFrame(() => {
        streamEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
      })
    }
  }, [loading])

  useEffect(() => {
    if (loading && autoFollowRef.current) {
      streamEndRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' })
    }
  }, [generatedContent, loading])

  useEffect(() => {
    if (!loading && currentChapter && pendingScrollToChapterRef.current) {
      pendingScrollToChapterRef.current = false
      scrollToElement(chapterContentRef.current, 'smooth')
    }
  }, [loading, currentChapter])

  const fetchNovelMemory = async () => {
    if (!id) return
    try {
      setMemoryLoading(true)
      const [cards, setting] = await Promise.all([
        novelService.getCharacterCards(Number(id)),
        novelService.getNovelSetting(Number(id))
      ])
      setCharacterCards(cards)
      setNovelSetting(setting)
      settingForm.setFieldsValue(setting)
    } catch (error) {
      console.error('获取小说记忆失败:', error)
      message.error('获取人物卡/内容设定失败')
    } finally {
      setMemoryLoading(false)
    }
  }

  const fetchChapters = async () => {
    try {
      const data = await novelService.getChapters(Number(id))
      setChapters(data)
    } catch (error) {
      message.error('获取章节列表失败')
    } finally {
      setPageLoading(false)
    }
  }

  // 加载章节内容到编辑器
  const loadChapter = (chapter: Chapter) => {
    // 如果章节已经被选中，不重复加载
    if (currentChapter?.id === chapter.id) {
      return
    }
    
    setCurrentChapter(chapter)
    setChapterTitle(chapter.title || '')
    const newContentState = EditorState.createWithContent(
      convertFromRaw({
        blocks: [{
          key: 'chapter-' + chapter.id,
          text: chapter.content,
          type: 'unstyled',
          depth: 0,
          inlineStyleRanges: [],
          entityRanges: [],
          data: {}
        }],
        entityMap: {}
      })
    )
    setEditorState(newContentState)
    setEditing(false)
    message.success(`已加载章节: ${chapter.title || '未命名章节'}`)
  }

  // 删除章节
  const handleDeleteChapter = async (chapterId: number) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这个章节吗？删除后将移至回收站。',
      okText: '确定',
      cancelText: '取消',
      onOk: async () => {
        try {
          await novelService.deleteChapter(chapterId)
          message.success('删除成功')
          fetchChapters()
          
          // 如果删除的是当前章节，清空当前章节状态
          if (currentChapter?.id === chapterId) {
            setCurrentChapter(null)
            setEditing(false)
          }
        } catch (error) {
          console.error('删除章节失败:', error)
          message.error('删除失败')
        }
      }
    })
  }

  // 开始拖拽
  const handleDragStart = (e: React.DragEvent, chapterId: number) => {
    e.dataTransfer.setData('text/plain', chapterId.toString())
    setDraggingChapterId(chapterId)
  }

  // 拖拽经过
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  // 放置
  const handleDrop = async (e: React.DragEvent, targetChapterId: number) => {
    e.preventDefault()
    const sourceChapterId = parseInt(e.dataTransfer.getData('text/plain'))
    
    if (sourceChapterId !== targetChapterId) {
      try {
        // 调用后端 API 更新章节顺序
        await novelService.updateChapterOrder(sourceChapterId, targetChapterId)
        message.success('章节顺序已更新')
        fetchChapters()
      } catch (error) {
        console.error('更新章节顺序失败:', error)
        message.error('更新章节顺序失败')
      }
    }
    setDraggingChapterId(null)
  }

  // 计算字数
  const getWordCount = (editorState: EditorState) => {
    const contentState = editorState.getCurrentContent()
    const plainText = contentState.getPlainText()
    // 统计中文字符和英文单词
    const chineseChars = plainText.match(/[\u4e00-\u9fa5]/g)?.length || 0
    const englishWords = plainText.match(/\b[a-zA-Z]+\b/g)?.length || 0
    // 统计数字
    const numbers = plainText.match(/\b\d+\b/g)?.length || 0
    // 总字数 = 中文字符 + 英文单词 + 数字
    return chineseChars + englishWords + numbers
  }

  const handleEditorChange = (newEditorState: EditorState) => {
    setEditorState(newEditorState)
  }

  const handleKeyCommand = (command: string, editorState: EditorState) => {
    const newState = RichUtils.handleKeyCommand(editorState, command)
    if (newState) {
      setEditorState(newState)
      return 'handled'
    }
    return 'not-handled'
  }

  const handleBoldClick = () => {
    setEditorState(RichUtils.toggleInlineStyle(editorState, 'BOLD'))
  }

  const handleItalicClick = () => {
    setEditorState(RichUtils.toggleInlineStyle(editorState, 'ITALIC'))
  }

  // 导出为 TXT 格式
  const exportToTxt = () => {
    if (chapters.length === 0) {
      message.warning('暂无章节可导出')
      return
    }

    let content = ''
    chapters.forEach((chapter, index) => {
      content += `第${index + 1}章 ${chapter.title || '未命名章节'}\n\n`
      content += `${chapter.content}\n\n`
      content += `========================================\n\n`
    })

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `小说_${id}.txt`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    message.success('导出成功')
  }

  // 导出为 JSON 格式
  const exportToJson = () => {
    if (chapters.length === 0) {
      message.warning('暂无章节可导出')
      return
    }

    const novelData = {
      novelId: id,
      exportTime: new Date().toISOString(),
      chapters: chapters.map((chapter, index) => ({
        order: index + 1,
        id: chapter.id,
        title: chapter.title || '未命名章节',
        content: chapter.content,
        plot: chapter.plot,
        createdAt: chapter.createdAt,
        updatedAt: chapter.updatedAt
      }))
    }

    const blob = new Blob([JSON.stringify(novelData, null, 2)], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `小说_${id}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    message.success('导出成功')
  }

  // 导出菜单项
  const exportMenuItems: MenuProps['items'] = [
    {
      key: 'txt',
      label: '导出为 TXT',
      onClick: exportToTxt
    },
    {
      key: 'json',
      label: '导出为 JSON',
      onClick: exportToJson
    }
  ]

  const openCreateCharacter = () => {
    setEditingCharacter(null)
    characterForm.resetFields()
    characterForm.setFieldsValue({ priority: 5, isActive: true })
    setCharacterModalVisible(true)
  }

  const openEditCharacter = (card: CharacterCard) => {
    setEditingCharacter(card)
    characterForm.setFieldsValue(card)
    setCharacterModalVisible(true)
  }

  const handleSaveCharacter = async () => {
    if (!id) return
    try {
      const values = await characterForm.validateFields()
      if (editingCharacter) {
        await novelService.updateCharacterCard(Number(id), editingCharacter.id, values)
        message.success('人物卡已更新')
      } else {
        await novelService.createCharacterCard(Number(id), values)
        message.success('人物卡已创建')
      }
      setCharacterModalVisible(false)
      await fetchNovelMemory()
    } catch (error) {
      if (error instanceof Error) {
        message.error(error.message || '保存人物卡失败')
      }
    }
  }

  const handleDeleteCharacter = (card: CharacterCard) => {
    if (!id) return
    Modal.confirm({
      title: `删除人物卡：${card.name}`,
      content: '删除后生成时将不再注入该人物设定。',
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        await novelService.deleteCharacterCard(Number(id), card.id)
        message.success('人物卡已删除')
        await fetchNovelMemory()
      }
    })
  }

  const handleToggleCharacter = async (card: CharacterCard, isActive: boolean) => {
    if (!id) return
    await novelService.updateCharacterCard(Number(id), card.id, { isActive })
    await fetchNovelMemory()
  }

  const handleSaveSetting = async () => {
    if (!id) return
    try {
      const values = await settingForm.validateFields()
      const setting = await novelService.updateNovelSetting(Number(id), values)
      setNovelSetting(setting)
      message.success('内容设定已保存')
    } catch (error) {
      if (error instanceof Error) {
        message.error(error.message || '保存内容设定失败')
      }
    }
  }

  const applyPromptTemplate = (template: PromptTemplate) => {
    setSelectedTemplateId(template.id)

    const builtInGenres = ['玄幻', '仙侠', '都市', '历史', '科幻', '言情']
    if (builtInGenres.includes(template.genre)) {
      setGenre(template.genre)
      setCustomGenre('')
    } else {
      setGenre('自定义')
      setCustomGenre(template.genre)
    }

    const builtInStyles = ['正常', '浪漫', '英雄主义', '神秘', '幽默', '悲剧']
    if (builtInStyles.includes(template.style)) {
      setStyle(template.style)
      setCustomStyle('')
    } else {
      setStyle('自定义')
      setCustomStyle(template.style)
    }

    setCorePlot(template.corePlot)
    setCharacters(template.characters)
    setOther(`${template.other}\n\n模板说明：${template.reason}`)
    setWordCount(template.wordCount)
    message.success(`已应用模板：${template.title}`)
  }

  useEffect(() => {
    const state = location.state as { promptTemplateId?: string; openGenerateModal?: boolean } | null
    if (!state?.promptTemplateId || appliedTemplateRef.current === state.promptTemplateId) {
      return
    }

    const template = PROMPT_TEMPLATES.find((item) => item.id === state.promptTemplateId)
    if (!template) {
      return
    }

    appliedTemplateRef.current = state.promptTemplateId
    applyPromptTemplate(template)
    if (state.openGenerateModal) {
      setActionType('generate')
      setModalVisible(true)
    }

    navigate(location.pathname, { replace: true })
  }, [location.pathname, location.state, navigate])

  const handleGenerate = async () => {
    // 先关闭弹窗
    setModalVisible(false)
    // 显示loading状态
    setLoading(true)
    pendingScrollToChapterRef.current = true
    setGeneratedContent('')
    try {
      const contentState = editorState.getCurrentContent()
      void contentState

      let result = { content: '', plot: '' }
      const ctx = buildNovelContext()
      
      if (actionType === 'generate') {
        const selectedGenre = genre === '自定义' ? customGenre : genre
        const selectedStyle = style === '自定义' ? customStyle : style
        
        result = await aiService.generateChapter(
          corePlot || '请生成一个章节',
          chapterTitle,
          (chunk) => {
            setGeneratedContent(prev => prev + chunk)
          },
          (_plot) => { void _plot },
          config,
          ctx,
          {
            genre: selectedGenre,
            style: selectedStyle,
            corePlot,
            characters,
            wordCount,
            other
          }
        )
      } else if (actionType === 'continue') {
        const continuePrompt = customPrompt || undefined
        result = await aiService.continueChapter(
          currentChapter?.content || '', 
          currentChapter?.plot || '',
          continuePrompt,
          (chunk) => {
            setGeneratedContent(prev => prev + chunk)
          },
          (_plot) => { void _plot },
          config,
          ctx,
          continueWordCount
        )
      } else {
        if (!currentChapter) {
          message.warning('请先选择一个章节')
          return
        }

        const beforeContent = currentChapter.content || ''
        const beforePlot = currentChapter.plot || ''

        const polishResult = await aiService.polishContent(
          beforeContent,
          customPrompt,
          (chunk) => {
            setGeneratedContent(prev => prev + chunk)
          },
          () => {
          },
          config,
          ctx,
          {
            beforeContent,
            beforePlot,
            chapterTitle: currentChapter.title
          }
        )

        result = { content: polishResult, plot: currentChapter?.plot || '' }
      }

      // 检查生成的内容是否为空
      console.log('生成结果:', result)
      if (!result.content.trim()) {
        throw new Error('生成内容为空')
      }

      // 将生成的内容添加到编辑器
      const newContentState = EditorState.createWithContent(
        convertFromRaw({
          blocks: [{
            key: 'generated',
            text: result.content,
            type: 'unstyled',
            depth: 0,
            inlineStyleRanges: [],
            entityRanges: [],
            data: {}
          }],
          entityMap: {}
        })
      )
      setEditorState(newContentState)
      
      // 生成完成后保存
      if (actionType === 'polish') {
        if (!currentChapter) {
          message.warning('请先选择一个章节')
          return
        }
        const updated = await novelService.updateChapterContent(currentChapter.id, result.content, result.plot)
        message.success('润色已覆盖原章节（旧内容可在生成历史中查看）')
        // 润色后自动创建一个版本快照，方便随时切换/回滚
        try {
          const label = `自动版本-润色-${currentChapter.title || '未命名章节'}-${new Date().toLocaleString()}`
          await novelService.createVersion(Number(id), label)
        } catch (e) {
          // 不阻塞润色主流程（常见原因：未初始化版本表）
          console.warn('润色后自动创建版本失败:', e)
        }
        await fetchChapters()
        loadChapter(updated)
      } else {
        await handleSaveChapter(result.content, result.plot)
      }
    } catch (error) {
      pendingScrollToChapterRef.current = false
      console.error('生成失败:', error)
      // 显示更具体的错误信息
      let errorMessage = '生成失败'
      if (error instanceof Error && error.message) {
        errorMessage += '：' + error.message
      }
      // 特别处理API密钥未配置的情况
      if (error instanceof Error && (error.message.includes('API密钥未配置') || error.message.includes('API key'))) {
        errorMessage = 'AI API密钥未配置，请在后端.env文件中配置API密钥后重试'
      }
      message.error(errorMessage)
    } finally {
      setLoading(false)
      // 不要清空generatedContent，因为它已经被添加到编辑器中
    }
  }

  const handleSaveChapter = async (content: string, plot?: string) => {
    try {
      if (!content.trim()) {
        message.error('章节内容不能为空')
        return
      }
      
      // 为续写和润色设置默认标题
      let finalTitle = chapterTitle
      if (!finalTitle.trim()) {
        if (actionType === 'continue') {
          finalTitle = `${currentChapter?.title || '章节'} - 续写`
        } else if (actionType === 'polish') {
          finalTitle = `${currentChapter?.title || '章节'} - 润色`
        } else {
          finalTitle = '未命名章节'
        }
      }
      
      const newChapter = await novelService.createChapter(Number(id), finalTitle, content, plot)
      message.success('保存成功')
      
      // 重新加载章节列表
      await fetchChapters()
      
      // 选中新创建的章节
      loadChapter(newChapter)
      
    } catch (error) {
      console.error('保存失败:', error)
      message.error('保存失败')
    }
  }

  const openGenerateModal = () => {
    setActionType('generate')
    setModalVisible(true)
  }

  const openContinueModal = () => {
    if (!currentChapter) {
      message.warning('请先选择一个章节')
      return
    }
    if (!currentChapter.content?.trim()) {
      message.warning('所选章节内容为空，无法续写')
      return
    }
    setActionType('continue')
    setModalVisible(true)
  }

  const openPolishModal = () => {
    if (!currentChapter) {
      message.warning('请先选择一个章节')
      return
    }
    setActionType('polish')
    setModalVisible(true)
  }

  const mobileMoreMenuItems: MenuProps['items'] = [
    {
      key: 'versions',
      icon: <BranchesOutlined />,
      label: '版本管理',
      onClick: () => navigate(`/novel/${id}/versions`)
    },
    {
      key: 'history',
      icon: <HistoryOutlined />,
      label: '生成历史',
      onClick: () => navigate(`/novel/${id}/history`)
    },
    {
      key: 'export',
      icon: <DownloadOutlined />,
      label: '导出小说',
      children: exportMenuItems
    }
  ]

  if (pageLoading) {
    return <Loading />
  }

  const memoryTabs = (
    <Tabs
      items={[
        {
          key: 'characters',
          label: `人物卡 (${characterCards.length})`,
          children: (
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              <Row justify="space-between" align="middle">
                <Col>
                  <span className="novel-memory-hint">
                    生成、续写、润色时会自动注入已启用的人物卡。
                  </span>
                </Col>
                <Col>
                  <Button type="primary" onClick={openCreateCharacter}>新增人物卡</Button>
                </Col>
              </Row>
              <List
                dataSource={characterCards}
                locale={{ emptyText: '暂无人物卡，建议先添加主角、重要配角和反派。' }}
                renderItem={(card) => (
                  <List.Item
                    actions={[
                      <Switch
                        key="active"
                        checked={card.isActive}
                        checkedChildren="启用"
                        unCheckedChildren="停用"
                        onChange={(checked) => handleToggleCharacter(card, checked)}
                      />,
                      <Button key="edit" type="link" onClick={() => openEditCharacter(card)}>编辑</Button>,
                      <Button key="delete" type="link" danger onClick={() => handleDeleteCharacter(card)}>删除</Button>
                    ]}
                  >
                    <List.Item.Meta
                      title={(
                        <Space wrap className="novel-memory-char-tags">
                          <span className="novel-memory-char-name">{card.name}</span>
                          {card.role && (
                            <span className="novel-memory-tag novel-memory-tag--role">{card.role}</span>
                          )}
                          <span className="novel-memory-tag novel-memory-tag--priority">
                            优先级 {card.priority}
                          </span>
                          {!card.isActive && (
                            <span className="novel-memory-tag novel-memory-tag--inactive">未启用</span>
                          )}
                        </Space>
                      )}
                      description={(
                        <div className="novel-memory-char-desc">
                          {card.identity && <div>身份：{card.identity}</div>}
                          {card.personality && <div>性格：{card.personality}</div>}
                          {card.relationship && <div>关系：{card.relationship}</div>}
                        </div>
                      )}
                    />
                  </List.Item>
                )}
              />
            </Space>
          )
        },
        {
          key: 'setting',
          label: '内容设定',
          children: (
            <Form form={settingForm} layout="vertical">
              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Form.Item label="世界观" name="worldview">
                    <Input.TextArea rows={3} placeholder="世界背景、地域、组织、基础规则" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item label="题材与风格" name="genreStyle">
                    <Input.TextArea rows={3} placeholder="题材定位、文风、叙事视角、读者爽点" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item label="力量/能力体系" name="powerSystem">
                    <Input.TextArea rows={3} placeholder="修炼、异能、科技、道具等能力边界" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item label="时间线" name="timeline">
                    <Input.TextArea rows={3} placeholder="故事时间、关键历史事件、当前阶段" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item label="剧情规则" name="plotRules">
                    <Input.TextArea rows={3} placeholder="必须遵守的剧情逻辑、伏笔、主线方向" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item label="禁忌与雷区" name="taboos">
                    <Input.TextArea rows={3} placeholder="不能出现的桥段、设定冲突或风格禁忌" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item label="文风指南" name="styleGuide">
                    <Input.TextArea rows={3} placeholder="句式、节奏、对话比例、描写密度" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item label="补充备注" name="notes">
                    <Input.TextArea rows={3} placeholder="其他会长期影响生成的设定" />
                  </Form.Item>
                </Col>
              </Row>
              <Row justify="space-between" align="middle">
                <Col>
                  <span style={{ color: 'var(--text-secondary)' }}>
                    {novelSetting?.updatedAt ? `上次保存：${new Date(novelSetting.updatedAt).toLocaleString()}` : '尚未保存内容设定'}
                  </span>
                </Col>
                <Col>
                  <Button type="primary" onClick={handleSaveSetting}>保存内容设定</Button>
                </Col>
              </Row>
            </Form>
          )
        }
      ]}
    />
  )

  const renderChapterList = (showHeader = true) => (
    <>
      {showHeader && (
        <Row justify="space-between" align="middle" style={{ marginBottom: '1rem' }}>
          <Title level={4} style={{ margin: 0 }}>章节列表</Title>
          <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>共 {chapters.length} 章</span>
        </Row>
      )}
      {chapters.length === 0 ? (
        <div className="novel-generating-waiting" style={{
          padding: '2rem',
          textAlign: 'center',
          border: '1px dashed rgba(59, 130, 246, 0.3)',
          borderRadius: 8
        }}>
          暂无章节，点击&quot;生成章节&quot;开始创作
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {chapters.map((chapter, index) => (
            <div
              key={chapter.id}
              draggable={!isMobile}
              onDragStart={(e) => handleDragStart(e, chapter.id)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, chapter.id)}
              className={`novel-chapter-item ${currentChapter?.id === chapter.id ? 'active' : ''}`}
              style={{ opacity: draggingChapterId === chapter.id ? 0.5 : 1 }}
              onClick={() => loadChapter(chapter)}
            >
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <DragOutlined style={{ color: '#999', cursor: 'grab', fontSize: '16px' }} />
                <span style={{ color: 'var(--primary-color)', fontWeight: 500, fontSize: '14px' }}>
                  第{index + 1}章
                </span>
                {editingChapterId === chapter.id ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={(e) => e.stopPropagation()}>
                    <Input
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onBlur={() => {
                        if (editingTitle.trim() !== '') {
                          novelService.updateChapterTitle(chapter.id, editingTitle.trim())
                            .then(() => {
                              message.success('标题已更新')
                              fetchChapters()
                            })
                            .catch(() => message.error('更新标题失败'))
                        }
                        setEditingChapterId(null)
                      }}
                      onPressEnter={() => {
                        if (editingTitle.trim() !== '') {
                          novelService.updateChapterTitle(chapter.id, editingTitle.trim())
                            .then(() => {
                              message.success('标题已更新')
                              fetchChapters()
                            })
                            .catch(() => message.error('更新标题失败'))
                        }
                        setEditingChapterId(null)
                      }}
                      size="small"
                      style={{ width: '150px' }}
                      autoFocus
                    />
                    <Button type="text" size="small" onClick={() => setEditingChapterId(null)}>取消</Button>
                  </div>
                ) : (
                  <span
                    style={{
                      color: currentChapter?.id === chapter.id ? 'var(--primary-color)' : 'var(--text-primary)',
                      fontWeight: currentChapter?.id === chapter.id ? 500 : 400,
                      cursor: 'pointer',
                      userSelect: 'none'
                    }}
                    onClick={() => loadChapter(chapter)}
                    onDoubleClick={() => {
                      setEditingChapterId(chapter.id)
                      setEditingTitle(chapter.title || '未命名章节')
                    }}
                  >
                    {chapter.title || '未命名章节'}
                  </span>
                )}
              </div>
              <Button
                danger
                type="text"
                size="small"
                icon={<span>🗑️</span>}
                onClick={(e) => {
                  e.stopPropagation()
                  handleDeleteChapter(chapter.id)
                }}
              >
                删除
              </Button>
            </div>
          ))}
        </div>
      )}
    </>
  )

  return (
    <div className="novel-container">
      <div className="novel-mobile-toolbar">
        <div className="novel-mobile-toolbar-left">
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/creation')}
            aria-label="返回"
          />
          <span className="novel-mobile-toolbar-title">
            {currentChapter?.title || '小说创作'}
          </span>
        </div>
        <Dropdown menu={{ items: mobileMoreMenuItems }} placement="bottomRight" trigger={['click']}>
          <Button type="text" icon={<MoreOutlined />} aria-label="更多操作" />
        </Dropdown>
      </div>

      <div className="novel-back-row" style={{ marginBottom: '1.5rem' }}>
        <Button
          type="link"
          onClick={() => navigate('/creation')}
        >
          返回
        </Button>
      </div>
      
      <Row justify="space-between" align="middle" className="novel-header">
        <Col>
          <Title level={2} className="novel-title">小说创作</Title>
          <Title level={4}>小说ID: {id}</Title>
        </Col>
        <Col>
          <Space className="novel-actions novel-actions-desktop">
            <Button
              icon={<BranchesOutlined />}
              onClick={() => navigate(`/novel/${id}/versions`)}
            >
              版本管理
            </Button>
            <Button
              icon={<HistoryOutlined />}
              onClick={() => navigate(`/novel/${id}/history`)}
            >
              生成历史
            </Button>
            <Button type="primary" className="novel-action-button" onClick={() => {
              setActionType('generate')
              setModalVisible(true)
            }}>
              生成章节
            </Button>
            <Button className="novel-action-button" onClick={() => {
              if (!currentChapter) {
                message.warning('请先选择一个章节')
                return
              }
              if (!currentChapter.content || !currentChapter.content.trim()) {
                message.warning('所选章节内容为空，无法续写')
                return
              }
              setActionType('continue')
              setModalVisible(true)
            }}>
              续写章节
            </Button>
            <Button onClick={() => {
              if (!currentChapter) {
                message.warning('请先选择一个章节')
                return
              }
              setActionType('polish')
              setModalVisible(true)
            }}>
              内容润色
            </Button>
            <Button type="default" onClick={() => {
              if (!currentChapter) {
                message.warning('请先选择一个章节')
                return
              }
              const contentState = editorState.getCurrentContent()
              const contentText = contentState.getPlainText()
              handleSaveChapter(contentText, currentChapter?.plot)
            }}>
              保存章节
            </Button>
            <Dropdown menu={{ items: exportMenuItems }} placement="bottomRight">
              <Button icon={<DownloadOutlined />}>
                导出小说
              </Button>
            </Dropdown>
          </Space>
        </Col>
      </Row>

      <Card
        className="novel-memory-card--desktop novel-memory-panel"
        title="小说记忆"
        loading={memoryLoading}
        style={{ marginBottom: '1.5rem' }}
      >
        {memoryTabs}
      </Card>

      <Collapse
        className="novel-memory-collapse novel-memory-panel"
        items={[{
          key: 'memory',
          label: `小说记忆${memoryLoading ? '（加载中）' : ''}`,
          children: memoryLoading ? <Loading /> : memoryTabs
        }]}
      />

      {isMobile ? (
        <Collapse
          className="novel-chapters-collapse"
          defaultActiveKey={['chapters']}
          items={[{
            key: 'chapters',
            label: (
              <span className="novel-chapters-collapse-label">
                章节列表
                <Tag color="processing" className="novel-chapters-count">共 {chapters.length} 章</Tag>
                {currentChapter && (
                  <span className="novel-chapters-current">
                    当前：{currentChapter.title || '未命名章节'}
                  </span>
                )}
              </span>
            ),
            children: (
              <div className="novel-chapter-list novel-chapter-list--mobile">
                {renderChapterList(false)}
              </div>
            )
          }]}
        />
      ) : (
        <Row gutter={[16, 16]} className="novel-chapters">
          <Col span={24}>
            <div className="novel-chapter-list">
              {renderChapterList(true)}
            </div>
          </Col>
        </Row>
      )}

      {/* 章节内容显示 */}
      {currentChapter && !loading && (
        <Row gutter={[16, 16]} style={{ marginBottom: '2rem' }}>
          <Col span={24}>
            <div className="novel-editor-container" ref={chapterContentRef}>
              <Row justify="space-between" align="middle" style={{ marginBottom: '1rem' }}>
                <Title level={4}>{currentChapter.title || '未命名章节'}</Title>
                <Space>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                    字数: {editing ? getWordCount(editorState) : currentChapter.content?.length || 0}
                  </span>
                  <Button 
                    type="primary" 
                    onClick={() => setEditing(!editing)}
                  >
                    {editing ? '取消编辑' : '编辑内容'}
                  </Button>
                </Space>
              </Row>
              
              {editing ? (
                <>
                  <Space style={{ marginBottom: '1rem' }}>
                    <Button onClick={handleBoldClick}>粗体</Button>
                    <Button onClick={handleItalicClick}>斜体</Button>
                  </Space>
                  <div className="novel-editor">
                    <Editor
                      ref={editorRef}
                      editorState={editorState}
                      onChange={handleEditorChange}
                      handleKeyCommand={handleKeyCommand}
                      placeholder="请输入小说内容..."
                    />
                  </div>
                </>
              ) : (
                <div className="novel-content-preview">
                  {currentChapter.content || '章节内容为空'}
                </div>
              )}
            </div>
          </Col>
        </Row>
      )}

      {/* 空状态提示 */}
      {!currentChapter && !loading && (
        <Row gutter={[16, 16]}>
          <Col span={24}>
            <div className="novel-empty-state">
              <Title level={5}>请从章节列表中选择一个章节查看</Title>
            </div>
          </Col>
        </Row>
      )}

      {/* 显示生成中的内容 */}
      {loading && (
        <Row style={{ marginTop: '2rem' }}>
          <Col span={24}>
            <div className="novel-generating" ref={generatingRef}>
              <Title level={4} className="novel-generating-title">
                ✨ 正在生成内容...
              </Title>
              <div className="novel-generating-content">
                {generatedContent ? (
                  <>
                    {generatedContent}
                    <span className="streaming-cursor"></span>
                  </>
                ) : (
                  <span className="novel-generating-waiting">等待AI响应中...</span>
                )}
              </div>
              <div ref={streamEndRef} className="novel-stream-anchor" aria-hidden="true" />
            </div>
          </Col>
        </Row>
      )}

      <div className="novel-ai-bar" role="toolbar" aria-label="创作操作">
        <Button type="primary" size="small" onClick={openGenerateModal}>
          生成
        </Button>
        <Button size="small" onClick={openContinueModal}>
          续写
        </Button>
        <Button size="small" onClick={openPolishModal}>
          润色
        </Button>
        <Button
          size="small"
          onClick={() => {
            if (!currentChapter) {
              message.warning('请先选择一个章节')
              return
            }
            const contentState = editorState.getCurrentContent()
            handleSaveChapter(contentState.getPlainText(), currentChapter?.plot)
          }}
        >
          保存
        </Button>
      </div>

      <Modal
        title={editingCharacter ? '编辑人物卡' : '新增人物卡'}
        open={characterModalVisible}
        onCancel={() => setCharacterModalVisible(false)}
        onOk={handleSaveCharacter}
        okText="保存"
        width={720}
      >
        <Form form={characterForm} layout="vertical">
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item label="姓名" name="name" rules={[{ required: true, message: '请输入人物姓名' }]}>
                <Input placeholder="例如：林夜" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item label="角色定位" name="role">
                <Input placeholder="主角 / 女主 / 反派 / 配角" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item label="身份" name="identity">
                <Input placeholder="出身、职业、阵营、当前身份" />
              </Form.Item>
            </Col>
            <Col xs={12} md={6}>
              <Form.Item label="优先级" name="priority" initialValue={5}>
                <InputNumber min={1} max={10} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={12} md={6}>
              <Form.Item label="启用" name="isActive" valuePropName="checked" initialValue>
                <Switch checkedChildren="启用" unCheckedChildren="停用" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item label="性格" name="personality">
                <Input.TextArea rows={3} placeholder="核心性格、说话方式、行为习惯" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item label="外貌" name="appearance">
                <Input.TextArea rows={3} placeholder="外貌特征、服饰、气质" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item label="人物关系" name="relationship">
                <Input.TextArea rows={3} placeholder="与主角、势力、其他角色的关系" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item label="秘密/动机" name="secret">
                <Input.TextArea rows={3} placeholder="隐藏身份、秘密目标、核心动机" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item label="成长线" name="arc">
                <Input.TextArea rows={3} placeholder="人物弧光、阶段变化、命运走向" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item label="备注" name="notes">
                <Input.TextArea rows={3} placeholder="其他长期约束" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      <Modal
        title={actionType === 'generate' ? '生成章节' : actionType === 'continue' ? '续写章节' : '内容润色'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={handleGenerate}
        okText="生成"
        confirmLoading={loading}
        width={600}
      >
        {actionType === 'generate' && (
          <Form layout="vertical">
            <Form.Item
              label={`Prompt 模板库（资料更新：${PROMPT_TEMPLATES_UPDATED_AT}）`}
              name="promptTemplate"
            >
              <Select
                allowClear
                showSearch
                placeholder="选择热门题材模板，一键填充生成参数"
                value={selectedTemplateId}
                onChange={(templateId) => {
                  const template = PROMPT_TEMPLATES.find((item) => item.id === templateId)
                  if (template) {
                    applyPromptTemplate(template)
                  } else {
                    setSelectedTemplateId(undefined)
                  }
                }}
                optionLabelProp="label"
                options={PROMPT_TEMPLATES.map((template) => ({
                  value: template.id,
                  label: template.title,
                  template
                }))}
                optionRender={(option) => {
                  const template = option.data.template
                  return (
                    <Space direction="vertical" size={2} style={{ width: '100%' }}>
                      <Space wrap>
                        <span>{template.title}</span>
                        <Tag color="blue">{template.category}</Tag>
                        {template.tags.slice(0, 3).map((tag) => <Tag key={tag}>{tag}</Tag>)}
                      </Space>
                      <span style={{ color: '#a5b4fc', fontSize: 12 }}>{template.reason}</span>
                    </Space>
                  )
                }}
              />
            </Form.Item>
            <Form.Item
              label="章节标题"
              name="chapterTitle"
            >
              <Input 
                placeholder="请输入章节标题（选填）" 
                value={chapterTitle} 
                onChange={(e) => setChapterTitle(e.target.value)} 
              />
            </Form.Item>
            <Form.Item
              label="题材"
              name="genre"
              rules={[{ required: true, message: '请选择题材' }]}
            >
              <Select value={genre} onChange={(value) => setGenre(value)}>
                <Option value="玄幻">玄幻</Option>
                <Option value="仙侠">仙侠</Option>
                <Option value="都市">都市</Option>
                <Option value="历史">历史</Option>
                <Option value="科幻">科幻</Option>
                <Option value="言情">言情</Option>
                <Option value="自定义">自定义</Option>
              </Select>
            </Form.Item>
            {genre === '自定义' && (
              <Form.Item
                label="自定义题材"
                name="customGenre"
                rules={[{ required: true, message: '请输入自定义题材' }]}
              >
                <Input 
                  placeholder="请输入自定义题材" 
                  value={customGenre} 
                  onChange={(e) => setCustomGenre(e.target.value)} 
                />
              </Form.Item>
            )}
            <Form.Item
              label="风格"
              name="style"
              rules={[{ required: true, message: '请选择风格' }]}
            >
              <Select value={style} onChange={(value) => setStyle(value)}>
                <Option value="正常">正常</Option>
                <Option value="浪漫">浪漫</Option>
                <Option value="英雄主义">英雄主义</Option>
                <Option value="神秘">神秘</Option>
                <Option value="幽默">幽默</Option>
                <Option value="悲剧">悲剧</Option>
                <Option value="自定义">自定义</Option>
              </Select>
            </Form.Item>
            {style === '自定义' && (
              <Form.Item
                label="自定义风格"
                name="customStyle"
                rules={[{ required: true, message: '请输入自定义风格' }]}
              >
                <Input 
                  placeholder="请输入自定义风格" 
                  value={customStyle} 
                  onChange={(e) => setCustomStyle(e.target.value)} 
                />
              </Form.Item>
            )}
            <Form.Item
              label="字数"
              name="wordCount"
            >
              <Select value={wordCount} onChange={(value) => setWordCount(value)}>
                <Option value="2000">2000字</Option>
                <Option value="3000">3000字</Option>
                <Option value="5000">5000字</Option>
              </Select>
            </Form.Item>
            <Form.Item
              label="核心剧情"
              name="corePlot"
              rules={[{ required: true, message: '请输入核心剧情' }]}
            >
              <Input.TextArea 
                placeholder="请输入核心剧情" 
                rows={2} 
                value={corePlot} 
                onChange={(e) => setCorePlot(e.target.value)} 
              />
            </Form.Item>
            <Form.Item
              label="登场人物性格"
              name="characters"
            >
              <Input.TextArea 
                placeholder="请输入登场人物性格（选填）" 
                rows={2} 
                value={characters} 
                onChange={(e) => setCharacters(e.target.value)} 
              />
            </Form.Item>
            <Form.Item
              label="其他要求"
              name="other"
            >
              <Input.TextArea 
                placeholder="请输入其他要求（选填）" 
                rows={2} 
                value={other} 
                onChange={(e) => setOther(e.target.value)} 
              />
            </Form.Item>
          </Form>
        )}
        {actionType === 'continue' && (
          <Form layout="vertical">
            <Form.Item
              label="续写要求"
              name="customPrompt"
            >
              <Input.TextArea 
                placeholder="请输入续写要求（选填）" 
                rows={4} 
                value={customPrompt} 
                onChange={(e) => setCustomPrompt(e.target.value)} 
              />
            </Form.Item>
            <Form.Item
              label="字数"
              name="continueWordCount"
            >
              <Select value={continueWordCount} onChange={(value) => setContinueWordCount(value)}>
                <Option value="2000">2000字</Option>
                <Option value="3000">3000字</Option>
                <Option value="5000">5000字</Option>
              </Select>
            </Form.Item>
          </Form>
        )}
        {actionType === 'polish' && (
          <Form layout="vertical">
            <Form.Item
              label="润色要求"
              name="customPrompt"
            >
              <Input.TextArea 
                placeholder="请输入文风、语法、流畅度等要求（选填）" 
                rows={4} 
                value={customPrompt} 
                onChange={(e) => setCustomPrompt(e.target.value)} 
              />
            </Form.Item>
          </Form>
        )}
      </Modal>
    </div>
  )
}

export default Novel
