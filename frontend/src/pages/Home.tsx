import React from 'react'
import { Button, Typography, Space, Row, Col } from 'antd'
import { Link } from 'react-router-dom'
import { useAuth } from '@hooks/useAuth'
import '@styles/Home.css'

const { Title, Paragraph } = Typography

const Home: React.FC = () => {
  const { isAuthenticated } = useAuth()
  
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
          <div className="home-features">
            <div className="feature-item">
              <span className="feature-icon">⚡</span>
              <span className="feature-text">灵感智能体提案</span>
            </div>
            <div className="feature-item">
              <span className="feature-icon">🌊</span>
              <span className="feature-text">写作智能体成文</span>
            </div>
            <div className="feature-item">
              <span className="feature-icon">🎯</span>
              <span className="feature-text">审查智能体质检</span>
            </div>
            <div className="feature-item">
              <span className="feature-icon">🚀</span>
              <span className="feature-text">人工终审定稿</span>
            </div>
          </div>
          <Space size="middle" className="home-actions">
            {isAuthenticated ? (
              <Button type="primary" size="large" className="home-button">
                <Link to="/creation">启动创作</Link>
              </Button>
            ) : (
              <>
                <Button type="primary" size="large" className="home-button">
                  <Link to="/login">接入系统</Link>
                </Button>
                <Button size="large" className="home-button">
                  <Link to="/register">创建身份</Link>
                </Button>
                <Button size="large" className="home-button">
                  <Link to="/creation">探索功能</Link>
                </Button>
              </>
            )}
          </Space>
        </Col>
      </Row>
    </div>
  )
}

export default Home
