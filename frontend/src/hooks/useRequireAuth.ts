import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from './useAuth'

/**
 * 鉴权守卫 hook：未登录时自动跳转到登录页。
 * 统一各页面重复的「authLoading 判断 + 未登录 navigate」样板。
 *
 * @param redirectTo 未登录时跳转的路径，默认 /login
 * @returns useAuth 返回值 + isReady（鉴权检查完成且已登录）
 */
export function useRequireAuth(redirectTo = '/login') {
  const auth = useAuth()
  const navigate = useNavigate()
  const { isAuthenticated, isLoading } = auth

  useEffect(() => {
    if (isLoading) {
      return
    }
    if (!isAuthenticated) {
      navigate(redirectTo)
    }
  }, [isAuthenticated, isLoading, navigate, redirectTo])

  return {
    ...auth,
    isReady: !isLoading && isAuthenticated
  }
}
