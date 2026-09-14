import React, { useRef, useState } from 'react'
import { Button, Modal, Typography, Row, Col } from 'antd'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@hooks/useAuth'
import { useMediaQuery } from '@hooks/useMediaQuery'
import '@styles/Home.css'

const { Title, Paragraph } = Typography

interface HomeFeature {
  key: string
  icon: string
  label: string
  summary: string
  details: string[]
}

const HOME_FEATURES: HomeFeature[] = [
  {
    key: 'inspiration',
    icon: '⚡',
    label: '灵感智能体提案',
    summary: '在创作向导里提出灵感定位、世界观、人物和大纲的候选方案，只有你确认后才会写入作品。',
    details: [
      '覆盖灵感定位、世界观设定、人物卡和整体大纲。',
      '可按你的提示词生成多套候选，也可对单个字段重新提案。',
      '提案只是草稿：采纳、改写或跳过都由你决定。'
    ]
  },
  {
    key: 'writer',
    icon: '🌊',
    label: '写作智能体成文',
    summary: '进入写作台后，按已确认的设定、人物、大纲和前文概括来生成、续写或润色章节。',
    details: [
      '会读取你已经确认的小说记忆，减少人物和世界观跑偏。',
      '支持按本章剧情生成、续写、润色，以及按审查意见返修。',
      '生成结果不会自动覆盖正文，需要你检查后再保存。'
    ]
  },
  {
    key: 'reviewer',
    icon: '🎯',
    label: '审查智能体质检',
    summary: '对照人物卡、大纲和章节概括检查正文，列出可勾选的问题，是否返修由你决定。',
    details: [
      '适合在保存前做一致性检查，例如人设冲突、大纲偏离、前后矛盾。',
      '也可以检查章节概括是否准确，避免后续续写用错前情。',
      '审查失败不会阻止保存，避免卡住你的写作节奏。'
    ]
  },
  {
    key: 'human',
    icon: '🚀',
    label: '人工终审定稿',
    summary: 'AI 只负责提案，最终采用、修改和发布权始终在你手里。',
    details: [
      '向导每一步都可以跳过或返回修改，不强制走完 AI 流程。',
      '写作台里可以继续手改正文、标题和概括，再决定是否保存。',
      '支持版本快照和回收站，改错了还能找回。'
    ]
  }
]

const USAGE_STEPS = [
  {
    title: '注册并登录',
    text: '先创建账号并登录。未登录时无法保存作品，也无法调用各智能体。'
  },
  {
    title: '配置 AI',
    text: '到「设置」选择平台和模型。可填写自己的 API Key；未填写时将使用站点默认密钥（若管理员已配置）。个人中心可查看自己的 token 用量，花费只在管理后台核算。'
  },
  {
    title: '新建小说',
    text: '点击「启动创作」进入作品列表，新建一本书，系统会打开创作向导。'
  },
  {
    title: '走完向导五步',
    text: '按顺序完成灵感 → 世界观 → 人物 → 大纲 → 写作。每步让灵感智能体提案，你审核确认后再进入下一步。'
  },
  {
    title: '在写作台成文',
    text: '向导完成后进入写作台。用写作智能体生成或续写章节，需要时再让审查智能体质检，最后由你保存定稿。'
  },
  {
    title: '随时改设定',
    text: '人物卡和世界观可在写作过程中继续补充。不满意的章节可润色、按审查意见返修，或从回收站恢复。'
  }
]

