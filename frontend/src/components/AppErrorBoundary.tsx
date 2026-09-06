import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Alert, Button, Space } from 'antd'

interface AppErrorBoundaryProps {
  children: ReactNode
}

interface AppErrorBoundaryState {
  error?: Error
}

/** 捕获页面级渲染异常，避免单个组件报错后整页白屏。 */
export default class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = {}

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('页面渲染失败:', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div style={{ maxWidth: 720, margin: '64px auto', padding: 24 }}>
        <Alert
          type="error"
          showIcon
          message="页面暂时无法显示"
          description={this.state.error.message || '发生未知渲染错误'}
          action={(
            <Space direction="vertical">
              <Button type="primary" onClick={() => this.setState({ error: undefined })}>重试</Button>
              <Button onClick={() => window.location.assign('/')}>返回首页</Button>
            </Space>
          )}
        />
      </div>
    )
  }
}
