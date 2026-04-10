import React from 'react'
import { Layout, Menu, Button, Space, Dropdown } from 'antd'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@hooks/useAuth'
import { UserOutlined, LogoutOutlined, DeleteOutlined } from '@ant-design/icons'

const { Header: AntHeader } = Layout

const Header: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { isAuthenticated, logout } = useAuth()

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  const menuItems = [
    {
      key: '/',
      label: <Link to="/">首页</Link>
    },
    {
      key: '/creation',
      label: <Link to="/creation">创作</Link>
    },
    {
      key: '/creative',
      label: <Link to="/creative">创意生成</Link>
    },
    {
      key: '/setting',
      label: <Link to="/setting">AI 设置</Link>
    },
    {
      key: '/feedback',
      label: <Link to="/feedback">反馈</Link>
    }
  ]

  const userMenuItems = [
    { 
      key: 'creative-list',
      label: <Link to="/creative-list">创意管理</Link>
    },
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: <Link to="/profile">个人中心</Link>
    },
    {
      key: 'trash',
      icon: <DeleteOutlined />,
      label: <Link to="/trash">回收站</Link>
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: handleLogout
    }
  ]

  return (
    <AntHeader className="sci-fi-header">
      <div className="header-content">
        <div className="header-logo">
          SmartScribe
        </div>
        <Menu
          mode="horizontal"
          selectedKeys={[location.pathname]}
          items={menuItems}
          className="header-menu"
        />
        <Space>
          {isAuthenticated ? (
            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
              <Button
                icon={<UserOutlined />}
                className="header-user-btn"
              >
                个人中心
              </Button>
            </Dropdown>
          ) : (
            <>
              <Button
                type="primary"
                className="header-login-btn"
              >
                <Link to="/login">登录</Link>
              </Button>
              <Button className="header-register-btn">
                <Link to="/register">注册</Link>
              </Button>
            </>
          )}
        </Space>
      </div>
      <style>{`
        .sci-fi-header {
          background: rgba(26, 31, 58, 0.8) !important;
          backdrop-filter: blur(10px);
          border-bottom: 1px solid rgba(59, 130, 246, 0.3);
          padding: 0;
          height: 64px;
          line-height: 64px;
          position: sticky;
          top: 0;
          z-index: 1000;
        }

        .header-content {
          display: flex;
          justify-content: space-between;
          align-items: center;
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 24px;
          width: 100%;
        }

        .header-logo {
          font-size: 1.5rem;
          font-weight: bold;
          background: linear-gradient(135deg, #00d4ff, #7c3aed);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          letter-spacing: 0.05em;
        }

        .header-menu {
          flex: 1;
          justify-content: center;
          background: transparent !important;
          border-bottom: none !important;
        }

        .header-menu .ant-menu-item {
          color: #a5b4fc !important;
          font-weight: 500;
          letter-spacing: 0.05em;
          border-bottom: 2px solid transparent !important;
          transition: all 0.3s ease;
        }

        .header-menu .ant-menu-item:hover {
          color: #00d4ff !important;
        }

        .header-menu .ant-menu-item-selected {
          color: #00d4ff !important;
          background: transparent !important;
          border-bottom: 2px solid #00d4ff !important;
        }

        .header-menu .ant-menu-item::after {
          display: none !important;
        }

        .header-user-btn,
        .header-register-btn {
          background: rgba(26, 31, 58, 0.6) !important;
          border: 1px solid rgba(59, 130, 246, 0.3) !important;
          color: #e0e7ff !important;
        }

        .header-user-btn:hover,
        .header-register-btn:hover {
          background: rgba(37, 43, 72, 0.8) !important;
          border-color: rgba(0, 212, 255, 0.5) !important;
          color: #00d4ff !important;
        }

        .header-login-btn {
          background: linear-gradient(135deg, #00d4ff, #7c3aed) !important;
          border: none !important;
        }

        .header-login-btn:hover {
          opacity: 0.9;
        }

        .ant-dropdown-menu {
          background: rgba(26, 31, 58, 0.95) !important;
          border: 1px solid rgba(59, 130, 246, 0.3) !important;
          backdrop-filter: blur(10px);
        }

        .ant-dropdown-menu-item {
          color: #a5b4fc !important;
        }

        .ant-dropdown-menu-item:hover {
          background: rgba(0, 212, 255, 0.1) !important;
          color: #00d4ff !important;
        }
      `}</style>
    </AntHeader>
  )
}

export default Header
