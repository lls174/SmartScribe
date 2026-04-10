import React, { useState } from 'react'
import { Button, Typography, Form, Input, Select, Space, message, Card } from 'antd'
import { feedbackService } from '@services/feedbackService'

const { Title, Paragraph } = Typography

const Feedback: React.FC = () => {
  const [loading, setLoading] = useState(false)
  const [form] = Form.useForm()

  const feedbackTypes = [
    { value: 'bug', label: 'Bug 反馈' },
    { value: 'suggestion', label: '功能建议' },
    { value: 'other', label: '其他' }
  ]

  const onFinish = async (values: any) => {
    setLoading(true)
    try {
      await feedbackService.submitFeedback(values.type, values.content)
      message.success('反馈提交成功')
      form.resetFields()
    } catch (error) {
      message.error('反馈提交失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <Title level={2}>意见反馈</Title>
      <Paragraph>请告诉我们您的使用体验和建议，帮助我们不断改进产品。</Paragraph>

      <Card style={{ marginTop: '2rem' }}>
        <Form form={form} onFinish={onFinish} layout="vertical">
          <Form.Item
            label="反馈类型"
            name="type"
            rules={[{ required: true, message: '请选择反馈类型' }]}
          >
            <Select options={feedbackTypes} />
          </Form.Item>

          <Form.Item
            label="反馈内容"
            name="content"
            rules={[{ required: true, message: '请输入反馈内容' }]}
          >
            <Input.TextArea rows={6} placeholder="请详细描述您的问题或建议" />
          </Form.Item>

          <Form.Item>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button type="primary" htmlType="submit" loading={loading}>
                提交反馈
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  )
}

export default Feedback
