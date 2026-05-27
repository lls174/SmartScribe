import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  HomeOutlined,
  EditOutlined,
  MessageOutlined,
  UserOutlined
} from '@ant-design/icons'
const HIDDEN_PATHS = ['/login', '/register']

const NAV_ITEMS = [
  { path: '/', icon: HomeOutlined, label: '首页', match: (p: string) => p === '/' },
  { path: '/creation', icon: EditOutlined, label: '创作', match: (p: string) => p === '/creation' || p.startsWith('/novel') },
  { path: '/feedback', icon: MessageOutlined, label: '反馈', match: (p: string) => p === '/feedback' },
  { path: '/profile', icon: UserOutlined, label: '我的', match: (p: string) =>
    ['/profile', '/setting', '/prompt-templates', '/creative', '/creative-list', '/trash', '/admin'].includes(p)
  }
]

const BottomNav: React.FC = () => {
  const { pathname } = useLocation()

  if (HIDDEN_PATHS.includes(pathname)) {
    return null
  }

  return (
    <nav className="bottom-nav" aria-label="主导航">
      {NAV_ITEMS.map(({ path, icon: Icon, label, match }) => {
        const active = match(pathname)
        return (
          <Link
            key={path}
            to={path}
            className={`bottom-nav-item${active ? ' active' : ''}`}
            aria-current={active ? 'page' : undefined}
          >
            <Icon className="bottom-nav-icon" />
            <span>{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}

export default BottomNav
