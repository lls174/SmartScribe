import React, { useState } from 'react'
import { Layout, Menu, Button, Space, Dropdown, Drawer } from 'antd'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@hooks/useAuth'
import { UserOutlined, LogoutOutlined, DeleteOutlined, MenuOutlined } from '@ant-design/icons'

const { Header: AntHeader } = Layout

const Header: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { isAuthenticated, logout } = useAuth()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

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
        
        {/* 桌面端菜单 */}
        <Menu
          mode="horizontal"
          selectedKeys={[location.pathname]}
          items={menuItems}
          className="header-menu"
        />
        
        {/* 移动端菜单按钮 */}
        <div className="mobile-menu-btn">
          <Button
            icon={<MenuOutlined />}
            onClick={() => setMobileMenuOpen(true)}
            className="mobile-menu-toggle"
          />
        </div>
        
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
      
      {/* 移动端侧边菜单 */}
      <Drawer
        title={<div className="drawer-logo">SmartScribe</div>}
        placement="right"
        onClose={() => setMobileMenuOpen(false)}
        open={mobileMenuOpen}
        width={280}
        className="mobile-drawer"
      >
        <Menu
          mode="vertical"
          selectedKeys={[location.pathname]}
          items={menuItems}
          className="mobile-drawer-menu"
          onClick={() => setMobileMenuOpen(false)}
        />
        {isAuthenticated && (
          <div className="mobile-drawer-divider"></div>
        )}
        {isAuthenticated && (
          <Menu
            mode="vertical"
            items={userMenuItems}
            className="mobile-drawer-menu"
            onClick={(e) => {
              if (e.key !== 'logout') {
                setMobileMenuOpen(false)
              }
            }}
          />
        )}
      </Drawer>
      
      <style>{`
        .sci-fi-header {
          background: rgba(26, 31, 58, 0.8) !important;
          backdrop-filter: blur(10px);
          border-bottom: 1px solid rgba(59, 130, 246, 0.3);
          padding: 0;
          padding-top: env(safe-area-inset-top);
          height: calc(64px + env(safe-area-inset-top));
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

        /* 移动端菜单按钮 */
        .mobile-menu-btn {
          display: none;
        }

        .mobile-menu-toggle {
          background: rgba(26, 31, 58, 0.6) !important;
          border: 1px solid rgba(59, 130, 246, 0.3) !important;
          color: #e0e7ff !important;
        }

        .mobile-menu-toggle:hover {
          background: rgba(37, 43, 72, 0.8) !important;
          border-color: rgba(0, 212, 255, 0.5) !important;
          color: #00d4ff !important;
        }

        /* 移动端侧边菜单 */
        .mobile-drawer {
          background: rgba(10, 14, 39, 0.95) !important;
          backdrop-filter: blur(10px);
          border-left: 1px solid rgba(59, 130, 246, 0.3);
        }

        .drawer-logo {
          font-size: 1.2rem;
          font-weight: bold;
          background: linear-gradient(135deg, #00d4ff, #7c3aed);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          letter-spacing: 0.05em;
        }

        .mobile-drawer-menu {
          background: transparent !important;
          border: none !important;
        }

        .mobile-drawer-menu .ant-menu-item {
          color: #a5b4fc !important;
          margin: 8px 0;
          border-radius: 6px;
        }

        .mobile-drawer-menu .ant-menu-item:hover {
          color: #00d4ff !important;
          background: rgba(0, 212, 255, 0.1) !important;
        }

        .mobile-drawer-menu .ant-menu-item-selected {
          color: #00d4ff !important;
          background: rgba(0, 212, 255, 0.15) !important;
        }

        .mobile-drawer-divider {
          height: 1px;
          background: rgba(59, 130, 246, 0.2);
          margin: 16px 0;
        }

        /* 响应式布局 */
        @media (max-width: 768px) {
          .sci-fi-header {
            height: calc(56px + env(safe-area-inset-top));
            line-height: 56px;
          }

          .header-content {
            padding: 0 16px;
          }

          .header-logo {
            font-size: 1.2rem;
          }

          .header-menu {
            display: none;
          }

          .mobile-menu-btn {
            display: block;
          }

          .header-login-btn,
          .header-register-btn,
          .header-user-btn {
            font-size: 12px;
            padding: 4px 12px;
          }
        }

        @media (max-width: 480px) {
          .header-content {
            padding: 0 12px;
          }

          .header-logo {
            font-size: 1.1rem;
          }

          .header-login-btn,
          .header-register-btn,
          .header-user-btn {
            font-size: 11px;
            padding: 4px 8px;
          }
        }
      `}</style>
    </AntHeader>
  )
}

export default Header
