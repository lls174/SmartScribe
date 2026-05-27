import React from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { SettingOutlined, ArrowLeftOutlined } from '@ant-design/icons'
import { useAuth } from '@hooks/useAuth'

type PageMeta = {
  title: string
  subtitle?: string
  showBack?: boolean
  backTo?: string
  hideSettings?: boolean
}

const HIDDEN_PATHS = ['/login', '/register']

const STATIC_META: Record<string, PageMeta> = {
  '/': { title: 'SmartScribe' },
  '/creation': { title: '小说管理', subtitle: '管理你的全部作品' },
  '/setting': { title: 'AI 配置', subtitle: '平台、模型与密钥', hideSettings: true },
  '/feedback': { title: '意见反馈', subtitle: '帮助我们改进产品' },
  '/profile': { title: '个人中心', subtitle: '账号与偏好设置' },
  '/creative': { title: '创意工坊', subtitle: '灵感与设定生成' },
  '/creative-list': { title: '创意管理', subtitle: '查看历史创意' },
  '/prompt-templates': { title: '模板库', subtitle: '提示词模板管理' },
  '/trash': { title: '回收站', subtitle: '已删除的小说' },
  '/admin': { title: '管理后台', subtitle: '系统数据与监控' }
}

function resolvePageMeta(pathname: string): PageMeta | null {
  if (HIDDEN_PATHS.includes(pathname)) return null
  if (/^\/novel\/[^/]+$/.test(pathname)) return null

  const versionMatch = pathname.match(/^\/novel\/([^/]+)\/versions$/)
  if (versionMatch) {
    return { title: '版本管理', subtitle: '章节版本对比与恢复', showBack: true, backTo: `/novel/${versionMatch[1]}` }
  }

  const historyMatch = pathname.match(/^\/novel\/([^/]+)\/history$/)
  if (historyMatch) {
    return { title: '生成历史', subtitle: 'AI 生成记录回溯', showBack: true, backTo: `/novel/${historyMatch[1]}` }
  }

  return STATIC_META[pathname] ?? { title: 'SmartScribe', subtitle: '智能写作助手' }
}

const MobileTopBar: React.FC = () => {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { isAuthenticated, user } = useAuth()
  const meta = resolvePageMeta(pathname)

  if (!meta) return null

  return (
    <header className="mobile-top-bar">
      <div className="mobile-top-bar-inner">
        <div className="mobile-top-bar-left">
          {meta.showBack ? (
            <button
              type="button"
              className="mobile-top-bar-back"
              onClick={() => navigate(meta.backTo || '/creation')}
              aria-label="返回"
            >
              <ArrowLeftOutlined />
            </button>
          ) : (
            <Link to="/" className="mobile-top-bar-logo">
              SS
            </Link>
          )}
          <div className="mobile-top-bar-titles">
            <h1 className="mobile-top-bar-title">{meta.title}</h1>
            {meta.subtitle && (
              <p className="mobile-top-bar-subtitle">{meta.subtitle}</p>
            )}
          </div>
        </div>

        <div className="mobile-top-bar-right">
          {isAuthenticated && user && (
            <span className="mobile-top-bar-avatar" title={user.username}>
              {(user.username || 'U').charAt(0).toUpperCase()}
            </span>
          )}
          {!meta.hideSettings && pathname !== '/setting' && (
            <Link to="/setting" className="mobile-top-bar-action" aria-label="AI 设置">
              <SettingOutlined />
            </Link>
          )}
        </div>
      </div>
      <div className="mobile-top-bar-glow" aria-hidden />
    </header>
  )
}

export default MobileTopBar
