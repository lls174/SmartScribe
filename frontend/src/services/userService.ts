import api from './api'
import type { User } from '@app-types/index'

export const userService = {
  // 用户注册
  register: async (username: string, password: string, confirmPassword: string) => {
    const response = await api.post('/user/register', {
      username,
      password,
      confirmPassword
    })
    return response.data
  },

  // 用户登录
  login: async (username: string, password: string): Promise<{ token: string; userId: number; user: User }> => {
    const response = await api.post('/user/login', {
      username,
      password
    })
    return response.data
  },

  // 获取用户信息
  getUserInfo: async (): Promise<User> => {
    const response = await api.get('/user/info')
    return response.data
  },

  // 更新用户信息
  updateUserInfo: async (data: { username: string; email: string }) => {
    const response = await api.put('/user/info', data)
    return response.data
  },

  // 修改密码
  updatePassword: async (data: { currentPassword: string; newPassword: string }) => {
    const response = await api.put('/user/password', data)
    return response.data
  }
}
