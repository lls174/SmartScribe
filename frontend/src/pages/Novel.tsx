import React, { useState, useRef, useEffect } from 'react'
import { Button, Typography, Space, Row, Col, Form, Input, Modal, message, Select, Dropdown } from 'antd'
import { DragOutlined, DownloadOutlined } from '@ant-design/icons'
import type { MenuProps } from 'antd'

const { Option } = Select
import { useParams, useNavigate } from 'react-router-dom'
import { Editor, EditorState, RichUtils, convertToRaw, convertFromRaw } from 'draft-js'
import 'draft-js/dist/Draft.css'
import { aiService } from '@services/aiService'
import type { NovelContext } from '@services/aiService'
import { novelService } from '@services/novelService'
import { useAuth } from '@hooks/useAuth'
import { useAIConfig } from '@contexts/AIConfigContext'
import Loading from '@components/Loading'
import type { Chapter } from '@types/index'
import '@styles/Novel.css'

const { Title } = Typography

const Novel: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
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
  const [continueWordCount, setContinueWordCount] = useState('2000')
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [pageLoading, setPageLoading] = useState(true)
  const [generatedContent, setGeneratedContent] = useState('')
  const [editing, setEditing] = useState(false)
  const [currentChapter, setCurrentChapter] = useState<Chapter | null>(null)
  const [editingChapterId, setEditingChapterId] = useState<number | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [draggingChapterId, setDraggingChapterId] = useState<number | null>(null)
  const editorRef = useRef<Editor>(null)

  const buildNovelContext = (): NovelContext => {
    return {
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
    }
  }, [id, isAuthenticated, authLoading, navigate])

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

  const handleGenerate = async () => {
    // 先关闭弹窗
    setModalVisible(false)
    // 显示loading状态
    setLoading(true)
    setGeneratedContent('')
    try {
      const contentState = editorState.getCurrentContent()
      const contentText = contentState.getPlainText()

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
          (plot) => {
          },
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
          (plot) => {
          },
          config,
          ctx,
          continueWordCount
        )
      } else {
        const polishResult = await aiService.polishContent(
          currentChapter?.content || '', 
          customPrompt,
          (chunk) => {
            setGeneratedContent(prev => prev + chunk)
          },
          () => {
          },
          config,
          ctx
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
      
      // 生成完成后自动保存内容
      await handleSaveChapter(result.content, result.plot)
    } catch (error) {
      console.error('生成失败:', error)
      // 显示更具体的错误信息
      let errorMessage = '生成失败'
      if (error.message) {
        errorMessage += '：' + error.message
      }
      // 特别处理API密钥未配置的情况
      if (error.message && (error.message.includes('API密钥未配置') || error.message.includes('API key'))) {
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

  if (pageLoading) {
    return <Loading />
  }

  return (
    <div className="novel-container">
      <div style={{ marginBottom: '1.5rem' }}>
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
          <Space className="novel-actions">
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

      {/* 章节列表 */}
      <Row gutter={[16, 16]} className="novel-chapters">
        <Col span={24}>
          <div className="novel-chapter-list">
            <Row justify="space-between" align="middle" style={{ marginBottom: '1rem' }}>
              <Title level={4} style={{ margin: 0 }}>章节列表</Title>
              <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>共 {chapters.length} 章</span>
            </Row>
            {chapters.length === 0 ? (
              <div className="novel-generating-waiting" style={{ 
                padding: '2rem', 
                textAlign: 'center',
                border: '1px dashed rgba(59, 130, 246, 0.3)',
                borderRadius: 8
              }}>
                暂无章节，点击"生成章节"开始创作
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {chapters.map((chapter, index) => (
                  <div 
                    key={chapter.id}
                    draggable="true"
                    onDragStart={(e) => handleDragStart(e, chapter.id)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, chapter.id)}
                    className={`novel-chapter-item ${currentChapter?.id === chapter.id ? 'active' : ''}`}
                    style={{
                      opacity: draggingChapterId === chapter.id ? 0.5 : 1
                    }}
                    onClick={() => loadChapter(chapter)}
                  >
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <DragOutlined 
                        style={{ 
                          color: '#999', 
                          cursor: 'grab',
                          fontSize: '16px'
                        }} 
                      />
                      <span style={{ 
                        color: '#1890ff', 
                        fontWeight: 500,
                        fontSize: '14px'
                      }}>
                        第{index + 1}章
                      </span>
                      {editingChapterId === chapter.id ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
                                  .catch((error) => {
                                    console.error('更新标题失败:', error)
                                    message.error('更新标题失败')
                                  })
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
                                  .catch((error) => {
                                    console.error('更新标题失败:', error)
                                    message.error('更新标题失败')
                                  })
                              }
                              setEditingChapterId(null)
                            }}
                            size="small"
                            style={{ width: '150px' }}
                            autoFocus
                          />
                          <Button 
                            type="text" 
                            size="small"
                            onClick={() => setEditingChapterId(null)}
                          >
                            取消
                          </Button>
                        </div>
                      ) : (
                        <span 
                          style={{ 
                            color: currentChapter?.id === chapter.id ? '#1890ff' : '#333',
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
          </div>
        </Col>
      </Row>

      {/* 章节内容显示 */}
      {currentChapter && !loading && (
        <Row gutter={[16, 16]} style={{ marginBottom: '2rem' }}>
          <Col span={24}>
            <div className="novel-editor-container">
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
            <div className="novel-generating">
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
            </div>
          </Col>
        </Row>
      )}

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
