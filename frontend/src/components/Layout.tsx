import React from 'react'
import { Layout as AntLayout } from 'antd'
import Header from './Header'
import DesktopPet from '@components/DesktopPet'

const { Content, Footer } = AntLayout

interface LayoutProps {
  children: React.ReactNode
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <AntLayout style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      flexDirection: 'column',
      background: 'transparent'
    }}>
      <Header />
      <DesktopPet />
      <Content style={{ 
        background: 'transparent',
        flex: 1
      }}>
        {children}
      </Content>
      <Footer style={{ 
        textAlign: 'center',
        background: 'rgba(26, 31, 58, 0.6)',
        color: 'var(--text-secondary)',
        borderTop: '1px solid rgba(59, 130, 246, 0.2)',
        paddingBottom: 'calc(24px + env(safe-area-inset-bottom))'
      }}>
        SmartScribe 写作助手 ©2026 个人网站
        <br />
        网站为个人学习 / 演示 / 自用
        <br />
{/*         <a href="http://beian.miit.gov.cn" target="_blank" rel="noopener noreferrer">
          京ICP备12345678号
        </a> */}
      </Footer>
    </AntLayout>
  )
}

export default Layout
