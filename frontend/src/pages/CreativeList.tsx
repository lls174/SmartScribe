import React, { useState, useEffect } from 'react'
import { Button, Typography, Card, Table, message, Space, Modal, Form, Input, Select, Tag, Popconfirm } from 'antd'
import { EditOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons'
import { creativeApi } from '@services/api'
import '@styles/CreativeList.css'

const { Title, Paragraph } = Typography
const { Option } = Select

const CreativeList: React.FC = () => {
  const [loading, setLoading] = useState(false)
  const [creatives, setCreatives] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [viewModalVisible, setViewModalVisible] = useState(false)
  const [editModalVisible, setEditModalVisible] = useState(false)
  const [currentCreative, setCurrentCreative] = useState<any>(null)
  const [editForm] = Form.useForm()

  const creativeTypes = [
    { value: 'trend', label: '流行趋势' },
    { value: 'theme', label: '热门题材' },
    { value: 'element', label: '创意元素' }
  ]

  const genres = [
    { value: 'all', label: '全题材' },
    { value: 'xuanhuan', label: '玄幻' },
    { value: 'xianxia', label: '仙侠' },
    { value: 'dushi', label: '都市' },
    { value: 'lishi', label: '历史' },
    { value: 'kehuan', label: '科幻' },
    { value: 'yanqing', label: '言情' }
  ]

  const loadCreatives = async () => {
    setLoading(true)
    try {
      const response = await creativeApi.getList(page, limit)
      setCreatives(response.data.creatives)
      setTotal(response.data.total)
    } catch (error) {
      console.error('获取创意列表失败:', error)
      message.error('获取创意列表失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCreatives()
  }, [page, limit])

  const handleViewCreative = (creative: any) => {
    setCurrentCreative(creative)
    setViewModalVisible(true)
  }

  const handleEditCreative = (creative: any) => {
    setCurrentCreative(creative)
    editForm.setFieldsValue({
      title: creative.title,
      genre: creative.genre
    })
    setEditModalVisible(true)
  }

  const handleUpdateCreative = async (values: any) => {
    try {
      await creativeApi.update(currentCreative.id, values)
      message.success('创意更新成功')
      setEditModalVisible(false)
      loadCreatives()
    } catch (error) {
      console.error('更新创意失败:', error)
      message.error('更新创意失败')
    }
  }

  const handleDeleteCreative = async (id: number) => {
    try {
      await creativeApi.delete(id)
      message.success('创意删除成功')
      loadCreatives()
    } catch (error) {
      console.error('删除创意失败:', error)
      message.error('删除创意失败')
    }
  }

  const columns = [
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      render: (text: string) => (
        <span className="creative-list-title-text">{text}</span>
      )
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => {
        const typeInfo = creativeTypes.find(t => t.value === type)
        return typeInfo ? (
          <Tag color="blue">{typeInfo.label}</Tag>
        ) : (
          <Tag color="default">{type}</Tag>
        )
      }
    },
    {
      title: '题材',
      dataIndex: 'genre',
      key: 'genre',
      render: (genre: string) => {
        const genreInfo = genres.find(g => g.value === genre)
        return genreInfo ? (
          <Tag color="green">{genreInfo.label}</Tag>
        ) : (
          <Tag color="default">{genre}</Tag>
        )
      }
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => new Date(date).toLocaleString()
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: any) => (
        <Space size="middle">
          <Button 
            type="text" 
            icon={<EyeOutlined />}
            onClick={() => handleViewCreative(record)}
          >
            查看
          </Button>
          <Button 
            type="text" 
            icon={<EditOutlined />}
            onClick={() => handleEditCreative(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定删除这个创意吗？"
            onConfirm={() => handleDeleteCreative(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button 
              type="text" 
              icon={<DeleteOutlined />}
              danger
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ]

  return (
    <div className="creative-list-container">
      <div className="creative-list-header">
        <Title level={2} className="creative-list-title">创意管理</Title>
        <Paragraph className="creative-list-description">
          管理已保存的创意内容
        </Paragraph>
      </div>

      <Card className="creative-list-card">
        <Table
          columns={columns}
          dataSource={creatives.map(creative => ({
            ...creative,
            key: creative.id
          }))}
          pagination={{
            total,
            pageSize: limit,
            current: page,
            onChange: (page) => setPage(page),
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50'],
            onShowSizeChange: (_, pageSize) => setLimit(pageSize)
          }}
          loading={loading}
          rowClassName="creative-list-row"
        />
      </Card>

      {/* 查看创意模态框 */}
      <Modal
        title={currentCreative?.title}
        open={viewModalVisible}
        onCancel={() => setViewModalVisible(false)}
        width={800}
      >
        <div className="creative-view-content">
          <div className="creative-view-meta">
            <span className="creative-view-label">类型:</span>
            <Tag color="blue">
              {creativeTypes.find(t => t.value === currentCreative?.type)?.label || currentCreative?.type}
            </Tag>
            <span className="creative-view-label">题材:</span>
            <Tag color="green">
              {genres.find(g => g.value === currentCreative?.genre)?.label || currentCreative?.genre}
            </Tag>
            <span className="creative-view-label">创建时间:</span>
            <span>{currentCreative?.createdAt ? new Date(currentCreative.createdAt).toLocaleString() : ''}</span>
          </div>
          <div className="creative-view-body">
            {currentCreative?.content}
          </div>
        </div>
      </Modal>

      {/* 编辑创意模态框 */}
      <Modal
        title="编辑创意"
        open={editModalVisible}
        onCancel={() => setEditModalVisible(false)}
        footer={null}
      >
        <Form
          form={editForm}
          onFinish={handleUpdateCreative}
          layout="vertical"
        >
          <Form.Item
            label="创意标题"
            name="title"
            rules={[{ required: true, message: '请输入创意标题' }]}
          >
            <Input placeholder="请输入创意标题" />
          </Form.Item>
          <Form.Item
            label="题材"
            name="genre"
          >
            <Select>
              {genres.map(genre => (
                <Option key={genre.value} value={genre.value}>{genre.label}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => setEditModalVisible(false)}>
                取消
              </Button>
              <Button type="primary" htmlType="submit">
                保存
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default CreativeList
