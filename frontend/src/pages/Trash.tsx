import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Button, Table, Space, message, Tabs, Tag, Modal } from 'antd'
import { RollbackOutlined, DeleteOutlined, BookOutlined, FileTextOutlined } from '@ant-design/icons'
import { novelService } from '@services/novelService'
import { useAuth } from '@hooks/useAuth'
import Loading from '@components/Loading'
import type { DeletedChapter, DeletedNovel } from '@app-types/index'
import '@styles/Trash.css'

const Trash: React.FC = () => {
  const navigate = useNavigate()
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const [loading, setLoading] = useState(false)
  const [deletedNovels, setDeletedNovels] = useState<DeletedNovel[]>([])
  const [deletedChapters, setDeletedChapters] = useState<DeletedChapter[]>([])

  useEffect(() => {
    if (authLoading) return
    if (!isAuthenticated) {
      navigate('/login')
      return
    }
    fetchTrashItems()
  }, [isAuthenticated, authLoading, navigate])

  const fetchTrashItems = async () => {
    try {
      setLoading(true)
      const [novels, chapters] = await Promise.all([
        novelService.getDeletedNovels(),
        novelService.getDeletedChapters()
      ])
      setDeletedNovels(novels)
      setDeletedChapters(chapters)
    } catch (error) {
      console.error('获取回收站失败:', error)
      message.error('获取回收站失败')
    } finally {
      setLoading(false)
    }
  }

  const handleRestoreNovel = async (id: number) => {
    try {
      await novelService.restoreNovel(id)
      message.success('小说恢复成功')
      fetchTrashItems()
    } catch (error) {
      console.error('恢复小说失败:', error)
      message.error('恢复小说失败')
    }
  }

  const handlePermanentDeleteNovel = async (id: number) => {
    Modal.confirm({
      title: '确认永久删除',
      content: '确定要永久删除这个小说吗？此操作不可恢复。',
      okText: '确定删除',
      cancelText: '取消',
      okType: 'danger',
      onOk: async () => {
        try {
          await novelService.permanentDeleteNovel(id)
          message.success('小说已永久删除')
          fetchTrashItems()
        } catch (error) {
          console.error('永久删除小说失败:', error)
          message.error('永久删除小说失败')
        }
      }
    })
  }

  const handleRestoreChapter = async (id: number) => {
    try {
      await novelService.restoreChapter(id)
      message.success('章节恢复成功')
      fetchTrashItems()
    } catch (error) {
      console.error('恢复章节失败:', error)
      message.error('恢复章节失败')
    }
  }

  const handlePermanentDeleteChapter = async (id: number) => {
    Modal.confirm({
      title: '确认永久删除',
      content: '确定要永久删除这个章节吗？此操作不可恢复。',
      okText: '确定删除',
      cancelText: '取消',
      okType: 'danger',
      onOk: async () => {
        try {
          await novelService.permanentDeleteChapter(id)
          message.success('章节已永久删除')
          fetchTrashItems()
        } catch (error) {
          console.error('永久删除章节失败:', error)
          message.error('永久删除章节失败')
        }
      }
    })
  }

  const novelColumns = [
    {
      title: '小说名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => <strong>{text}</strong>
    },
    {
      title: '简介',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (text: string) => text || '无简介'
    },
    {
      title: '删除时间',
      dataIndex: 'deletedAt',
      key: 'deletedAt',
      render: (text: string) => new Date(text).toLocaleString()
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: DeletedNovel) => (
        <Space>
          <Button
            type="primary"
            icon={<RollbackOutlined />}
            onClick={() => handleRestoreNovel(record.id)}
          >
            恢复
          </Button>
          <Button
            danger
            icon={<DeleteOutlined />}
            onClick={() => handlePermanentDeleteNovel(record.id)}
          >
            永久删除
          </Button>
        </Space>
      )
    }
  ]

  const chapterColumns = [
    {
      title: '章节标题',
      dataIndex: 'title',
      key: 'title',
      render: (text: string) => <strong>{text || '未命名章节'}</strong>
    },
    {
      title: '所属小说',
      dataIndex: ['novel', 'name'],
      key: 'novelName',
      render: (text: string) => (
        <Space>
          <BookOutlined />
          {text}
        </Space>
      )
    },
    {
      title: '删除时间',
      dataIndex: 'deletedAt',
      key: 'deletedAt',
      render: (text: string) => new Date(text).toLocaleString()
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: DeletedChapter) => (
        <Space>
          <Button
            type="primary"
            icon={<RollbackOutlined />}
            onClick={() => handleRestoreChapter(record.id)}
          >
            恢复
          </Button>
          <Button
            danger
            icon={<DeleteOutlined />}
            onClick={() => handlePermanentDeleteChapter(record.id)}
          >
            永久删除
          </Button>
        </Space>
      )
    }
  ]

  if (loading && deletedNovels.length === 0 && deletedChapters.length === 0) {
    return <Loading />
  }

  const tabItems = [
    {
      key: 'novels',
      label: (
        <span>
          <BookOutlined />
          小说回收站
          {deletedNovels.length > 0 && (
            <Tag color="red" style={{ marginLeft: 8 }}>
              {deletedNovels.length}
            </Tag>
          )}
        </span>
      ),
      children: deletedNovels.length === 0 ? (
        <div className="trash-empty">
          <BookOutlined className="trash-empty-icon" />
          <div>暂无已删除的小说</div>
        </div>
      ) : (
        <Table
          className="trash-table"
          columns={novelColumns}
          dataSource={deletedNovels}
          rowKey="id"
          pagination={{ pageSize: 10 }}
        />
      )
    },
    {
      key: 'chapters',
      label: (
        <span>
          <FileTextOutlined />
          章节回收站
          {deletedChapters.length > 0 && (
            <Tag color="orange" style={{ marginLeft: 8 }}>
              {deletedChapters.length}
            </Tag>
          )}
        </span>
      ),
      children: deletedChapters.length === 0 ? (
        <div className="trash-empty">
          <FileTextOutlined className="trash-empty-icon" />
          <div>暂无已删除的章节</div>
        </div>
      ) : (
        <Table
          className="trash-table"
          columns={chapterColumns}
          dataSource={deletedChapters}
          rowKey="id"
          pagination={{ pageSize: 10 }}
        />
      )
    }
  ]

  return (
    <div className="trash-container">
      <div className="trash-header">
        <h1 className="trash-title">回收站</h1>
        <p className="trash-description">
          已删除的小说和章节会在这里保留 30 天，逾期将自动永久删除
        </p>
      </div>

      <Card className="trash-card">
        <Tabs defaultActiveKey="novels" type="card" className="trash-tabs" items={tabItems} />
      </Card>
    </div>
  )
}

export default Trash
