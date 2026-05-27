import React, { useEffect, useState } from 'react'
import { Button, Card, Col, Input, message, Modal, Row, Space, Statistic, Table, Tabs, Tag, Typography } from 'antd'
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table'
import { adminService } from '@services/adminService'
import type { AdminUser, AiRequestLog, Feedback, UsageSummary } from '@app-types/index'

const { Title, Text } = Typography

const PAGE_SIZE = 10

const Admin: React.FC = () => {
  const [summary, setSummary] = useState<UsageSummary | null>(null)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([])
  const [logs, setLogs] = useState<AiRequestLog[]>([])
  const [usersTotal, setUsersTotal] = useState(0)
  const [feedbacksTotal, setFeedbacksTotal] = useState(0)
  const [logsTotal, setLogsTotal] = useState(0)
  const [usersPage, setUsersPage] = useState(1)
  const [feedbacksPage, setFeedbacksPage] = useState(1)
  const [logsPage, setLogsPage] = useState(1)
  const [loading, setLoading] = useState(false)

  const loadSummary = async () => {
    const data = await adminService.getUsageSummary()
    setSummary(data)
  }

  const loadUsers = async (page = usersPage) => {
    const data = await adminService.getUsers({ page, limit: PAGE_SIZE })
    setUsers(data.items)
    setUsersTotal(data.total)
    setUsersPage(data.page)
  }

  const loadFeedbacks = async (page = feedbacksPage) => {
    const data = await adminService.getFeedbacks({ page, limit: PAGE_SIZE })
    setFeedbacks(data.items)
    setFeedbacksTotal(data.total)
    setFeedbacksPage(data.page)
  }

  const loadLogs = async (page = logsPage) => {
    const data = await adminService.getAiRequestLogs({ page, limit: PAGE_SIZE })
    setLogs(data.items)
    setLogsTotal(data.total)
    setLogsPage(data.page)
  }

  const refreshAll = async () => {
    setLoading(true)
    try {
      await Promise.all([loadSummary(), loadUsers(1), loadFeedbacks(1), loadLogs(1)])
    } catch (error) {
      message.error('加载管理后台数据失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refreshAll()
  }, [])

  const confirmBanUser = (user: AdminUser) => {
    let reason = ''
    Modal.confirm({
      title: `封禁用户 ${user.username}`,
      content: (
        <Input.TextArea
          rows={3}
          placeholder="请输入封禁原因（可选）"
          onChange={(event) => {
            reason = event.target.value
          }}
        />
      ),
      okText: '确认封禁',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        await adminService.banUser(user.id, reason)
        message.success('用户已封禁')
        await loadUsers()
      }
    })
  }

  const handleUnbanUser = async (user: AdminUser) => {
    await adminService.unbanUser(user.id)
    message.success('用户已解封')
    await loadUsers()
  }

  const userColumns: ColumnsType<AdminUser> = [
    { title: 'ID', dataIndex: 'id', width: 80 },
    { title: '用户名', dataIndex: 'username' },
    { title: '角色', dataIndex: 'role', render: (role) => <Tag color={role === 'admin' ? 'purple' : 'blue'}>{role}</Tag> },
    { title: '状态', dataIndex: 'status', render: (status) => <Tag color={status === 'banned' ? 'red' : 'green'}>{status === 'banned' ? '已封禁' : '正常'}</Tag> },
    { title: '请求数', dataIndex: 'requestCount' },
    { title: '累计 Token', dataIndex: 'totalTokens' },
    { title: '注册时间', dataIndex: 'createdAt', render: (value: string) => new Date(value).toLocaleString() },
    {
      title: '操作',
      render: (_, record) => record.status === 'banned'
        ? <Button size="small" onClick={() => handleUnbanUser(record)}>解封</Button>
        : <Button size="small" danger onClick={() => confirmBanUser(record)} disabled={record.role === 'admin'}>封禁</Button>
    }
  ]

  const feedbackColumns: ColumnsType<Feedback> = [
    { title: 'ID', dataIndex: 'id', width: 80 },
    { title: '用户', render: (_, record) => record.User?.username || `用户 ${record.userId}` },
    { title: '类型', dataIndex: 'type', render: (type) => <Tag>{type}</Tag> },
    { title: '内容', dataIndex: 'content', ellipsis: true },
    { title: '提交时间', dataIndex: 'createdAt', render: (value: string) => new Date(value).toLocaleString() }
  ]

  const logColumns: ColumnsType<AiRequestLog> = [
    { title: 'ID', dataIndex: 'id', width: 80 },
    { title: '用户', render: (_, record) => record.User?.username || `用户 ${record.userId}` },
    { title: '动作', dataIndex: 'action' },
    { title: '平台', dataIndex: 'platform' },
    { title: '模型', dataIndex: 'model' },
    { title: '状态', dataIndex: 'status', render: (status) => <Tag color={status === 'success' ? 'green' : 'red'}>{status === 'success' ? '成功' : '失败'}</Tag> },
    { title: 'Token', dataIndex: 'totalTokens', render: (value: number, record) => `${value}${record.isEstimated ? '（估算）' : ''}` },
    { title: '耗时', dataIndex: 'durationMs', render: (value?: number) => value ? `${value}ms` : '-' },
    { title: '错误', dataIndex: 'errorMessage', ellipsis: true, render: (value?: string | null) => value || '-' },
    { title: '时间', dataIndex: 'createdAt', render: (value: string) => new Date(value).toLocaleString() }
  ]

  const handleUsersPageChange = (pagination: TablePaginationConfig) => {
    loadUsers(pagination.current || 1)
  }

  const handleFeedbacksPageChange = (pagination: TablePaginationConfig) => {
    loadFeedbacks(pagination.current || 1)
  }

  const handleLogsPageChange = (pagination: TablePaginationConfig) => {
    loadLogs(pagination.current || 1)
  }

  return (
    <div style={{ padding: '2rem', maxWidth: 1280, margin: '0 auto' }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <div>
            <Title level={2}>管理后台</Title>
            <Text type="secondary">查看反馈、用户状态、系统用量和 AI 请求日志。</Text>
          </div>
          <Button onClick={refreshAll} loading={loading}>刷新</Button>
        </Space>

        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} md={6}>
            <Card><Statistic title="总请求数" value={summary?.totalRequests || 0} /></Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card><Statistic title="成功请求" value={summary?.successRequests || 0} /></Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card><Statistic title="累计 Token" value={summary?.totalTokens || 0} /></Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card><Statistic title="今日 Token" value={summary?.todayTokens || 0} /></Card>
          </Col>
        </Row>

        <Card>
          <Tabs
            items={[
              {
                key: 'users',
                label: '用户使用情况',
                children: (
                  <Table
                    rowKey="id"
                    columns={userColumns}
                    dataSource={users}
                    loading={loading}
                    pagination={{ current: usersPage, pageSize: PAGE_SIZE, total: usersTotal }}
                    onChange={handleUsersPageChange}
                    scroll={{ x: 900 }}
                  />
                )
              },
              {
                key: 'feedbacks',
                label: '反馈列表',
                children: (
                  <Table
                    rowKey="id"
                    columns={feedbackColumns}
                    dataSource={feedbacks}
                    loading={loading}
                    pagination={{ current: feedbacksPage, pageSize: PAGE_SIZE, total: feedbacksTotal }}
                    onChange={handleFeedbacksPageChange}
                  />
                )
              },
              {
                key: 'logs',
                label: 'AI 请求日志',
                children: (
                  <Table
                    rowKey="id"
                    columns={logColumns}
                    dataSource={logs}
                    loading={loading}
                    pagination={{ current: logsPage, pageSize: PAGE_SIZE, total: logsTotal }}
                    onChange={handleLogsPageChange}
                    scroll={{ x: 1100 }}
                  />
                )
              }
            ]}
          />
        </Card>
      </Space>
    </div>
  )
}

export default Admin
