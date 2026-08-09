import { api } from '../lib/api'
import type { TestCategory } from '../types'

export interface CreateTestCategoryDto {
  name: string; code: string; displayOrder?: number; active?: boolean
}

export const testCategoryService = {
  getAll: async (): Promise<TestCategory[]> => {
    const { data } = await api.get('/test-categories')
    return Array.isArray(data) ? data : []
  },
  create: async (dto: CreateTestCategoryDto): Promise<TestCategory> => {
    const { data } = await api.post('/test-categories', dto); return data
  },
  update: async (id: number, dto: Partial<CreateTestCategoryDto>): Promise<TestCategory> => {
    const { data } = await api.patch(`/test-categories/${id}`, dto); return data
  },
  delete: async (id: number): Promise<void> => { await api.delete(`/test-categories/${id}`) },
  getArchived: async (): Promise<TestCategory[]> => {
    const { data } = await api.get('/test-categories/archived')
    return Array.isArray(data) ? data : []
  },
  restore: async (id: number): Promise<TestCategory> => {
    const { data } = await api.patch(`/test-categories/${id}/restore`)
    return data
  },
  permanentDelete: async (id: number): Promise<void> => { await api.delete(`/test-categories/${id}/permanent`) },
}
