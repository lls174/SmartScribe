import React from 'react'
import { Layout as AntLayout } from 'antd'
import { useLocation } from 'react-router-dom'
import Header from './Header'
import BottomNav from './BottomNav'
import MobileTopBar from './MobileTopBar'
import DesktopPet from '@components/DesktopPet'

const { Content, Footer } = AntLayout

interface LayoutProps {
  children: React.ReactNode
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { pathname } = useLocation()
  const isNovelEditor = /^\/novel\/[^/]+$/.test(pathname)

  return (
    <AntLayout
      className="app-layout"
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'transparent'
      }}
    >
      <Header />
      <MobileTopBar />
      <DesktopPet />
      <Content
        className={`app-main-content${isNovelEditor ? ' app-main-content--novel-editor' : ''}`}
        style={{
          background: 'transparent',
          flex: 1
        }}
      >
        {children}
      </Content>
      <Footer
        className="app-footer"
        style={{
          textAlign: 'center',
          background: 'rgba(26, 31, 58, 0.6)',
          color: 'var(--text-secondary)',
          borderTop: '1px solid rgba(59, 130, 246, 0.2)',
          paddingBottom: 'calc(24px + env(safe-area-inset-bottom))'
        }}
      >
        SmartScribe 写作助手 ©2026 个人网站
        <br />
        网站为个人学习 / 演示 / 自用
      </Footer>
      <BottomNav />
    </AntLayout>
  )
}

export default Layout
