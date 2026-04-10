import React, { useState } from 'react'
import { Button, Form, Input, Typography, Card, Row, Col, Alert } from 'antd'
import { Link, useNavigate } from 'react-router-dom'
import { userService } from '@services/userService'
import { useAuth } from '@hooks/useAuth'
import '@styles/Login.css'

const { Title } = Typography

const Login: React.FC = () => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const { login } = useAuth()

  const onFinish = async (values: { username: string; password: string }) => {
    setLoading(true)
    setError('')
    try {
      const response = await userService.login(values.username, values.password)
      login(response.token)
      navigate('/creation')
    } catch (err: any) {
      setError(err.response?.data?.message || '登录失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-container">
      <Card title={<Title level={2}>用户登录</Title>}>
        {error && <Alert message={error} type="error" style={{ marginBottom: 16 }} />}
        <Form onFinish={onFinish} layout="vertical">
          <Form.Item
            label="用户名"
            name="username"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input placeholder="请输入用户名" />
          </Form.Item>
          <Form.Item
            label="密码"
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password placeholder="请输入密码" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} style={{ width: '100%' }}>
              登录
            </Button>
          </Form.Item>
          <div className="login-footer">
            还没有账号？ <Link to="/register">立即注册</Link>
          </div>
        </Form>
      </Card>
    </div>
  )
}

export default Login
