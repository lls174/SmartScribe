import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { App as AntdApp, ConfigProvider } from 'antd'
import zhCN from 'antd/lib/locale/zh_CN'
import Layout from '@components/Layout'
import AdminRoute from '@components/AdminRoute'
import { AIConfigProvider } from '@contexts/AIConfigContext'
import { ThemeProvider, useTheme } from '@contexts/ThemeContext'
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
import NovelVersions from '@pages/NovelVersions'
import NovelHistory from '@pages/NovelHistory'
import Admin from '@pages/Admin'
import PromptTemplates from '@pages/PromptTemplates'

function AppShell() {
  const { antdTheme } = useTheme()
  return (
    <ConfigProvider locale={zhCN} theme={antdTheme}>
      <AntdApp>
        <AIConfigProvider>
          <Router basename={import.meta.env.BASE_URL}>
            <Layout>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/creation" element={<Creation />} />
                <Route path="/prompt-templates" element={<PromptTemplates />} />
                <Route path="/novel/:id" element={<Novel />} />
                <Route path="/creative" element={<Creative />} />
                <Route path="/setting" element={<Setting />} />
                <Route path="/feedback" element={<Feedback />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/trash" element={<Trash />} />
                <Route path="/creative-list" element={<CreativeList />} />
                <Route path="/novel/:id/versions" element={<NovelVersions />} />
                <Route path="/novel/:id/history" element={<NovelHistory />} />
                <Route path="/admin" element={<AdminRoute><Admin /></AdminRoute>} />
              </Routes>
            </Layout>
          </Router>
        </AIConfigProvider>
      </AntdApp>
    </ConfigProvider>
  )
}

function App() {
  return (
    <ThemeProvider>
      <AppShell />
    </ThemeProvider>
  )
}

export default App
