import React, { useState } from 'react'
import { Button, Form, Input, Typography, Card, Alert } from 'antd'
import { Link, useNavigate } from 'react-router-dom'
import { userService } from '@services/userService'
import { getApiErrorMessage } from '@utils/index'
import '@styles/Login.css'

const { Title } = Typography

const Register: React.FC = () => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const onFinish = async (values: { username: string; password: string; confirmPassword: string }) => {
    setLoading(true)
    setError('')
    try {
      await userService.register(values.username, values.password, values.confirmPassword)
      navigate('/login')
    } catch (err) {
      setError(getApiErrorMessage(err, '注册失败'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="register-container">
      <Card title={<Title level={2}>用户注册</Title>}>
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
            rules={[
              { required: true, message: '请输入密码' },
              { min: 6, message: '密码长度至少为6位' },
              { max: 20, message: '密码长度最多为20位' }
            ]}
          >
            <Input.Password placeholder="请输入密码" />
          </Form.Item>
          <Form.Item
            label="确认密码"
            name="confirmPassword"
            rules={[{ required: true, message: '请确认密码' }]}
          >
            <Input.Password placeholder="请确认密码" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} style={{ width: '100%' }}>
              注册
            </Button>
          </Form.Item>
          <div className="register-footer">
            已有账号？ <Link to="/login">立即登录</Link>
          </div>
        </Form>
      </Card>
    </div>
  )
}

export default Register
