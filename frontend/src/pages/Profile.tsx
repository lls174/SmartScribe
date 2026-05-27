import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Card, Form, Input, Button, message, Tabs, Row, Col, Divider } from 'antd'
import {
  UserOutlined,
  LockOutlined,
  MailOutlined,
  BookOutlined,
  SettingOutlined,
  CommentOutlined,
  BulbOutlined,
  DeleteOutlined,
  SafetyCertificateOutlined
} from '@ant-design/icons'
import { userService } from '@services/userService'
import { useAuth } from '@hooks/useAuth'
import Loading from '@components/Loading'
import '@styles/Profile.css'

interface UserInfo {
  id: number
  username: string
  email?: string | null
  createdAt: string
}

const Profile: React.FC = () => {
  const navigate = useNavigate()
  const { isAuthenticated, isLoading, user, logout } = useAuth()
  const [loading, setLoading] = useState(false)
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
  const [infoForm] = Form.useForm()
  const [passwordForm] = Form.useForm()

  useEffect(() => {
    if (isLoading) return
    
    if (!isAuthenticated) {
      navigate('/login')
      return
    }
    fetchUserInfo()
  }, [isAuthenticated, isLoading, navigate])

  const fetchUserInfo = async () => {
    try {
      setLoading(true)
      const data = await userService.getUserInfo()
      setUserInfo(data)
      infoForm.setFieldsValue({
        username: data.username,
        email: data.email
      })
    } catch (error) {
      console.error('获取用户信息失败:', error)
      message.error('获取用户信息失败')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateInfo = async (values: { username: string; email: string }) => {
    try {
      setLoading(true)
      await userService.updateUserInfo(values)
      message.success('个人信息更新成功')
      fetchUserInfo()
    } catch (error) {
      console.error('更新个人信息失败:', error)
      message.error('更新个人信息失败')
    } finally {
      setLoading(false)
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
      setLoading(true)
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
      setLoading(false)
    }
  }

  if (isLoading || (loading && !userInfo)) {
    return <Loading />
  }

  const tabItems = [
    {
      key: 'info',
      label: (
        <span>
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
                loading={loading}
                block
              >
                保存修改
              </Button>
            </Form.Item>
          </Form>

          {userInfo && (
            <>
              <Divider className="profile-divider" />
              <div className="profile-info">
                <p>用户ID: {userInfo.id}</p>
                <p>注册时间: {new Date(userInfo.createdAt).toLocaleString()}</p>
              </div>
            </>
          )}
        </>
      )
    },
    {
      key: 'password',
      label: (
        <span>
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
              loading={loading}
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
            <Tabs defaultActiveKey="info" type="card" className="profile-tabs" items={tabItems} />
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default Profile
