import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { ConfigProvider, theme } from 'antd'
import zhCN from 'antd/lib/locale/zh_CN'
import Layout from '@components/Layout'
import { AIConfigProvider } from '@contexts/AIConfigContext'
import Home from '@pages/Home'
import Login from '@pages/Login'
import Register from '@pages/Register'
import Creation from '@pages/Creation'
import Novel from '@pages/Novel'
import Setting from '@pages/Setting'
import Feedback from '@pages/Feedback'
import Creative from '@pages/Creative'
import Profile from '@pages/Profile'
import Trash from '@pages/Trash'
import CreativeList from '@pages/CreativeList'

const antdTheme = {
  algorithm: theme.darkAlgorithm,
  token: {
    colorPrimary: '#00d4ff',
    colorSuccess: '#10b981',
    colorWarning: '#f59e0b',
    colorError: '#ef4444',
    colorInfo: '#00d4ff',
    colorBgBase: '#0a0e27',
    colorBgContainer: 'rgba(10, 14, 39, 0.7)',
    colorBgElevated: 'rgba(15, 20, 45, 0.85)',
    colorBgLayout: '#050816',
    colorBorder: 'rgba(59, 130, 246, 0.35)',
    colorBorderSecondary: 'rgba(59, 130, 246, 0.2)',
    colorText: '#e0e7ff',
    colorTextSecondary: '#a5b4fc',
    colorTextTertiary: 'rgba(165, 180, 252, 0.5)',
    colorTextQuaternary: 'rgba(165, 180, 252, 0.3)',
    borderRadius: 8,
    fontFamily: "'Rajdhani', 'Segoe UI', 'Roboto', sans-serif",
    controlHeight: 44,
  },
  components: {
    Input: {
      activeBorderColor: '#00d4ff',
      hoverBorderColor: 'rgba(0, 212, 255, 0.5)',
      activeShadow: '0 0 16px rgba(0, 212, 255, 0.3)',
      colorBgContainer: 'rgba(10, 14, 39, 0.7)',
      colorBorder: 'rgba(59, 130, 246, 0.35)',
      activeBg: 'rgba(10, 14, 39, 0.8)',
    },
    InputNumber: {
      colorBgContainer: 'rgba(10, 14, 39, 0.7)',
      colorBorder: 'rgba(59, 130, 246, 0.35)',
    },
    Card: {
      colorBgContainer: 'rgba(15, 20, 45, 0.85)',
      colorBorderSecondary: 'rgba(59, 130, 246, 0.3)',
    },
    Button: {
      primaryShadow: '0 4px 16px rgba(0, 212, 255, 0.35)',
    },
    Select: {
      colorBgContainer: 'rgba(10, 14, 39, 0.7)',
      colorBorder: 'rgba(59, 130, 246, 0.35)',
      optionActiveBg: 'rgba(0, 212, 255, 0.1)',
      optionSelectedBg: 'rgba(0, 212, 255, 0.15)',
    },
    Modal: {
      contentBg: 'rgba(15, 20, 45, 0.95)',
    },
    Table: {
      headerBg: 'rgba(20, 25, 55, 0.9)',
      rowHoverBg: 'rgba(0, 212, 255, 0.05)',
      borderColor: 'rgba(59, 130, 246, 0.2)',
    },
    Pagination: {
      itemBg: 'transparent',
      itemActiveBg: 'rgba(0, 212, 255, 0.2)',
    },
  },
}

function App() {
  return (
    <ConfigProvider locale={zhCN} theme={antdTheme}>
      <AIConfigProvider>
        <Router basename={import.meta.env.BASE_URL}>
          <Layout>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/creation" element={<Creation />} />
              <Route path="/novel/:id" element={<Novel />} />
              <Route path="/creative" element={<Creative />} />
              <Route path="/setting" element={<Setting />} />
              <Route path="/feedback" element={<Feedback />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/trash" element={<Trash />} />
              <Route path="/creative-list" element={<CreativeList />} />
            </Routes>
          </Layout>
        </Router>
      </AIConfigProvider>
    </ConfigProvider>
  )
}

export default App
