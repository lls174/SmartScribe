import api from './api'
import type {
  AdminUser,
  AiCatalogModel,
  AiModelPrice,
  AiRequestLog,
  Feedback,
  PaginatedResponse,
  UsageSummary
} from '@app-types/index'

interface ListParams {
  page?: number
  limit?: number
  userId?: number
  platform?: string
  model?: string
  status?: string
  keySource?: string
  costFlag?: string
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
  },

  syncModels: async (): Promise<{ synced: number; failures: Array<{ platform: string; message: string }> }> => {
    const response = await api.post('/admin/models/sync', {}, { timeout: 60000 })
    return response.data
  },

  getModels: async (params: { capability?: string; platform?: string; enabled?: string } = {}): Promise<{ items: AiCatalogModel[] }> => {
    const response = await api.get('/admin/models', { params })
    return response.data
  },

  createModel: async (data: { platform: string; modelId: string; label?: string; description?: string; badge?: string }): Promise<AiCatalogModel> => {
    const response = await api.post('/admin/models', data)
    return response.data
  },

  updateModel: async (id: number, data: Partial<Pick<AiCatalogModel, 'enabled' | 'recommended' | 'label' | 'badge' | 'description' | 'capability'>>): Promise<AiCatalogModel> => {
    const response = await api.patch(`/admin/models/${id}`, data)
    return response.data
  },

  syncPrices: async (): Promise<{ updated: number; skippedManual: number; unmatched: number }> => {
    const response = await api.post('/admin/prices/sync', {}, { timeout: 60000 })
    return response.data
  },

  getPrices: async (): Promise<{ items: AiModelPrice[]; syncedAt: string | null }> => {
    const response = await api.get('/admin/prices')
    return response.data
  },

  getAiDefaults: async (): Promise<{ platform: string; model: string }> => {
    const response = await api.get('/admin/ai-defaults')
    return response.data
  },

  saveAiDefaults: async (data: { platform: string; model: string }): Promise<{ platform: string; model: string }> => {
    const response = await api.put('/admin/ai-defaults', data)
    return response.data
  },

  savePrice: async (data: {
    platform: string
    modelId: string
    inputPerMillion: string
    outputPerMillion: string
    cachedInputPerMillion?: string | null
    currency: 'CNY' | 'USD'
    notes?: string
  }): Promise<AiModelPrice> => {
    const response = await api.put('/admin/prices', data)
    return response.data
  }
}
