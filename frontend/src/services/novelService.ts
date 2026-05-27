import api from './api'
import type { CharacterCard, Chapter, DeletedChapter, DeletedNovel, Novel, NovelSetting } from '@app-types/index'

export interface NovelVersion {
  id: number
  userId: number
  novelId: number
  label?: string | null
  snapshot: any
  createdAt: string
  updatedAt: string
}

export interface GenerationHistory {
  id: number
  userId: number
  novelId?: number | null
  chapterId?: number | null
  action: string
  prompt?: string | null
  params?: any
  result?: string | null
  createdAt: string
  updatedAt: string
}

export type CharacterCardPayload = Partial<Omit<CharacterCard, 'id' | 'novelId' | 'createdAt' | 'updatedAt'>>
export type NovelSettingPayload = Partial<Omit<NovelSetting, 'id' | 'novelId' | 'createdAt' | 'updatedAt'>>

export const novelService = {
  // 获取小说列表
  getNovels: async (): Promise<Novel[]> => {
    const response = await api.get('/novel')
    return response.data
  },

  // 获取小说详情
  getNovel: async (id: number): Promise<Novel> => {
    const response = await api.get(`/novel/${id}`)
    return response.data
  },

  // 创建小说
  createNovel: async (name: string, description: string): Promise<Novel> => {
    const response = await api.post('/novel', { name, description })
    return response.data
  },

  // 更新小说标题/简介
  updateNovel: async (id: number, data: { name?: string; description?: string }): Promise<Novel> => {
    const response = await api.put(`/novel/${id}`, data)
    return response.data
  },

  // 版本管理：创建版本
  createVersion: async (novelId: number, label?: string): Promise<NovelVersion> => {
    const response = await api.post(`/novel/${novelId}/versions`, { label })
    return response.data
  },

  // 版本管理：版本列表
  getVersions: async (novelId: number): Promise<NovelVersion[]> => {
    const response = await api.get(`/novel/${novelId}/versions`)
    return response.data
  },

  // 版本管理：版本详情
  getVersion: async (novelId: number, versionId: number): Promise<NovelVersion> => {
    const response = await api.get(`/novel/${novelId}/versions/${versionId}`)
    return response.data
  },

  // 版本管理：切换/恢复版本
  restoreVersion: async (novelId: number, versionId: number): Promise<void> => {
    await api.post(`/novel/${novelId}/versions/${versionId}/restore`)
  },

  // 生成历史：获取小说生成历史
  getGenerationHistory: async (novelId: number, page = 1, limit = 20): Promise<{ page: number; limit: number; total: number; histories: GenerationHistory[] }> => {
    const response = await api.get(`/novel/${novelId}/history?page=${page}&limit=${limit}`)
    return response.data
  },

  getCharacterCards: async (novelId: number): Promise<CharacterCard[]> => {
    const response = await api.get(`/novel/${novelId}/characters`)
    return response.data
  },

  createCharacterCard: async (novelId: number, data: CharacterCardPayload): Promise<CharacterCard> => {
    const response = await api.post(`/novel/${novelId}/characters`, data)
    return response.data
  },

  updateCharacterCard: async (novelId: number, cardId: number, data: CharacterCardPayload): Promise<CharacterCard> => {
    const response = await api.put(`/novel/${novelId}/characters/${cardId}`, data)
    return response.data
  },

  deleteCharacterCard: async (novelId: number, cardId: number): Promise<void> => {
    await api.delete(`/novel/${novelId}/characters/${cardId}`)
  },

  getNovelSetting: async (novelId: number): Promise<NovelSetting> => {
    const response = await api.get(`/novel/${novelId}/setting`)
    return response.data
  },

  updateNovelSetting: async (novelId: number, data: NovelSettingPayload): Promise<NovelSetting> => {
    const response = await api.put(`/novel/${novelId}/setting`, data)
    return response.data
  },

  // 删除小说（假删除）
  deleteNovel: async (id: number): Promise<void> => {
    await api.delete(`/novel/${id}`)
  },

  // 获取已删除的小说列表
  getDeletedNovels: async (): Promise<DeletedNovel[]> => {
    const response = await api.get('/novel/trash/novels')
    return response.data
  },

  // 恢复已删除的小说
  restoreNovel: async (id: number): Promise<void> => {
    await api.put(`/novel/trash/novels/${id}/restore`)
  },

  // 永久删除小说
  permanentDeleteNovel: async (id: number): Promise<void> => {
    await api.delete(`/novel/trash/novels/${id}/permanent`)
  },

  // 获取章节列表
  getChapters: async (novelId: number): Promise<Chapter[]> => {
    const response = await api.get(`/novel/${novelId}/chapters`)
    return response.data
  },

  // 创建章节
  createChapter: async (novelId: number, title: string, content: string, plot?: string): Promise<Chapter> => {
    const response = await api.post(`/novel/${novelId}/chapters`, { title, content, plot })
    return response.data
  },

  // 删除章节（假删除）
  deleteChapter: async (chapterId: number): Promise<void> => {
    await api.delete(`/novel/chapters/${chapterId}`)
  },

  // 获取已删除的章节列表
  getDeletedChapters: async (): Promise<DeletedChapter[]> => {
    const response = await api.get('/novel/trash/chapters')
    return response.data
  },

  // 恢复已删除的章节
  restoreChapter: async (chapterId: number): Promise<void> => {
    await api.put(`/novel/trash/chapters/${chapterId}/restore`)
  },

  // 永久删除章节
  permanentDeleteChapter: async (chapterId: number): Promise<void> => {
    await api.delete(`/novel/trash/chapters/${chapterId}/permanent`)
  },

  // 更新章节标题
  updateChapterTitle: async (chapterId: number, title: string): Promise<void> => {
    await api.put(`/novel/chapters/${chapterId}`, { title })
  },

  // 更新章节内容（用于润色覆盖）
  updateChapterContent: async (chapterId: number, content: string, plot?: string): Promise<Chapter> => {
    const response = await api.put(`/novel/chapters/${chapterId}`, { content, plot })
    return response.data.chapter
  },

  // 更新章节顺序
  updateChapterOrder: async (sourceChapterId: number, targetChapterId: number): Promise<void> => {
    await api.put('/novel/chapters/order', { sourceChapterId, targetChapterId })
  }
}
