﻿import { useState, useEffect, useCallback } from 'react'

export const useAuth = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return !!localStorage.getItem('token')
  })
  const [isLoading, setIsLoading] = useState(true)

  // 检查登录状态
  const checkAuth = useCallback(() => {
    const token = localStorage.getItem('token')
    setIsAuthenticated(!!token)
    setIsLoading(false)
  }, [])

  useEffect(() => {
    checkAuth()
    
    // 监听 storage 变化，实现跨组件状态同步
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'token') {
        checkAuth()
      }
    }
    
    window.addEventListener('storage', handleStorageChange)
    
    // 使用定时器轮询检查 token 变化（同一标签页内）
    const interval = setInterval(() => {
      checkAuth()
    }, 1000)
    
    return () => {
      window.removeEventListener('storage', handleStorageChange)
      clearInterval(interval)
    }
  }, [checkAuth])

  const login = useCallback((token: string) => {
    localStorage.setItem('token', token)
    setIsAuthenticated(true)
    // 触发 storage 事件
    window.dispatchEvent(new Event('storage'))
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('token')
    setIsAuthenticated(false)
    // 触发 storage 事件
    window.dispatchEvent(new Event('storage'))
  }, [])

  return {
    isAuthenticated,
    isLoading,
    login,
    logout,
    user: null // 暂时返回 null，实际应用可以从 token 解析用户信息
  }
}
