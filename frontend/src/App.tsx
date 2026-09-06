import { lazy, Suspense } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { App as AntdApp, ConfigProvider } from 'antd'
import zhCN from 'antd/lib/locale/zh_CN'
import Layout from '@components/Layout'
import AdminRoute from '@components/AdminRoute'
import { AIConfigProvider } from '@contexts/AIConfigContext'
import { ThemeProvider, useTheme } from '@contexts/ThemeContext'
import Loading from '@components/Loading'
import AppErrorBoundary from '@components/AppErrorBoundary'

const Home = lazy(() => import('@pages/Home'))
const Login = lazy(() => import('@pages/Login'))
const Register = lazy(() => import('@pages/Register'))
const Creation = lazy(() => import('@pages/Creation'))
const Novel = lazy(() => import('@pages/Novel'))
const CreationWizard = lazy(() => import('@pages/CreationWizard'))
const Setting = lazy(() => import('@pages/Setting'))
const Feedback = lazy(() => import('@pages/Feedback'))
const Creative = lazy(() => import('@pages/Creative'))
const Profile = lazy(() => import('@pages/Profile'))
const Trash = lazy(() => import('@pages/Trash'))
const CreativeList = lazy(() => import('@pages/CreativeList'))
const NovelVersions = lazy(() => import('@pages/NovelVersions'))
const NovelHistory = lazy(() => import('@pages/NovelHistory'))
const Admin = lazy(() => import('@pages/Admin'))
const PromptTemplates = lazy(() => import('@pages/PromptTemplates'))

function AppShell() {
  const { antdTheme } = useTheme()
  return (
    <ConfigProvider locale={zhCN} theme={antdTheme}>
      <AntdApp>
        <AIConfigProvider>
          <Router basename={import.meta.env.BASE_URL}>
            <Layout>
              <AppErrorBoundary>
                <Suspense fallback={<Loading />}>
                  <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />
                  <Route path="/creation" element={<Creation />} />
                  <Route path="/prompt-templates" element={<PromptTemplates />} />
                  <Route path="/novel/:id" element={<Novel />} />
                  <Route path="/novel/:id/guide" element={<CreationWizard />} />
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
                </Suspense>
              </AppErrorBoundary>
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
