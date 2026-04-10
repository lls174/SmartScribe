import React, { useState } from 'react'
import { Button, Typography, Card, Row, Col, Space, Form, Select, message, Spin, Modal, Input } from 'antd'
import { aiService } from '@services/aiService'
import { creativeApi } from '@services/api'
import { useAIConfig } from '@contexts/AIConfigContext'
import '@styles/Creative.css'

const { Title, Paragraph } = Typography
const { Option } = Select

const Creative: React.FC = () => {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const { config } = useAIConfig()
  const [result, setResult] = useState<string>('')
  const [activeTab, setActiveTab] = useState<'trend' | 'theme' | 'element'>('trend')
  const [saveModalVisible, setSaveModalVisible] = useState(false)
  const [saveLoading, setSaveLoading] = useState(false)
  const [saveForm] = Form.useForm()
  const [formValues, setFormValues] = useState<any>({})

  const creativeTypes = [
    { value: 'trend', label: '流行趋势' },
    { value: 'theme', label: '热门题材' },
    { value: 'element', label: '创意元素' }
  ]

  const genres = [
    { value: 'xuanhuan', label: '玄幻' },
    { value: 'xianxia', label: '仙侠' },
    { value: 'dushi', label: '都市' },
    { value: 'lishi', label: '历史' },
    { value: 'kehuan', label: '科幻' },
    { value: 'yanqing', label: '言情' }
  ]

  const onFinish = async (values: any) => {
    setLoading(true)
    setResult('')
    setFormValues(values)
    try {
      let prompt = ''
      
      if (activeTab === 'trend') {
        prompt = `请分析当前网络小说市场的流行趋势，特别是${values.genre === 'all' ? '各个题材' : genres.find(g => g.value === values.genre)?.label}题材的流行趋势。包括：1. 热门元素和梗 2. 读者偏好 3. 市场热点 4. 未来可能的发展方向。请提供详细的分析和具体例子。`
      } else if (activeTab === 'theme') {
        prompt = `请推荐当前最热门的${values.genre === 'all' ? '网络小说' : genres.find(g => g.value === values.genre)?.label + '小说'}题材，包括：1. 热门题材名称 2. 题材特点 3. 成功案例 4. 创作建议。请提供详细的分析和具体例子。`
      } else {
        prompt = `请提供${values.genre === 'all' ? '各种题材' : genres.find(g => g.value === values.genre)?.label}小说的创意元素库，包括：1. 设定元素 2. 情节元素 3. 人物元素 4. 世界观元素。每个元素请提供具体例子和应用建议。`
      }

      let fullContent = ''
      
      fullContent = await aiService.generateCreative(
        prompt,
        activeTab,
        (chunk) => {
          if (!result) {
            setLoading(false)
          }
          setResult(prev => prev + chunk)
        },
        () => {
          message.success('创意生成成功')
        },
        config
      )
      
      setResult(fullContent)
    } catch (error) {
      console.error('生成创意失败:', error)
      message.error('生成创意失败')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveCreative = async (values: any) => {
    setSaveLoading(true)
    try {
      await creativeApi.create({
        title: values.title,
        type: activeTab,
        genre: formValues.genre || 'all',
        content: result
      })
      message.success('创意保存成功')
      setSaveModalVisible(false)
      saveForm.resetFields()
    } catch (error) {
      console.error('保存创意失败:', error)
      message.error('保存创意失败')
    } finally {
      setSaveLoading(false)
    }
  }

  return (
    <div className="creative-container">
      <Title level={2} className="creative-title">创意生成</Title>
      <Paragraph className="creative-description">
        通过AI获取网上的流行元素、热门题材等创意灵感
      </Paragraph>

      <Card className="creative-form-card">
        <Form form={form} onFinish={onFinish} layout="vertical">
          <Row gutter={[16, 16]}>
            <Col xs={24} md={12}>
              <Form.Item
                label="创意类型"
                name="type"
                rules={[{ required: true, message: '请选择创意类型' }]}
                initialValue="trend"
              >
                <Select
                  options={creativeTypes}
                  onChange={(value) => setActiveTab(value)}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                label="题材选择"
                name="genre"
              >
                <Select>
                  <Option value="all">全题材</Option>
                  {genres.map(genre => (
                    <Option key={genre.value} value={genre.value}>{genre.label}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button type="primary" htmlType="submit" loading={loading} className="creative-button">
                生成创意
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      {loading && (
        <Card className="creative-loading-card">
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <Spin size="large" />
            <p style={{ marginTop: 16, color: '#a5b4fc' }}>正在生成创意...</p>
          </div>
        </Card>
      )}

      {result && (
        <Card className="creative-result-card" title="✨ 创意结果">
          <div className="creative-result-content">
            {result}
            {loading && <span className="streaming-cursor"></span>}
          </div>
          <div style={{ marginTop: '1rem', textAlign: 'right' }}>
            <Button 
              type="primary" 
              onClick={() => setSaveModalVisible(true)}
              disabled={loading}
            >
              保存创意
            </Button>
          </div>
        </Card>
      )}

      {/* 保存创意模态框 */}
      <Modal
        title="保存创意"
        open={saveModalVisible}
        onCancel={() => setSaveModalVisible(false)}
        footer={null}
      >
        <Form
          form={saveForm}
          onFinish={handleSaveCreative}
          layout="vertical"
        >
          <Form.Item
            label="创意标题"
            name="title"
            rules={[{ required: true, message: '请输入创意标题' }]}
            initialValue={`${creativeTypes.find(t => t.value === activeTab)?.label} - ${formValues.genre === 'all' ? '全题材' : genres.find(g => g.value === formValues.genre)?.label}`}
          >
            <Input placeholder="请输入创意标题" />
          </Form.Item>
          <Form.Item>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => setSaveModalVisible(false)}>
                取消
              </Button>
              <Button type="primary" htmlType="submit" loading={saveLoading}>
                保存
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default Creative
