import api from './api'
import type { AdminUser, AiRequestLog, Feedback, PaginatedResponse, UsageSummary } from '@app-types/index'

interface ListParams {
  page?: number
  limit?: number
  userId?: number
  platform?: string
  model?: string
  status?: string
}

export const adminService = {
  getUsageSummary: async (): Promise<UsageSummary> => {
    const response = await api.get('/admin/usage/summary')
    return response.data
  },

  getUsers: async (params: ListParams = {}): Promise<PaginatedResponse<AdminUser>> => {
    const response = await api.get('/admin/users', { params })
    return response.data
  },

  banUser: async (userId: number, reason?: string): Promise<void> => {
    await api.post(`/admin/users/${userId}/ban`, { reason })
  },

  unbanUser: async (userId: number): Promise<void> => {
    await api.post(`/admin/users/${userId}/unban`)
  },

  getFeedbacks: async (params: ListParams = {}): Promise<PaginatedResponse<Feedback>> => {
    const response = await api.get('/admin/feedbacks', { params })
    return response.data
  },

  getAiRequestLogs: async (params: ListParams = {}): Promise<PaginatedResponse<AiRequestLog>> => {
    const response = await api.get('/admin/usage/logs', { params })
    return response.data
  }
}
