import React, { useMemo, useState } from 'react'
import { Button, Card, Col, Input, message, Row, Select, Space, Tag, Typography } from 'antd'
import { useNavigate } from 'react-router-dom'
import { PROMPT_TEMPLATES, PROMPT_TEMPLATES_UPDATED_AT, type PromptTemplate } from '@/data/promptTemplates'
import { novelService } from '@services/novelService'
import { useAuth } from '@hooks/useAuth'

const { Title, Paragraph, Text } = Typography

const buildNovelName = (template: PromptTemplate) => {
  return template.title.replace(/\s*\+\s*/g, '：')
}

const buildNovelDescription = (template: PromptTemplate) => {
  return [
    `模板：${template.title}`,
    `分类：${template.category}`,
    `标签：${template.tags.join('、')}`,
    `核心剧情：${template.corePlot}`,
    `推荐理由：${template.reason}`
  ].join('\n')
}

const PromptTemplates: React.FC = () => {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()
  const [keyword, setKeyword] = useState('')
  const [category, setCategory] = useState<string>()
  const [creatingId, setCreatingId] = useState<string>()

  const categories = useMemo(() => {
    return Array.from(new Set(PROMPT_TEMPLATES.map((template) => template.category)))
  }, [])

  const filteredTemplates = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase()
    return PROMPT_TEMPLATES.filter((template) => {
      const matchCategory = !category || template.category === category
      const matchKeyword = !normalizedKeyword || [
        template.title,
        template.category,
        template.genre,
        template.style,
        template.corePlot,
        template.reason,
        template.tags.join(' ')
      ].join(' ').toLowerCase().includes(normalizedKeyword)

      return matchCategory && matchKeyword
    })
  }, [category, keyword])

  const handleCreateNovel = async (template: PromptTemplate) => {
    if (!isAuthenticated) {
      message.warning('请先登录后再使用模板创建小说')
      navigate('/login')
      return
    }

    setCreatingId(template.id)
    try {
      const novel = await novelService.createNovel(buildNovelName(template), buildNovelDescription(template))
      await novelService.updateNovelSetting(novel.id, {
        genreStyle: `${template.genre} / ${template.style}`,
        plotRules: template.corePlot,
        notes: `来源模板：${template.title}\n${template.reason}\n标签：${template.tags.join('、')}`
      })

      message.success('已根据模板创建小说')
      navigate(`/novel/${novel.id}`, {
        state: {
          promptTemplateId: template.id,
          openGenerateModal: true
        }
      })
    } catch (error) {
      console.error('根据模板创建小说失败:', error)
      message.error('创建小说失败，请稍后重试')
    } finally {
      setCreatingId(undefined)
    }
  }

  return (
    <div style={{ padding: '2rem', maxWidth: 1200, margin: '0 auto' }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div>
          <Title level={2}>Prompt 模板库</Title>
          <Paragraph type="secondary">
            汇总当前流行网文/短剧元素。选择模板后会自动创建一部新小说，并在创作页填充生成参数。
          </Paragraph>
          <Text type="secondary">资料更新时间：{PROMPT_TEMPLATES_UPDATED_AT}</Text>
        </div>

        <Card>
          <Row gutter={[16, 16]}>
            <Col xs={24} md={14}>
              <Input.Search
                allowClear
                placeholder="搜索题材、标签、爽点或模板名称"
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
              />
            </Col>
            <Col xs={24} md={10}>
              <Select
                allowClear
                style={{ width: '100%' }}
                placeholder="按分类筛选"
                value={category}
                onChange={setCategory}
                options={categories.map((item) => ({ value: item, label: item }))}
              />
            </Col>
          </Row>
        </Card>

        <Row gutter={[16, 16]}>
          {filteredTemplates.map((template) => (
            <Col xs={24} md={12} xl={8} key={template.id}>
              <Card
                title={template.title}
                extra={<Tag color="blue">{template.category}</Tag>}
                actions={[
                  <Button
                    key="create"
                    type="primary"
                    loading={creatingId === template.id}
                    onClick={() => handleCreateNovel(template)}
                  >
                    用此模板创建小说
                  </Button>
                ]}
                style={{ height: '100%' }}
              >
                <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                  <Space wrap>
                    <Tag color="purple">{template.genre}</Tag>
                    <Tag color="cyan">{template.style}</Tag>
                    {template.tags.map((tag) => <Tag key={tag}>{tag}</Tag>)}
                  </Space>
                  <Paragraph ellipsis={{ rows: 4, expandable: true, symbol: '展开' }}>
                    {template.corePlot}
                  </Paragraph>
                  <Text type="secondary">{template.reason}</Text>
                </Space>
              </Card>
            </Col>
          ))}
        </Row>
      </Space>
    </div>
  )
}

export default PromptTemplates
