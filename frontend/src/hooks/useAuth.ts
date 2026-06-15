import { useState, useEffect, useCallback } from 'react'
import { isAxiosError } from 'axios'
import { userService } from '@services/userService'
import type { User } from '@app-types/index'

const AUTH_USER_KEY = 'authUser'

const isAuthFailure = (error: unknown): boolean => {
  if (!isAxiosError(error)) {
    return false
  }
  const status = error.response?.status
  return status === 401 || status === 403
}

const getStoredUser = (): User | null => {
  const raw = localStorage.getItem(AUTH_USER_KEY)
  if (!raw) {
    return null
  }

  try {
    return JSON.parse(raw) as User
  } catch {
    localStorage.removeItem(AUTH_USER_KEY)
    return null
  }
}

export const useAuth = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return !!localStorage.getItem('token')
  })
  const [isLoading, setIsLoading] = useState(true)
  const [user, setUser] = useState<User | null>(() => getStoredUser())

  // 检查登录状态
  const checkAuth = useCallback(() => {
    const token = localStorage.getItem('token')
    setIsAuthenticated(!!token)
    setUser(token ? getStoredUser() : null)
    setIsLoading(false)
  }, [])

  const refreshUser = useCallback(async () => {
    const token = localStorage.getItem('token')
    if (!token) {
      setUser(null)
      return null
    }

    const currentUser = await userService.getUserInfo()
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(currentUser))
    setUser(currentUser)
    return currentUser
  }, [])

  useEffect(() => {
    checkAuth()

    if (localStorage.getItem('token')) {
      refreshUser().catch((error) => {
        if (!isAuthFailure(error)) {
          return
        }
        localStorage.removeItem('token')
        localStorage.removeItem(AUTH_USER_KEY)
        setIsAuthenticated(false)
        setUser(null)
      })
    }
    
    // 监听 storage 变化，实现跨组件状态同步
    const handleAuthChange = () => {
      checkAuth()
    }
    
    window.addEventListener('storage', handleAuthChange)
    window.addEventListener('auth-change', handleAuthChange)
    
    return () => {
      window.removeEventListener('storage', handleAuthChange)
      window.removeEventListener('auth-change', handleAuthChange)
    }
  }, [checkAuth, refreshUser])

  const login = useCallback(async (token: string, nextUser?: User) => {
    localStorage.setItem('token', token)
    setIsAuthenticated(true)
    if (nextUser) {
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(nextUser))
      setUser(nextUser)
    } else {
      await refreshUser()
    }
    window.dispatchEvent(new Event('auth-change'))
  }, [refreshUser])

  const updateCurrentUser = useCallback((nextUser: User) => {
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(nextUser))
    setUser(nextUser)
    window.dispatchEvent(new Event('auth-change'))
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('token')
    localStorage.removeItem(AUTH_USER_KEY)
    setIsAuthenticated(false)
    setUser(null)
    window.dispatchEvent(new Event('auth-change'))
  }, [])

  return {
    isAuthenticated,
    isLoading,
    login,
    logout,
    refreshUser,
    updateCurrentUser,
    user
  }
}
