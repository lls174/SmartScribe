import React, { useState, useEffect } from 'react'
import { Button, Typography, Space, Card, List, Modal, Form, Input, message, Popconfirm } from 'antd'
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons'
import { Link, useNavigate } from 'react-router-dom'
import { novelService } from '@services/novelService'
import { useAuth } from '@hooks/useAuth'
import '@styles/Creation.css'

const { Title, Paragraph } = Typography

interface Novel {
  id: number
  name: string
  description: string
  createdAt: string
}

const Creation: React.FC = () => {
  const navigate = useNavigate()
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const [novels, setNovels] = useState<Novel[]>([])
  const [loading, setLoading] = useState(true)
  const [modalVisible, setModalVisible] = useState(false)
  const [form] = Form.useForm()

  useEffect(() => {
    if (authLoading) return
    if (!isAuthenticated) {
      navigate('/login')
      return
    }
    fetchNovels()
  }, [isAuthenticated, authLoading, navigate])

  const fetchNovels = async () => {
    try {
      const data = await novelService.getNovels()
      setNovels(data)
    } catch (error) {
      message.error('获取小说列表失败')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateNovel = async (values: { name: string; description: string }) => {
    try {
      const newNovel = await novelService.createNovel(values.name, values.description)
      setNovels([newNovel, ...novels])
      setModalVisible(false)
      form.resetFields()
      navigate(`/novel/${newNovel.id}`)
    } catch (error) {
      message.error('创建小说失败')
    }
  }

  const handleDeleteNovel = async (id: number) => {
    try {
      await novelService.deleteNovel(id)
      setNovels(novels.filter(novel => novel.id !== id))
      message.success('删除成功')
    } catch (error) {
      message.error('删除失败')
    }
  }

  return (
    <div className="creation-container">
      <div className="creation-header">
        <Title level={2} className="creation-title">小说管理</Title>
        <Button 
          type="primary" 
          icon={<PlusOutlined />}
          onClick={() => setModalVisible(true)}
          className="creation-button"
        >
          新建小说
        </Button>
      </div>

      <List
        className="novel-list"
        loading={loading}
        dataSource={novels}
        renderItem={(novel: Novel) => (
          <List.Item className="novel-item">
            <Card className="novel-card">
              <div className="novel-info">
                <Title level={4} className="novel-name">{novel.name}</Title>
                <Paragraph className="novel-description">{novel.description || '暂无描述'}</Paragraph>
                <div className="novel-meta">
                  <span className="novel-date">创建时间: {new Date(novel.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
              <div className="novel-actions">
                <Link to={`/novel/${novel.id}`}>
                  <Button type="primary" className="action-button">进入创作</Button>
                </Link>
                <Popconfirm
                  title="确定要删除这本小说吗？"
                  onConfirm={() => handleDeleteNovel(novel.id)}
                  okText="确定"
                  cancelText="取消"
                >
                  <Button danger icon={<DeleteOutlined />} className="action-button">删除</Button>
                </Popconfirm>
              </div>
            </Card>
          </List.Item>
        )}
      />

      <Modal
        title="新建小说"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        className="creation-modal"
      >
        <Form form={form} onFinish={handleCreateNovel} layout="vertical">
          <Form.Item
            label="小说名称"
            name="name"
            rules={[{ required: true, message: '请输入小说名称' }]}
          >
            <Input placeholder="请输入小说名称" className="creation-input" />
          </Form.Item>
          <Form.Item
            label="小说简介"
            name="description"
          >
            <Input.TextArea placeholder="请输入小说简介（选填）" rows={4} className="creation-input" />
          </Form.Item>
          <Form.Item>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => setModalVisible(false)}>取消</Button>
              <Button type="primary" htmlType="submit" className="creation-button">创建</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default Creation
