import React from 'react'
import { Navigate } from 'react-router-dom'
import { Spin, Result } from 'antd'
import { useAuth } from '@hooks/useAuth'

interface AdminRouteProps {
  children: React.ReactNode
}

const AdminRoute: React.FC<AdminRouteProps> = ({ children }) => {
  const { isAuthenticated, isLoading, user } = useAuth()

  if (isLoading) {
    return (
      <div style={{ minHeight: 320, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spin />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (user?.role !== 'admin') {
    return <Result status="403" title="403" subTitle="当前账号没有管理员权限" />
  }

  return <>{children}</>
}

export default AdminRoute
