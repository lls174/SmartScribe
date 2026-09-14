import React, { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Card, Form, Input, Button, message, Tabs, Row, Col, Divider, Spin, Statistic, Table, Typography } from 'antd'
import {
  UserOutlined,
  LockOutlined,
  MailOutlined,
  BookOutlined,
  SettingOutlined,
  CommentOutlined,
  BulbOutlined,
  DeleteOutlined,
  SafetyCertificateOutlined,
  BarChartOutlined
} from '@ant-design/icons'
import { userService } from '@services/userService'
import { useAuth } from '@hooks/useAuth'
import type { UserUsageLog, UserUsageSummary } from '@app-types/index'
import '@styles/Profile.css'

/** 从地址栏读取当前 Tab，只接受个人信息 / 用量 / 密码 */
const resolveProfileTab = (tab: string | null) => {
  if (tab === 'usage' || tab === 'password') return tab
  return 'info'
}

const Profile: React.FC = () => {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { isAuthenticated, isLoading, user, logout, updateCurrentUser } = useAuth()
  const activeTab = resolveProfileTab(searchParams.get('tab'))
  const [saving, setSaving] = useState(false)
  const [infoForm] = Form.useForm()
  const [passwordForm] = Form.useForm()
  const [usageSummary, setUsageSummary] = useState<UserUsageSummary | null>(null)
  const [usageLogs, setUsageLogs] = useState<UserUsageLog[]>([])
  const [usageLoading, setUsageLoading] = useState(false)

  useEffect(() => {
    if (isLoading) return
    if (!isAuthenticated) {
      navigate('/login')
    }
  }, [isAuthenticated, isLoading, navigate])

  /** 个人信息用本地缓存立刻填表，不挡整页。 */
  useEffect(() => {
    if (!user) return
    infoForm.setFieldsValue({
      username: user.username,
      email: user.email || ''
    })
  }, [user, infoForm])

  /** 点开 AI 用量后再拉接口。 */
  useEffect(() => {
    if (!isAuthenticated || activeTab !== 'usage') return
    let cancelled = false
    const loadUsage = async () => {
      setUsageLoading(true)
      try {
        const [summary, logs] = await Promise.all([
          userService.getUsageSummary(),
          userService.getUsageLogs({ page: 1, limit: 8 })
        ])
        if (cancelled) return
        setUsageSummary(summary)
        setUsageLogs(logs.items)
      } catch {
        if (!cancelled) {
          message.error('获取用量失败')
        }
      } finally {
        if (!cancelled) {
          setUsageLoading(false)
        }
      }
    }
    void loadUsage()
    return () => {
      cancelled = true
    }
  }, [activeTab, isAuthenticated])

  const handleUpdateInfo = async (values: { username: string; email: string }) => {
    try {
      setSaving(true)
      await userService.updateUserInfo(values)
      if (user) {
        updateCurrentUser({ ...user, username: values.username, email: values.email })
      }
      message.success('个人信息更新成功')
    } catch (error) {
      console.error('更新个人信息失败:', error)
      message.error('更新个人信息失败')
    } finally {
      setSaving(false)
    }
  }

  const handleUpdatePassword = async (values: {
    currentPassword: string
    newPassword: string
    confirmPassword: string
  }) => {
    if (values.newPassword !== values.confirmPassword) {
      message.error('两次输入的新密码不一致')
      return
    }

    try {
      setSaving(true)
      await userService.updatePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword
      })
      message.success('密码修改成功')
      passwordForm.resetFields()
    } catch (error) {
      console.error('修改密码失败:', error)
      message.error('修改密码失败，请检查当前密码是否正确')
    } finally {
      setSaving(false)
    }
  }

  if (!isAuthenticated) {
    return null
  }

  const tabItems = [
    {
      key: 'info',
      label: (
        <span className="profile-tabs__label">
          <UserOutlined />
          个人信息
        </span>
      ),
      children: (
        <>
          <Form
            form={infoForm}
            layout="vertical"
            onFinish={handleUpdateInfo}
            className="profile-form"
          >
            <Form.Item
              label="用户名"
              name="username"
              rules={[
                { required: true, message: '请输入用户名' },
                { min: 3, message: '用户名至少3个字符' },
                { max: 20, message: '用户名最多20个字符' }
              ]}
            >
              <Input
                prefix={<UserOutlined />}
                placeholder="请输入用户名"
              />
            </Form.Item>

            <Form.Item
              label="邮箱"
              name="email"
              rules={[
                { required: true, message: '请输入邮箱' },
                { type: 'email', message: '请输入有效的邮箱地址' }
              ]}
            >
              <Input
                prefix={<MailOutlined />}
                placeholder="请输入邮箱"
              />
            </Form.Item>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                size="large"
                loading={saving}
                block
              >
                保存修改
              </Button>
            </Form.Item>
          </Form>

          {user && (
            <>
              <Divider className="profile-divider" />
              <div className="profile-info">
                <p>用户ID: {user.id}</p>
                <p>注册时间: {new Date(user.createdAt).toLocaleString()}</p>
              </div>
            </>
          )}
        </>
      )
    },
    {
      key: 'usage',
      label: (
        <span className="profile-tabs__label">
          <BarChartOutlined />
          AI 用量
        </span>
      ),
      children: (
        <div className="profile-usage">
          <Typography.Paragraph type="secondary" className="profile-usage-lead">
            这里只统计你账号下的 token。自备 Key 与平台代付都只显示用量，不展示金额。
          </Typography.Paragraph>
          <Spin spinning={usageLoading}>
            <div className="profile-usage-body">
              <Row gutter={[16, 16]} className="profile-usage-stats">
                <Col xs={24} sm={8}>
                  <Card className="profile-usage-card"><Statistic title="今日 Token" value={usageSummary?.today.totalTokens || 0} /></Card>
                </Col>
                <Col xs={24} sm={8}>
                  <Card className="profile-usage-card"><Statistic title="本月 Token" value={usageSummary?.month.totalTokens || 0} /></Card>
                </Col>
                <Col xs={24} sm={8}>
                  <Card className="profile-usage-card"><Statistic title="累计 Token" value={usageSummary?.total.totalTokens || 0} /></Card>
                </Col>
              </Row>
              <Typography.Paragraph className="profile-usage-detail">
                今日输入 {usageSummary?.today.promptTokens || 0}（缓存命中 {usageSummary?.today.cachedPromptTokens || 0}），输出 {usageSummary?.today.completionTokens || 0}。
                官方计数 {usageSummary?.officialCount || 0} 次，估算 {usageSummary?.estimatedCount || 0} 次。
              </Typography.Paragraph>
              <Table
                className="profile-usage-table"
                rowKey={(row) => `${row.platform}-${row.model}`}
                size="small"
                pagination={false}
                scroll={{ x: 560 }}
                dataSource={usageSummary?.breakdown || []}
                columns={[
                  { title: '平台', dataIndex: 'platform', width: 88 },
                  { title: '模型', dataIndex: 'model', ellipsis: true },
                  { title: '请求', dataIndex: 'requestCount', width: 64 },
                  { title: '输入', dataIndex: 'promptTokens', width: 72 },
                  { title: '缓存', dataIndex: 'cachedPromptTokens', width: 72 },
                  { title: '输出', dataIndex: 'completionTokens', width: 72 },
                  { title: '合计', dataIndex: 'totalTokens', width: 80 }
                ]}
              />
              <Table
                className="profile-usage-table"
                rowKey="id"
                size="small"
                pagination={false}
                scroll={{ x: 640 }}
                dataSource={usageLogs}
                columns={[
                  { title: '动作', dataIndex: 'action', width: 88, ellipsis: true },
                  { title: '平台', dataIndex: 'platform', width: 88 },
                  { title: '模型', dataIndex: 'model', ellipsis: true },
                  { title: 'Token', dataIndex: 'totalTokens', width: 100, render: (value: number, record: UserUsageLog) => `${value}${record.isEstimated ? '（估算）' : ''}` },
                  { title: '密钥', dataIndex: 'keySource', width: 88, render: (value?: string | null) => value === 'user' ? '自备 Key' : '平台代付' },
                  { title: '时间', dataIndex: 'createdAt', width: 168, render: (value: string) => new Date(value).toLocaleString() }
                ]}
              />
            </div>
          </Spin>
        </div>
      )
    },
    {
      key: 'password',
      label: (
        <span className="profile-tabs__label">
          <LockOutlined />
          修改密码
        </span>
      ),
      children: (
        <Form
          form={passwordForm}
          layout="vertical"
          onFinish={handleUpdatePassword}
          className="profile-form"
        >
          <Form.Item
            label="当前密码"
            name="currentPassword"
            rules={[
              { required: true, message: '请输入当前密码' }
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="请输入当前密码"
            />
          </Form.Item>

          <Form.Item
            label="新密码"
            name="newPassword"
            rules={[
              { required: true, message: '请输入新密码' },
              { min: 6, message: '密码至少6个字符' },
              { max: 20, message: '密码最多20个字符' }
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="请输入新密码"
            />
          </Form.Item>

          <Form.Item
            label="确认新密码"
            name="confirmPassword"
            rules={[
              { required: true, message: '请确认新密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('newPassword') === value) {
                    return Promise.resolve()
                  }
                  return Promise.reject(new Error('两次输入的密码不一致'))
                }
              })
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="请确认新密码"
            />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              size="large"
              loading={saving}
              block
            >
              修改密码
            </Button>
          </Form.Item>
        </Form>
      )
    }
  ]

  return (
    <div className="profile-container">
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <h1 className="profile-title page-title--hide-mobile">个人中心</h1>
        </Col>
      </Row>

      <div className="profile-shortcuts">
        <Link to="/creation" className="profile-shortcut-item">
          <BookOutlined className="profile-shortcut-icon" />
          <span className="profile-shortcut-label">我的小说</span>
        </Link>
        <Link to="/setting" className="profile-shortcut-item">
          <SettingOutlined className="profile-shortcut-icon" />
          <span className="profile-shortcut-label">AI 设置</span>
        </Link>
        <Link to="/profile?tab=usage" className="profile-shortcut-item">
          <BarChartOutlined className="profile-shortcut-icon" />
          <span className="profile-shortcut-label">AI 用量</span>
        </Link>
        <Link to="/prompt-templates" className="profile-shortcut-item">
          <BulbOutlined className="profile-shortcut-icon" />
          <span className="profile-shortcut-label">模板库</span>
        </Link>
        <Link to="/creative" className="profile-shortcut-item">
          <BulbOutlined className="profile-shortcut-icon" />
          <span className="profile-shortcut-label">创意生成</span>
        </Link>
        <Link to="/creative-list" className="profile-shortcut-item">
          <BulbOutlined className="profile-shortcut-icon" />
          <span className="profile-shortcut-label">创意管理</span>
        </Link>
        <Link to="/feedback" className="profile-shortcut-item">
          <CommentOutlined className="profile-shortcut-icon" />
          <span className="profile-shortcut-label">意见反馈</span>
        </Link>
        <Link to="/trash" className="profile-shortcut-item">
          <DeleteOutlined className="profile-shortcut-icon" />
          <span className="profile-shortcut-label">回收站</span>
        </Link>
        {user?.role === 'admin' && (
          <Link to="/admin" className="profile-shortcut-item">
            <SafetyCertificateOutlined className="profile-shortcut-icon" />
            <span className="profile-shortcut-label">管理后台</span>
          </Link>
        )}
        <button
          type="button"
          className="profile-shortcut-item profile-shortcut-item--danger"
          onClick={() => {
            logout()
            navigate('/login')
          }}
        >
          <UserOutlined className="profile-shortcut-icon" />
          <span className="profile-shortcut-label">退出登录</span>
        </button>
      </div>

      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Card className="profile-card">
            <Tabs
              activeKey={activeTab}
              onChange={(key) => {
                if (key === 'info') {
                  setSearchParams({}, { replace: true })
                  return
                }
                setSearchParams({ tab: key }, { replace: true })
              }}
              className="profile-tabs"
              items={tabItems}
            />
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default Profile
