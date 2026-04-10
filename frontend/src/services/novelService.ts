﻿import api from './api'
import type { Novel, Chapter } from '@types/index'

export const novelService = {
  // 获取小说列表
  getNovels: async (): Promise<Novel[]> => {
    const response = await api.get('/novel')
    return response.data
  },

  // 创建小说
  createNovel: async (name: string, description: string): Promise<Novel> => {
    const response = await api.post('/novel', { name, description })
    return response.data
  },

  // 删除小说（假删除）
  deleteNovel: async (id: number): Promise<void> => {
    await api.delete(`/novel/${id}`)
  },

  // 获取已删除的小说列表
  getDeletedNovels: async (): Promise<Novel[]> => {
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
  getDeletedChapters: async (): Promise<Chapter[]> => {
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

  // 更新章节顺序
  updateChapterOrder: async (sourceChapterId: number, targetChapterId: number): Promise<void> => {
    await api.put('/novel/chapters/order', { sourceChapterId, targetChapterId })
  }
}