const Home: React.FC = () => {
  const { isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const canHoverPreview = useMediaQuery('(hover: hover) and (pointer: fine) and (min-width: 769px)')
  const [activeFeature, setActiveFeature] = useState<HomeFeature | null>(null)
  const [featureModal, setFeatureModal] = useState<HomeFeature | null>(null)
  const [guideOpen, setGuideOpen] = useState(false)
  const hideTimerRef = useRef<number>(0)

  /** 桌面移入说明框时，在右侧展示介绍。 */
  const showFeature = (feature: HomeFeature) => {
    if (!canHoverPreview) {
      return
    }
    window.clearTimeout(hideTimerRef.current)
    setActiveFeature(feature)
  }

  /** 桌面移出时稍作延迟再收起，避免卡片之间切换时闪烁。 */
  const hideFeature = () => {
    if (!canHoverPreview) {
      return
    }
    window.clearTimeout(hideTimerRef.current)
    hideTimerRef.current = window.setTimeout(() => {
      setActiveFeature(null)
    }, 140)
  }

  /** 手机端点击后弹出说明，避免悬停和点击互相抢状态。 */
  const openFeatureModal = (feature: HomeFeature) => {
    if (canHoverPreview) {
      return
    }
    setFeatureModal(feature)
  }

  /** 整颗按钮跳转，避免只有文字能点。 */
  const goToCreation = () => {
    navigate('/creation')
  }

  /** 未登录时进入登录页。 */
  const goToLogin = () => {
    navigate('/login')
  }

  return (
    <div className="home-container">
      <div className="home-scanline"></div>
      <div className="home-particles">
        {[...Array(9)].map((_, i) => (
          <div key={i} className="particle"></div>
        ))}
      </div>
      <Row justify="center" align="middle" className="home-hero">
        <Col xs={24} md={16} className="home-content">
          <Title level={1} className="home-title">
            SmartScribe
          </Title>
          <Title level={2} className="home-subtitle">
            AI 引导、人类把关的网文共创伙伴
          </Title>
          <Paragraph className="home-description">
            从灵感、设定、人物到大纲与正文，AI 全程提案，由你审核并决定最终作品。
          </Paragraph>
          <div className="home-feature-board" onMouseLeave={hideFeature}>
            <div className="home-features">
              {HOME_FEATURES.map((feature) => (
                <button
                  key={feature.key}
                  type="button"
                  className={`feature-item${(canHoverPreview ? activeFeature : featureModal)?.key === feature.key ? ' feature-item--active' : ''}`}
                  onMouseEnter={() => showFeature(feature)}
                  onFocus={() => showFeature(feature)}
                  onClick={() => openFeatureModal(feature)}
                >
                  <span className="feature-icon">{feature.icon}</span>
                  <span className="feature-text">{feature.label}</span>
                </button>
              ))}
            </div>
            <aside className={`home-feature-preview${activeFeature ? ' is-open' : ''}`}>
              {activeFeature && (
                <>
                  <div className="home-feature-preview__head">
                    <span className="home-feature-preview__icon">{activeFeature.icon}</span>
                    <strong>{activeFeature.label}</strong>
                  </div>
                  <p className="home-feature-preview__summary">{activeFeature.summary}</p>
                  <ul className="home-feature-preview__list">
                    {activeFeature.details.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </>
              )}
            </aside>
          </div>
          <div className="home-actions">
            {isAuthenticated ? (
              <Button type="primary" size="large" className="home-button" onClick={goToCreation}>
                启动创作
              </Button>
            ) : (
              <Button type="primary" size="large" className="home-button" onClick={goToLogin}>
                接入系统
              </Button>
            )}
            <button type="button" className="home-guide-link" onClick={() => setGuideOpen(true)}>
              使用说明
            </button>
          </div>
        </Col>
      </Row>

      <Modal
        open={Boolean(featureModal)}
        title={featureModal ? `${featureModal.icon} ${featureModal.label}` : ''}
        footer={null}
        onCancel={() => setFeatureModal(null)}
        destroyOnHidden
      >
        {featureModal && (
          <>
            <p className="home-feature-preview__summary">{featureModal.summary}</p>
            <ul className="home-feature-preview__list">
              {featureModal.details.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </>
        )}
      </Modal>

      <Modal
        open={guideOpen}
        title="网站使用说明"
        footer={null}
        onCancel={() => setGuideOpen(false)}
        destroyOnHidden
      >
        <Paragraph className="home-guide-lead">
          本站按「AI 提案、人类终审」来写网文。建议按下面顺序使用，避免一上来就空写正文。
        </Paragraph>
        <ol className="home-guide-list">
          {USAGE_STEPS.map((step, index) => (
            <li key={step.title} className="home-guide-item">
              <span className="home-guide-index">{index + 1}</span>
              <div>
                <strong>{step.title}</strong>
                <p>{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </Modal>

    </div>
  )
}

export default Home
